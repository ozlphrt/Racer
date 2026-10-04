import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { CONFIG } from '../js/config.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { Simulation } from '../js/simulation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const publicDir = path.resolve(__dirname, '../public');

if (!fs.existsSync(publicDir)) {
  fs.mkdirSync(publicDir, { recursive: true });
}

const trackKey = process.argv[2] || 'grand-prix';
const totalGenerations = Number(process.argv[3] || 150);

console.log(`=== Training AI Champion on track: ${trackKey} for ${totalGenerations} generations ===`);
const preset = TRACK_PRESETS[trackKey] || TRACK_PRESETS['grand-prix'];
const track = new Track(preset.points, CONFIG.track.width, CONFIG.track.samples);
const sim = new Simulation(track, CONFIG);

const t0 = Date.now();
let steps = 0;
let bestFitness = -Infinity;
let bestLap = Infinity;
let bestGenome = null;
let lastReportGen = 0;

for (let g = 1; g <= totalGenerations; g++) {
  // Anneal mutation rate slightly as generations advance to lock in precision racing lines
  if (g > 30 && g <= 80) {
    sim.mutationRate = 0.09;
  } else if (g > 80) {
    sim.mutationRate = 0.05;
  }

  // Step until generation completes
  const startGen = sim.generation;
  while (sim.generation === startGen) {
    sim.step();
    steps++;
  }

  const latest = sim.history[sim.history.length - 1];
  if (sim.allTimeBest && sim.allTimeBest.fitness > bestFitness) {
    bestFitness = sim.allTimeBest.fitness;
    bestGenome = Array.from(sim.allTimeBest.genome, (v) => +v.toFixed(5));
  }
  if (Number.isFinite(sim.bestLapEver) && sim.bestLapEver < bestLap) {
    bestLap = sim.bestLapEver;
  }

  if (g % 10 === 0 || g === 1 || g === totalGenerations) {
    console.log(
      `[Gen ${String(g).padStart(3)}/${totalGenerations}] ` +
      `Best Fit: ${String(latest?.best?.toFixed(0) ?? 0).padStart(6)} | ` +
      `Avg Fit: ${String(latest?.avg?.toFixed(0) ?? 0).padStart(6)} | ` +
      `Gen Lap: ${latest?.bestLap && Number.isFinite(latest.bestLap) ? latest.bestLap.toFixed(2) + 's' : '  -  '} | ` +
      `All-Time Best Lap: ${Number.isFinite(bestLap) ? bestLap.toFixed(2) + 's' : '  -  '} | ` +
      `Finishers: ${latest?.finishers ?? 0}`
    );
    lastReportGen = g;
  }
}

const elapsedSec = (Date.now() - t0) / 1000;
console.log(`\nTraining complete in ${elapsedSec.toFixed(1)}s (${(steps * CONFIG.dt / elapsedSec).toFixed(0)}× real-time)`);
console.log(`Final All-Time Record Lap: ${bestLap.toFixed(2)}s | Peak Fitness: ${bestFitness.toFixed(0)}`);

if (sim.allTimeBest) {
  const championData = {
    version: 1,
    track: trackKey,
    layers: [...CONFIG.nn.layers],
    genome: Array.from(sim.allTimeBest.genome, (v) => +v.toFixed(5)),
    fitness: sim.allTimeBest.fitness,
    generation: sim.allTimeBest.generation,
    bestLap: Number.isFinite(sim.allTimeBest.bestLap) ? sim.allTimeBest.bestLap : bestLap,
    savedAt: new Date().toISOString(),
    trainingMeta: {
      totalGenerations,
      elapsedSec: +elapsedSec.toFixed(1),
      physicsDt: CONFIG.dt,
      fpsEquivalent: 60,
    }
  };

  const outPath = path.join(publicDir, 'pretrained-brain.json');
  fs.writeFileSync(outPath, JSON.stringify(championData, null, 2), 'utf-8');
  console.log(`Saved champion brain to: ${outPath}`);

  const trackOutPath = path.join(publicDir, `pretrained-${trackKey}.json`);
  fs.writeFileSync(trackOutPath, JSON.stringify(championData, null, 2), 'utf-8');
  console.log(`Saved track champion to: ${trackOutPath}`);
}
