// Bounded 10 Hz recorder: time, speed, throttle/brake, steering, heading error,
// sideways slip, recovery active, lateral position in track half-widths.
export class CrashApproachRecorder {
  constructor() { this.data = new Float64Array(22 * 8); this.reset(); }
  reset() { this.next = 0; this.count = 0; this.lastTime = -Infinity; }
  record(car, force = false) {
    if (!force && car.time - this.lastTime < 0.1 - 1e-6) return;
    // Replace the most recent sample when a crash falls on a sampling tick.
    const replace = force && this.count && car.time - this.lastTime < 0.02;
    const slot = replace ? (this.next + 21) % 22 : this.next;
    const offset = slot * 8, track = car.track, index = car.idx;
    const target = Math.atan2(track.ty[index], track.tx[index]);
    const heading = Math.atan2(Math.sin(target - car.angle), Math.cos(target - car.angle));
    const lateral = ((car.x - track.cx[index]) * -track.ty[index] + (car.y - track.cy[index]) * track.tx[index]) / track.half;
    const values = this.data;
    values[offset] = car.time; values[offset + 1] = car.speed;
    values[offset + 2] = car.throttle; values[offset + 3] = car.steer;
    values[offset + 4] = heading; values[offset + 5] = car.slipAngle;
    values[offset + 6] = car.wrongWayRecoveryActive || car.runoffRecoveryActive ? 1 : 0; values[offset + 7] = lateral;
    if (!replace) { this.next = (this.next + 1) % 22; this.count = Math.min(22, this.count + 1); }
    this.lastTime = car.time;
  }
  snapshot(time) {
    const rows = [];
    for (let i = 0; i < this.count; i++) {
      const slot = (this.next - this.count + i + 22) % 22;
      const offset = slot * 8;
      if (this.data[offset] < time - 2 - 1e-6) continue;
      const row = Array.from(this.data.subarray(offset, offset + 8));
      row[0] -= time;
      rows.push(row.map(value => Math.round(value * 1000) / 1000));
    }
    return rows;
  }
}

export const APPROACH_PATTERNS = {
  recovery: 'Recovery active', slide: 'Sustained slide', reversals: 'Steering reversals',
  unbraked: 'No braking before departure', launch: 'Early launch',
};

/** Observable, overlapping flags; these are not inferred crash causes or overspeed claims. */
export function analyzeApproach(samples, raceTime, startDelay, lap) {
  const valid = samples.filter(row => Array.isArray(row) && row.length === 8 && row.every(Number.isFinite) && row[0] >= -2.001 && row[0] <= 0);
  const duration = valid.length > 1 ? valid.at(-1)[0] - valid[0][0] : 0;
  if (duration < 0.5) return { duration, patterns: [], sufficient: false };
  let slideDuration = 0, longestSlide = 0, lastSign = 0, reversals = 0;
  for (let i = 0; i < valid.length; i++) {
    const row = valid[i];
    const dt = i ? Math.min(0.15, Math.max(0, row[0] - valid[i - 1][0])) : 0;
    slideDuration = Math.abs(row[5]) >= Math.PI / 12 ? slideDuration + dt : 0;
    longestSlide = Math.max(longestSlide, slideDuration);
    const sign = Math.abs(row[3]) >= 0.25 ? Math.sign(row[3]) : 0;
    if (sign && lastSign && sign !== lastSign) reversals++;
    if (sign) lastSign = sign;
  }
  const brakingWindow = valid.filter(row => row[0] <= -0.1 && row[0] >= -1);
  const patterns = [];
  if (valid.some(row => row[6] === 1)) patterns.push('recovery');
  if (longestSlide >= 0.3 - 1e-6) patterns.push('slide');
  if (reversals >= 3) patterns.push('reversals');
  if (brakingWindow.length >= 5 && brakingWindow.every(row => row[2] >= -0.1)) patterns.push('unbraked');
  if (lap === 1 && raceTime - startDelay <= 5) patterns.push('launch');
  return { duration: +duration.toFixed(2), patterns, sufficient: true,
    peakSpeed: Math.max(...valid.map(row => row[1])),
    peakHeading: Math.max(...valid.map(row => Math.abs(row[4]))),
    peakSlip: Math.max(...valid.map(row => Math.abs(row[5]))), reversals };
}

export function summarizeApproaches(crashes) {
  const s1 = crashes.filter(c => c.progress < 1 / 12);
  const recorded = s1.filter(c => c.approachSummary?.sufficient === true);
  const counts = Object.fromEntries(Object.keys(APPROACH_PATTERNS).map(key => [key, 0]));
  for (const crash of recorded) for (const key of new Set(crash.approachSummary.patterns)) if (Object.hasOwn(counts, key)) counts[key]++;
  const dominant = Object.keys(counts).sort((a, b) => counts[b] - counts[a])[0];
  const latest = [...s1].reverse().find(c => Array.isArray(c.approach) && c.approach.length >= 2);
  return { count: s1.length, recorded: recorded.length, counts, dominant: counts[dominant] ? dominant : null, latest };
}
