import { randn } from './math.js';

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

// Track historical plateau progress across generations
let peakFitnessHistory = 0;
let recentBestLapHistory = Infinity;
let stagnantGenerationsCount = 0;
let paceStagnantGenerationsCount = 0;
let burstGensRemaining = 0;

export function triggerExplorationBurst(gens = 30) {
  burstGensRemaining = gens;
  stagnantGenerationsCount = 0;
  paceStagnantGenerationsCount = 0;
  return burstGensRemaining;
}

export function getBurstGensRemaining() {
  return burstGensRemaining;
}

export function getStagnantGenerationsCount() {
  return Math.max(stagnantGenerationsCount, paceStagnantGenerationsCount);
}

export function resetStagnation() {
  stagnantGenerationsCount = 0;
  paceStagnantGenerationsCount = 0;
  burstGensRemaining = 0;
  peakFitnessHistory = 0;
  recentBestLapHistory = Infinity;
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
    if (Math.random() < 0.28) {
      g[i] += randn() * sigma;
    }
  }
  // Target steer output weights (penultimate output neuron)
  const steerNeuronOffset = Math.max(0, n - 24);
  for (let i = steerNeuronOffset; i < n - 2; i++) {
    if (Math.random() < 0.45) {
      g[i] += (randn() * 1.2) * sigma;
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

/**
 * Build the next generation: elites survive unchanged, pace-champions are protected,
 * and high-variance wildcard explorers break through plateaus.
 * @param {{genome: Float32Array, fitness: number, bestLap?: number}[]} scored
 */
export function evolve(scored, { population, elites, tournamentK, mutationRate, mutationSigma, bestLapEver, genBestLap }) {
  const sorted = [...scored].sort((a, b) => b.fitness - a.fitness);
  const next = [];

  // 1. Track Fitness & Pace Progression
  const topFit = sorted[0]?.fitness || 0;
  if (topFit > peakFitnessHistory * 1.008 + 150) {
    peakFitnessHistory = topFit;
    stagnantGenerationsCount = 0;
  } else {
    stagnantGenerationsCount++;
  }

  // 2. Pace Gap Stagnation Detector (tracks deficit to historic record)
  const hasRecord = typeof bestLapEver === 'number' && Number.isFinite(bestLapEver) && bestLapEver > 5 && bestLapEver < 40;
  const currentGenLap = typeof genBestLap === 'number' && Number.isFinite(genBestLap) && genBestLap > 5 ? genBestLap : null;

  if (currentGenLap) {
    if (currentGenLap < recentBestLapHistory - 0.015) {
      recentBestLapHistory = currentGenLap;
      stagnantGenerationsCount = 0;
    }

    if (hasRecord) {
      const gapToRecord = currentGenLap - bestLapEver;
      // If gap to record remains stagnant > 0.40s for an extended campaign
      if (gapToRecord > 0.40) {
        paceStagnantGenerationsCount++;
        // Give 100 generations of exploitation before a brief 20-gen catalyst burst
        if (paceStagnantGenerationsCount >= 100 && burstGensRemaining === 0) {
          triggerExplorationBurst(20);
        }
      } else {
        paceStagnantGenerationsCount = Math.max(0, paceStagnantGenerationsCount - 3);
      }
    }
  }

  const isBurstActive = burstGensRemaining > 0;
  if (burstGensRemaining > 0) burstGensRemaining--;

  // Multi-tier stagnation detection (prolonged 80+ gen plateau, sustained deficit, or manual burst)
  const isPlateauing = stagnantGenerationsCount >= 80 || paceStagnantGenerationsCount >= 80 || isBurstActive;
  const burstMultiplier = isBurstActive ? 1.4 : (isPlateauing ? 1.2 : 1.0);
  const effectiveSigma = mutationSigma * burstMultiplier;
  const effectiveRate = Math.min(0.28, mutationRate * burstMultiplier);

  // 1. Keep top elite champions unchanged (guarantees zero regression of best race pace)
  const eliteCount = Math.max(1, elites !== undefined ? elites : 2);
  for (let i = 0; i < eliteCount && i < sorted.length; i++) {
    next.push(Float32Array.from(sorted[i].genome));
  }

  // 2. Pace Champion Preservation (protect the car that achieved the fastest individual lap)
  const validLapCars = sorted
    .filter((s) => s.bestLap && Number.isFinite(s.bestLap) && s.bestLap > 0 && s.bestLap < 60)
    .sort((a, b) => a.bestLap - b.bestLap);

  if (validLapCars.length > 0 && next.length < population) {
    const fastestLapCar = validLapCars[0];
    const alreadyIncluded = next.some((g) => g === fastestLapCar.genome);
    if (!alreadyIncluded) {
      next.push(Float32Array.from(fastestLapCar.genome));
    }
  }

  // 3. Stagnation Breaker: Inject targeted Wildcard Explorers when truly plateauing
  if ((isPlateauing || isBurstActive) && next.length < population) {
    const hotParent = validLapCars[0] || sorted[0];
    if (hotParent) {
      // Wildcard 1: Late Braker (delays braking on entry, earlier on gas)
      next.push(mutateLateBraker(hotParent.genome, effectiveSigma * 1.25));

      // Wildcard 2: Apex Slicer (tighter kerb clipping & apex entry)
      if (next.length < population) {
        next.push(mutateApexSlicer(hotParent.genome, effectiveSigma * 1.35));
      }

      // Wildcard 3: Apex Hunter (high momentum carrier)
      if (next.length < population) {
        next.push(mutateApexHunter(hotParent.genome, effectiveSigma * 1.45));
      }
    }
  }

  // 4. Standard dynamic explorers (8-18% of population)
  const explorerPct = isBurstActive ? 0.18 : (isPlateauing ? 0.14 : 0.08);
  const explorers = Math.max(1, Math.floor(population * explorerPct));
  for (let i = 0; i < explorers && next.length < population; i++) {
    const parent = sorted[(Math.random() * Math.min(8, sorted.length)) | 0];
    const expSigma = isBurstActive ? effectiveSigma * 1.4 : (isPlateauing ? effectiveSigma * 1.25 : effectiveSigma * 1.15);
    const expRate = isBurstActive ? 0.22 : 0.16;
    next.push(mutate(Float32Array.from(parent.genome), expRate, expSigma));
  }

  // 5. Breed rest of population via tournament selection & blended crossover
  // 40% of the time, select parent B from single-lap pace champions rather than 5-lap survivors
  while (next.length < population) {
    const a = tournament(sorted, tournamentK);
    const b = (validLapCars.length >= 2 && Math.random() < 0.40)
      ? paceTournament(validLapCars, tournamentK)
      : tournament(sorted, tournamentK);
    next.push(mutate(crossover(a.genome, b.genome), effectiveRate, effectiveSigma));
  }
  return next;
}

/** Population of one exact copy + mutated variants of a saved genome. */
export function seedPopulation(genome, { population, mutationRate, mutationSigma }) {
  const next = [Float32Array.from(genome)];
  while (next.length < population) next.push(mutate(Float32Array.from(genome), mutationRate, mutationSigma));
  return next;
}
