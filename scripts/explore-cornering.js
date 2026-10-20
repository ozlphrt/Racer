// Independent search: never reads browser saves, breeds the live population, or
// installs milestones. Usage: node scripts/explore-cornering.js export.json out.json [rounds=20] [seed=11464]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG } from '../js/config.js';
import { Car } from '../js/car.js';
import { NeuralNetwork } from '../js/neuralNetwork.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { TireBarrierSystem } from '../js/tireBarriers.js';
import { randn } from '../js/math.js';
import { validateChampion } from '../js/championValidation.js';
import { physicsSignature } from '../js/milestones.js';

const [input, output, rounds = '20', seed = '11464'] = process.argv.slice(2);
if (!input || !output) throw new Error('Supply an input brain and an output report path.');
if (resolve(input).toLowerCase() === resolve(output).toLowerCase()) throw new Error('The output must not overwrite the source brain.');
if (CONFIG.generation.maxLaps !== 5) throw new Error('This comparison protocol requires the five-lap configuration.');
const data = JSON.parse(readFileSync(input, 'utf8'));
if (!Number.isInteger(+rounds) || +rounds < 1 || !Number.isInteger(+seed) ||
    !TRACK_PRESETS[data.track] || data.layers?.join() !== CONFIG.nn.layers.join() ||
    !Array.isArray(data.genome) || data.genome.length !== NeuralNetwork.genomeSize(CONFIG.nn.layers) ||
    !data.genome.every(Number.isFinite)) throw new Error('Invalid arguments or incompatible brain.');
let state = +seed >>> 0;
Math.random = () => {
  state += 0x6D2B79F5;
  let n = state;
  n = Math.imul(n ^ n >>> 15, n | 1);
  n ^= n + Math.imul(n ^ n >>> 7, n | 61);
  return ((n ^ n >>> 14) >>> 0) / 4294967296;
};
const track = new Track(TRACK_PRESETS[data.track].points, CONFIG.track.width, CONFIG.track.samples);
const config = structuredClone(CONFIG), signature = physicsSignature(track, config);
function evaluate(genome, slot = 0) {
  const car = new Car(track, new NeuralNetwork(CONFIG.nn.layers, genome), slot);
  const barriers = new TireBarrierSystem(track), cars = [car];
  const sectors = Array(12).fill(0), counts = Array(12).fill(0);
  let previousSector = Math.floor(car.totalIdx / track.N * 12), crossTime = 0;
  let assisted = false, hardBrakeSeconds = 0, brakeAndTurnSeconds = 0, peakSlip = 0;
  for (let step = 0; step < Math.ceil(CONFIG.generation.timeLimit / CONFIG.dt) && !car.crashed && !car.finished; step++) {
    const flying = car.laps >= 1;
    car.update(CONFIG.dt);
    if (!car.crashed && !car.finished) barriers.update(CONFIG.dt, cars);
    car.sense();
    assisted ||= car.runoffRecoveryActive || car.wrongWayRecoveryActive;
    if (flying) {
      if (car.throttle < -0.9) {
        hardBrakeSeconds += CONFIG.dt;
        if (Math.abs(car.steer) > 0.3) brakeAndTurnSeconds += CONFIG.dt;
      }
      peakSlip = Math.max(peakSlip, Math.abs(car.slipAngle));
    }
    const sector = Math.floor(car.totalIdx / track.N * 12);
    if (sector > previousSector) {
      if (previousSector >= 12 && previousSector < 60 && sector === previousSector + 1) {
        const index = previousSector % 12;
        sectors[index] += car.time - crossTime; counts[index]++;
      }
      previousSector = sector; crossTime = car.time;
    }
  }
  const flying = car.lapTimes.slice(1);
  return { finished: car.finished, assisted, outcome: car.finished ? 'finished' : car.crashDiagnostic?.cause || car.deathReason || 'timed-out',
    raceTime: car.time, bestLap: Number.isFinite(car.bestLap) ? car.bestLap : null,
    flyingMean: car.finished && flying.length ? flying.reduce((a, b) => a + b, 0) / flying.length : null,
    sectors: sectors.map((total, i) => counts[i] ? total / counts[i] : null),
    hardBrakeSeconds: hardBrakeSeconds / Math.max(1, flying.length),
    brakeAndTurnSeconds: brakeAndTurnSeconds / Math.max(1, flying.length), peakSlip };
}
const baselineGenome = Float32Array.from(data.genome), baseline = evaluate(baselineGenome);
if (!baseline.finished || baseline.assisted) throw new Error('Baseline must complete the race without recovery to serve as a clean pace reference.');
let beam = [{ genome: baselineGenome, metrics: baseline, strategy: 'baseline' }];
let fastest = beam[0];
const seen = new Set([baselineGenome.join(',')]), strategies = ['brake-release', 'steering-line', 'coordinated', 'broad', 'corner-anticipation', 'output-gain'];
const strategyCounts = Object.fromEntries(strategies.map(s => [s, { tested: 0, cleanFinishes: 0 }]));
const outputStart = NeuralNetwork.layerOffsets(CONFIG.nn.layers).at(-1), outputWidth = CONFIG.nn.layers.at(-2) + 1;
const log = [];
for (let round = 0; round < +rounds; round++) {
  const candidates = [...beam];
  for (let variant = 0; variant < 36; variant++) {
    const parent = beam[(Math.random() * beam.length) | 0];
    const child = Float32Array.from(parent.genome), strategy = strategies[variant % strategies.length];
    const sigma = [0.015, 0.04, 0.1, 0.2, 0.35, 0.5][Math.floor(variant / 6)];
    let changed = false;
    if (strategy === 'corner-anticipation') {
      // Change the three forward-ray columns coherently across all first-layer
      // neurons, rather than scrambling unrelated parts of the policy.
      const factor = Math.exp(randn() * Math.max(0.1, sigma));
      for (let neuron = 0; neuron < CONFIG.nn.layers[1]; neuron++) for (const ray of [2, 3, 4]) child[neuron * 9 + ray] *= factor;
      changed = true;
    } else if (strategy === 'output-gain') {
      // Positive logit gain changes pedal/steering saturation while preserving
      // each output's zero crossing. Physics and NN inputs stay unchanged.
      const steerGain = Math.exp(randn() * Math.max(0.1, sigma));
      const pedalGain = Math.exp(randn() * Math.max(0.1, sigma));
      for (let i = outputStart; i < child.length; i++) child[i] *= i < outputStart + outputWidth ? steerGain : pedalGain;
      changed = true;
    }
    for (let i = 0; i < child.length; i++) {
      const steer = i >= outputStart && i < outputStart + outputWidth;
      const throttle = i >= outputStart + outputWidth;
      const eligible = strategy === 'brake-release' ? throttle : strategy === 'steering-line' ? steer :
        strategy === 'coordinated' ? steer || throttle : strategy === 'broad';
      if (eligible && Math.random() < (strategy === 'broad' ? 0.16 : 0.55)) {
        child[i] += randn() * sigma; changed = true;
      }
    }
    if (!changed || seen.has(child.join(','))) continue;
    seen.add(child.join(','));
    const metrics = evaluate(child), count = strategyCounts[strategy]; count.tested++;
    if (metrics.finished && !metrics.assisted) {
      count.cleanFinishes++;
      const candidate = { genome: child, metrics, strategy };
      candidates.push(candidate);
      if (metrics.bestLap < fastest.metrics.bestLap - 0.005 ||
          Math.abs(metrics.bestLap - fastest.metrics.bestLap) < 0.005 && metrics.flyingMean < fastest.metrics.flyingMean) fastest = candidate;
    }
  }
  candidates.sort((a, b) => a.metrics.flyingMean - b.metrics.flyingMean || a.metrics.raceTime - b.metrics.raceTime);
  // Retain a small island for each strategy so a temporarily slower line is
  // not immediately crowded out by tiny variants of one braking policy.
  beam = candidates.slice(0, 3);
  const fastestThisRound = [...candidates].sort((a, b) => a.metrics.bestLap - b.metrics.bestLap || a.metrics.flyingMean - b.metrics.flyingMean).slice(0, 2);
  for (const candidate of [fastest, ...fastestThisRound]) if (!beam.includes(candidate)) beam.push(candidate);
  for (const strategy of strategies) {
    const candidate = candidates.find(c => c.strategy === strategy && !beam.includes(c));
    if (candidate) beam.push(candidate);
  }
  const entry = { round: round + 1, tested: seen.size - 1, best: beam[0].metrics.bestLap,
    flyingMean: beam[0].metrics.flyingMean, strategy: beam[0].strategy, fastestObserved: fastest.metrics.bestLap };
  log.push(entry); console.log(JSON.stringify(entry));
}
// Export/import uses five-decimal weights. Validate that actual portable brain,
// not a higher-precision in-memory candidate that the user cannot reproduce.
const finalists = [];
const shortlisted = [fastest, ...beam.filter(c => c.metrics.flyingMean < baseline.flyingMean - 0.005).slice(0, 3)];
for (const candidate of [...new Set(shortlisted)].filter(c => c.strategy !== 'baseline')) {
  const genome = Array.from(candidate.genome, v => +v.toFixed(5)), portable = evaluate(genome);
  const validation = await validateChampion({ config, genome, trackKey: data.track, signature });
  const starts = Array.from({ length: 20 }, (_, slot) => evaluate(genome, slot));
  const baselineStarts = Array.from({ length: 20 }, (_, slot) => evaluate(baselineGenome, slot));
  const mean = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
  const accepted = validation.finished === 20 && validation.assisted === 0 && portable.finished &&
    portable.bestLap < baseline.bestLap - 0.005 &&
    portable.flyingMean < baseline.flyingMean - 0.005 &&
    starts.every((r, slot) => r.flyingMean !== null && r.flyingMean <= baselineStarts[slot].flyingMean + 0.005) &&
    mean(starts, 'raceTime') < mean(baselineStarts, 'raceTime') - 0.005;
  const rejectionReasons = [];
  if (validation.finished !== 20 || validation.assisted !== 0) rejectionReasons.push('not 20 clean finishes');
  if (!(portable.bestLap < baseline.bestLap - 0.005)) rejectionReasons.push('fastest lap did not improve');
  if (!(portable.flyingMean < baseline.flyingMean - 0.005)) rejectionReasons.push('reference-slot flying average did not improve');
  if (!starts.every((r, slot) => r.flyingMean !== null && r.flyingMean <= baselineStarts[slot].flyingMean + 0.005)) rejectionReasons.push('flying pace regressed in at least one grid slot');
  if (!(mean(starts, 'raceTime') < mean(baselineStarts, 'raceTime') - 0.005)) rejectionReasons.push('mean full-race time did not improve');
  finalists.push({ strategy: candidate.strategy, genome, portable, validation, accepted,
    meanRaceTime: mean(starts, 'raceTime'), baselineMeanRaceTime: mean(baselineStarts, 'raceTime'), rejectionReasons });
}
writeFileSync(output, JSON.stringify({ source: 'offline-exploration', originGeneration: data.generation,
  track: data.track, layers: data.layers, seed: +seed, rounds: +rounds, signature,
  baseline, strategyCounts, log, finalists, accepted: finalists.some(f => f.accepted) }, null, 2));
console.log(JSON.stringify({ report: output, baseline: baseline.bestLap, tested: seen.size - 1,
  best: beam[0].metrics.bestLap, accepted: finalists.some(f => f.accepted) }));
