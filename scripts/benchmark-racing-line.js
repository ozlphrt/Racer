// node scripts/benchmark-racing-line.js export.json report.json [trials=240] [seed=20261020]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG } from '../js/config.js';
import { NeuralNetwork } from '../js/neuralNetwork.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { physicsSignature } from '../js/milestones.js';
import { makeRacingLine } from './racingLinePlanner.js';
import { evaluatePlanner } from './plannerEvaluation.js';

const [input, output, trialText = '240', seedText = '20261020'] = process.argv.slice(2);
if (!input || !output || resolve(input).toLowerCase() === resolve(output).toLowerCase()) throw new Error('Use separate input and output paths.');
const data = JSON.parse(readFileSync(input, 'utf8')), trials = +trialText, seed = +seedText;
if (!Number.isInteger(trials) || trials < 1 || !Number.isInteger(seed) || !TRACK_PRESETS[data.track] ||
    data.layers?.join() !== CONFIG.nn.layers.join() || !Array.isArray(data.genome) ||
    data.genome.length !== NeuralNetwork.genomeSize(data.layers) || !data.genome.every(Number.isFinite) || CONFIG.generation.maxLaps !== 5) {
  throw new Error('Invalid arguments, incompatible brain or race distance.');
}
let state = seed >>> 0;
function random() {
  state += 0x6D2B79F5; let n = state;
  n = Math.imul(n ^ n >>> 15, n | 1); n ^= n + Math.imul(n ^ n >>> 7, n | 61);
  return ((n ^ n >>> 14) >>> 0) / 4294967296;
}
const track = new Track(TRACK_PRESETS[data.track].points, CONFIG.track.width, CONFIG.track.samples);
const lines = [[0, 14], [180, 14], [600, 14], [1500, 14], [600, 20], [1500, 20]]
  .map(([iterations, margin]) => makeRacingLine(track, iterations, margin));
function evaluate(options, slot = 0) {
  return evaluatePlanner(track, data.genome, options, options ? lines[options.line] : null, slot, seed);
}
const baseline = Array.from({ length: 20 }, (_, slot) => evaluate(null, slot));
if (baseline.some(r => !r.finished || r.assisted)) throw new Error('Source must finish all 20 starts unassisted.');
const candidates = [], outcomeCounts = {};
for (let trial = 0; trial < trials; trial++) {
  let options = { line: trial % lines.length,
    lateralAcceleration: 120 + random() * 750, brakingAcceleration: 110 + random() * 310,
    lookaheadTime: 0.12 + random() * 0.35, headingGain: 1 + random() * 6,
    pedalGain: 0.015 + random() * 0.045, brakeCap: [0.6, 0.75, 0.9, 1][Math.floor(random() * 4)] };
  if (trial >= Math.floor(trials / 2)) {
    const viable = candidates.filter(c => c.metrics.finished && !c.metrics.assisted)
      .sort((a, b) => a.metrics.flyingMean - b.metrics.flyingMean);
    const parents = [...new Set([...viable.slice(0, 4), ...viable.filter(c => c.metrics.offTrackSeconds === 0).slice(0, 4)])];
    if (parents.length) {
      options = { ...parents[Math.floor(random() * parents.length)].options };
      for (const key of ['lateralAcceleration', 'brakingAcceleration', 'lookaheadTime', 'headingGain', 'pedalGain']) {
        options[key] *= Math.exp((random() - 0.5) * 0.5);
      }
      options.lookaheadTime = Math.max(0.1, Math.min(0.7, options.lookaheadTime));
      options.brakingAcceleration = Math.max(80, Math.min(440, options.brakingAcceleration));
      if (random() < 0.2) options.line = Math.floor(random() * lines.length);
      if (random() < 0.2) options.brakeCap = [0.6, 0.75, 0.9, 1][Math.floor(random() * 4)];
    }
  }
  const metrics = evaluate(options);
  const key = metrics.finished && !metrics.assisted ? 'clean-finish' : metrics.outcome;
  outcomeCounts[key] = (outcomeCounts[key] || 0) + 1;
  candidates.push({ options, metrics });
  if ((trial + 1) % 40 === 0) console.log(JSON.stringify({ tested: trial + 1, outcomeCounts }));
}
const mean = (rows, key) => rows.reduce((sum, r) => sum + r[key], 0) / rows.length;
const clean = candidates.filter(c => c.metrics.finished && !c.metrics.assisted)
  .sort((a, b) => a.metrics.flyingMean - b.metrics.flyingMean || a.metrics.raceTime - b.metrics.raceTime);
const finalists = [];
const shortlist = [...new Set([...clean.slice(0, 3), ...clean.filter(c => c.metrics.offTrackSeconds === 0).slice(0, 3)])];
for (const candidate of shortlist) {
  const starts = Array.from({ length: 20 }, (_, slot) => evaluate(candidate.options, slot));
  const complete = starts.every(r => r.finished && !r.assisted);
  const referenceBestImproved = starts[0].bestLap < baseline[0].bestLap - 0.005;
  const noExtraRunoff = starts.every((r, slot) => r.offTrackSeconds <= baseline[slot].offTrackSeconds + CONFIG.dt);
  const noPaceRegression = starts.every((r, slot) => r.flyingMean !== null && r.flyingMean <= baseline[slot].flyingMean + 0.005);
  const fasterRace = complete && mean(starts, 'raceTime') < mean(baseline, 'raceTime') - 0.005;
  const rejectionReasons = [];
  if (!complete) rejectionReasons.push('not twenty unassisted finishes');
  if (!referenceBestImproved) rejectionReasons.push('reference best lap did not improve');
  if (!noExtraRunoff) rejectionReasons.push('more off-track time than champion (one tick tolerance)');
  if (!noPaceRegression) rejectionReasons.push('flying pace regressed in at least one grid slot');
  if (!fasterRace) rejectionReasons.push('mean full-race time did not improve');
  const accepted = complete && referenceBestImproved && noExtraRunoff && noPaceRegression && fasterRace;
  const centerlineStarts = Array.from({ length: 20 }, (_, slot) => evaluate({ ...candidate.options, line: 0 }, slot));
  finalists.push({ ...candidate, starts, accepted, rejectionReasons,
    cleanFinishes: starts.filter(r => r.finished && !r.assisted).length,
    meanRaceTime: complete ? mean(starts, 'raceTime') : null,
    centerlineAblation: { starts: centerlineStarts,
      cleanFinishes: centerlineStarts.filter(r => r.finished && !r.assisted).length,
      meanRaceTime: centerlineStarts.every(r => r.finished && !r.assisted) ? mean(centerlineStarts, 'raceTime') : null } });
}
const report = { format: 'offline-racing-line-benchmark-v1', originGeneration: data.generation, track: data.track,
  compatibleWithLiveBrain: false, trials, seed, signature: physicsSignature(track, CONFIG),
  protocol: 'Privileged whole-track geometry; relaxed paths with 14 or 20 world units of nominal center clearance from asphalt edge. Actual vehicle excursions are measured separately. Curvature speed limit and backward braking envelope. Existing Car physics, barriers and recovery unchanged. Twenty solo five-lap starts for finalists; matched centerline ablation. No learned policy or live deployment. Gate requires faster reference best lap and mean race, no per-slot flying regression above 0.005s, twenty unassisted finishes, and no extra off-track time above one physics tick.',
  baseline: { starts: baseline, meanRaceTime: mean(baseline, 'raceTime') }, outcomeCounts,
  lines: lines.map(line => ({ iterations: line.iterations, margin: line.margin, x: Array.from(line.x), y: Array.from(line.y), offset: Array.from(line.offset) })),
  candidates, finalists, accepted: finalists.some(r => r.accepted) };
writeFileSync(output, JSON.stringify(report, null, 2));
console.log(JSON.stringify({ report: output, cleanTrials: clean.length, bestTrial: clean[0] || null,
  finalists: finalists.map(r => ({ options: r.options, cleanFinishes: r.cleanFinishes, meanRaceTime: r.meanRaceTime,
    referenceBestLap: r.starts[0].bestLap, centerlineMeanRaceTime: r.centerlineAblation.meanRaceTime, accepted: r.accepted })) }));
