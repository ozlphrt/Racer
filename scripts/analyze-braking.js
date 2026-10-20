// Offline control ablation. Never changes physics, browser saves or live brains.
// node scripts/analyze-braking.js export.json report.json
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { Car } from '../js/car.js';
import { NeuralNetwork } from '../js/neuralNetwork.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { TireBarrierSystem } from '../js/tireBarriers.js';
import { physicsSignature } from '../js/milestones.js';

const [input, output] = process.argv.slice(2);
if (!input || !output || resolve(input).toLowerCase() === resolve(output).toLowerCase()) {
  throw new Error('Supply separate source brain and output report paths.');
}
const data = JSON.parse(readFileSync(input, 'utf8'));
if (!TRACK_PRESETS[data.track] || data.layers?.join() !== CONFIG.nn.layers.join() ||
    !Array.isArray(data.genome) || data.genome.length !== NeuralNetwork.genomeSize(CONFIG.nn.layers) ||
    !data.genome.every(Number.isFinite) || CONFIG.generation.maxLaps !== 5) throw new Error('Incompatible source or race distance.');
const track = new Track(TRACK_PRESETS[data.track].points, CONFIG.track.width, CONFIG.track.samples);
const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
const signedDistance = (index, center) => ((index - center + track.N * 1.5) % track.N) - track.N / 2;
// Rank geometric bends; keep distinct apexes at least 160 world units apart.
const ranked = Array.from({ length: track.N }, (_, index) => {
  const a = track.wrap(index - 3), b = track.wrap(index + 3);
  return { index, bend: wrapAngle(Math.atan2(track.ty[b], track.tx[b]) - Math.atan2(track.ty[a], track.tx[a])) };
}).sort((a, b) => Math.abs(b.bend) - Math.abs(a.bend));
const corners = [];
for (const bend of ranked) {
  if (corners.every(c => Math.abs(signedDistance(bend.index, c.index)) * track.spacing >= 160)) corners.push(bend);
  if (corners.length === 4) break;
}
corners.sort((a, b) => a.index - b.index);
const policies = [
  { name: 'baseline', cap: 1, rate: Infinity },
  ...[0.9, 0.75, 0.6].map(cap => ({ name: `brake-cap-${cap}`, cap, rate: Infinity })),
  ...[3, 6, 12].map(rate => ({ name: `brake-ramp-${rate}-per-second`, cap: 1, rate })),
  { name: 'cap-0.75-ramp-6', cap: 0.75, rate: 6 },
];
function evaluate(policy, slot) {
  const network = new NeuralNetwork(data.layers, data.genome);
  let previous = 0;
  const brain = { forward(inputs) {
    const out = network.forward(inputs);
    // Only limit increasing brake demand. Steering, throttle and brake release
    // remain the source policy's decisions; this is not a retrained brain.
    const desired = Math.max(-policy.cap, out[1]);
    const pedal = desired < 0 ? Math.max(desired, previous - policy.rate * CONFIG.dt) : desired;
    previous = pedal;
    return [out[0], pedal];
  } };
  const car = new Car(track, policy.direct ? network : brain, slot), barriers = new TireBarrierSystem(track);
  const rows = [], active = new Map();
  let assisted = false, hardBrakeSeconds = 0, peakBrake = 0;
  for (let step = 0; step < Math.ceil(CONFIG.generation.timeLimit / CONFIG.dt) && !car.crashed && !car.finished; step++) {
    car.update(CONFIG.dt);
    if (!car.crashed && !car.finished) barriers.update(CONFIG.dt, [car]);
    car.sense();
    assisted ||= car.runoffRecoveryActive || car.wrongWayRecoveryActive;
    if (car.laps < 1 || car.finished || car.crashed) continue;
    const brake = Math.max(0, -car.throttle);
    if (brake > 0.9) hardBrakeSeconds += CONFIG.dt;
    peakBrake = Math.max(peakBrake, brake);
    for (let c = 0; c < corners.length; c++) {
      const distance = signedDistance(car.idx, corners[c].index) * track.spacing;
      const key = `${car.laps}:${c}`;
      if (distance >= -100 && distance <= 100) {
        let row = active.get(key);
        if (!row) {
          // Only measure full windows entered from the approach side.
          if (distance > -70) continue;
          row = { corner: c + 1, lap: car.laps + 1, startTime: car.time,
            entryKmh: car.speed * (5.63 / 26) * 3.6, minKmh: Infinity,
            peakBrake: 0, brakingSeconds: 0, hardBrakeSeconds: 0, peakSlipDegrees: 0,
            maxLateralWorldUnits: 0 };
          active.set(key, row);
        }
        row.minKmh = Math.min(row.minKmh, car.speed * (5.63 / 26) * 3.6);
        row.peakBrake = Math.max(row.peakBrake, brake);
        row.brakingSeconds += brake > 0.05 ? CONFIG.dt : 0;
        row.hardBrakeSeconds += brake > 0.9 ? CONFIG.dt : 0;
        row.peakSlipDegrees = Math.max(row.peakSlipDegrees, Math.abs(car.slipAngle) * 180 / Math.PI);
        row.maxLateralWorldUnits = Math.max(row.maxLateralWorldUnits, Math.sqrt(track.lateralDistSq(car.x, car.y, car.idx)));
      } else if (distance > 100 && distance < 150 && active.has(key)) {
        const row = active.get(key);
        if (!row.complete) {
          row.complete = true;
          row.seconds = car.time - row.startTime;
          row.exitKmh = car.speed * (5.63 / 26) * 3.6;
          rows.push(row);
        }
      }
    }
  }
  const flying = car.lapTimes.slice(1);
  return { slot, finished: car.finished, assisted,
    outcome: car.finished ? 'finished' : car.crashDiagnostic?.cause || car.deathReason || 'timed-out',
    raceTime: car.time, bestLap: Number.isFinite(car.bestLap) ? car.bestLap : null,
    flyingMean: flying.length ? flying.reduce((a, b) => a + b, 0) / flying.length : null,
    peakBrake, hardBrakeSecondsPerFlyingLap: flying.length ? hardBrakeSeconds / flying.length : null,
    corners: rows };
}
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
const results = [];
for (const policy of policies) {
  const starts = Array.from({ length: 20 }, (_, slot) => evaluate(policy, slot));
  const clean = starts.filter(r => r.finished && !r.assisted);
  if (policy.name === 'baseline') {
    assert.equal(clean.length, 20, 'Source must finish all 20 starts without recovery.');
    for (const row of starts) assert.deepEqual(row, evaluate({ ...policy, direct: true }, row.slot),
      'Identity wrapper must reproduce the original neural controller exactly.');
  }
  const result = { policy: { ...policy, rate: Number.isFinite(policy.rate) ? policy.rate : null },
    finished: starts.filter(r => r.finished).length, cleanFinishes: clean.length,
    meanRaceTime: clean.length === 20 ? mean(clean.map(r => r.raceTime)) : null,
    referenceBestLap: starts[0].bestLap, referenceFlyingMean: starts[0].flyingMean,
    corners: corners.map((corner, i) => {
      const samples = clean.flatMap(r => r.corners.filter(c => c.corner === i + 1));
      return { corner: i + 1, index: corner.index, progress: corner.index / track.N,
        x: track.cx[corner.index], y: track.cy[corner.index], samples: samples.length,
        ...Object.fromEntries(['entryKmh', 'minKmh', 'exitKmh', 'seconds', 'peakBrake', 'brakingSeconds',
          'hardBrakeSeconds', 'peakSlipDegrees', 'maxLateralWorldUnits'].map(key => [key, mean(samples.map(r => r[key]))])) };
    }), starts };
  const baseline = results[0];
  result.passesPaceGate = Boolean(baseline && clean.length === 20 &&
    result.referenceBestLap < baseline.referenceBestLap - 0.005 &&
    result.meanRaceTime < baseline.meanRaceTime - 0.005 &&
    starts.every((r, i) => r.flyingMean !== null && r.flyingMean <= baseline.starts[i].flyingMean + 0.005));
  results.push(result);
  console.log(JSON.stringify({ policy: policy.name, finished: result.finished, clean: clean.length,
    meanRaceTime: result.meanRaceTime, referenceBestLap: result.referenceBestLap, passesPaceGate: result.passesPaceGate }));
}
writeFileSync(output, JSON.stringify({ format: 'offline-braking-ablation-v1', originGeneration: data.generation,
  track: data.track, signature: physicsSignature(track, CONFIG),
  protocol: '20 solo grid starts per policy, five laps, unchanged physics and retirement rules. Corners: four strongest distinct centerline bends; 100 world units before/after apex. Completed flying-lap windows only, clean finishers only. Caps/ramps apply globally, with no retraining or racing-line planner.',
  results }, null, 2));
