// Refine startup safety against recorded finalists, without retuning physics.
// node scripts/refine-planner-starts.js export.json benchmark.json report.json
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG } from '../js/config.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { physicsSignature } from '../js/milestones.js';
import { makeRacingLine } from './racingLinePlanner.js';
import { evaluatePlanner } from './plannerEvaluation.js';

const [input, previous, output] = process.argv.slice(2);
if (!input || !previous || !output || [input, previous].some(p => resolve(p).toLowerCase() === resolve(output).toLowerCase())) throw new Error('Supply separate source, benchmark and output paths.');
const data = JSON.parse(readFileSync(input, 'utf8')), source = JSON.parse(readFileSync(previous, 'utf8'));
if (!TRACK_PRESETS[data.track] || source.track !== data.track || source.originGeneration !== data.generation ||
    data.layers?.join() !== CONFIG.nn.layers.join() || !Array.isArray(data.genome) ||
    !data.genome.every(Number.isFinite) || data.genome.length !== 230 || CONFIG.generation.maxLaps !== 5) throw new Error('Mismatched source benchmark.');
const track = new Track(TRACK_PRESETS[data.track].points, CONFIG.track.width, CONFIG.track.samples);
if (source.signature !== physicsSignature(track, CONFIG)) throw new Error('Physics mismatch.');
const lines = source.lines.map(l => makeRacingLine(track, l.iterations, l.margin));
const baseline = Array.from({ length: 20 }, (_, slot) => evaluatePlanner(track, data.genome, null, null, slot, source.seed));
const mean = (rows, key) => rows.reduce((s, r) => s + r[key], 0) / rows.length;
const results = [];
for (let candidate = 0; candidate < source.finalists.length; candidate++) {
  const parent = source.finalists[candidate];
  if (parent.cleanFinishes !== 20 || parent.starts[0].bestLap >= baseline[0].bestLap - 0.005) continue;
  for (const scale of [1, 0.99, 0.98, 0.97, 0.96, 0.95, 0.94, 0.92, 0.9]) {
    const options = { ...parent.options, firstLapSpeedScale: scale };
    const starts = Array.from({ length: 20 }, (_, slot) => evaluatePlanner(track, data.genome, options, lines[options.line], slot, source.seed));
    const complete = starts.every(r => r.finished && !r.assisted);
    const accepted = complete && starts[0].bestLap < baseline[0].bestLap - 0.005 &&
      mean(starts, 'raceTime') < mean(baseline, 'raceTime') - 0.005 &&
      starts.every((r, i) => r.flyingMean !== null && r.flyingMean <= baseline[i].flyingMean + 0.005 &&
        r.offTrackSeconds <= baseline[i].offTrackSeconds + CONFIG.dt);
    const result = { candidate, options, starts, accepted,
      cleanFinishes: starts.filter(r => r.finished && !r.assisted).length,
      runoffStarts: starts.filter(r => r.offTrackSeconds > CONFIG.dt).length,
      maxOffTrackSeconds: Math.max(...starts.map(r => r.offTrackSeconds)),
      meanRaceTime: complete ? mean(starts, 'raceTime') : null, referenceBestLap: starts[0].bestLap };
    results.push(result);
    console.log(JSON.stringify({ candidate, scale, clean: result.cleanFinishes, runoffStarts: result.runoffStarts,
      meanRaceTime: result.meanRaceTime, referenceBestLap: result.referenceBestLap, accepted }));
  }
}
writeFileSync(output, JSON.stringify({ format: 'offline-planner-start-refinement-v1', originGeneration: data.generation,
  track: data.track, signature: source.signature, seed: source.seed, compatibleWithLiveBrain: false,
  protocol: 'First-lap target-speed scaling only; steady-state line, speed profile and physics unchanged. Each variant gets twenty solo five-lap starts. Same pace, assistance and runoff gate as source benchmark.',
  lines: source.lines, baseline, results, accepted: results.some(r => r.accepted) }, null, 2));
