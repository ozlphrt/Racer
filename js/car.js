import { CONFIG } from './config.js';
import { clamp } from './math.js';

export const RAY_ANGLES = CONFIG.sensors.angles.map((a) => (a * Math.PI) / 180);

/**
 * Arcade car. Driven either by a NeuralNetwork brain or by manual controls.
 * Inputs for the next decision are computed at the end of each update so the
 * rendered rays always match the rendered position.
 */
export class Car {
  constructor(track, brain = null, gridSlot = 0) {
    this.track = track;
    this.brain = brain;
    this.manual = !brain;
    this.gridSlot = gridSlot;
    this.rayDist = new Float32Array(RAY_ANGLES.length);
    this.inputs = new Float32Array(RAY_ANGLES.length + 1);
    this.rayWindow = Math.ceil(CONFIG.sensors.length / track.spacing) + 3;
    this.collisionAlwaysOn = false;
    this.reset(gridSlot);
  }

  reset(gridSlot = this.gridSlot || 0) {
    const t = this.track;
    this.gridSlot = gridSlot;

    // All cars spawn at the exact same starting spot on the track centerline
    const distBack = 16;
    const latOffset = 0;

    const sampleIdx = t.wrap(Math.round(t.N - distBack / t.spacing));
    const tx = t.tx[sampleIdx];
    const ty = t.ty[sampleIdx];
    const nx = -ty;
    const ny = tx;

    this.x = t.cx[sampleIdx] + nx * latOffset;
    this.y = t.cy[sampleIdx] + ny * latOffset;
    this.angle = Math.atan2(ty, tx);
    this.idx = sampleIdx;
    this.totalIdx = sampleIdx - t.N; // Passing finish line index 0 brings totalIdx to 0
    this.maxIdx = this.totalIdx;
    this.vx = 0;
    this.vy = 0;
    this.slipAngle = 0;
    this.contacts = 0;
    this.collisionPenalty = 0;
    this.offTrackTimer = 0;
    this.offTrackPenalty = 0;
    this.speed = 0;
    this.steer = 0;
    this.targetSteer = 0;
    this.throttle = 0;
    this.targetThrottle = 0;
    this.launchDelay = 0;
    this.driverBias = 0;
    this.decisionTimer = 0;
    this.decisionInterval = 0; // Full 60Hz per-tick real-time decision rate
    this.alive = true;
    this.crashed = false;
    this.finished = false;
    this.finishTime = null;
    this.finishTimer = 0;
    this.deathReason = null;
    this.deathTimer = 0;
    this.spinRate = 0;
    this.yawRate = 0;
    this.laps = 0;
    this.lapTimes = [];
    this.lapStart = 0;
    this.time = 0;
    this.stall = 0;
    this.sense();
  }

  sense(otherCars = null) {
    const t = this.track;
    const L = CONFIG.sensors.length;
    const colConfig = CONFIG.collision || {};
    const warmup = colConfig.warmupTime || 30;
    const leadTime = colConfig.separationLeadTime || 25;
    const colEnabled = Boolean(colConfig.enabled) && (this.time >= (warmup - leadTime));
    const colRad = colConfig.radius || 13.5;
    const colRadSq = colRad * colRad;
    const maxRange = L + colRad;
    const maxRangeSq = maxRange * maxRange;

    // Fast pre-filter of candidate opponent cars within sensor radius (only when collisions are enabled)
    if (!this._nearby) this._nearby = [];
    this._nearby.length = 0;
    const nearby = this._nearby;
    if (colEnabled && otherCars && otherCars.length > 0) {
      const ox = this.x;
      const oy = this.y;
      for (let i = 0; i < otherCars.length; i++) {
        const oc = otherCars[i];
        if (!oc || oc === this || !oc.alive || oc.crashed) continue;
        const rx = oc.x - ox;
        const ry = oc.y - oy;
        if (Math.abs(rx) <= maxRange && Math.abs(ry) <= maxRange && rx * rx + ry * ry <= maxRangeSq) {
          nearby.push(rx, ry);
        }
      }
    }

    for (let r = 0; r < RAY_ANGLES.length; r++) {
      const a = this.angle + RAY_ANGLES[r];
      const dx = Math.cos(a);
      const dy = Math.sin(a);

      const dWall = t.castRay(this.x, this.y, dx, dy, L, this.idx, this.rayWindow);
      let dOpponent = L;

      // Raycast against opponent cars when collision/sensing is active
      if (colEnabled && nearby && nearby.length > 0) {
        for (let i = 0; i < nearby.length; i += 2) {
          const rx = nearby[i];
          const ry = nearby[i + 1];
          const tProj = rx * dx + ry * dy;
          if (tProj > 0 && tProj < dOpponent) {
            const dPerpSq = (rx * rx + ry * ry) - (tProj * tProj);
            if (dPerpSq <= colRadSq) {
              const dHit = tProj - Math.sqrt(colRadSq - dPerpSq);
              if (dHit > 0 && dHit < dOpponent) {
                dOpponent = dHit;
              }
            }
          }
        }
      }

      this.rayDist[r] = Math.min(dWall, dOpponent);

      // Soft Vision Blending: Preserve track curve vision while smoothly introducing traffic proximity
      const wallSignal = 1 - dWall / L;
      const oppSignal = dOpponent < L ? (1 - dOpponent / L) * 0.70 : 0;
      this.inputs[r] = Math.max(wallSignal, oppSignal);
    }

    const targetHeading = Math.atan2(t.ty[this.idx] || 0, t.tx[this.idx] || 1);
    let diff = targetHeading - this.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.headingDiff = diff;

    const forwardFactor = Math.cos(diff);
    this.inputs[RAY_ANGLES.length] = (this.speed / CONFIG.car.maxSpeed) * Math.max(-1, Math.min(1, forwardFactor));
  }

  die(reason) {
    if (reason === 'finished') {
      this.finished = true;
      this.finishTime = this.time;
      this.deathReason = 'finished';
      this.finishTimer = 2.8; // Cruise forward past the checkered line for 2.8s
      return;
    }
    this.crashed = true;
    this.deathReason = reason;
    this.deathTimer = reason === 'crash' ? 3.0 : 0.8; // 3.0 seconds off-track continuation before removal
    this.spinRate = (Math.random() - 0.5) * 3.4;
  }

  update(dt, controls = null) {
    if (!this.alive) return;
    const c = CONFIG.car;
    const g = CONFIG.generation;
    const t = this.track;
    this.time += dt;

    // Track forward orientation & wrong-way detection
    const targetHeading = Math.atan2(t.ty[this.idx] || 0, t.tx[this.idx] || 1);
    let headingDiff = targetHeading - this.angle;
    while (headingDiff > Math.PI) headingDiff -= Math.PI * 2;
    while (headingDiff < -Math.PI) headingDiff += Math.PI * 2;
    this.headingDiff = headingDiff;

    // A car is heading in the wrong way if angled > 72° (0.40π rad) away from forward track tangent
    const isWrongWay = Math.abs(headingDiff) > Math.PI * 0.40;

    // If car has crossed finish line: smooth celebration cooldown cruise along track (NO explosion)
    if (this.finished) {
      this.finishTimer -= dt;
      this.speed = Math.max(70, this.speed - (this.speed * 0.7 + 35) * dt);
      let diff = targetHeading - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += diff * Math.min(1, 4.0 * dt);
      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.idx = t.nearestIndex(this.x, this.y, this.idx);
      if (this.finishTimer <= 0) {
        this.alive = false; // Clean retirement without explosion
      }
      return;
    }

    // If car has gone off-track: slide into the grass runoff with realistic deceleration for 3.0s before removal
    if (this.crashed) {
      this.deathTimer -= dt;
      this.speed = Math.max(0, this.speed - (this.speed * 0.36 + 12) * dt);
      this.angle += this.spinRate * dt;
      this.x += Math.cos(this.angle) * this.speed * dt;
      this.y += Math.sin(this.angle) * this.speed * dt;
      if (this.deathTimer <= 0) {
        this.alive = false; // Triggers explosion out on the grass after full 3.0s off-track slide
      }
      return;
    }

    // Start grid countdown delay: hold cars stationary until green light launch
    const startDelay = CONFIG.generation?.startDelay || 2.0;
    if (this.time < startDelay) {
      this.speed = 0;
      this.vx = 0;
      this.vy = 0;
      this.throttle = 0;
      this.steer = 0;
      this.targetThrottle = 0;
      this.targetSteer = 0;
      this.sense();
      return;
    }

    // Unrestricted Direct Input: 100% instant 60Hz per-tick response for steering, throttle & brake
    if (controls) {
      this.steer = clamp(controls.steer, -1, 1);
      this.throttle = clamp(controls.throttle, -1, 1);
    } else if (this.brain) {
      if (isWrongWay) {
        // Car is pointed in the wrong direction: actively turn around to face forward along the track!
        const turnDir = Math.sign(headingDiff) || 1;
        this.steer = turnDir;
        this.throttle = 0.8;
      } else {
        const out = this.brain.forward(this.inputs);
        this.steer = clamp(out[0], -1, 1);
        this.throttle = clamp(out[1], -1, 1);
      }
    }
    this.targetSteer = this.steer;
    this.targetThrottle = this.throttle;

    // --- Dynamic Bicycle Slip Physics (Understeer / Oversteer & Tire Grip) ---
    // 1. Decompose current velocity into body frame
    let cos = Math.cos(this.angle);
    let sin = Math.sin(this.angle);
    let vFwd = this.vx * cos + this.vy * sin;
    let vLat = -this.vx * sin + this.vy * cos;

    // 2. Longitudinal acceleration, braking & aerodynamic drag
    const aLong = this.throttle * (this.throttle >= 0 ? c.accel : c.brake);
    vFwd += aLong * dt;
    vFwd -= vFwd * c.drag * dt;
    vFwd = clamp(vFwd, 0, c.maxSpeed);

    // 3. Cornering & Speed-Scaled Steering Authority (high speed stabilizes rack, low speed retains full hairpin agility)
    const speedRackScale = 1.0 / (1.0 + Math.max(0, vFwd - 90) * 0.0036);
    const turnAuthority = Math.min(1.0, vFwd / c.minTurnSpeed) * speedRackScale;
    let dAngle = this.steer * c.turnRate * turnAuthority * dt;

    // Apply & damp dynamic impact yaw rate (restorative tire self-aligning moment)
    if (this.yawRate) {
      dAngle += this.yawRate * dt;
      this.yawRate *= Math.exp(-c.tireGrip * dt * 2.6);
      if (Math.abs(this.yawRate) < 0.001) this.yawRate = 0;
    }
    this.angle += dAngle;

    // 4. Rotate velocity vector into new body orientation
    const cosD = Math.cos(dAngle);
    const sinD = Math.sin(dAngle);
    const vFwdRot = vFwd * cosD + vLat * sinD;
    const vLatRot = -vFwd * sinD + vLat * cosD;

    // 5. Oversteer & Tire Lateral Friction (rock-solid straight line grip, progressive slip in hard corners)
    const oversteerAmount = Math.abs(this.steer) > 0.12 ? c.oversteerFactor * Math.abs(this.throttle) * Math.abs(this.steer) : 0;
    const traction = c.tireGrip * Math.max(0.65, 1.0 - oversteerAmount);
    const vLatFinal = vLatRot - vLatRot * traction * dt;

    // 6. Reconstruct world velocity
    cos = Math.cos(this.angle);
    sin = Math.sin(this.angle);
    this.vx = vFwdRot * cos - vLatFinal * sin;
    this.vy = vFwdRot * sin + vLatFinal * cos;
    this.speed = Math.hypot(this.vx, this.vy);
    this.slipAngle = Math.atan2(vLatFinal, Math.max(10, vFwdRot));

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Progress along the track
    const ni = t.nearestIndex(this.x, this.y, this.idx);
    let d = ni - this.idx;
    if (d > t.N / 2) d -= t.N;
    else if (d < -t.N / 2) d += t.N;
    this.idx = ni;
    this.totalIdx += d;
    if (this.totalIdx > this.maxIdx) {
      this.maxIdx = this.totalIdx;
      this.stall = 0;
      if (this.maxIdx >= (this.laps + 1) * t.N) {
        this.laps++;
        this.lapTimes.push(this.time - this.lapStart);
        this.lapStart = this.time;
        if (!this.manual && this.laps >= g.maxLaps) {
          this.finished = true;
          this.die('finished');
          return;
        }
      }
    } else if (!isWrongWay) {
      this.stall += dt;
    }

    // Wall & Runoff collision handling:
    if (this.isDeepOffTrack(cos, sin)) {
      this.die('crash');
      return;
    } else if (this.isOffTrack(cos, sin)) {
      // In grass runoff zone: apply tire drag deceleration, off-track penalty, and recovery timer
      this.offTrackTimer += dt;
      this.offTrackPenalty += 140 * dt;
      const grassDrag = Math.max(0, 1 - 2.8 * dt);
      this.vx *= grassDrag;
      this.vy *= grassDrag;
      this.speed = Math.hypot(this.vx, this.vy);
      if (this.offTrackTimer > 1.8) {
        this.die('crash');
        return;
      }
    } else if (this.offTrackTimer > 0) {
      // Recovered safely back onto tarmac / curb
      this.offTrackTimer = Math.max(0, this.offTrackTimer - 2.5 * dt);
    }

    if (!this.manual) {
      const gracePeriod = g.startGracePeriod || 5.0;
      if (this.time > gracePeriod) {
        if (this.stall > (g.stallTime || 6.0)) return this.die('stalled');
        if (this.totalIdx < this.maxIdx - (g.backwardsTolerance || 80) && !isWrongWay) return this.die('wrong way');
      }
    }
  }

  isOffTrack(cos, sin, extraBuffer = 0) {
    const hl = CONFIG.car.length / 2;
    const hw = CONFIG.car.width / 2;
    // Small buffer on launch frame to prevent rear grid row corner false clipping
    const safetyBuffer = this.time < 1.2 ? 5.0 : 0.0;
    const curbBuffer = 7.5; // Curb / rumble strip tolerance
    const halfWidth = this.track.half + safetyBuffer + curbBuffer + extraBuffer;
    const lim = halfWidth * halfWidth;

    for (let sx = -1; sx <= 1; sx += 2) {
      for (let sy = -1; sy <= 1; sy += 2) {
        const px = this.x + cos * hl * sx - sin * hw * sy;
        const py = this.y + sin * hl * sx + cos * hw * sy;
        if (this.track.lateralDistSq(px, py, this.idx) > lim) return true;
      }
    }
    return false;
  }

  isDeepOffTrack(cos, sin) {
    // 16px past the curb (23.5px beyond asphalt white line) hits the outer barrier
    return this.isOffTrack(cos, sin, 16.0);
  }

  get fitness() {
    const f = CONFIG.fitness;
    const g = CONFIG.generation;

    // 1. Distance Progress along track
    let s = this.maxIdx * this.track.spacing;

    // 2. Continuous Average Speed Pace Reward (rewards sustained high velocity)
    const avgSpeed = (this.maxIdx * this.track.spacing) / Math.max(1, this.time);
    s += avgSpeed * 7.5;

    // 3. Lap Completion Bonus
    s += this.laps * (f.lapBonus || 4500);

    // 4. Lap Speed Multiplier (exponentially rewards fast lap times)
    for (const lt of this.lapTimes) {
      if (lt > 0) {
        const speedRatio = (f.targetLapTime || 10.0) / lt;
        s += (f.lapBonus || 4500) * Math.pow(speedRatio, 1.35);
      }
    }

    // 5. Lap Consistency Bonus (rewards reproducing fast, reliable lap times across consecutive laps)
    if (this.lapTimes.length >= 2) {
      let sumLap = 0;
      for (const lt of this.lapTimes) sumLap += lt;
      const meanLap = sumLap / this.lapTimes.length;
      let varSum = 0;
      for (const lt of this.lapTimes) varSum += Math.abs(lt - meanLap);
      const avgDev = varSum / this.lapTimes.length;
      const consistencyBonus = Math.max(0, 2200 - avgDev * 1400);
      s += consistencyBonus;
    }

    // 6. Full 5-Lap Race Finish Bonus + Time-Remaining Speed Multiplier
    if (this.finished || this.laps >= (g.maxLaps || 5)) {
      s += f.fullRaceBonus || 30000;
      // High speed reward for completing the entire 5 laps quickly
      const timeRemaining = Math.max(0, (g.timeLimit || 85) - this.time);
      s += timeRemaining * 200;
    }

    // 7. Clean Driving & Collision Avoidance Reward / Penalty
    if (this.contacts === 0 && this.laps > 0) {
      s += (f.cleanRaceBonus || 3500) * Math.min(1.0, this.laps / (g.maxLaps || 5));
    } else {
      const contactDeduction = (this.collisionPenalty || 0) + (this.contacts * (f.contactPenalty || 50));
      s -= Math.min(s * 0.45, contactDeduction); // Meaningful collision penalty while preserving forward drive
    }

    // 8. Grass Runoff penalty
    if (this.offTrackPenalty > 0) {
      s -= Math.min(s * 0.40, this.offTrackPenalty);
    }

    // 9. Wall crash penalty (strict penalty for going deep off-track)
    if (this.crashed) {
      s -= f.crashPenalty || 600;
    }

    return Math.max(0, s);
  }

  get bestLap() {
    return this.lapTimes.length ? Math.min(...this.lapTimes) : Infinity;
  }

  /** 0..1 progress within the current lap. */
  get lapProgress() {
    const N = this.track.N;
    return (((this.maxIdx % N) + N) % N) / N;
  }
}
