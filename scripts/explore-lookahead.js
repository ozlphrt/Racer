// Usage: node scripts/explore-lookahead.js export.json report.json [rounds=24] [seed=11464] [near|far]
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { CONFIG } from '../js/config.js';
import { Car } from '../js/car.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { TireBarrierSystem } from '../js/tireBarriers.js';
import { randn } from '../js/math.js';
import { physicsSignature } from '../js/milestones.js';
import { LookaheadBrain, upgradeGenome, LOOKAHEAD_LAYERS } from './lookaheadBrain.js';

const [input, output, rounds = '24', seed = '11464', horizon = 'near'] = process.argv.slice(2);
if (!input || !output || resolve(input).toLowerCase() === resolve(output).toLowerCase()) throw new Error('Supply separate input and report paths.');
const data = JSON.parse(readFileSync(input, 'utf8'));
if (!TRACK_PRESETS[data.track] || data.layers?.join() !== '8,12,8,2' || !Number.isInteger(+rounds) || +rounds < 1 || !Number.isInteger(+seed) || CONFIG.generation.maxLaps !== 5 || !['near', 'far'].includes(horizon)) throw new Error('Invalid arguments or configuration.');
const distances = horizon === 'far' ? [160, 320] : [80, 180];
const baselineGenome = upgradeGenome(data.genome);
let state = +seed >>> 0;
Math.random = () => {
  state += 0x6D2B79F5;
  let n = state;
  n = Math.imul(n ^ n >>> 15, n | 1);
  n ^= n + Math.imul(n ^ n >>> 7, n | 61);
  return ((n ^ n >>> 14) >>> 0) / 4294967296;
};
const track = new Track(TRACK_PRESETS[data.track].points, CONFIG.track.width, CONFIG.track.samples);
function evaluate(genome, slot = 0, masked = false) {
  const brain = new LookaheadBrain(genome, masked, distances), car = new Car(track, brain, slot);
  brain.car = car;
  const barriers = new TireBarrierSystem(track), cars = [car];
  let assisted = false, hardBrake = 0, brakeTurning = 0;
  for (let tick = 0; tick < CONFIG.generation.timeLimit / CONFIG.dt && !car.finished && !car.crashed; tick++) {
    const flying = car.laps >= 1;
    car.update(CONFIG.dt);
    if (!car.crashed && !car.finished) barriers.update(CONFIG.dt, cars);
    car.sense();
    assisted ||= car.runoffRecoveryActive || car.wrongWayRecoveryActive;
    if (flying && car.throttle < -0.9) {
      hardBrake += CONFIG.dt;
      if (Math.abs(car.steer) > 0.3) brakeTurning += CONFIG.dt;
    }
  }
  const flying = car.lapTimes.slice(1);
  return { slot, finished: car.finished, assisted,
    outcome: car.finished ? 'finished' : car.crashDiagnostic?.cause || car.deathReason || 'timed-out',
    bestLap: Number.isFinite(car.bestLap) ? car.bestLap : null,
    flyingMean: car.finished ? flying.reduce((sum, value) => sum + value, 0) / flying.length : null,
    raceTime: car.time, hardBrake: hardBrake / Math.max(1, flying.length),
    brakeTurning: brakeTurning / Math.max(1, flying.length) };
}
const baseline = evaluate(baselineGenome);
if (!baseline.finished || baseline.assisted) throw new Error('Baseline is not a clean finisher.');
let beam = [{ genome: baselineGenome, metrics: baseline, strategy: 'baseline' }], fastest = beam[0];
const seen = new Set([baselineGenome.join(',')]), strategies = ['lateral', 'heading', 'curvature', 'lookahead', 'coordinated', 'broad'];
const counts = Object.fromEntries(strategies.map(s => [s, { tested: 0, cleanFinishes: 0 }]));
const log = [];
for (let round = 0; round < +rounds; round++) {
  const candidates = [...beam];
  for (let variant = 0; variant < 36; variant++) {
    const parent = beam[Math.floor(Math.random() * beam.length)], child = Float32Array.from(parent.genome);
    const strategy = strategies[variant % 6], sigma = [0.03, 0.1, 0.3, 0.8, 1.5, 2.5][Math.floor(variant / 6)];
    for (let i = 0; i < child.length; i++) {
      const column = i < 156 ? i % 13 : -1, added = column >= 8 && column <= 11;
      const eligible = strategy === 'lateral' ? column === 8 : strategy === 'heading' ? column === 9 :
        strategy === 'curvature' ? column === 10 || column === 11 : strategy === 'lookahead' ? added :
        strategy === 'coordinated' ? added || i >= 260 : true;
      if (eligible && Math.random() < (strategy === 'broad' ? 0.16 : 0.4)) child[i] += randn() * sigma * (added ? 1 : 0.1);
    }
    const key = child.join(',');
    if (seen.has(key)) continue;
    seen.add(key); counts[strategy].tested++;
    const metrics = evaluate(child);
    if (metrics.finished && !metrics.assisted) {
      counts[strategy].cleanFinishes++;
      const candidate = { genome: child, metrics, strategy };
      candidates.push(candidate);
      if (metrics.bestLap < fastest.metrics.bestLap - 0.005 || Math.abs(metrics.bestLap - fastest.metrics.bestLap) < 0.005 && metrics.flyingMean < fastest.metrics.flyingMean) fastest = candidate;
    }
  }
  candidates.sort((a, b) => a.metrics.flyingMean - b.metrics.flyingMean || a.metrics.raceTime - b.metrics.raceTime);
  beam = candidates.slice(0, 3);
  if (!beam.includes(fastest)) beam.push(fastest);
  for (const strategy of strategies) {
    const candidate = candidates.find(c => c.strategy === strategy && !beam.includes(c));
    if (candidate) beam.push(candidate);
  }
  const entry = { round: round + 1, tested: seen.size - 1, flyingMean: beam[0].metrics.flyingMean,
    fastestObserved: fastest.metrics.bestLap, strategy: beam[0].strategy };
  log.push(entry); console.log(JSON.stringify(entry));
}
const baselineStarts = Array.from({ length: 20 }, (_, slot) => evaluate(baselineGenome, slot));
const mean = (rows, key) => rows.reduce((sum, row) => sum + row[key], 0) / rows.length;
const shortlist = [...new Set([fastest, ...beam.slice(0, 3)])].filter(c => c.strategy !== 'baseline');
const finalists = shortlist.map(candidate => {
  const genome = Array.from(candidate.genome, v => +v.toFixed(5));
  const starts = Array.from({ length: 20 }, (_, slot) => evaluate(genome, slot));
  const ablation = evaluate(genome, 0, true);
  const accepted = starts.every(r => r.finished && !r.assisted) &&
    starts[0].bestLap < baseline.bestLap - 0.005 &&
    mean(starts, 'raceTime') < mean(baselineStarts, 'raceTime') - 0.005 &&
    starts.every((r, slot) => r.flyingMean !== null && r.flyingMean <= baselineStarts[slot].flyingMean + 0.005);
  return { genome, strategy: candidate.strategy, starts, ablation, accepted,
    meanRaceTime: mean(starts, 'raceTime'), baselineMeanRaceTime: mean(baselineStarts, 'raceTime') };
});
writeFileSync(output, JSON.stringify({ format: 'offline-lookahead-v1', originGeneration: data.generation,
  layers: LOOKAHEAD_LAYERS, distances, features: ['lateral position', 'heading error', ...distances.map(d => `curvature at ${d} units`)],
  compatibleWithLiveApp: false, physicsSignature: physicsSignature(track, CONFIG), seed: +seed, rounds: +rounds,
  baseline, baselineStarts, counts, log, finalists, accepted: finalists.some(f => f.accepted) }, null, 2));
console.log(JSON.stringify({ report: output, tested: seen.size - 1, baseline: baseline.bestLap,
  fastest: fastest.metrics.bestLap, accepted: finalists.some(f => f.accepted) }));
