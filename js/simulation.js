import { Car } from './car.js';
import { NeuralNetwork } from './neuralNetwork.js';
import { evolve, seedPopulation } from './genetics.js';
import { TireBarrierSystem } from './tireBarriers.js';
import { audio } from './audio.js';

/** Runs generations of AI cars (plus an optional manual player car). DOM-free. */
export class Simulation {
  constructor(track, config) {
    this.track = track;
    this.config = config;
    this.layers = config.nn.layers;
    this.mutationRate = config.ga.mutationRate;

    this.onGeneration = null;
    this.onNewBest = null;
    this.onNewBestLap = null;

    this.player = null;
    this.playerControls = { steer: 0, throttle: 0 };
    this.playerBestLap = Infinity;
    this.deathEvents = [];

    this.mode = 'train'; // 'train' | 'race'
    this.collisionsAlwaysOn = true;

    this.tireBarriers = new TireBarrierSystem(track);

    this.reset();
  }

  get gaOptions() {
    const pop = this.mode === 'race' ? 20 : this.config.ga.population;
    return { ...this.config.ga, population: pop, mutationRate: this.mutationRate };
  }

  reset() {
    this.generation = 1;
    this.history = [];
    this.allTimeBest = null;
    this.bestLapEver = Infinity;
    this.deathEvents = [];
    const count = this.mode === 'race' ? 20 : this.config.ga.population;
    const genomes = Array.from({ length: count }, () =>
      NeuralNetwork.randomGenome(this.layers),
    );
    this.startGeneration(genomes);
  }

  getTopGenomes(count = 20) {
    const list = [];
    if (this.allTimeBest && this.allTimeBest.genome) {
      list.push(Float32Array.from(this.allTimeBest.genome));
    }
    if (this.cars && this.cars.length > 0) {
      const sorted = [...this.cars].sort((a, b) => b.fitness - a.fitness);
      for (const c of sorted) {
        if (list.length >= count) break;
        if (c.brain && c.brain.genome) {
          list.push(Float32Array.from(c.brain.genome));
        }
      }
    }
    if (list.length === 0) {
      while (list.length < count) {
        list.push(NeuralNetwork.randomGenome(this.layers));
      }
    } else {
      const baseLen = list.length;
      while (list.length < count) {
        const parent = list[(Math.random() * baseLen) | 0];
        const copy = Float32Array.from(parent);
        for (let i = 0; i < copy.length; i++) {
          if (Math.random() < 0.12) copy[i] += (Math.random() * 2 - 1) * 0.15;
        }
        list.push(copy);
      }
    }
    return list.slice(0, count);
  }

  setMode(mode) {
    if (mode === 'race') {
      this.mode = 'race';
      this.collisionsAlwaysOn = true;
      const raceGenomes = this.getTopGenomes(20);
      this.startGeneration(raceGenomes);
    } else {
      this.mode = 'train';
      this.collisionsAlwaysOn = false;
      const pop = this.config.ga.population;
      const trainGenomes = this.getTopGenomes(pop);
      this.startGeneration(trainGenomes);
    }
  }

  resumeState(savedState) {
    this.generation = Math.max(1, savedState.generation || 1);
    this.history = Array.isArray(savedState.history) ? [...savedState.history] : [];
    this.allTimeBest = savedState.allTimeBest || null;
    this.bestLapEver = savedState.bestLapEver ?? Infinity;
    this.deathEvents = [];
    if (typeof savedState.mutationRate === 'number') {
      this.mutationRate = savedState.mutationRate;
    }

    const pop = this.mode === 'race' ? 20 : this.config.ga.population;

    if (savedState.currentGenomes && savedState.currentGenomes.length === pop) {
      this.startGeneration(savedState.currentGenomes);
    } else if (savedState.currentGenomes && savedState.currentGenomes.length > 0) {
      const valid = savedState.currentGenomes;
      const genomes = [...valid];
      while (genomes.length < pop) {
        const parent = valid[(Math.random() * valid.length) | 0];
        const copy = Float32Array.from(parent);
        for (let i = 0; i < copy.length; i++) {
          if (Math.random() < this.mutationRate) copy[i] += (Math.random() * 2 - 1) * this.config.ga.mutationSigma;
        }
        genomes.push(copy);
      }
      this.startGeneration(genomes.slice(0, pop));
    } else if (savedState.allTimeBest && savedState.allTimeBest.genome) {
      this.seedFrom(savedState.allTimeBest.genome, savedState.allTimeBest);
    } else {
      const genomes = Array.from({ length: pop }, () =>
        NeuralNetwork.randomGenome(this.layers),
      );
      this.startGeneration(genomes);
    }
  }

  setTrack(track, keepGeneration = false) {
    if (this.track === track) return;
    this.track = track;
    this.tireBarriers?.setTrack(track);
    if (!keepGeneration) {
      this.reset();
    } else {
      if (this.cars && this.cars.length > 0) {
        this.startGeneration(this.cars.map((c) => c.brain.genome));
      } else {
        this.reset();
      }
    }
  }

  /** Replace the current population with mutated copies of `genome`. */
  seedFrom(genome, meta = null) {
    if (meta) {
      if (typeof meta.generation === 'number' && meta.generation > 0) {
        this.generation = meta.generation;
      }
      if (meta.fitness !== undefined && meta.fitness !== null) {
        this.allTimeBest = {
          genome: Float32Array.from(genome),
          fitness: meta.fitness,
          generation: this.generation,
          bestLap: meta.bestLap ?? Infinity,
        };
      }
      // When explicitly importing a brain, align the best lap record with the imported brain
      this.bestLapEver = (meta.bestLap && Number.isFinite(meta.bestLap) && meta.bestLap > 0)
        ? meta.bestLap
        : Infinity;

      const fit = meta.fitness || (this.allTimeBest ? this.allTimeBest.fitness : 100000);
      const bestL = this.bestLapEver;
      const popSize = this.mode === 'race' ? 20 : this.config.ga.population;

      // Clean up future history entries so chart starts cleanly from the imported generation
      this.history = (this.history || []).filter((h) => h.generation < this.generation);

      this.history.push({
        generation: this.generation,
        best: fit,
        avg: fit * 0.85,
        median: fit * 0.82,
        min: fit * 0.5,
        max: fit,
        bestLap: bestL,
        avgLap: Number.isFinite(bestL) ? bestL * 1.15 : Infinity,
        finishers: popSize,
        eliminated: 0,
        population: popSize,
        fitnessDeltaPct: 0,
        lapImprovementPct: 0,
      });
    }
    this.startGeneration(seedPopulation(genome, this.gaOptions));
  }

  startGeneration(genomes, metaList = null) {
    this.cars = genomes.map((g, idx) => {
      const c = new Car(this.track, new NeuralNetwork(this.layers, g), idx);
      c.collisionAlwaysOn = false;
      c.launchDelay = 0;
      c.driverBias = 0;
      if (idx === 0 && Number.isFinite(this.bestLapEver) && this.bestLapEver > 0) {
        c.bestLap = this.bestLapEver;
      }
      if (metaList && metaList[idx]) {
        const m = metaList[idx];
        if (m.genTag !== undefined) c.genTag = m.genTag;
        if (m.genLabel !== undefined) c.genLabel = m.genLabel;
        if (m.teamIdx !== undefined) c.teamIdx = m.teamIdx;
        if (m.bestLap !== undefined) c.bestLap = m.bestLap;
      }
      return c;
    });
    this.time = 0;
    this.postRaceTimer = null;
    this.checkeredFlagTimer = null;
    this.aliveCount = this.cars.length;
    this.deathEvents = [];
    this.tireBarriers?.reset();
  }

  setManual(on) {
    this.player = on ? new Car(this.track, null, 0) : null;
  }

  step(customDt) {
    const dt = typeof customDt === 'number' ? customDt : this.config.dt;
    let aliveRacing = 0;
    let aliveTotal = 0;

    for (const car of this.cars) {
      if (!car.alive) continue;
      aliveTotal++;
      const wasAlive = car.alive;
      const wasCrashed = car.crashed;
      car.update(dt);
      if (!wasCrashed && car.crashed) {
        this.onCarEliminated?.(car, car.deathReason);
      }
      if (wasAlive && !car.alive) {
        // Trigger explosion only for actual crashes, never for finished cars
        if (car.deathReason !== 'finished') {
          this.deathEvents.push({ x: car.x, y: car.y, angle: car.angle, reason: car.deathReason, speed: car.speed });
        }
        this.onCarDeath?.(car);
      } else if (car.alive && !car.crashed && !car.finished) {
        aliveRacing++;
      }
    }

    if (this.player) {
      const p = this.player;
      const lapsBefore = p.laps;
      const wasAlive = p.alive;
      const wasCrashed = p.crashed;
      p.update(dt, this.playerControls);
      if (!wasCrashed && p.crashed) {
        this.onCarEliminated?.(p, p.deathReason);
      }
      if (wasAlive && !p.alive) {
        if (p.deathReason !== 'finished') {
          this.deathEvents.push({ x: p.x, y: p.y, angle: p.angle, reason: p.deathReason, speed: p.speed, isPlayer: true });
        }
        this.onCarDeath?.(p);
      }
      if (p.laps > lapsBefore) this.playerBestLap = Math.min(this.playerBestLap, p.lapTimes[p.lapTimes.length - 1]);
      if (!p.alive) p.reset();
    }

    // Active racing & finished rollout cars collection (solid collision presence maintained)
    if (!this._activeCars) this._activeCars = [];
    this._activeCars.length = 0;
    const activeCars = this._activeCars;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      if (c && (c.alive || c.crashed || c.finished)) {
        activeCars.push(c);
      }
    }
    if (this.player && (this.player.alive || this.player.crashed || this.player.finished)) {
      activeCars.push(this.player);
    }

    // Update Dynamic Tire Barrier Physics & Collision Response
    if (this.tireBarriers) {
      this.tireBarriers.update(dt, activeCars, (car, impactSpeed) => {
        audio.playTireThump(impactSpeed);
      });
    }

    const colConfig = this.config.collision || {};
    const warmup = colConfig.warmupTime || 30;
    const leadTime = colConfig.separationLeadTime || 25;
    const isSeparationPhase = Boolean(colConfig.enabled) && (this.time >= (warmup - leadTime)) && (this.time < warmup);
    const colEnabled = Boolean(colConfig.enabled) && (this.time >= warmup);

    const col = this.config.collision || { radius: 13.5, restitution: 0.45, scrub: 0.04 };
    const minColDist = (col.radius || 13.5) * 2;
    const minColDistSq = minColDist * minColDist;
    const restitution = col.restitution !== undefined ? col.restitution : 0.45;
    const scrub = col.scrub !== undefined ? col.scrub : 0.04;

    if (isSeparationPhase) {
      // Ultra-Smooth Lateral Lane Separation (between 25s and 0s on the collision timer)
      // Normalized time progress: 0.0 at 25s left -> 1.0 at 0s left
      const progress = Math.min(1.0, Math.max(0.0, (this.time - (warmup - leadTime)) / leadTime));

      // Ken Perlin's Smootherstep (6t^5 - 15t^4 + 10t^3): 100% C^2 continuous with zero initial jolt
      const ramp = progress * progress * progress * (progress * (progress * 6 - 15) + 10);

      // Desired collision-safe clearances: 28px longitudinally (bumper-to-bumper), 16px laterally (side-by-side)
      const targetSafeLong = 10 + 18 * ramp;
      const targetSafeLat = 6 + 10 * ramp;
      const halfTrack = (this.track?.width || 84) * 0.5 - 6;

      // Silky sub-pixel drift coefficients (smooth continuous lane fanning)
      const latRate = (0.0005 + 0.038 * ramp);
      const longRate = (0.0002 + 0.015 * ramp);
      const maxLatNudge = 0.005 + 0.12 * ramp;
      const maxLongNudge = 0.002 + 0.06 * ramp;

      for (let i = 0; i < activeCars.length; i++) {
        const c1 = activeCars[i];
        const idx1 = c1.idx || 0;
        const tx = this.track.tx[idx1] || 1;
        const ty = this.track.ty[idx1] || 0;
        const nx = -ty;
        const ny = tx;

        for (let j = i + 1; j < activeCars.length; j++) {
          const c2 = activeCars[j];
          const dx = c2.x - c1.x;
          const dy = c2.y - c1.y;

          // Decompose relative vector into track coordinates (forward vs lateral)
          const dLong = dx * tx + dy * ty;
          const dLat = dx * nx + dy * ny;
          const absLong = Math.abs(dLong);
          const absLat = Math.abs(dLat);

          if (absLong < targetSafeLong && absLat < targetSafeLat) {
            const overlapLat = targetSafeLat - absLat;
            const overlapLong = targetSafeLong - absLong;

            // 1. Smooth lateral lane fanning (cars smoothly fan out across left, center, right lanes)
            const latSign = absLat > 0.001 ? Math.sign(dLat) : ((i % 2 === 0) ? 1 : -1);
            const latNudge = Math.min(overlapLat * latRate, maxLatNudge) * latSign;

            // 2. Microscopic longitudinal spacing (smooth staggered convoy spacing)
            const longSign = absLong > 0.001 ? Math.sign(dLong) : 1;
            const longNudge = Math.min(overlapLong * longRate, maxLongNudge) * longSign;

            c1.x -= (nx * latNudge + tx * longNudge);
            c1.y -= (ny * latNudge + ty * longNudge);
            c2.x += (nx * latNudge + tx * longNudge);
            c2.y += (ny * latNudge + ty * longNudge);
          }
        }
      }
    } else if (colEnabled) {
      // Realistic Multi-Car Rigid-Body & Contact Friction Physics (Active after 30s)
      const carMass = 1.0;
      const chassisInertia = 72.0; // Rotational moment of inertia for 26x13 chassis
      const frictionCoeff = 0.42; // Coulomb tangential scraping friction / body rub drag

      for (let i = 0; i < activeCars.length; i++) {
        const c1 = activeCars[i];
        for (let j = i + 1; j < activeCars.length; j++) {
          const c2 = activeCars[j];

          const dx = c2.x - c1.x;
          if (Math.abs(dx) >= minColDist) continue;
          const dy = c2.y - c1.y;
          if (Math.abs(dy) >= minColDist) continue;
          const distSq = dx * dx + dy * dy;

          if (distSq < minColDistSq && distSq > 0.0001) {
            const dist = Math.sqrt(distSq);
            const nx = dx / dist;
            const ny = dy / dist;
            const tx = -ny; // Tangent vector along contact plane
            const ty = nx;
            const overlap = minColDist - dist;

            // 1. Non-penetration positional relaxation
            const push = overlap * 0.32;
            c1.x -= nx * push;
            c1.y -= ny * push;
            c2.x += nx * push;
            c2.y += ny * push;

            // 2. Relative velocity at contact interface
            const rvx = c2.vx - c1.vx;
            const rvy = c2.vy - c1.vy;
            const vRelNorm = rvx * nx + rvy * ny;
            const vRelTang = rvx * tx + rvy * ty;

            if (vRelNorm < 0) {
              // 3. Normal Restitution Impulse (elastic separation)
              const jNorm = -(1 + restitution) * vRelNorm * 0.5 * carMass;

              // 4. Tangential Scraping Drag Impulse (Coulomb body friction drags rubbing cars together)
              const maxFriction = jNorm * frictionCoeff;
              const jTang = Math.max(-maxFriction, Math.min(maxFriction, -vRelTang * 0.40 * carMass));

              // Total 2D impulse vector applied to Car 2 (and opposite to Car 1)
              const jx = jNorm * nx + jTang * tx;
              const jy = jNorm * ny + jTang * ty;

              c1.vx -= jx / carMass;
              c1.vy -= jy / carMass;
              c2.vx += jx / carMass;
              c2.vy += jy / carMass;

              // Speed scrub & contact penalty
              c1.vx *= 1 - scrub;
              c1.vy *= 1 - scrub;
              c2.vx *= 1 - scrub;
              c2.vy *= 1 - scrub;
              c1.speed = Math.hypot(c1.vx, c1.vy);
              c2.speed = Math.hypot(c2.vx, c2.vy);

              const impactSpeed = Math.abs(vRelNorm) + Math.abs(vRelTang) * 0.45;
              const penalty = (this.config.fitness?.contactPenalty || 50) * (1 + impactSpeed / 40);
              c1.collisionPenalty = (c1.collisionPenalty || 0) + penalty;
              c2.collisionPenalty = (c2.collisionPenalty || 0) + penalty;

              c1.contacts++;
              c2.contacts++;

              // 5. Realistic Off-Center Torque & Yaw Deflection (Leverage from contact point)
              // Contact point offset from car centers (r x F)
              const r1x = dx * 0.5;
              const r1y = dy * 0.5;
              const r2x = -dx * 0.5;
              const r2y = -dy * 0.5;

              // Torque = rx * Fy - ry * Fx
              const torque1 = -(r1x * jy - r1y * jx);
              const torque2 = (r2x * jy - r2y * jx);

              // Apply dynamic yaw velocity (progressively steered and damped by tire grip, NO center spinning!)
              c1.yawRate = (c1.yawRate || 0) + (torque1 / chassisInertia) * 0.75;
              c2.yawRate = (c2.yawRate || 0) + (torque2 / chassisInertia) * 0.75;
            }
          }
        }
      }
    }

    // Update sensors for all active cars (opponent detection engages during separation + collision phases)
    const senseOpponents = isSeparationPhase || colEnabled;
    for (const c of activeCars) {
      c.sense(senseOpponents ? activeCars : null);
    }

    this.time += dt;
    this.aliveCount = aliveRacing;

    // F1 Checkered Flag Rule:
    // Once any car crosses the line to finish the race (taking the checkered flag),
    // enforce a 5.0s window for trailing cars to finish before concluding the race.
    const anyCarFinished = this.cars.some((c) => c.finished);
    if (anyCarFinished) {
      if (this.checkeredFlagTimer === null || this.checkeredFlagTimer === undefined) {
        this.checkeredFlagTimer = 5.0; // 5-second F1 Chequered Flag cooldown window
      } else {
        this.checkeredFlagTimer -= dt;
        if (this.checkeredFlagTimer <= 0) {
          this.checkeredFlagTimer = null;
          this.endGeneration();
          return;
        }
      }
    } else {
      this.checkeredFlagTimer = null;
    }

    // Check if race has concluded: no cars actively racing, and no cars actively in a crash slide
    const isCrashingSliding = this.cars.some((c) => c.crashed && c.alive);
    const isRaceComplete = aliveRacing === 0 && !isCrashingSliding;

    if (isRaceComplete) {
      if (this.postRaceTimer === null || this.postRaceTimer === undefined) {
        this.postRaceTimer = 4.0; // 4-second victory cooldown with all cars remaining on track
      } else {
        this.postRaceTimer -= dt;
        if (this.postRaceTimer <= 0) {
          this.postRaceTimer = null;
          this.endGeneration();
          return;
        }
      }
    } else {
      this.postRaceTimer = null;
    }

    if (this.time >= this.config.generation.timeLimit) {
      this.endGeneration();
    }
  }

  endGeneration() {
    // Sort cars by true race finishing order (P1 ahead of field)
    const sortedCars = [...this.cars].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) return a.time - b.time;
      if (a.laps !== b.laps) return b.laps - a.laps;
      return b.maxIdx - a.maxIdx;
    });

    const f = this.config.fitness || {};
    const scored = sortedCars.map((c, rankIdx) => {
      let fit = c.fitness;
      // Track position bonus for beating opponents and finishing ahead
      if (rankIdx === 0) fit += f.p1Bonus || 2500;
      else if (rankIdx === 1) fit += f.p2Bonus || 1500;
      else if (rankIdx === 2) fit += f.p3Bonus || 900;
      else if (rankIdx < 10) fit += (10 - rankIdx) * 60;

      return {
        genome: c.brain.genome,
        fitness: Math.max(0, fit),
        bestLap: c.bestLap,
        finished: c.finished,
      };
    });

    let best = scored[0];
    let sum = 0;
    let minFitness = Infinity;
    let maxFitness = -Infinity;
    let finishers = 0;
    let eliminated = 0;
    let genBestLap = Infinity;
    let lapSum = 0;
    let lapCount = 0;

    for (const s of scored) {
      sum += s.fitness;
      if (s.fitness > best.fitness) best = s;
      if (s.fitness < minFitness) minFitness = s.fitness;
      if (s.fitness > maxFitness) maxFitness = s.fitness;
      if (s.finished) finishers++;
      else eliminated++;
      if (s.bestLap < genBestLap) genBestLap = s.bestLap;
      if (s.bestLap && Number.isFinite(s.bestLap) && s.bestLap < 100) {
        lapSum += s.bestLap;
        lapCount++;
      }
    }

    // Compute Median Fitness
    const sortedFits = scored.map((s) => s.fitness).sort((a, b) => a - b);
    const mid = Math.floor(sortedFits.length / 2);
    const medianFitness = sortedFits.length % 2 === 0
      ? (sortedFits[mid - 1] + sortedFits[mid]) / 2
      : sortedFits[mid];

    const avgFitness = sum / scored.length;
    const avgLap = lapCount > 0 ? lapSum / lapCount : Infinity;
    const fitnessDeltaPct = avgFitness > 0 ? ((best.fitness - avgFitness) / avgFitness) * 100 : 0;
    const lapImprovementPct = Number.isFinite(genBestLap) && Number.isFinite(avgLap) && avgLap > 0
      ? ((avgLap - genBestLap) / avgLap) * 100
      : 0;

    const record = {
      generation: this.generation,
      best: best.fitness,
      avg: avgFitness,
      median: medianFitness,
      min: Number.isFinite(minFitness) ? minFitness : 0,
      max: Number.isFinite(maxFitness) ? maxFitness : best.fitness,
      bestLap: genBestLap,
      avgLap,
      finishers,
      eliminated,
      population: scored.length,
      fitnessDeltaPct,
      lapImprovementPct,
    };
    this.history.push(record);

    if (!this.allTimeBest || best.fitness > this.allTimeBest.fitness) {
      this.allTimeBest = {
        genome: Float32Array.from(best.genome),
        fitness: best.fitness,
        generation: this.generation,
        bestLap: best.bestLap,
      };
      this.onNewBest?.(this.allTimeBest);
    }
    if (genBestLap < this.bestLapEver) {
      this.bestLapEver = genBestLap;
      this.onNewBestLap?.(genBestLap);
    }

    const next = evolve(scored, this.gaOptions);
    this.generation++;
    this.startGeneration(next);
    this.onGeneration?.(record);
  }

  /** The physical race leader currently in P1 (furthest along track, finished first, not crashed). */
  get leader() {
    let p1 = null;
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      if (!c || (!c.alive && !c.finished) || c.crashed) continue;
      if (!p1) {
        p1 = c;
        continue;
      }
      // True Race Position: finished first, then most laps, then furthest progress along the circuit
      if (c.finished !== p1.finished) {
        if (c.finished) p1 = c;
      } else if (c.finished && p1.finished) {
        const tC = c.finishTime !== undefined && c.finishTime !== null ? c.finishTime : c.time;
        const tP1 = p1.finishTime !== undefined && p1.finishTime !== null ? p1.finishTime : p1.time;
        if (tC < tP1) p1 = c;
      } else if (c.laps !== p1.laps) {
        if (c.laps > p1.laps) p1 = c;
      } else if (c.totalIdx > p1.totalIdx) {
        p1 = c;
      }
    }
    if (p1) return p1;

    // Fallback if all remaining living cars are currently in death slide
    for (let i = 0; i < this.cars.length; i++) {
      const c = this.cars[i];
      if (!c || !c.alive) continue;
      if (!p1) {
        p1 = c;
        continue;
      }
      if (c.laps !== p1.laps) {
        if (c.laps > p1.laps) p1 = c;
      } else if (c.totalIdx > p1.totalIdx) {
        p1 = c;
      }
    }
    return p1 || this.cars[0] || null;
  }

  get genBestFitness() {
    let bf = 0;
    for (const c of this.cars) bf = Math.max(bf, c.fitness);
    return bf;
  }

  /** Returns the car holding the best recorded lap time across the active grid (or the top seeded champion). */
  get bestLapCar() {
    let best = null;
    let minLap = Infinity;
    if (this.cars && this.cars.length > 0) {
      for (let i = 0; i < this.cars.length; i++) {
        const c = this.cars[i];
        if (c && c.bestLap && Number.isFinite(c.bestLap) && c.bestLap > 0 && c.bestLap < minLap) {
          minLap = c.bestLap;
          best = c;
        }
      }
    }
    if (this.player && this.player.bestLap && Number.isFinite(this.player.bestLap) && this.player.bestLap > 0 && this.player.bestLap < minLap) {
      return this.player;
    }
    return best || (this.cars && this.cars[0]) || null;
  }

  /** Fastest lap time completed by any car in the current race/generation. */
  get currentGenBestLap() {
    let best = Infinity;
    if (this.cars) {
      for (let i = 0; i < this.cars.length; i++) {
        const bl = this.cars[i].bestLap;
        if (bl < best) best = bl;
      }
    }
    if (this.player && this.player.bestLap < best) {
      best = this.player.bestLap;
    }
    return best;
  }
}
