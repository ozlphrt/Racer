// Reproduce training from an exported brain without modifying browser saves.
// Usage: node scripts/analyze-starts.js export.json [generations=25] [seed=10822]
import { readFileSync } from 'node:fs';
import { CONFIG } from '../js/config.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { Simulation } from '../js/simulation.js';
import { seedPopulation } from '../js/genetics.js';
import { NeuralNetwork } from '../js/neuralNetwork.js';

const [path, generations = '25', seed = '10822'] = process.argv.slice(2);
if (!path) throw new Error('Supply an exported brain JSON path.');
const data = JSON.parse(readFileSync(path, 'utf8'));
if (!Number.isInteger(Number(generations)) || Number(generations) < 1 || !Number.isInteger(Number(seed))) {
  throw new Error('Generations must be a positive integer and seed must be an integer.');
}
if (!TRACK_PRESETS[data.track] || JSON.stringify(data.layers) !== JSON.stringify(CONFIG.nn.layers) ||
    !Array.isArray(data.genome) || data.genome.length !== NeuralNetwork.genomeSize(CONFIG.nn.layers) ||
    !data.genome.every(Number.isFinite)) throw new Error('Export must contain a supported track and a compatible finite genome.');
let state = Number(seed) >>> 0;
Math.random = () => {
  state += 0x6D2B79F5;
  let n = state;
  n = Math.imul(n ^ n >>> 15, n | 1);
  n ^= n + Math.imul(n ^ n >>> 7, n | 61);
  return ((n ^ n >>> 14) >>> 0) / 4294967296;
};
const track = new Track(TRACK_PRESETS[data.track].points, CONFIG.track.width, CONFIG.track.samples);
const sim = new Simulation(track, CONFIG);
sim.captureEnabled = false;
sim.startGeneration(seedPopulation(data.genome, CONFIG.ga));
const slots = Array.from({ length: CONFIG.ga.population }, (_, slot) =>
  ({ slot, starts: 0, finished: 0, crashed: 0, earlyCrash: 0, runoff: 0 }));
const originalEnd = sim.endGeneration.bind(sim);
sim.endGeneration = reason => {
  for (const car of sim.cars) {
    const row = slots[car.gridSlot], crash = car.crashDiagnostic;
    row.starts++;
    row.finished += Number(car.finished);
    row.crashed += Number(Boolean(crash));
    row.runoff += Number(crash?.cause === 'runoff');
    row.earlyCrash += Number(Boolean(crash?.approachSummary?.patterns.includes('launch')));
  }
  originalEnd(reason);
};
while (sim.history.length < Number(generations)) sim.step();
const totals = slots.reduce((sum, row) => {
  for (const key of ['starts', 'finished', 'crashed', 'earlyCrash', 'runoff']) sum[key] = (sum[key] || 0) + row[key];
  return sum;
}, {});
console.log(JSON.stringify({ seed: Number(seed), generations: Number(generations), totals,
  completion: totals.finished / totals.starts,
  bestLap: sim.bestLapEver, slots,
  races: sim.history.map(r => ({ generation: r.generation, finished: r.finishers, bestLap: r.bestLap })) }, null, 2));
