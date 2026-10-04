// Headless sanity check: track geometry + does the population actually learn?
// Usage: node scripts/headless-train.js [generations]
import { CONFIG } from '../js/config.js';
import { Track, TRACK_POINTS } from '../js/track.js';
import { Simulation } from '../js/simulation.js';

const gens = Number(process.argv[2] ?? 60);
const track = new Track(TRACK_POINTS, CONFIG.track.width, CONFIG.track.samples);

let maxK = 0;
for (const k of track.curvature) maxK = Math.max(maxK, Math.abs(k));
console.log(
  `Track length ${track.length.toFixed(0)}, spacing ${track.spacing.toFixed(2)}, ` +
    `min corner radius ${(1 / maxK).toFixed(1)} (half width ${track.half})`,
);
if (1 / maxK <= track.half) console.warn('⚠ Inner wall self-intersects at the tightest corner!');

const sim = new Simulation(track, CONFIG);
const t0 = Date.now();
let steps = 0;
let firstLapGen = null;
while (sim.generation <= gens) {
  sim.step();
  steps++;
}
for (const r of sim.history) {
  if (firstLapGen === null && Number.isFinite(r.bestLap)) firstLapGen = r.generation;
  if (r.generation % 5 === 0 || r.generation === 1) {
    console.log(
      `gen ${String(r.generation).padStart(3)}  best ${r.best.toFixed(0).padStart(6)}  avg ${r.avg
        .toFixed(0)
        .padStart(6)}  bestLap ${Number.isFinite(r.bestLap) ? r.bestLap.toFixed(2) + 's' : '  -  '}  finishers ${r.finishers}`,
    );
  }
}
const secs = (Date.now() - t0) / 1000;
console.log(`\nFirst lap at gen ${firstLapGen ?? 'never'}; best lap ever ${sim.bestLapEver.toFixed(2)}s`);
console.log(`${steps} steps in ${secs.toFixed(1)}s → ${(steps * CONFIG.dt / secs).toFixed(0)}× real-time`);
