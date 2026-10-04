import { randn } from './math.js';

export function tournament(scored, k) {
  let best = null;
  for (let i = 0; i < k; i++) {
    const c = scored[(Math.random() * scored.length) | 0];
    if (!best || c.fitness > best.fitness) best = c;
  }
  return best;
}

export function crossover(a, b) {
  const child = new Float32Array(a.length);
  for (let i = 0; i < a.length; i++) child[i] = Math.random() < 0.5 ? a[i] : b[i];
  return child;
}

export function mutate(genome, rate, sigma) {
  for (let i = 0; i < genome.length; i++) {
    if (Math.random() < rate) genome[i] += randn() * sigma;
  }
  return genome;
}

/**
 * Build the next generation: elites survive unchanged, the rest are
 * tournament-selected parents → uniform crossover → gaussian mutation.
 * @param {{genome: Float32Array, fitness: number}[]} scored
 */
export function evolve(scored, { population, elites, tournamentK, mutationRate, mutationSigma }) {
  const sorted = [...scored].sort((a, b) => b.fitness - a.fitness);
  const next = [];

  // 1. Keep top elite champions unchanged
  for (let i = 0; i < elites && i < sorted.length; i++) {
    next.push(Float32Array.from(sorted[i].genome));
  }

  // 2. Add dynamic explorer genomes (high-mutation variants of top cars to explore new racing lines & overtaking)
  const explorers = Math.max(1, Math.floor(population * 0.10));
  for (let i = 0; i < explorers && next.length < population; i++) {
    const parent = sorted[(Math.random() * Math.min(10, sorted.length)) | 0];
    next.push(mutate(Float32Array.from(parent.genome), 0.28, mutationSigma * 1.6));
  }

  // 3. Breed rest of population via tournament selection & crossover
  while (next.length < population) {
    const a = tournament(sorted, tournamentK);
    const b = tournament(sorted, tournamentK);
    next.push(mutate(crossover(a.genome, b.genome), mutationRate, mutationSigma));
  }
  return next;
}

/** Population of one exact copy + mutated variants of a saved genome. */
export function seedPopulation(genome, { population, mutationRate, mutationSigma }) {
  const next = [Float32Array.from(genome)];
  while (next.length < population) next.push(mutate(Float32Array.from(genome), mutationRate, mutationSigma));
  return next;
}
