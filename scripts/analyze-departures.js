// Offline sector/crash and post-recovery attribution; never reads browser saves.
// Usage: node scripts/analyze-departures.js export.json [generations=25] [seed=11464]
import { readFileSync } from 'node:fs';
import { CONFIG } from '../js/config.js';
import { Car } from '../js/car.js';
import { NeuralNetwork } from '../js/neuralNetwork.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { Simulation } from '../js/simulation.js';
import { seedPopulation } from '../js/genetics.js';
const [path, generations = '25', seed = '11464'] = process.argv.slice(2);
if (!path) throw new Error('Supply an exported brain JSON path.');
const data = JSON.parse(readFileSync(path, 'utf8'));
if (!Number.isInteger(+generations) || +generations < 1 || !Number.isInteger(+seed) ||
    !TRACK_PRESETS[data.track] || JSON.stringify(data.layers) !== JSON.stringify(CONFIG.nn.layers) ||
    !Array.isArray(data.genome) || data.genome.length !== NeuralNetwork.genomeSize(CONFIG.nn.layers) ||
    !data.genome.every(Number.isFinite)) throw new Error('Invalid arguments or incompatible export.');
let state = +seed >>> 0;
Math.random = () => {
  state += 0x6D2B79F5;
  let n = state;
  n = Math.imul(n ^ n >>> 15, n | 1);
  n ^= n + Math.imul(n ^ n >>> 7, n | 61);
  return ((n ^ n >>> 14) >>> 0) / 4294967296;
};
const track = new Track(TRACK_PRESETS[data.track].points, CONFIG.track.width, CONFIG.track.samples);
const sim = new Simulation(track, CONFIG);
sim.captureEnabled = false;
sim.startGeneration(seedPopulation(data.genome, CONFIG.ga));
const states = new WeakMap(), crashes = [], cohorts = { assisted: {}, unassisted: {} };
const update = Car.prototype.update, die = Car.prototype.die;
Car.prototype.update = function(dt, controls) {
  let info = states.get(this);
  if (!info) { info = { activations: 0, returns: 0, lastReturn: null }; states.set(this, info); }
  const before = this.runoffRecoveryActive;
  update.call(this, dt, controls);
  if (!before && this.runoffRecoveryActive && !this.crashed) info.activations++;
  if (before && !this.runoffRecoveryActive && !this.crashed &&
      !this.isOffTrack(Math.cos(this.angle), Math.sin(this.angle))) {
    info.returns++; info.lastReturn = this.time;
  }
};
Car.prototype.die = function(reason, cause) {
  if (reason === 'crash' && !this.crashed) {
    this.crashApproach.record(this, true);
    const info = states.get(this);
    crashes.push({ sector: 1 + Math.floor(this.idx / track.N * 12), lap: this.laps + 1,
      time: this.time, cause, speed: this.speed * 0.77953846,
      priorRecovery: Boolean(info?.activations), returns: info?.returns || 0,
      secondsAfterReturn: info?.lastReturn == null ? null : this.time - info.lastReturn,
      trace: this.crashApproach.snapshot(this.time), genome: Float32Array.from(this.brain.genome), slot: this.gridSlot });
  }
  die.call(this, reason, cause);
};
const end = sim.endGeneration.bind(sim);
sim.endGeneration = reason => {
  for (const car of sim.cars) {
    const info = states.get(car), group = cohorts[info?.activations ? 'assisted' : 'unassisted'];
    const outcome = car.finished ? 'finished' : car.deathReason || reason;
    group[outcome] = (group[outcome] || 0) + 1;
  }
  end(reason);
};
try { while (sim.history.length < +generations) sim.step(); }
finally { Car.prototype.update = update; Car.prototype.die = die; }
function replay(example, recovery) {
  const car = new Car(track, new NeuralNetwork(CONFIG.nn.layers, example.genome), example.slot);
  if (!recovery) car.applyRunoffRecovery = () => {};
  for (let n = 0; n < CONFIG.generation.timeLimit / CONFIG.dt && !car.crashed && !car.finished; n++) {
    car.update(CONFIG.dt); car.sense();
  }
  return { outcome: car.finished ? 'finished' : car.crashDiagnostic?.cause || car.deathReason || 'time-limit',
    sector: car.crashDiagnostic ? 1 + Math.floor(car.crashDiagnostic.progress * 12) : null, time: car.time };
}
const s3 = crashes.filter(c => c.sector === 3), paired = [];
for (const example of s3) {
  const baseline = replay(example, true);
  if (baseline.sector !== 3 || baseline.outcome !== example.cause || Math.abs(baseline.time - example.time) > 0.04) continue;
  const disabled = replay(example, false);
  paired.push({ priorRecovery: example.priorRecovery, disabled,
    sameDeparture: disabled.sector === 3 && disabled.outcome === example.cause && Math.abs(disabled.time - example.time) < 0.04 });
}
const counts = (rows, key) => Object.fromEntries([...new Set(rows.map(row => row[key]))].map(value =>
  [value, rows.filter(row => row[key] === value).length]));
console.log(JSON.stringify({ seed: +seed, generations: +generations, bestLap: sim.bestLapEver, cohorts,
  crashes: crashes.length, sectors: counts(crashes, 'sector'),
  s3: { count: s3.length, priorRecovery: s3.filter(c => c.priorRecovery).length,
    withinTwoSecondsOfReturn: s3.filter(c => c.secondsAfterReturn != null && c.secondsAfterReturn < 2).length,
    fullThrottleAtRetirement: s3.filter(c => c.trace.at(-1)?.[2] > 0.9).length,
    nearStraightSteeringAtRetirement: s3.filter(c => Math.abs(c.trace.at(-1)?.[3]) < 0.15).length,
    causes: counts(s3, 'cause'), matchedPairs: paired.length,
    sameWithoutRecovery: paired.filter(p => p.sameDeparture).length,
    disabledOutcomes: counts(paired.map(p => p.disabled), 'outcome'),
    traces: s3.slice(0, 12).map(({ genome, ...rest }) => rest) } }, null, 2));
