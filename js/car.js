import { CONFIG } from './config.js';
import { clamp } from './math.js';
import { CrashApproachRecorder, analyzeApproach } from './crashApproach.js';

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
    this.carIndex = 0;
    this.carNumber = 1;
    this.teamIdx = 0;
    this.rayDist = new Float32Array(RAY_ANGLES.length);
    this.inputs = new Float32Array(RAY_ANGLES.length + 1);
    this.rayWindow = Math.ceil(CONFIG.sensors.length / track.spacing) + 3;
    this.collisionAlwaysOn = false;
    this.reset(gridSlot);
  }

  reset(gridSlot = this.gridSlot || 0) {
    const t = this.track;
    this.gridSlot = gridSlot;

    // Position car based on Grid Box setting: staggered 2x2 F1 grid formation vs single centerline
    const useGrid = Boolean(CONFIG.gridBox ?? true);
    let distBack = 16;
    let latOffset = 0;

    if (useGrid) {
      const row = Math.floor(gridSlot / 2);
      const col = gridSlot % 2; // 0 = inside/pole, 1 = outside
      // Generous F1 row spacing (34 units) and stagger (17 units) so 26-unit cars have clean clearance without touching
      distBack = 20 + row * 34 + (col === 1 ? 17 : 0);
      latOffset = (col === 0 ? -1 : 1) * ((t.width || 84) * 0.22);
    }

    const sampleIdx = t.wrap(Math.round(t.N - distBack / t.spacing));
    const tx = t.tx[sampleIdx];
    const ty = t.ty[sampleIdx];
    const nx = -ty;
    const ny = tx;

    this.x = t.cx[sampleIdx] + nx * latOffset;
    this.y = t.cy[sampleIdx] + ny * latOffset;
    this.angle = Math.atan2(ty, tx);
    this.previousX = this.x;
    this.previousY = this.y;
    this.previousAngle = this.angle;
    this.beforePreviousX = this.x;
    this.beforePreviousY = this.y;
    this.beforePreviousAngle = this.angle;
    this.idx = sampleIdx;
    this.totalIdx = sampleIdx - t.N; // Passing finish line index 0 brings totalIdx to 0
    this.maxIdx = this.totalIdx;
    this.vx = 0;
    this.vy = 0;
    this.slipAngle = 0;
    this.wheelSpin = 0;
    this.brakeLock = 0;
    this.contacts = 0;
    this.lastCarContactTime = null;
    this.crashDiagnostic = null;
    if (!this.crashApproach) this.crashApproach = new CrashApproachRecorder();
    else this.crashApproach.reset();
    this.collisionPenalty = 0;
    this.offTrackTimer = 0;
    this.offTrackPenalty = 0;
    this.speed = 0;
    this.topSpeed = 0;
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
    this.wrongWayRecoveryActive = false;
    this.runoffRecoveryActive = false;
    this.recoveryTurnDirection = 0;
    this.laps = 0;
    this.lapTimes = [];
    this.lapStart = 0;
    this.currentLapSamples = [];
    this.firstLapGhostStart = null;
    this.lastLapSamples = [];
    this.bestLapSamples = [];
    this._sampleTimer = 0;
    this.time = 0;
    this.stall = 0;
    this.sense();
  }

  sense(otherCars = null) {
    const t = this.track;
    const L = CONFIG.sensors.length;
    const colConfig = CONFIG.collision || {};
    const warmup = colConfig.warmupTime ?? 30;
    const leadTime = colConfig.separationLeadTime ?? 4;
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
        if (!oc || oc === this || (!oc.alive && !oc.finished) || oc.crashed) continue;
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

  die(reason, crashCause = 'unknown') {
    if (reason === 'finished') {
      this.finished = true;
      this.finishTime = this.time;
      this.deathReason = 'finished';
      this.throttle = this.targetThrottle = 0;
      this.steer = this.targetSteer = 0;
      this.wheelSpin = this.brakeLock = 0;
      return;
    }
    if (reason === 'crash' && !this.crashed) {
      const index = this.track.nearestIndex(this.x, this.y, this.idx);
      this.crashDiagnostic = {
        x: this.x, y: this.y, speed: this.speed, progress: index / this.track.N,
        lap: this.laps + 1, cause: crashCause,
        recentContact: Number.isFinite(this.lastCarContactTime) && this.time - this.lastCarContactTime <= 1,
      };
      if (index / this.track.N < 1 / 12) {
        this.crashApproach.record(this, true);
        const approach = this.crashApproach.snapshot(this.time);
        this.crashDiagnostic.approach = approach;
        this.crashDiagnostic.approachSummary = analyzeApproach(approach, this.time, CONFIG.generation.startDelay || 2, this.laps + 1);
      }
    }
    this.crashed = true;
    this.deathReason = reason;
    this.deathTimer = reason === 'crash' ? 3.0 : 0.8; // 3.0 seconds off-track continuation before removal
    this.spinRate = (Math.random() - 0.5) * 3.4;
  }

  update(dt, controls = null) {
    if (!this.alive && !this.finished) return;
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

    // Enter recovery beyond 72 degrees, but remain in recovery until aligned
    // within 54 degrees. A single threshold flips between braking and recovery
    // every tick when a sliding car straddles that heading in a tight corner.
    const headingError = Math.abs(headingDiff);
    const isWrongWay = this.wrongWayRecoveryActive
      ? headingError > Math.PI * 0.30
      : headingError > Math.PI * 0.40;
    if (isWrongWay && !this.wrongWayRecoveryActive) {
      this.recoveryTurnDirection = Math.sign(headingDiff) || 1;
    }
    this.wrongWayRecoveryActive = isWrongWay;
    if (!isWrongWay) this.recoveryTurnDirection = 0;

    // If car has crossed finish line: smooth F1 in-lap cooldown cruise around the track
    if (this.finished) {
      this.throttle = this.targetThrottle = 0;
      this.wheelSpin = this.brakeLock = this.slipAngle = 0;
      const targetCooldownSpeed = 130; // ~25% of top speed: smooth in-lap parade/cooldown pace

      if (this.speed > targetCooldownSpeed) {
        // Smooth progressive throttle lift-off & gentle engine braking (no sudden slamming of brakes)
        const decel = Math.min(220, (this.speed - targetCooldownSpeed) * 1.5 + 35);
        this.speed = Math.max(targetCooldownSpeed, this.speed - decel * dt);
      } else if (this.speed < targetCooldownSpeed * 0.90) {
        // Gently feed throttle to maintain the relaxing cooldown cruise speed
        this.speed = Math.min(targetCooldownSpeed, this.speed + 80 * dt);
      }

      // Smooth track centerline guidance: gracefully follow track curvature through all turns
      const cx = (t.cx && t.cx[this.idx] !== undefined) ? t.cx[this.idx] : this.x;
      const cy = (t.cy && t.cy[this.idx] !== undefined) ? t.cy[this.idx] : this.y;
      const tx = (t.tx && t.tx[this.idx] !== undefined) ? t.tx[this.idx] : 1;
      const ty = (t.ty && t.ty[this.idx] !== undefined) ? t.ty[this.idx] : 0;
      const nx = -ty;
      const ny = tx;
      const lateralDist = (this.x - cx) * nx + (this.y - cy) * ny;
      // Proportional correction to glide smoothly down the middle of the track
      const centerCorrection = Math.max(-0.55, Math.min(0.55, -lateralDist * 0.04));
      const desiredHeading = targetHeading + centerCorrection;

      let diff = desiredHeading - this.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      this.angle += diff * Math.min(1.0, 5.0 * dt);

      this.vx = Math.cos(this.angle) * this.speed;
      this.vy = Math.sin(this.angle) * this.speed;
      this.x += this.vx * dt;
      this.y += this.vy * dt;
      this.idx = t.nearestIndex(this.x, this.y, this.idx);
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
      this.crashApproach.record(this);
      this.sense();
      return;
    }

    // Unrestricted Direct Input: 100% instant 60Hz per-tick response for steering, throttle & brake
    if (controls) {
      this.runoffRecoveryActive = false;
      this.steer = clamp(controls.steer, -1, 1);
      this.throttle = clamp(controls.throttle, -1, 1);
    } else if (this.brain) {
      if (isWrongWay) {
        this.runoffRecoveryActive = false;
        // Car is pointed in the wrong direction: actively turn around to face forward along the track!
        this.steer = this.recoveryTurnDirection;
        this.throttle = 0.8;
      } else {
        const out = this.brain.forward(this.inputs);
        this.steer = clamp(out[0], -1, 1);
        this.throttle = clamp(out[1], -1, 1);
        this.applyRunoffRecovery();
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

    // 2. Longitudinal acceleration, braking, launch wheelspin & brake lockups
    this.wheelSpin = 0;
    this.brakeLock = 0;

    if (this.throttle >= 0) {
      // Forward Acceleration with Launch Traction Limit & Wheelspin
      const requestedDrive = this.throttle * c.accel;
      // Mechanical tire grip at low speed (~195 units), plus aerodynamic downforce grip proportional to speed
      const maxDriveGrip = 195 + vFwd * 1.5;
      if (this.throttle > 0.55 && requestedDrive > maxDriveGrip) {
        // Rear tire wheelspin occurs!
        this.wheelSpin = Math.min(1.0, (requestedDrive - maxDriveGrip) / 140);
        // Kinetic sliding friction delivers ~88% of peak traction while tires spin
        const effectiveAcc = maxDriveGrip * 0.88;
        vFwd += effectiveAcc * dt;
      } else {
        vFwd += requestedDrive * dt;
      }
    } else {
      // Braking with Threshold Lockup Slip
      const requestedBrake = -this.throttle * c.brake;
      // Peak braking tire grip before lockup (increases with downforce)
      const maxBrakeGrip = 360 + vFwd * 1.6;
      if (requestedBrake > maxBrakeGrip) {
        // Tires lock up and scrub across the tarmac!
        this.brakeLock = Math.min(1.0, (requestedBrake - maxBrakeGrip) / 240);
        const effectiveBrake = maxBrakeGrip * 0.86;
        vFwd -= effectiveBrake * dt;
      } else {
        vFwd -= requestedBrake * dt;
      }
    }

    // Aerodynamic drag
    vFwd -= vFwd * c.drag * dt;
    vFwd = clamp(vFwd, 0, c.maxSpeed);

    // 3. Cornering & Speed-Scaled Steering Authority with Understeer / Lockup push
    const speedRackScale = 1.0 / (1.0 + Math.max(0, vFwd - 90) * 0.0036);
    // Hard brake lockup scrubs front steering authority (understeer lockup push)
    const lockupLoss = 1.0 - this.brakeLock * 0.42;
    // Aggressive high-speed steering lock causes front tire scrub / push (understeer)
    const highSpeedScrub = (Math.abs(this.steer) > 0.65 && vFwd > 120)
      ? 1.0 - (Math.abs(this.steer) - 0.65) * (c.understeerFactor * vFwd)
      : 1.0;
    const turnAuthority = Math.min(1.0, vFwd / c.minTurnSpeed) * speedRackScale * lockupLoss * Math.max(0.35, highSpeedScrub);
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

    // 5. Oversteer & Friction Circle Lateral Grip Coupling
    // Power oversteer: throttle combined with steering angle breaks rear traction
    const oversteerAmount = Math.abs(this.steer) > 0.08
      ? (c.oversteerFactor * Math.abs(this.throttle) * Math.abs(this.steer))
      : 0;
    // Friction circle penalty: high longitudinal demand (acceleration/wheelspin or hard braking) consumes lateral grip
    const longGripPenalty = (Math.abs(this.throttle) * 0.25) + (this.wheelSpin * 0.35) + (this.brakeLock * 0.30);
    const effectiveGrip = Math.max(0.18, 1.0 - oversteerAmount - longGripPenalty);
    const traction = c.tireGrip * effectiveGrip;
    const vLatFinal = vLatRot - vLatRot * traction * dt;

    // 6. Reconstruct world velocity
    cos = Math.cos(this.angle);
    sin = Math.sin(this.angle);
    this.vx = vFwdRot * cos - vLatFinal * sin;
    this.vy = vFwdRot * sin + vLatFinal * cos;
    this.speed = Math.hypot(this.vx, this.vy);
    this.topSpeed = Math.max(this.topSpeed, this.speed);
    this.slipAngle = Math.atan2(vLatFinal, Math.max(10, vFwdRot));

    this.x += this.vx * dt;
    this.y += this.vy * dt;

    // Record lap trajectory samples at ~25Hz for high-definition ghost replay
    if (this.alive && !this.crashed) {
      this._sampleTimer = (this._sampleTimer || 0) + dt;
      if (this._sampleTimer >= 0.04) {
        this._sampleTimer = 0;
        if (!this.currentLapSamples) this.currentLapSamples = [];
        this.currentLapSamples.push({
          t: this.time - this.lapStart,
          x: this.x,
          y: this.y,
          angle: this.angle,
          speed: this.speed,
        });
      }
    }

    // Progress along the track
    const ni = t.nearestIndex(this.x, this.y, this.idx);
    let d = ni - this.idx;
    if (d > t.N / 2) d -= t.N;
    else if (d < -t.N / 2) d += t.N;
    this.idx = ni;
    this.crashApproach.record(this);
    const previousTotalIdx = this.totalIdx;
    this.totalIdx += d;
    if (this.laps === 0 && previousTotalIdx < 0 && this.totalIdx >= 0) {
      this.firstLapGhostStart = { t: this.time - this.lapStart,
        x: this.x, y: this.y, angle: this.angle, speed: this.speed };
    }
    if (this.totalIdx > this.maxIdx) {
      this.maxIdx = this.totalIdx;
      this.stall = 0;
      if (this.maxIdx >= (this.laps + 1) * t.N) {
        this.laps++;
        const lapDuration = this.time - this.lapStart;
        this.lapTimes.push(lapDuration);
        const isBestLapForCar = this.lapTimes.length === 1 || lapDuration <= Math.min(...this.lapTimes);
        
        if (!this.currentLapSamples) this.currentLapSamples = [];
        this.currentLapSamples.push({
          t: lapDuration,
          x: this.x,
          y: this.y,
          angle: this.angle,
          speed: this.speed,
        });

        if (isBestLapForCar && this.currentLapSamples.length > 5) {
          this.bestLapSamples = [...this.currentLapSamples];
        }
        this.lastLapSamples = [...this.currentLapSamples];
        const completedSamples = this.lastLapSamples;
        this.currentLapSamples = [];
        this.lapStart = this.time;

        this.currentLapSamples.push({
          t: 0,
          x: this.x,
          y: this.y,
          angle: this.angle,
          speed: this.speed,
        });

        this.onLapComplete?.(this, lapDuration, completedSamples);
        if (this.laps >= g.maxLaps) {
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
      this.die('crash', 'off-track');
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
        this.die('crash', 'runoff');
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

  applyRunoffRecovery() {
    // A braking policy can strand itself in the grass: at rest it has no
    // steering authority. Only assist an already slow, braking AI outside the
    // curb. Keep the normal runoff deadline, drag and hard boundary intact.
    if (this.manual || !this.brain || this.finished || this.crashed ||
        this.wrongWayRecoveryActive || this.speed > 90) {
      this.runoffRecoveryActive = false;
      return;
    }
    const cos = Math.cos(this.angle), sin = Math.sin(this.angle);
    if (this.runoffRecoveryActive) {
      // Release inside the curb with a small margin so the controller does not
      // alternate with the network while the rear wheels are still on grass.
      if (!this.isOffTrack(cos, sin, -2)) this.runoffRecoveryActive = false;
    } else if (this.offTrackTimer >= 0.35 && this.speed < 45 && this.throttle < -0.1 &&
               this.isOffTrack(cos, sin) && !this.isDeepOffTrack(cos, sin)) {
      this.runoffRecoveryActive = true;
    }
    if (!this.runoffRecoveryActive) return;
    const t = this.track;
    const lookahead = t.wrap(this.idx + Math.ceil(45 / t.spacing));
    const desired = Math.atan2(t.cy[lookahead] - this.y, t.cx[lookahead] - this.x);
    const error = Math.atan2(Math.sin(desired - this.angle), Math.cos(desired - this.angle));
    this.steer = clamp(error * 1.8, -1, 1);
    this.throttle = clamp((55 - this.speed) * 0.04, -0.25, 0.55);
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
    const raceTime = this.finished && Number.isFinite(this.finishTime) ? this.finishTime : this.time;

    // 1. Distance Progress along track
    let s = this.maxIdx * this.track.spacing;

    // 2. Continuous Average Speed Pace Reward (rewards sustained high velocity)
    const avgSpeed = (this.maxIdx * this.track.spacing) / Math.max(1, raceTime);
    s += avgSpeed * 7.5;

    // 3. Lap Completion Bonus
    s += this.laps * (f.lapBonus || 4500);

    // 4. Lap Speed Multiplier (exponentially rewards fast lap times to break through conservative plateaus)
    for (const lt of this.lapTimes) {
      if (lt > 0) {
        const target = f.targetLapTime || 8.54;
        const speedRatio = Math.max(0.5, target / lt);
        s += (f.lapBonus || 4500) * Math.pow(speedRatio, 3.2);

        // Sub-9.4s Hot-Lap Breakthrough Bonus: heavily rewards pushing towards the 8.54s record
        if (lt < 9.4) {
          const paceDelta = Math.max(0, 9.4 - lt);
          s += Math.pow(paceDelta * 4.5, 2.2) * 1800;
        }
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
      const timeRemaining = Math.max(0, (g.timeLimit || 85) - raceTime);
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
    if (this.lapTimes.length) return Math.min(...this.lapTimes);
    return Number.isFinite(this._initialBestLap) ? this._initialBestLap : Infinity;
  }

  set bestLap(val) {
    this._initialBestLap = val;
  }

  /** 0..1 progress within the current lap. */
  get lapProgress() {
    const N = this.track.N;
    return (((this.maxIdx % N) + N) % N) / N;
  }
}
