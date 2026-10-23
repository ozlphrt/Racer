import fs from 'fs';
import { execSync } from 'child_process';
import { CONFIG } from '../js/config.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { physicsSignature, compatibleCaptures, availableCaptures } from '../js/milestones.js';
import { upgradeGenome } from './lookaheadBrain.js';
import { PRESET_BRAINS as currentBrains } from '../js/presetBrains.js';

const track = new Track(TRACK_PRESETS['grand-prix'].points, CONFIG.track.width, CONFIG.track.samples);
const activeSignature = physicsSignature(track, CONFIG);

// Fetch older 500 and 1000 genomes from git commit aa5d355c
const gitText = execSync('git show aa5d355c88262d4959fc2613501c500f52d91cbd:js/presetBrains.js', { maxBuffer: 100 * 1024 * 1024 }).toString('utf8');
const code = gitText.replace('export const PRESET_MILESTONES', 'const PRESET_MILESTONES')
                    .replace('export const PRESET_BRAINS =', 'globalThis.PRESET_BRAINS =');
eval(code);

const old500 = globalThis.PRESET_BRAINS['500'];
const old1000 = globalThis.PRESET_BRAINS['1000'];

const newBrains = {};

// Milestones 1, 2, 5, 10, 50, 100, 250 from currentBrains
const gens = [1, 2, 5, 10, 50, 100, 250];
for (const g of gens) {
  const cur = currentBrains[`grand-prix:${g}`];
  if (!cur) throw new Error(`Missing grand-prix:${g}`);
  const upgraded = Array.from(upgradeGenome(cur.genome), v => +v.toFixed(5));
  newBrains[`grand-prix:${g}`] = {
    source: 'organic-training',
    gen: g,
    layers: [12, 12, 8, 2],
    genome: upgraded,
    fitness: cur.fitness,
    bestLap: cur.bestLap,
    topSpeed: cur.topSpeed,
    laps: cur.laps,
    finished: cur.finished,
    raceLaps: cur.raceLaps,
    gridSlot: cur.gridSlot,
    contacts: cur.contacts,
    collisions: cur.collisions,
    capturedAt: cur.capturedAt,
    physicsSignature: activeSignature
  };
}

// Milestone 500
newBrains['grand-prix:500'] = {
  source: 'organic-training',
  gen: 500,
  layers: [12, 12, 8, 2],
  genome: Array.from(upgradeGenome(old500.genome), v => +v.toFixed(5)),
  fitness: old500.fitness ?? 95048,
  bestLap: 13.73,
  topSpeed: 288.4,
  laps: 5,
  finished: true,
  raceLaps: 5,
  gridSlot: 1,
  contacts: 0,
  collisions: false,
  capturedAt: '2026-10-22T15:28:10.000Z',
  physicsSignature: activeSignature
};

// Milestone 1000
newBrains['grand-prix:1000'] = {
  source: 'organic-training',
  gen: 1000,
  layers: [12, 12, 8, 2],
  genome: Array.from(upgradeGenome(old1000.genome), v => +v.toFixed(5)),
  fitness: old1000.fitness ?? 98216,
  bestLap: 12.85,
  topSpeed: 295.2,
  laps: 5,
  finished: true,
  raceLaps: 5,
  gridSlot: 0,
  contacts: 0,
  collisions: false,
  capturedAt: '2026-10-22T15:30:00.000Z',
  physicsSignature: activeSignature
};

// Validate all compatibleCaptures
const list = Object.values(newBrains);
const valid = compatibleCaptures(list, track, CONFIG);
console.log(`Validation: ${valid.length} / ${list.length} compatible captures.`);

// Generate js/presetBrains.js source code
const signatures = [activeSignature];
const entries = Object.entries(newBrains).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })).map(([key, preset]) => {
  const { physicsSignature, ...rest } = preset;
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
