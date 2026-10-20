// Map-based experimental controller; kept separate from neural training.
import { CONFIG } from './config.js';
import { clamp } from './math.js';

const angle = a => Math.atan2(Math.sin(a), Math.cos(a));

export function makeRacingLine(track, iterations = 600, margin = 14) {
  if (!Number.isInteger(iterations) || iterations < 0 || !Number.isFinite(margin) || margin < CONFIG.car.width / 2 || margin >= track.half) {
    throw new Error('Invalid path iterations or vehicle clearance.');
  }
  const x = Float64Array.from(track.cx), y = Float64Array.from(track.cy);
  const offset = new Float64Array(track.N), next = new Float64Array(track.N);
  // Relax the path toward straight chords, projecting back into a conservative
  // corridor. This can widen entries and shorten apexes, but is not a global
  // optimal-control solution or permission to leave the asphalt.
  for (let pass = 0; pass < iterations; pass++) {
    for (let i = 0; i < track.N; i++) {
      const p = track.wrap(i - 1), q = track.wrap(i + 1);
      const dx = (x[p] + x[q]) / 2 - x[i], dy = (y[p] + y[q]) / 2 - y[i];
      next[i] = clamp(offset[i] + 0.5 * (-track.ty[i] * dx + track.tx[i] * dy), -track.half + margin, track.half - margin);
    }
    offset.set(next);
    for (let i = 0; i < track.N; i++) {
      x[i] = track.cx[i] - track.ty[i] * offset[i];
      y[i] = track.cy[i] + track.tx[i] * offset[i];
    }
  }
  const curvature = new Float64Array(track.N), distance = new Float64Array(track.N);
  for (let i = 0; i < track.N; i++) {
    const p = track.wrap(i - 2), q = track.wrap(i + 2);
    const ax = x[i] - x[p], ay = y[i] - y[p], bx = x[q] - x[i], by = y[q] - y[i];
    curvature[i] = 2 * (ax * by - ay * bx) /
      Math.max(1e-6, Math.hypot(ax, ay) * Math.hypot(bx, by) * Math.hypot(ax + bx, ay + by));
    distance[i] = Math.hypot(x[track.wrap(i + 1)] - x[i], y[track.wrap(i + 1)] - y[i]);
  }
  return { x, y, curvature, distance, offset, iterations, margin };
}

export function makeSpeedProfile(line, lateralAcceleration, brakingAcceleration, maximum = CONFIG.car.maxSpeed) {
  if (![lateralAcceleration, brakingAcceleration, maximum].every(v => Number.isFinite(v) && v > 0)) throw new Error('Positive speed limits required.');
  const n = line.x.length;
  const speed = Float64Array.from(line.curvature, k => Math.min(maximum, Math.sqrt(lateralAcceleration / Math.max(1e-5, Math.abs(k)))));
  // Multiple cyclic backward passes propagate upcoming braking requirements
  // across the start line too. No future simulated car state is used.
  for (let pass = 0; pass < 3; pass++) for (let i = n - 1; i >= 0; i--) {
    speed[i] = Math.min(speed[i], Math.sqrt(speed[(i + 1) % n] ** 2 + 2 * brakingAcceleration * line.distance[i]));
  }
  return speed;
}

export class RacingLinePlanner {
  constructor(track, line, options) {
    if (options.firstLapSpeedScale !== undefined && (!Number.isFinite(options.firstLapSpeedScale) || options.firstLapSpeedScale <= 0 || options.firstLapSpeedScale > 1)) {
      throw new Error('First-lap speed scale must be greater than zero and at most one.');
    }
    this.track = track;
    this.line = line;
    this.options = options;
    this.speedProfile = makeSpeedProfile(line, options.lateralAcceleration, options.brakingAcceleration);
    this.car = null;
    this.output = new Float64Array(2);
  }
  forward() {
    const car = this.car, t = this.track, p = this.options;
    if (!car) throw new Error('Attach a car before driving.');
    // Find the nearby planned-line point, rather than assuming centerline index
    // and planned-line arc length are identical on a clipped apex.
    let index = car.idx, nearest = Infinity;
    for (let d = -5; d <= 8; d++) {
      const i = t.wrap(car.idx + d), distance = (car.x - this.line.x[i]) ** 2 + (car.y - this.line.y[i]) ** 2;
      if (distance < nearest) { nearest = distance; index = i; }
    }
    const lookahead = Math.max(28, car.speed * p.lookaheadTime);
    let target = index, travelled = 0;
    while (travelled < lookahead && travelled < t.N * t.spacing) {
      travelled += this.line.distance[target]; target = t.wrap(target + 1);
    }
    const dx = this.line.x[target] - car.x, dy = this.line.y[target] - car.y;
    const velocityHeading = car.speed > 10 ? Math.atan2(car.vy, car.vx) : car.angle;
    const alpha = angle(Math.atan2(dy, dx) - velocityHeading);
    const yaw = 2 * car.speed * Math.sin(alpha) / Math.max(20, Math.hypot(dx, dy));
    const slip = angle(velocityHeading - car.angle);
    const tractionEstimate = CONFIG.car.tireGrip * 0.75;
    const yawCommand = yaw + p.headingGain * (slip + yaw / tractionEstimate);
    const authority = CONFIG.car.turnRate * Math.min(1, Math.max(car.speed, 10) / CONFIG.car.minTurnSpeed) /
      (1 + Math.max(0, car.speed - 90) * 0.0036);
    this.output[0] = clamp(yawCommand / authority, -1, 1);
    // A staggered grid begins away from the steady-state racing line. Apply a
    // configurable launch-lap margin; subsequent laps use the original plan.
    const targetSpeed = this.speedProfile[index] * (car.laps === 0 ? p.firstLapSpeedScale ?? 1 : 1);
    const error = targetSpeed - car.speed;
    this.output[1] = clamp(error * p.pedalGain, -p.brakeCap, 1);
    return this.output;
  }
}
