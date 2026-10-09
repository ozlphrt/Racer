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
let stagnantGenerationsCount = 0;
let burstGensRemaining = 0;

export function triggerExplorationBurst(gens = 150) {
  burstGensRemaining = gens;
  stagnantGenerationsCount = 0;
  return burstGensRemaining;
}

export function getBurstGensRemaining() {
  return burstGensRemaining;
}

/**
 * Build the next generation: elites survive unchanged, the rest are
 * tournament-selected parents → blended crossover → adaptive precision mutation.
 * Automatically injects targeted exploratory pulse when stuck in a prolonged plateau (>35 gens),
 * or during a manual exploration burst.
 * @param {{genome: Float32Array, fitness: number}[]} scored
 */
export function evolve(scored, { population, elites, tournamentK, mutationRate, mutationSigma }) {
  const sorted = [...scored].sort((a, b) => b.fitness - a.fitness);
  const next = [];

  const topFit = sorted[0]?.fitness || 0;
  if (topFit > peakFitnessHistory + 25) {
    peakFitnessHistory = topFit;
    stagnantGenerationsCount = 0;
  } else {
    stagnantGenerationsCount++;
  }

  const isBurstActive = burstGensRemaining > 0;
  if (burstGensRemaining > 0) burstGensRemaining--;

  // Adaptive simulated annealing / plateau & exploration burst:
  const isPlateauing = stagnantGenerationsCount > 35 || isBurstActive;
  const burstMultiplier = isBurstActive ? 1.65 : (isPlateauing ? 1.25 : 1.0);
  const effectiveSigma = mutationSigma * burstMultiplier;
  const effectiveRate = Math.min(0.32, mutationRate * burstMultiplier);

  // 1. Keep top elite champions unchanged (guarantees zero regression of best lap time)
  const eliteCount = Math.max(1, elites !== undefined ? elites : 2);
  for (let i = 0; i < eliteCount && i < sorted.length; i++) {
    next.push(Float32Array.from(sorted[i].genome));
  }

  // 2. Add dynamic explorer genomes (high-mutation variants of top cars to explore new braking & apex lines)
  const explorerPct = isBurstActive ? 0.25 : (isPlateauing ? 0.15 : 0.10);
  const explorers = Math.max(1, Math.floor(population * explorerPct));
  for (let i = 0; i < explorers && next.length < population; i++) {
    const parent = sorted[(Math.random() * Math.min(10, sorted.length)) | 0];
    const expSigma = isBurstActive ? effectiveSigma * 2.0 : (isPlateauing ? effectiveSigma * 1.8 : effectiveSigma * 1.5);
    const expRate = isBurstActive ? 0.30 : 0.22;
    next.push(mutate(Float32Array.from(parent.genome), expRate, expSigma));
  }

  // 3. Breed rest of population via tournament selection & blended crossover
  while (next.length < population) {
    const a = tournament(sorted, tournamentK);
    const b = tournament(sorted, tournamentK);
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
