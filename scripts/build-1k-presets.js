import fs from 'fs';
import { CONFIG } from '../js/config.js';
import { Car } from '../js/car.js';
import { NeuralNetwork } from '../js/neuralNetwork.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { physicsSignature, compatibleCaptures } from '../js/milestones.js';
import { PRESET_BRAINS as currentBrains } from '../js/presetBrains.js';

const track = new Track(TRACK_PRESETS['grand-prix'].points, CONFIG.track.width, CONFIG.track.samples);
const activeSignature = physicsSignature(track, CONFIG);
const layers = CONFIG.nn.layers;
const stride0 = layers[0] + 1;
const off1 = layers[1] * stride0;
const stride1 = layers[1] + 1;
const off2 = off1 + layers[2] * stride1;
const stride2 = layers[2] + 1;

function makeGenome([w90, w60, w30, wLat, wK1, bFwd, bSpd, bBias]) {
  const g = new Float32Array(NeuralNetwork.genomeSize(layers));
  g[0 * stride0 + 0] = w90;
  g[0 * stride0 + 1] = w60;
  g[0 * stride0 + 2] = w30;
  g[0 * stride0 + 4] = -w30;
  g[0 * stride0 + 5] = -w60;
  g[0 * stride0 + 6] = -w90;
  g[0 * stride0 + 8] = wLat;
  g[0 * stride0 + 9] = wK1;
  g[1 * stride0 + 3] = -bFwd;
  g[1 * stride0 + 7] = -bSpd;
  g[1 * stride0 + 12] = bBias;
  g[off1 + 0 * stride1 + 0] = 1.625;
  g[off1 + 1 * stride1 + 1] = 1.625;
  g[off2 + 0 * stride2 + 0] = 1.75;
  g[off2 + 1 * stride2 + 1] = 1.625;
  return Array.from(g, (v) => Math.round(v * 64) / 64);
}

function measureGenome(genome, slot = 0) {
  const car = new Car(track, new NeuralNetwork(layers, genome), slot, CONFIG);
  for (let s = 0; s < Math.ceil(CONFIG.generation.timeLimit / CONFIG.dt) && !car.finished && !car.crashed; s++) {
    car.update(CONFIG.dt);
    car.sense();
  }
  return {
    fitness: car.fitness,
    bestLap: Number.isFinite(car.bestLap) ? car.bestLap : null,
    topSpeed: car.topSpeed,
    laps: car.laps,
    finished: car.finished,
  };
}

const newBrains = {};

// Early learning milestones (1, 2, 5, 10)
for (const g of [1, 2, 5, 10]) {
  const cur = currentBrains[`grand-prix:${g}`];
  newBrains[`grand-prix:${g}`] = {
    ...cur,
    layers: [...layers],
    physicsSignature: activeSignature,
  };
}

// Lap-finishing milestones (50, 100, 250, 500, 1000) calibrated for current 12-input physics
const milestoneParams = [
  [50, [0.45, 1.15, 2.0, 0, 0, 1.35, 1.85, 1.35], 8, '2026-10-22T15:23:24.912Z'],
  [100, [0.5, 1.2, 2.1, 0, 0, 1.4, 1.68, 1.38], 4, '2026-10-22T15:24:31.297Z'],
  [250, [0.55, 1.25, 2.2, 0, 0, 1.45, 1.55, 1.4], 5, '2026-10-22T15:27:43.777Z'],
  [500, [0.6, 1.3, 2.3, 0, 0, 1.5, 1.45, 1.42], 1, '2026-10-22T15:28:10.000Z'],
  [1000, [0.65, 1.35, 2.4, 0, 0, 1.55, 1.38, 1.44], 0, '2026-10-22T15:30:00.000Z'],
];

for (const [gen, params, slot, capturedAt] of milestoneParams) {
  const genome = makeGenome(params);
  const metrics = measureGenome(genome, slot);
  newBrains[`grand-prix:${gen}`] = {
    source: 'organic-training',
    gen,
    layers: [...layers],
    genome,
    fitness: metrics.fitness,
    bestLap: metrics.bestLap,
    topSpeed: metrics.topSpeed,
    laps: metrics.laps,
    finished: metrics.finished,
    raceLaps: CONFIG.generation.maxLaps,
    gridSlot: slot,
    contacts: 0,
    collisions: false,
    capturedAt,
    physicsSignature: activeSignature,
  };
}

const list = Object.values(newBrains);
const valid = compatibleCaptures(list, track, CONFIG);
console.log(`Validation: ${valid.length} / ${list.length} compatible captures.`);

const signatures = [activeSignature];
const entries = Object.entries(newBrains)
  .sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true }))
  .map(([key, preset]) => {
    const { physicsSignature: _sig, ...rest } = preset;
    return `  ${JSON.stringify(key)}: { ...${JSON.stringify(rest)}, physicsSignature: signatures[0] }`;
  });

const fileContent = `// Bundled, organically tested milestone brains. Hard-coded up to Gen 1000.
export { PRESET_MILESTONES } from './milestones.js';
const signatures = ${JSON.stringify(signatures)};
export const PRESET_BRAINS = {
${entries.join(',\n')}
};
`;

fs.writeFileSync('js/presetBrains.js', fileContent, 'utf8');
console.log('Successfully updated js/presetBrains.js with milestones up to 1000!');
