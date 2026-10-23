import { Car } from './car.js';
import { countRaceOutcomes } from './raceOutcomes.js';
import { getCarContact, resolveCarContact } from './carContact.js';
import { NeuralNetwork } from './neuralNetwork.js';
import { evolve, seedPopulation, resetStagnation } from './genetics.js';
import { TireBarrierSystem } from './tireBarriers.js';
import { audio } from './audio.js';
import { getCarNumber } from './renderer3d.js';
import { PRESET_MILESTONES, physicsSignature, compatibleCaptures } from './milestones.js';

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
    return { ...this.config.ga, population: pop, mutationRate: this.mutationRate,
      layers: this.layers, lockedFrom: this.config.nn.baseInputs };
  }

  reset() {
    resetStagnation();
    this.capturedPresets = [];
    this.captureEnabled = true;
    this.generation = 1;
    this.history = [];
    this.allTimeBest = null;
    this.lastRaceChampion = null;
    this.fastestLapChampion = null;
    this.bestLapEver = Infinity;
    this.prevBestLapEver = null;
    this.playerBestLap = Infinity;
    this.raceBestLap = Infinity;
    this.raceGhostLap = Infinity;
    this.raceGhostTelemetry = null;
    this.raceGhostSource = null;
    this.raceGhostActiveLap = 1;
    this.raceGhostStartedAt = 0;
    this.raceLapBests = new Map();
    this.raceLastCompleted = new Map();
    this.recordLapTelemetry = null;
    this.isRealCarTelemetry = false;
    this.deathEvents = [];
    const count = this.mode === 'race' ? 20 : this.config.ga.population;
    const genomes = Array.from({ length: count }, () =>
      NeuralNetwork.randomGenome(this.layers, this.config.nn.baseInputs),
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
        list.push(NeuralNetwork.randomGenome(this.layers, this.config.nn.baseInputs));
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
    this.lastRaceChampion = savedState.lastRaceChampion || null;
    this.capturedPresets = compatibleCaptures(savedState.capturedPresets, this.track, this.config);
    this.captureEnabled = savedState.captureEnabled === true;
    this.generation = Math.max(1, savedState.generation || 1);
    this.history = Array.isArray(savedState.history) ? [...savedState.history] : [];
    this.allTimeBest = savedState.allTimeBest || null;
    this.bestLapEver = Number.isFinite(savedState.bestLapEver) && savedState.bestLapEver > 0
      ? savedState.bestLapEver : Infinity;
    this.recordLapTelemetry = Number.isFinite(this.bestLapEver) && Array.isArray(savedState.recordLapTelemetry) && savedState.recordLapTelemetry.length > 10
      ? savedState.recordLapTelemetry : null;
    this.isRealCarTelemetry = Boolean(savedState.isRealCarTelemetry && this.recordLapTelemetry);
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
        NeuralNetwork.randomGenome(this.layers, this.config.nn.baseInputs),
      );
      this.startGeneration(genomes);
    }
  }

  setTrack(track, keepGeneration = false) {
    if (this.track === track) return;
    this.track = track;
    this.tireBarriers?.setTrack(track);
    this.playerBestLap = Infinity;
    if (this.player) this.setManual(true);
    if (!keepGeneration) {
      this.reset();
    } else {
      // Keep the trained population and generation, but discard circuit-specific results.
      this.history = [];
      this.allTimeBest = null;
      this.lastRaceChampion = null;
      this.bestLapEver = Infinity;
      this.prevBestLapEver = null;
      this.recordLapTelemetry = null;
      this.isRealCarTelemetry = false;
      this.capturedPresets = [];
      this.captureEnabled = false;
      resetStagnation();
      if (this.cars && this.cars.length > 0) {
        this.startGeneration(this.cars.map((c) => c.brain.genome));
      } else {
        this.reset();
      }
    }
  }

  /** Replace the current population with mutated copies of `genome`. */
  seedFrom(genome, meta = null) {
    this.lastRaceChampion = null;
    this.captureEnabled = false;
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

  generateGridSlots(count) {
    if (count <= 1) return [0];

    const mode = this.config.gridOrder || 'qualifying';

    if (mode === 'random') {
      // Complete lottery grid draw
      const arr = Array.from({ length: count }, (_, i) => i);
      for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }

    if (mode === 'reverse8') {
      // F2 Sprint style: Top 8 reversed, rest in order
      const slots = new Array(count);
      for (let i = 0; i < count; i++) {
        slots[i] = i < 8 ? (7 - i) : i;
      }
      return slots;
    }

    // Default 'qualifying': Dynamic Q3/Q2/Q1 shootout.
    // Top 8 fastest brains contest Pole and the top 4 rows (Q3) with qualifying variance.
    // Midfield cars contest rows 5-7 (Q2), and backmarkers fill the rear (Q1).
    const slots = new Array(count);
    const shuffleSection = (start, end) => {
      const indices = [];
      for (let i = start; i < end && i < count; i++) indices.push(i);
      for (let i = indices.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [indices[i], indices[j]] = [indices[j], indices[i]];
      }
      for (let i = 0; i < indices.length; i++) {
        slots[start + i] = indices[i];
      }
    };
    shuffleSection(0, 8);
    shuffleSection(8, 15);
    shuffleSection(15, count);
    return slots;
  }

  startGeneration(genomes, metaList = null) {
    this.generationPhysics = physicsSignature(this.track, this.config);
    const gridSlots = this.generateGridSlots(genomes.length);

    this.cars = genomes.map((g, idx) => {
      const slot = gridSlots[idx];
      const c = new Car(this.track, new NeuralNetwork(this.layers, g), slot);
      c.carIndex = idx;
      c.carNumber = getCarNumber(idx, false);
      c.teamIdx = Math.floor(idx / 2) % 10;
      c.collisionAlwaysOn = false;
      c.launchDelay = 0;
      c.driverBias = 0;
      if (metaList && metaList[idx]) {
        const m = metaList[idx];
        if (m.genTag !== undefined) c.genTag = m.genTag;
        if (m.genLabel !== undefined) c.genLabel = m.genLabel;
        if (m.teamIdx !== undefined) c.teamIdx = m.teamIdx;
      }
      // Live Record Ghost Telemetry Capture: immediate refresh when record lap is completed
      c.onLapComplete = (car, lapDuration, samples) => {
        this.handleLapComplete(car, lapDuration, samples);
      };
      return c;
    });
    this.time = 0;
    this.postRaceTimer = null;
    this.checkeredFlagTimer = null;
    this.aliveCount = this.cars.length;
    this.raceBestLap = Infinity;
    this.raceGhostLap = Infinity;
    this.raceGhostTelemetry = null;
    this.raceGhostSource = null;
    this.raceGhostActiveLap = 1;
    this.raceGhostStartedAt = 0;
    this.raceLapBests = new Map();
    this.raceLastCompleted = new Map();
    this.deathEvents = [];
    this.tireBarriers?.reset();
  }

  setManual(on) {
    this.player = on ? new Car(this.track, null, 0) : null;
    if (this.player) {
      this.player.carIndex = 99;
      this.player.carNumber = 7;
      this.player.teamIdx = 1;
      this.player.onLapComplete = (car, lapDuration, samples) => {
        this.handleLapComplete(car, lapDuration, samples);
      };
    }
  }

  handleLapComplete(car, lapDuration, samples) {
    if (!Number.isFinite(lapDuration) || lapDuration <= 0) return;

    // Lap 1 includes countdown/grid travel in race timing. A lap-2 ghost must
    // replay the actual circuit from the first line crossing, not the launch.
    const lineStart = car?.laps === 1 ? car.firstLapGhostStart : null;
    let replaySamples = samples;
    let replayDuration = lapDuration;
    if (lineStart && Number.isFinite(lineStart.t) && lineStart.t >= 0 && lineStart.t < lapDuration && Array.isArray(samples)) {
      replayDuration = lapDuration - lineStart.t;
      replaySamples = [{ ...lineStart, t: 0 }, ...samples.filter(s => s.t > lineStart.t)
        .map(s => ({ ...s, t: s.t - lineStart.t }))];
    }

    // Collect completed laps now; select playback only at P1's next lap boundary.
    if (Number.isInteger(car?.laps) && car.laps > 0 && replayDuration > 5 && replayDuration < 60 &&
      Array.isArray(replaySamples) && replaySamples.length > 5 &&
      replaySamples.every((s, i) => Number.isFinite(s.t) && s.t >= 0 && s.t <= replayDuration + 0.1 &&
        Number.isFinite(s.x) && Number.isFinite(s.y) && Number.isFinite(s.angle) && Number.isFinite(s.speed) &&
        (i === 0 || s.t >= replaySamples[i - 1].t))) {
      const candidate = { duration: replayDuration, samples: [...replaySamples],
        source: { generation: this.generation, carNumber: car.carNumber, lap: car.laps } };
      this.raceLastCompleted.set(car, candidate);
      const previous = this.raceLapBests.get(car.laps);
      if (!previous || replayDuration < previous.duration - 0.01) this.raceLapBests.set(car.laps, candidate);
    }

    if (lapDuration <= 5 || lapDuration >= 60) return;

    const prevOverallRecord = this.bestLapEver;
    const isOverallRecord = lapDuration < this.bestLapEver;
    const isReplacingSynthetic = !this.isRealCarTelemetry;

    const prevRaceBest = this.raceBestLap;
    const isRaceBest = lapDuration < this.raceBestLap;

    if (isOverallRecord || isReplacingSynthetic) {
      this.prevBestLapEver = Number.isFinite(prevOverallRecord) && prevOverallRecord < 100 ? prevOverallRecord : null;
      this.bestLapEver = lapDuration;
      this.raceBestLap = lapDuration;
      this.isRealCarTelemetry = true;
      if (samples && samples.length > 5) {
        this.recordLapTelemetry = [...samples];
      }
      this.onNewBestLap?.(lapDuration, car, this.prevBestLapEver, 'overall');
    } else if (isRaceBest && lapDuration < 35.0) {
      const prev = Number.isFinite(prevRaceBest) && prevRaceBest < 100 ? prevRaceBest : null;
      this.raceBestLap = lapDuration;
      this.onNewBestLap?.(lapDuration, car, prev, 'race');
    }
  }

  step(customDt) {
    const dt = typeof customDt === 'number' ? customDt : this.config.dt;
    let aliveRacing = 0;
    let aliveTotal = 0;

    for (const car of this.cars) {
      if (!car.alive) continue;
      car.beforePreviousX = car.previousX;
      car.beforePreviousY = car.previousY;
      car.beforePreviousAngle = car.previousAngle;
      car.previousX = car.x;
      car.previousY = car.y;
      car.previousAngle = car.angle;
      aliveTotal++;
      const wasAlive = car.alive;
      const wasCrashed = car.crashed;
      car.update(dt);
      if (this.motionDebug) { car.motionFreeX = car.x; car.motionFreeY = car.y; }
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
      p.beforePreviousX = p.previousX;
      p.beforePreviousY = p.previousY;
      p.beforePreviousAngle = p.previousAngle;
      p.previousX = p.x;
      p.previousY = p.y;
      p.previousAngle = p.angle;
      const lapsBefore = p.laps;
      const wasAlive = p.alive;
      const wasCrashed = p.crashed;
      p.update(dt, this.playerControls);
      if (this.motionDebug) { p.motionFreeX = p.x; p.motionFreeY = p.y; }
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
      if (c && (c.alive || c.finished)) {
        activeCars.push(c);
      }
    }
    if (this.player && (this.player.alive || this.player.finished)) {
      activeCars.push(this.player);
    }

    // Update Dynamic Tire Barrier Physics & Collision Response
    if (this.tireBarriers) {
      this.tireBarriers.update(dt, activeCars, (car, impactSpeed) => {
        audio.playTireThump(impactSpeed);
      });
    }

    const colConfig = this.config.collision || {};
    const warmup = colConfig.warmupTime ?? 30;
    const leadTime = colConfig.separationLeadTime ?? 4;
    const isSeparationPhase = Boolean(colConfig.enabled) && (this.time >= (warmup - leadTime)) && (this.time < warmup);
    const colEnabled = Boolean(colConfig.enabled) && (this.time >= warmup);

    const col = this.config.collision || { radius: 13.5, restitution: 0.45, scrub: 0.04 };
    const carLength = this.config.car.length, carWidth = this.config.car.width;
    const minColDist = Math.max(col.radius || 13.5, Math.hypot(carLength, carWidth) * 0.5) * 2;
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

          if (distSq < minColDistSq) {
            const contact = getCarContact(c1, c2, carLength, carWidth);
            if (!contact) continue;
            const { nx, ny } = contact;
            const overlap = contact.depth;

            // 1. Non-penetration positional relaxation
            const push = overlap * 0.32;
            c1.x -= nx * push;
            c1.y -= ny * push;
            c2.x += nx * push;
            c2.y += ny * push;

            const response = resolveCarContact(c1, c2, contact, {
              inertia: chassisInertia, restitution, friction: frictionCoeff, scrub,
            });
            if (response) {
              const { impactSpeed } = response;
              if (impactSpeed > 5) {
                c1.lastCarContactTime = c1.time;
                c2.lastCarContactTime = c2.time;
              }
              const penalty = (this.config.fitness?.contactPenalty || 50) * (1 + impactSpeed / 40);
              c1.collisionPenalty = (c1.collisionPenalty || 0) + penalty;
              c2.collisionPenalty = (c2.collisionPenalty || 0) + penalty;

              c1.contacts++;
              c2.contacts++;

            }
          }
        }
      }
    }

    // Update sensors for all active cars (opponent detection engages during separation + collision phases)
    const senseOpponents = isSeparationPhase || colEnabled;
    for (const c of activeCars) {
      if (this.motionDebug) c.motionCorrection = Math.hypot(c.x - c.motionFreeX, c.y - c.motionFreeY);
      c.sense(senseOpponents ? activeCars : null);
    }

    this.time += dt;
    this.updateRaceGhost();
    this.aliveCount = aliveRacing;

    // Both live and fast-forward races use the same trailing-finisher window.
    const anyCarFinished = this.cars.some((c) => c.finished);
    if (anyCarFinished) {
      if (this.checkeredFlagTimer === null || this.checkeredFlagTimer === undefined) {
        this.checkeredFlagTimer = this.config.generation.finishWindow ?? 15;
      } else {
        this.checkeredFlagTimer -= dt;
        if (this.checkeredFlagTimer <= 0) {
          this.checkeredFlagTimer = null;
          this.endGeneration('finish-window');
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
          this.endGeneration('all-stopped');
          return;
        }
      }
    } else {
      this.postRaceTimer = null;
    }

    if (this.time >= this.config.generation.timeLimit) {
      this.endGeneration('time-limit');
    }
  }

  endGeneration(endReason = 'race-ended') {
    // Sort cars by true race finishing order (P1 ahead of field)
    const sortedCars = [...this.cars].sort((a, b) => {
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) return (a.finishTime ?? a.time) - (b.finishTime ?? b.time);
      if (a.laps !== b.laps) return b.laps - a.laps;
      return b.maxIdx - a.maxIdx;
    });

    const f = this.config.fitness || {};
    const scored = sortedCars.map((c, rankIdx) => {
      let fit = c.fitness;
      if (f.p1Bonus && rankIdx === 0) fit += f.p1Bonus;
      else if (f.p2Bonus && rankIdx === 1) fit += f.p2Bonus;
      else if (f.p3Bonus && rankIdx === 2) fit += f.p3Bonus;

      return {
        car: c,
        genome: c.brain.genome,
        fitness: Math.max(0, fit),
        bestLap: c.bestLap,
        finished: c.finished,
        laps: c.laps,
      };
    });

    const champion = scored.find(s => s.finished);
    if (champion) this.lastRaceChampion = { genome: Array.from(champion.genome), generation: this.generation,
      fitness: champion.fitness, bestLap: champion.bestLap };
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
      outcomes: countRaceOutcomes(this.cars, endReason),
      crashDiagnostics: this.cars.filter(c => c.deathReason === 'crash' && c.crashDiagnostic)
        .map(c => ({ ...c.crashDiagnostic })),
      endReason,
      fitnessDeltaPct,
      lapImprovementPct,
    };
    this.history.push(record);
    // Keep raw S1 traces for the same 25-race diagnostic window; retain summaries.
    const expiredTraces = this.history[this.history.length - 26];
    for (const crash of expiredTraces?.crashDiagnostics || []) delete crash.approach;

    // Capture the actual tested champion before its population is replaced by offspring.
    if (this.captureEnabled && this.mode === 'train' && PRESET_MILESTONES.includes(this.generation) &&
      this.generationPhysics === physicsSignature(this.track, this.config) &&
      !this.capturedPresets.some((p) => p.gen === this.generation)) {
      const car = best.car;
      this.capturedPresets.push({
        source: 'organic-training', gen: this.generation, layers: [...this.layers],
        genome: Array.from(best.genome), fitness: best.fitness,
        bestLap: Number.isFinite(car.bestLap) ? car.bestLap : null,
        topSpeed: car.topSpeed, laps: car.laps, finished: car.finished,
        raceLaps: this.config.generation.maxLaps,
        gridSlot: car.gridSlot, contacts: car.contacts,
        collisions: Boolean(this.config.collision?.enabled),
        physicsSignature: this.generationPhysics, capturedAt: new Date().toISOString(),
      });
      this.onMilestoneCaptured?.(this.capturedPresets[this.capturedPresets.length - 1]);
    }

    if (!this.allTimeBest || best.fitness > this.allTimeBest.fitness) {
      this.allTimeBest = {
        genome: Float32Array.from(best.genome),
        fitness: best.fitness,
        generation: this.generation,
        bestLap: best.bestLap,
      };
      this.onNewBest?.(this.allTimeBest);
    }
    if (Number.isFinite(genBestLap) && genBestLap > 5 && genBestLap < 60) {
      const isBetterThanRecord = genBestLap < this.bestLapEver;
      const shouldUpdate = isBetterThanRecord || !this.isRealCarTelemetry;
      if (shouldUpdate) {
        const prevRec = this.bestLapEver;
        this.prevBestLapEver = Number.isFinite(prevRec) && prevRec < 100 ? prevRec : null;
        this.bestLapEver = genBestLap;
        this.isRealCarTelemetry = true;
        const fastestCar = this.cars.find(
          (c) => c.bestLapSamples && c.bestLapSamples.length > 5 && c.lapTimes && c.lapTimes.some((t) => Math.abs(t - genBestLap) < 0.05)
        ) || this.cars.find(
          (c) => c.lastLapSamples && c.lastLapSamples.length > 5 && c.lapTimes && c.lapTimes.some((t) => Math.abs(t - genBestLap) < 0.05)
        );
        if (fastestCar) {
          const samples = (fastestCar.bestLapSamples && fastestCar.bestLapSamples.length > 5)
            ? fastestCar.bestLapSamples
            : fastestCar.lastLapSamples;
          if (samples && samples.length > 5) {
            this.recordLapTelemetry = [...samples];
          }
          if (fastestCar.brain && fastestCar.brain.genome) {
            this.fastestLapChampion = {
              genome: Float32Array.from(fastestCar.brain.genome),
              bestLap: genBestLap,
              fitness: fastestCar.fitness,
              generation: this.generation,
            };
          }
        }
        this.raceBestLap = genBestLap;
        this.onNewBestLap?.(genBestLap, fastestCar, this.prevBestLapEver, 'overall');
      }
    }

    const next = evolve(scored, {
      ...this.gaOptions,
      bestLapEver: this.bestLapEver,
      genBestLap,
      allTimeBest: this.allTimeBest,
      fastestLapChampion: this.fastestLapChampion,
    });
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

  /**
   * Reset or recalibrate all-time circuit lap record to current physics baseline.
   */
  resetLapRecord(targetVal = null) {
    let recentBest = Infinity;
    // Prefer the fastest lap set by currently active living cars
    if (this.cars) {
      for (const c of this.cars) {
        if (c.bestLap && Number.isFinite(c.bestLap) && c.bestLap > 5 && c.bestLap < recentBest) {
          recentBest = c.bestLap;
        }
      }
    }
    // Or check recent 10 generations (current session baseline)
    if (recentBest === Infinity && this.history) {
      const recents = this.history.slice(-10);
      for (const r of recents) {
        if (r.bestLap && Number.isFinite(r.bestLap) && r.bestLap > 5 && r.bestLap < recentBest) {
          recentBest = r.bestLap;
        }
      }
    }

    const baseline = (targetVal !== null && Number.isFinite(targetVal) && targetVal > 0)
      ? targetVal
      : recentBest;

    this.bestLapEver = Number.isFinite(baseline) ? baseline : Infinity;
    this.recordLapTelemetry = null;
    this.isRealCarTelemetry = false;

    // If a current car has samples for this baseline, adopt them immediately
    if (this.cars && Number.isFinite(this.bestLapEver) && this.bestLapEver < Infinity) {
      const matchCar = this.cars.find((c) => c.bestLap && Math.abs(c.bestLap - this.bestLapEver) < 0.05);
      if (matchCar && matchCar.bestLapSamples && matchCar.bestLapSamples.length > 5) {
        this.recordLapTelemetry = [...matchCar.bestLapSamples];
        this.isRealCarTelemetry = true;
      }
    }

    // Clean up historical bestLap entries in history so pre-calibration records don't poison new baseline
    if (this.history && Number.isFinite(this.bestLapEver) && this.bestLapEver < Infinity) {
      for (const r of this.history) {
        if (r.bestLap && r.bestLap < this.bestLapEver) {
          r.bestLap = this.bestLapEver;
        }
      }
    }

    this.onNewBestLap?.(this.bestLapEver);
    return this.bestLapEver;
  }

  /**
   * Returns genuinely recorded historical telemetry without inventing a trajectory.
   * Race ghost playback deliberately uses raceGhostTelemetry instead.
   */
  getRecordLapTelemetry() {
    if (this.isRealCarTelemetry && this.recordLapTelemetry && this.recordLapTelemetry.length > 10) {
      return this.recordLapTelemetry;
    }
    return null;
  }

  /** Freeze the selected source for the whole lap; restart its clock at P1's crossing. */
  updateRaceGhost(leader = this.leader) {
    const completed = leader?.laps || 0;
    const nextLap = completed + 1;
    if (nextLap <= this.raceGhostActiveLap || completed >= this.config.generation.maxLaps) return;
    let selected = null;
    if (nextLap === 2) {
      const p1Lap = this.raceLastCompleted.get(leader);
      if (p1Lap?.source.lap === 1) selected = p1Lap;
    } else {
      for (const [lap, candidate] of this.raceLapBests) {
        if (lap <= completed && (!selected || candidate.duration < selected.duration - 0.01)) selected = candidate;
      }
    }
    this.raceGhostActiveLap = nextLap;
    this.raceGhostStartedAt = this.time;
    this.raceGhostLap = selected?.duration ?? Infinity;
    this.raceGhostTelemetry = selected?.samples ?? null;
    this.raceGhostSource = selected ? { ...selected.source, replayLap: nextLap } : null;
  }

  /** Use the same display time as interpolated cars, relative to this lap's start. */
  getRecordGhostRenderState(renderAlpha = 1) {
    const alpha = Math.max(0, Math.min(1, renderAlpha));
    const displayTime = Math.max(0, this.time - this.config.dt * (1 - alpha));
    return this.getRecordGhostState(Math.max(0, displayTime - (this.raceGhostStartedAt || 0)));
  }

  /** Interpolate one replay, then hold its finish pose until P1 starts the next lap. */
  getRecordGhostState(lapElapsed) {
    const dur = this.raceGhostLap;
    const samples = this.raceGhostTelemetry;
    if (!Number.isFinite(dur) || dur <= 5 || dur >= 60 || !samples || samples.length < 2) return null;

    const clampedTime = Math.max(0, Math.min(dur, lapElapsed));
    const first = samples[0], last = samples[samples.length - 1];
    let s0, s1, t0, t1;
    if (clampedTime < first.t) {
      s0 = s1 = first;
      t0 = t1 = first.t;
    } else if (clampedTime >= last.t) {
      s0 = s1 = last;
      t0 = t1 = last.t;
    } else {
      let lo = 0, hi = samples.length - 1;
      while (hi - lo > 1) {
        const mid = (lo + hi) >>> 1;
        if (samples[mid].t <= clampedTime) lo = mid;
        else hi = mid;
      }
      s0 = samples[lo];
      s1 = samples[hi];
      t0 = s0.t;
      t1 = s1.t;
    }

    const span = t1 - t0;
    const alpha = span > 0.0001 ? Math.max(0, Math.min(1, (clampedTime - t0) / span)) : 0;
    const x = s0.x + (s1.x - s0.x) * alpha;
    const y = s0.y + (s1.y - s0.y) * alpha;

    let da = s1.angle - s0.angle;
    while (da > Math.PI) da -= Math.PI * 2;
    while (da < -Math.PI) da += Math.PI * 2;
    const angle = s0.angle + da * alpha;
    const speed = clampedTime >= dur ? 0 : s0.speed + (s1.speed - s0.speed) * alpha;

    return { x, y, angle, speed, lapTime: clampedTime, totalDuration: dur };
  }
}
