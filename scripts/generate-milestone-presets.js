// Capture only milestones actually completed by this fresh training run.
import fs from 'node:fs';
import { CONFIG } from '../js/config.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { Simulation } from '../js/simulation.js';
const trackKey = process.argv[2] || 'grand-prix';
const generations = Number(process.argv[3] || 180);
if (!TRACK_PRESETS[trackKey] || !Number.isInteger(generations) || generations < 1) {
  throw new Error('Usage: node scripts/generate-milestone-presets.js [track] [actual generations]');
}
const track = new Track(TRACK_PRESETS[trackKey].points, CONFIG.track.width, CONFIG.track.samples);
const sim = new Simulation(track, CONFIG);
sim.onMilestoneCaptured = (preset) => console.log('Captured actual generation', preset.gen, 'best lap:', preset.bestLap, 'laps:', preset.laps);
while (sim.generation <= generations) sim.step();
const output = { version: 1, track: trackKey, presets: sim.capturedPresets };
fs.writeFileSync(new URL('../public/captured-presets.json', import.meta.url), JSON.stringify(output, null, 2));
console.log('Saved', output.presets.length, 'tested checkpoints. No future milestones were generated.');
