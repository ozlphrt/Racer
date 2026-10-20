// Offline investigation only. Extended deadlines below never affect the game.
// Usage: node scripts/analyze-runoff.js brain-export.json [generations=25] [seed=11187] [--compare-recovery]
import { readFileSync } from 'node:fs';
import { CONFIG } from '../js/config.js';
import { Car } from '../js/car.js';
import { NeuralNetwork } from '../js/neuralNetwork.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { Simulation } from '../js/simulation.js';
import { seedPopulation } from '../js/genetics.js';

const [path, generations = '25', seed = '11187', experiment] = process.argv.slice(2);
const compareRecovery = experiment === '--compare-recovery';
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

const episodes = [], cases = [], active = new WeakMap();
const originalRecovery = Car.prototype.applyRunoffRecovery;
if (compareRecovery) Car.prototype.applyRunoffRecovery = function() {};
const originalUpdate = Car.prototype.update;
Car.prototype.update = function(dt, controls) {
  const eligible = this.alive && !this.crashed && !this.finished;
  const before = this.offTrackTimer;
  originalUpdate.call(this, dt, controls);
  if (!eligible) return;
  let episode = active.get(this);
  const grass = this.offTrackTimer > before;
  if (grass && !episode) {
    episode = { duration: 0, entrySpeed: this.speed * 0.77953846, entryTimer: before,
      maxHeading: 0, recoveryActive: false };
    active.set(this, episode);
  }
  if (!episode) return;
  if (grass) episode.duration += dt;
  episode.maxHeading = Math.max(episode.maxHeading, Math.abs(this.headingDiff) * 180 / Math.PI);
  episode.recoveryActive ||= this.wrongWayRecoveryActive;
  if (this.crashed || !grass) {
    episode.result = this.crashed ? this.deathReason + ':' + this.crashDiagnostic?.cause : 'returned';
    episode.exitSpeed = this.speed * 0.77953846;
    episode.exitThrottle = this.throttle;
    episode.exitSteering = Math.abs(this.steer);
    const lateral = (this.x - track.cx[this.idx]) * -track.ty[this.idx] + (this.y - track.cy[this.idx]) * track.tx[this.idx];
    episode.outwardVelocity = Math.sign(lateral) * (-this.vx * track.ty[this.idx] + this.vy * track.tx[this.idx]);
    episodes.push(episode);
    active.delete(this);
  }
};
const originalEnd = sim.endGeneration.bind(sim);
sim.endGeneration = reason => {
  for (const car of sim.cars) if (car.crashDiagnostic?.cause === 'runoff') {
    cases.push({ genome: Float32Array.from(car.brain.genome), slot: car.gridSlot, time: car.time - (3 - car.deathTimer) });
  }
  originalEnd(reason);
};
try { while (sim.history.length < +generations) sim.step(); }
finally {
  Car.prototype.update = originalUpdate;
  Car.prototype.applyRunoffRecovery = originalRecovery;
}

// Replay exactly the same failed policy and grid slot, changing only the runoff
// deadline. Exclude cases whose baseline retirement cannot be reproduced.
function replay(example, limit, recovery = !compareRecovery) {
  const car = new Car(track, new NeuralNetwork(CONFIG.nn.layers, example.genome), example.slot);
  if (!recovery) car.applyRunoffRecovery = function() {};
  let extended = false, returned = false, assisted = false;
  const die = car.die;
  car.die = function(reason, cause) {
    if (cause === 'runoff' && this.offTrackTimer <= limit) { extended = true; return; }
    die.call(this, reason, cause);
  };
  for (let step = 0; step < CONFIG.generation.timeLimit / CONFIG.dt && !car.crashed && !car.finished; step++) {
    const before = car.offTrackTimer;
    car.update(CONFIG.dt); car.sense();
    assisted ||= car.runoffRecoveryActive;
    if ((extended || assisted) && car.offTrackTimer < before && !car.crashed) returned = true;
  }
  return { reason: car.deathReason || 'time-limit', cause: car.crashDiagnostic?.cause,
    finished: car.finished, returned, time: car.time };
}
const matched = cases.filter(example => {
  const baseline = replay(example, 1.8);
  return baseline.cause === 'runoff' && Math.abs(baseline.time - example.time) < 0.04;
});
const counterfactuals = [3.6, 6].map(limit => {
  const results = matched.map(example => replay(example, limit));
  return { limit, cases: matched.length, returned: results.filter(r => r.returned).length,
    finished: results.filter(r => r.finished).length,
    outcomes: Object.fromEntries([...new Set(results.map(r => r.cause || r.reason))].map(reason =>
      [reason, results.filter(r => (r.cause || r.reason) === reason).length])) };
});
const average = (rows, key) => rows.length ? +(rows.reduce((sum, row) => sum + row[key], 0) / rows.length).toFixed(2) : null;
const groups = Object.fromEntries([...new Set(episodes.map(e => e.result))].map(result => {
  const rows = episodes.filter(e => e.result === result);
  return [result, { count: rows.length, duration: average(rows, 'duration'),
    entryKmh: average(rows, 'entrySpeed'), exitKmh: average(rows, 'exitSpeed'),
    exitThrottle: average(rows, 'exitThrottle'), exitSteering: average(rows, 'exitSteering'),
    stoppedWithBrake: rows.filter(e => e.exitSpeed < 5 && e.exitThrottle < -0.1).length,
    headingDegrees: average(rows, 'maxHeading'), recoveryActive: rows.filter(e => e.recoveryActive).length,
    movingInward: rows.filter(e => e.outwardVelocity < -1).length }];
}));
const totals = sim.history.reduce((sum, race) => {
  for (const [key, value] of Object.entries(race.outcomes)) if (typeof value === 'number') sum[key] = (sum[key] || 0) + value;
  return sum;
}, {});
console.log(JSON.stringify({ seed: +seed, generations: +generations, totals, bestLap: sim.bestLapEver,
  episodes: groups, runoffCases: cases.length, baselineMatched: matched.length, counterfactuals,
  recovery: compareRecovery ? (() => {
    const results = matched.map(example => replay(example, 1.8, true));
    return { cases: matched.length, returned: results.filter(r => r.returned).length,
      finished: results.filter(r => r.finished).length,
      outcomes: Object.fromEntries([...new Set(results.map(r => r.cause || r.reason))].map(reason =>
        [reason, results.filter(r => (r.cause || r.reason) === reason).length])) };
  })() : undefined }, null, 2));
