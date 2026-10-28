import { randn } from './math.js';

function hasSameGenome(a, b) {
  if (a === b) return true;
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

export function tournament(scored, k) {
  let best = null;
  for (let i = 0; i < k; i++) {
    const c = scored[(Math.random() * scored.length) | 0];
    if (!best || c.fitness > best.fitness) best = c;
  }
  return best;
}

/**
 * Advanced Neural Crossover:
 * Combines Blended Arithmetic Recombination (BLX) with layer-preserving segment crossover.
 * Prevents functional disruption of co-adapted internal neural representations.
 */
export function crossover(a, b) {
  const child = new Float32Array(a.length);
  const mode = Math.random();

  if (mode < 0.60) {
    // 1. Blended Arithmetic Crossover: interpolate smoothly between parent weights
    // Explores continuous parameter space between parent policies
    for (let i = 0; i < a.length; i++) {
      const wa = a[i];
      const wb = b[i];
      const t = Math.random() * 1.1 - 0.05; // BLX-0.05
      child[i] = wa + t * (wb - wa);
    }
  } else if (mode < 0.85) {
    // 2. Multi-point segment crossover: preserves intact functional weight groups
    const p1 = (Math.random() * a.length) | 0;
    const p2 = (Math.random() * a.length) | 0;
    const minP = Math.min(p1, p2);
    const maxP = Math.max(p1, p2);
    for (let i = 0; i < a.length; i++) {
      child[i] = (i >= minP && i <= maxP) ? a[i] : b[i];
    }
  } else {
    // 3. Uniform crossover (retained for genetic diversity)
    for (let i = 0; i < a.length; i++) {
      child[i] = Math.random() < 0.5 ? a[i] : b[i];
    }
  }
  return child;
}

export function mutate(genome, rate, sigma) {
  for (let i = 0; i < genome.length; i++) {
    if (Math.random() < rate) genome[i] += randn() * sigma;
  }
  return genome;
}

// Track historical plateau progress across generations (instance-scoped or default)
export function createStagnationState() {
  return {
    peakFitnessHistory: 0,
    recentBestLapHistory: Infinity,
    stagnantGenerationsCount: 0,
    paceStagnantGenerationsCount: 0,
    burstGensRemaining: 0,
  };
}

const defaultStagnationState = createStagnationState();

export function triggerExplorationBurst(gens = 30, state = defaultStagnationState) {
  state.burstGensRemaining = gens;
  state.stagnantGenerationsCount = 0;
  state.paceStagnantGenerationsCount = 0;
  if (state !== defaultStagnationState) {
    defaultStagnationState.burstGensRemaining = gens;
    defaultStagnationState.stagnantGenerationsCount = 0;
    defaultStagnationState.paceStagnantGenerationsCount = 0;
  }
  return state.burstGensRemaining;
}

export function getBurstGensRemaining(state = defaultStagnationState) {
  return state.burstGensRemaining;
}

export function getStagnantGenerationsCount(state = defaultStagnationState) {
  return Math.max(state.stagnantGenerationsCount, state.paceStagnantGenerationsCount);
}

export function resetStagnation(state = defaultStagnationState) {
  state.stagnantGenerationsCount = 0;
  state.paceStagnantGenerationsCount = 0;
  state.burstGensRemaining = 0;
  state.peakFitnessHistory = 0;
  state.recentBestLapHistory = Infinity;
  if (state !== defaultStagnationState) {
    defaultStagnationState.stagnantGenerationsCount = 0;
    defaultStagnationState.paceStagnantGenerationsCount = 0;
    defaultStagnationState.burstGensRemaining = 0;
    defaultStagnationState.peakFitnessHistory = 0;
    defaultStagnationState.recentBestLapHistory = Infinity;
  }
}

/**
 * Directional mutation for Late Brakers:
 * Targets forward distance ray sensors and throttle neuron bias to delay corner braking points
 * and carry maximum throttle momentum through corner exits.
 */
function mutateLateBraker(genome, sigma) {
  const g = Float32Array.from(genome);
  const n = g.length;

  // 1. Mutate general weights with moderate variance
  for (let i = 0; i < n; i++) {
    if (Math.random() < 0.25) {
      g[i] += randn() * sigma;
    }
  }

  // 2. Target first-layer forward sensor weights (indices corresponding to central ray sensors 2, 3, 4)
  // Scaling them down makes the car less fearful of upcoming corner walls, pushing brake point 10-15m later
  const firstLayerSize = Math.min(96, n);
  for (let i = 0; i < firstLayerSize; i++) {
    if (Math.random() < 0.35) {
      g[i] += (randn() * 0.7 - 0.12) * sigma;
    }
  }

  // 3. Target the final throttle/brake neuron bias (last element of genome)
  // Positive shift keeps power applied longer into corner entries
  if (n > 0) {
    g[n - 1] += (Math.abs(randn()) * 0.4 + 0.22) * sigma;
  }
  return g;
}

/**
 * Directional mutation for Apex Slicers:
 * Amplifies high-speed steering responsiveness to clip apex kerbs closer and straighten corners.
 */
function mutateApexSlicer(genome, sigma) {
  const g = Float32Array.from(genome);
  const n = g.length;
  for (let i = 0; i < n; i++) {
    if (Math.random() < 0.20) {
      g[i] += randn() * sigma * 0.5;
    }
  }
  // Target steer output weights (penultimate output neuron) with smooth, controlled adjustments
  const steerNeuronOffset = Math.max(0, n - 24);
  for (let i = steerNeuronOffset; i < n - 2; i++) {
    if (Math.random() < 0.25) {
      g[i] += (randn() * 0.35) * sigma;
    }
  }
  return g;
}

/**
 * Directional mutation for racing apex seekers:
 * Focuses exploratory mutations onto steering reactivity and high-speed throttle carry
 */
function mutateApexHunter(genome, sigma) {
  const g = Float32Array.from(genome);
  const n = g.length;
  for (let i = 0; i < n; i++) {
    if (Math.random() < 0.28) {
      g[i] += randn() * sigma;
    }
  }
  const outStart = Math.max(0, n - 16);
  for (let i = outStart; i < n; i++) {
    if (Math.random() < 0.40) {
      g[i] += (randn() * 0.8 + 0.15) * sigma;
    }
  }
  return g;
}

/**
 * Tournament selection specifically for single-lap pace champions
 */
function paceTournament(candidates, k) {
  let best = candidates[(Math.random() * candidates.length) | 0];
  for (let i = 1; i < k; i++) {
    const c = candidates[(Math.random() * candidates.length) | 0];
    if (c.bestLap < best.bestLap) best = c;
  }
  return best;
}

/** First-layer weight indices belonging to inputs `from`..layers[0]-1 (stride = inputs + bias). */
export function lookaheadWeightIndices(layers, from) {
  const idx = [];
  if (!layers || !Number.isInteger(from) || from >= layers[0]) return idx;
  const stride = layers[0] + 1;
  for (let j = 0; j < layers[1]; j++) for (let i = from; i < layers[0]; i++) idx.push(j * stride + i);
  return idx;
}

/**
 * Build the next generation: elites survive unchanged, pace-champions are protected,
 * and high-variance wildcard explorers break through plateaus.
 * @param {{genome: Float32Array, fitness: number, bestLap?: number, finished?: boolean}[]} scored
 */
export function evolve(scored, { population, elites, tournamentK, mutationRate, mutationSigma, bestLapEver, genBestLap, layers, lockedFrom, allTimeBest, fastestLapChampion, stagnationState = defaultStagnationState }) {
  const sState = stagnationState || defaultStagnationState;
  const isLapComplete = candidate => Boolean(candidate.finished || (candidate.laps >= 1) || (Number.isFinite(candidate.bestLap) && candidate.bestLap < Infinity));
  const sorted = [...scored].sort((a, b) => {
    const aLap = isLapComplete(a);
    const bLap = isLapComplete(b);
    return Number(Boolean(b.finished)) - Number(Boolean(a.finished)) || Number(bLap) - Number(aLap) || b.fitness - a.fitness;
  });
  const finishers = sorted.filter(candidate => candidate.finished);
  const lapCompleters = sorted.filter(isLapComplete);
  const parentPool = finishers.length ? finishers : (lapCompleters.length ? lapCompleters : sorted);
  const completionRate = (finishers.length || lapCompleters.length) / Math.max(1, scored.length);
  const needsReliability = completionRate < 0.70;
  const next = [];
  const protectedGenomes = new Set();

  // Staged learning: until some car completes a lap or race, the weights of the extra track-awareness
  // inputs are inherited unchanged (zero at birth). Unlocks as soon as any car proves it can complete a circuit lap.
  const hasLapFinished = lapCompleters.length > 0;
  const lockIdx = !hasLapFinished ? lookaheadWeightIndices(layers, lockedFrom) : [];
  const lock = (child, parent) => {
    for (let k = 0; k < lockIdx.length; k++) child[lockIdx[k]] = parent[lockIdx[k]];
    return child;
  };

  // 1. Track Fitness & Pace Progression
  const topFit = sorted[0]?.fitness || 0;
  if (topFit > sState.peakFitnessHistory * 1.008 + 150) {
    sState.peakFitnessHistory = topFit;
    sState.stagnantGenerationsCount = 0;
  } else {
    sState.stagnantGenerationsCount++;
  }

  // 2. Pace Gap Stagnation Detector (tracks deficit to historic record)
  const hasRecord = typeof bestLapEver === 'number' && Number.isFinite(bestLapEver) && bestLapEver > 5 && bestLapEver < 40;
  const currentGenLap = typeof genBestLap === 'number' && Number.isFinite(genBestLap) && genBestLap > 5 ? genBestLap : null;

  if (currentGenLap) {
    if (currentGenLap < sState.recentBestLapHistory - 0.015) {
      sState.recentBestLapHistory = currentGenLap;
      sState.stagnantGenerationsCount = 0;
    }

    if (hasRecord) {
      const gapToRecord = currentGenLap - bestLapEver;
      // If gap to record remains stagnant > 0.40s for an extended run
      if (gapToRecord > 0.40) {
        sState.paceStagnantGenerationsCount++;
      } else {
        sState.paceStagnantGenerationsCount = Math.max(0, sState.paceStagnantGenerationsCount - 3);
      }
    }
  }

  // Automate exploration burst when training reaches a sustained plateau:
  // - 40 consecutive generations without fitness or lap time progress
  // - 40 consecutive generations stuck with > 0.40s deficit to track record
  // - Zero-finisher deadlock for 35+ generations
  // Condition: reliable completion must be established (> 70%) unless trapped in zero-finisher deadlock
  const isZeroFinishStuck = finishers.length === 0 && sState.stagnantGenerationsCount >= 35;
  const isPlateauCondition = (!needsReliability || isZeroFinishStuck) && (sState.stagnantGenerationsCount >= 40 || sState.paceStagnantGenerationsCount >= 40 || isZeroFinishStuck);

  if (isPlateauCondition && sState.burstGensRemaining === 0 && defaultStagnationState.burstGensRemaining === 0) {
    triggerExplorationBurst(6, sState); // 6 generations of targeted exploration catalyst
  } else if (defaultStagnationState.burstGensRemaining > 0 && sState !== defaultStagnationState && sState.burstGensRemaining === 0) {
    sState.burstGensRemaining = defaultStagnationState.burstGensRemaining;
  }

  const isBurstActive = sState.burstGensRemaining > 0;
  if (sState.burstGensRemaining > 0) {
    sState.burstGensRemaining--;
    if (sState !== defaultStagnationState && defaultStagnationState.burstGensRemaining > 0) {
      defaultStagnationState.burstGensRemaining = sState.burstGensRemaining;
    }
    // Keep stagnation counters reset during the burst to give full exploitation window after burst ends
    sState.stagnantGenerationsCount = 0;
    sState.paceStagnantGenerationsCount = 0;
  }

  const isPlateauing = isPlateauCondition || isBurstActive;
  const burstMultiplier = isBurstActive ? 1.25 : (needsReliability && finishers.length ? 0.75 : (isPlateauing ? 1.15 : 1.0));
  const effectiveSigma = mutationSigma * burstMultiplier;
  const effectiveRate = Math.min(0.25, mutationRate * burstMultiplier);

  // 1. Preserve reliable finishers first, ranked by fitness within each group.
  const eliteCount = Math.max(1, elites !== undefined ? elites : 2);
  for (let i = 0; i < eliteCount && i < sorted.length && next.length < population; i++) {
    next.push(Float32Array.from(sorted[i].genome));
    protectedGenomes.add(sorted[i].genome);
  }

  // 2. Pace Champion Preservation (protect the car that achieved the fastest individual lap)
  const validLapCars = sorted
    .filter((s) => s.bestLap && Number.isFinite(s.bestLap) && s.bestLap > 0 && s.bestLap < 60)
    .sort((a, b) => a.bestLap - b.bestLap);

  if (validLapCars.length > 0 && next.length < population) {
    const fastestLapCar = validLapCars[0];
    const alreadyIncluded = next.some(g => hasSameGenome(g, fastestLapCar.genome));
    if (!alreadyIncluded) {
      next.push(Float32Array.from(fastestLapCar.genome));
      protectedGenomes.add(fastestLapCar.genome);
    }
  }

  // 3. Hall-of-Fame Immortal Champions (guarantees the proven record racing line is NEVER lost)
  // Only inject if not already present in this generation's elites.
  if (allTimeBest && allTimeBest.genome && next.length < population) {
    if (!next.some(g => hasSameGenome(g, allTimeBest.genome))) {
      next.push(Float32Array.from(allTimeBest.genome));
      protectedGenomes.add(allTimeBest.genome);
    }
  }
  if (fastestLapChampion && fastestLapChampion.genome && next.length < population) {
    if (!next.some(g => hasSameGenome(g, fastestLapChampion.genome))) {
      next.push(Float32Array.from(fastestLapChampion.genome));
      protectedGenomes.add(fastestLapChampion.genome);
    }
  }

  // 4. Stagnation Breaker: Inject targeted Wildcard Explorers when plateauing
  if ((isPlateauing || isBurstActive) && next.length < population) {
    const hotParent = finishers[0] || validLapCars[0] || sorted[0];
    if (hotParent) {
      // Wildcard 1: Late Braker (delays braking on entry, earlier on gas)
      next.push(lock(mutateLateBraker(hotParent.genome, effectiveSigma * 1.15), hotParent.genome));

      // Wildcard 2: Apex Slicer (smooth kerb entry)
      if (next.length < population) {
        next.push(lock(mutateApexSlicer(hotParent.genome, effectiveSigma * 1.15), hotParent.genome));
      }

      // Wildcard 3: Apex Hunter (momentum carrier)
      if (next.length < population) {
        next.push(lock(mutateApexHunter(hotParent.genome, effectiveSigma * 1.20), hotParent.genome));
      }
    }
  }

  // 5. Standard dynamic explorers (8-16% of population)
  const explorerPct = isBurstActive ? 0.16 : (isPlateauing ? 0.12 : 0.08);
  const explorers = Math.max(1, Math.floor(population * explorerPct));
  for (let i = 0; i < explorers && next.length < population; i++) {
    const parent = parentPool[(Math.random() * Math.min(8, parentPool.length)) | 0];
    const expSigma = isBurstActive ? effectiveSigma * 1.25 : (isPlateauing ? effectiveSigma * 1.15 : effectiveSigma * 1.10);
    const expRate = isBurstActive ? 0.20 : 0.15;
    next.push(lock(mutate(Float32Array.from(parent.genome), expRate, expSigma), parent.genome));
  }

  // 6. Preserve most proven policies with small local changes.
  // CRITICAL: Even during a burst, preserve 45% of the population as slightly mutated clones of proven finishers!
  // This guarantees the population NEVER loses the learned racing line.
  const localRatio = isBurstActive ? 0.45 : 0.60;
  const localOffspring = finishers.length ? Math.floor(population * localRatio) : 0;
  for (let i = 0; i < localOffspring && next.length < population; i++) {
    const parent = tournament(finishers, tournamentK);
    next.push(mutate(Float32Array.from(parent.genome), effectiveRate * 0.35, effectiveSigma * 0.15));
  }

  // 5. Breed rest of population via tournament selection & blended crossover
  // Keep a small pace-exploration lane; most offspring inherit proven finishers.
  while (next.length < population) {
    const a = tournament(parentPool, tournamentK);
    const b = (validLapCars.length >= 2 && Math.random() < 0.20)
      ? paceTournament(validLapCars, tournamentK)
      : tournament(parentPool, tournamentK);
    next.push(lock(mutate(crossover(a.genome, b.genome), effectiveRate, effectiveSigma), a.genome));
  }
  return next;
}

/** Population of one exact copy + mutated variants of a saved genome. */
export function seedPopulation(genome, { population, mutationRate, mutationSigma }) {
  const next = [Float32Array.from(genome)];
  while (next.length < population) next.push(mutate(Float32Array.from(genome), mutationRate, mutationSigma));
  return next;
}
