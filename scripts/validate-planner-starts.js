// node scripts/validate-planner-starts.js export.json refinement.json report.json
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG } from '../js/config.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { physicsSignature } from '../js/milestones.js';
import { makeRacingLine } from './racingLinePlanner.js';
import { evaluatePlanner } from './plannerEvaluation.js';
const [input, previous, output] = process.argv.slice(2);
if (!input || !previous || !output || [input, previous].some(p => resolve(p).toLowerCase() === resolve(output).toLowerCase())) throw new Error('Use separate input and output files.');
const data = JSON.parse(readFileSync(input, 'utf8')), source = JSON.parse(readFileSync(previous, 'utf8'));
if (!TRACK_PRESETS[data.track] || source.track !== data.track || source.originGeneration !== data.generation ||
    data.layers?.join() !== CONFIG.nn.layers.join() || !Array.isArray(data.genome) ||
    data.genome.length !== 230 || !data.genome.every(Number.isFinite) || CONFIG.generation.maxLaps !== 5) throw new Error('Source mismatch.');
const track = new Track(TRACK_PRESETS[data.track].points, CONFIG.track.width, CONFIG.track.samples);
if (source.signature !== physicsSignature(track, CONFIG)) throw new Error('Physics mismatch.');
let rng = 54321;
const random = () => { rng = (Math.imul(rng, 1664525) + 1013904223) >>> 0; return rng / 4294967296; };
const starts = Array.from({ length: 100 }, (_, index) => ({ slot: index % 20, seed: 54321 + index,
  perturbation: { lateral: (random() - 0.5) * 4, longitudinal: (random() - 0.5) * 4, heading: (random() - 0.5) * 4 * Math.PI / 180 } }));
const baseline = starts.map(s => evaluatePlanner(track, data.genome, null, null, s.slot, s.seed, false, s.perturbation));
const finalists = source.results.filter(r => r.accepted && [0.98, 0.96, 0.94].includes(r.options.firstLapSpeedScale));
const mean = rows => rows.every(r => r.finished && !r.assisted) ? rows.reduce((s, r) => s + r.raceTime, 0) / rows.length : null;
const results = [];
for (const candidate of finalists) {
  const spec = source.lines[candidate.options.line], line = makeRacingLine(track, spec.iterations, spec.margin);
  const rows = starts.map(s => evaluatePlanner(track, data.genome, candidate.options, line, s.slot, s.seed, false, s.perturbation));
  const accepted = rows.every((r, i) => r.finished && !r.assisted && r.offTrackSeconds <= baseline[i].offTrackSeconds + CONFIG.dt &&
    r.flyingMean !== null && baseline[i].flyingMean !== null && r.flyingMean <= baseline[i].flyingMean + 0.005) &&
    mean(rows) !== null && mean(baseline) !== null && mean(rows) < mean(baseline) - 0.005;
  const result = { options: candidate.options, line: spec, rows, accepted,
    unassistedFinishes: rows.filter(r => r.finished && !r.assisted).length,
    runoffStarts: rows.filter(r => r.offTrackSeconds > CONFIG.dt).length,
    maxOffTrackSeconds: Math.max(...rows.map(r => r.offTrackSeconds)), meanRaceTime: mean(rows) };
  results.push(result);
  console.log(JSON.stringify({ firstLapSpeedScale: candidate.options.firstLapSpeedScale, accepted,
    unassistedFinishes: result.unassistedFinishes, runoffStarts: result.runoffStarts, meanRaceTime: result.meanRaceTime,
    baselineMeanRaceTime: mean(baseline) }));
}
writeFileSync(output, JSON.stringify({ format: 'offline-planner-perturbed-start-validation-v1', originGeneration: data.generation,
  track: data.track, signature: source.signature, protocol: '100 paired five-lap solo starts; all 20 grid slots, lateral/longitudinal perturbations within ±2 world units, heading within ±2 degrees; fixed independent seed 54321. Same physics and limits. Not traffic or unseen-track validation.',
  starts, baseline, baselineMeanRaceTime: mean(baseline), results }, null, 2));
