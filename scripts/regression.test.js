import test from 'node:test';
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { Car } from '../js/car.js';
import { FixedStepClock } from '../js/fixedStepClock.js';
import { NeuralNetwork } from '../js/neuralNetwork.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { Simulation } from '../js/simulation.js';
import { loadTrainingState, saveTrainingState, buildBrainExport, importBrainFile } from '../js/storage.js';
import { compatibleCaptures, availableCaptures } from '../js/milestones.js';
import { PRESET_BRAINS } from '../js/presetBrains.js';
import { getRenderPose } from '../js/renderPose.js';
import { DeferredTask } from '../js/deferredTask.js';
import { batchStaticMeshes, partitionInstances, batchSceneryInstances } from '../js/staticBatch.js';
import { Renderer3D, F1_CAR_NUMBERS } from '../js/renderer3d.js';
import * as THREE from 'three';
import { CarSideviewRenderer, carPreviewKey } from '../js/carSideviewRenderer.js';
import { buildPaceInsights } from '../js/paceInsights.js';
import { ClassAnimationScheduler } from '../js/uiAnimations.js';
import { getCarContact, resolveCarContact } from '../js/carContact.js';
import { carPreviewAsset } from '../js/carPreviewAssets.js';
import { countRaceOutcomes, summarizeRaceOutcomes, raceOutcomeMarkup } from '../js/raceOutcomes.js';
import { evolve, resetStagnation, getBurstGensRemaining } from '../js/genetics.js';
import { trainingStatus } from '../js/trainingStatus.js';
import { summarizeCrashes, crashDiagnosticMarkup, approachDiagnosticMarkup } from '../js/crashDiagnostics.js';
import { CrashApproachRecorder, analyzeApproach, summarizeApproaches } from '../js/crashApproach.js';

test('pre-crash recorder wraps without growing and preserves the final two seconds in order', () => {
  const car = new Simulation(track(), CONFIG).cars[0];
  const recorder = new CrashApproachRecorder();
  const buffer = recorder.data;
  for (let i = 0; i <= 600; i++) {
    car.time = i / 60; car.speed = i;
    recorder.record(car);
  }
  car.time = 10.04; car.speed = 700;
  recorder.record(car, true);
  const samples = recorder.snapshot(car.time);
  assert.equal(recorder.data, buffer);
  assert.ok(recorder.count <= 22);
  assert.ok(samples.length >= 20 && samples.length <= 22);
  assert.ok(samples[0][0] >= -2);
  assert.equal(samples.at(-1)[0], 0);
  assert.equal(samples.at(-1)[1], 700);
  assert.ok(samples.every((row, i) => i === 0 || row[0] > samples[i - 1][0]));
  recorder.record(car, true);
  assert.equal(recorder.snapshot(car.time).length, samples.length, 'same-tick capture replaces rather than duplicates');
  recorder.reset();
  assert.deepEqual(recorder.snapshot(0), []);
});

test('S1 approach patterns distinguish observed sliding/recovery from short or clean traces', () => {
  const clean = Array.from({ length: 21 }, (_, i) => [+(i / 10 - 2).toFixed(2), 250, -0.5, 0.1, 0.05, 0.02, 0, 0.2]);
  assert.deepEqual(analyzeApproach(clean, 30, 2, 2).patterns, []);
  const sliding = clean.map((row, i) => [row[0], 250, 0.5, i % 4 < 2 ? 0.8 : -0.8, 1.5, 0.4, 1, 1.2]);
  const analysis = analyzeApproach(sliding, 6, 2, 1);
  assert.deepEqual(new Set(analysis.patterns), new Set(['recovery', 'slide', 'reversals', 'unbraked', 'launch']));
  assert.equal(analysis.duration, 2);
  assert.equal(analyzeApproach(sliding.slice(-3), 6, 2, 1).sufficient, false);
  const crashes = Array.from({ length: 5 }, () => ({ progress: 0.03, lap: 1, approach: sliding, approachSummary: analysis }));
  const summary = summarizeApproaches([{ progress: 0.02 }, ...crashes, { progress: 0.3, approachSummary: analysis }]);
  assert.equal(summary.recorded, 5);
  assert.equal(summary.count, 6, 'legacy S1 crashes are counted but not assigned fabricated patterns');
  assert.equal(summary.counts.slide, 5);
  const markup = approachDiagnosticMarkup(crashes);
  assert.match(markup, /Most observed:/);
  assert.match(markup, /Sideways slip/);
  assert.match(markup, /<details/);
  assert.doesNotMatch(approachDiagnosticMarkup([{ progress: 0.01 }]), /Most observed:/);
});

test('only S1 crashes retain approach traces and old raw traces expire without losing summaries', t => {
  storageFixture(t);
  const sim = new Simulation(track(), CONFIG);
  const car = sim.cars[0];
  car.x = sim.track.cx[0]; car.y = sim.track.cy[0]; car.idx = 0;
  for (let i = 0; i <= 20; i++) { car.time = 10 + i / 10; car.crashApproach.record(car); }
  car.die('crash', 'off-track');
  assert.equal(car.crashDiagnostic.approach.length, 21);
  assert.equal(car.crashDiagnostic.approachSummary.sufficient, true);
  const old = { ...car.crashDiagnostic };
  sim.history = Array.from({ length: 25 }, (_, i) => ({ generation: i + 1, crashDiagnostics: i ? [] : [old] }));
  sim.endGeneration('all-stopped');
  assert.equal(old.approach, undefined);
  assert.ok(old.approachSummary);
  assert.ok(sim.history.at(-1).crashDiagnostics[0].approach);
  assert.equal(saveTrainingState(sim, layers), true);
  const restored = loadTrainingState(layers);
  assert.deepEqual(restored.history.at(-1).crashDiagnostics[0].approach, sim.history.at(-1).crashDiagnostics[0].approach);
  assert.deepEqual(restored.history.at(-1).crashDiagnostics[0].approachSummary, sim.history.at(-1).crashDiagnostics[0].approachSummary);
  const next = sim.cars[0], index = Math.floor(sim.track.N / 2);
  Object.assign(next, { x: sim.track.cx[index], y: sim.track.cy[index], idx: index });
  next.die('crash', 'off-track');
  assert.equal(next.crashDiagnostic.approach, undefined);
});

test('crash snapshots preserve location and speed at retirement and reset between races', () => {
  const sim = new Simulation(track(), CONFIG);
  const car = sim.cars[0];
  Object.assign(car, { speed: 200, time: 10, lastCarContactTime: 9.5, laps: 2 });
  car.die('crash', 'off-track');
  const snapshot = { ...car.crashDiagnostic };
  assert.equal(snapshot.speed, 200);
  assert.equal(snapshot.cause, 'off-track');
  assert.equal(snapshot.recentContact, true);
  assert.equal(snapshot.lap, 3);
  car.update(0.5);
  assert.deepEqual(car.crashDiagnostic, snapshot, 'slide animation cannot move a recorded crash');
  car.reset();
  assert.equal(car.crashDiagnostic, null);
  assert.equal(car.lastCarContactTime, null);
  car.time = 10; car.lastCarContactTime = 8;
  car.die('crash', 'tire-barrier');
  assert.equal(car.crashDiagnostic.recentContact, false);
});

test('crash summaries count only observed snapshots with correct location bins and units', () => {
  const crash = { x: 100, y: 200, speed: 200, progress: 0.2, cause: 'off-track', recentContact: true };
  const history = [{ generation: 1 }, { generation: 2, crashDiagnostics: [crash,
    { ...crash, cause: 'tire-barrier', recentContact: false }, { ...crash, progress: NaN }] },
    { generation: 3, crashDiagnostics: [] }];
  const summary = summarizeCrashes(history);
  assert.equal(summary.recorded, 2);
  assert.equal(summary.window, 3);
  assert.equal(summary.crashes.length, 2);
  assert.equal(summary.sectors[2].count, 2);
  assert.equal(summary.causes['off-track'], 1);
  assert.equal(summary.causes['tire-barrier'], 1);
  assert.equal(summary.recentContact, 1);
  assert.ok(Math.abs(summary.averageSpeed - 155.90769) < 0.001);
  assert.match(crashDiagnosticMarkup(history, track()), /Hotspot S3: 2\/2/);
  assert.match(crashDiagnosticMarkup(history, track()), /<svg/);
  assert.match(crashDiagnosticMarkup([{}], track()), /older crashes have no recorded locations/);
  assert.match(crashDiagnosticMarkup([{ crashDiagnostics: [] }], track()), /No crashes/);
  assert.equal(summarizeCrashes([...history, ...Array.from({ length: 25 }, () => ({}))]).recorded, 0);
});

test('breeding favors finishers while preserving the fastest lap genome', t => {
  t.mock.method(Math, 'random', () => 0.99);
  resetStagnation();
  t.after(resetStagnation);
  const reliable = Float32Array.of(2, 2, 2);
  const fragile = Float32Array.of(1, 1, 1);
  const scored = [
    { genome: fragile, fitness: 90000, bestLap: 11, finished: false },
    { genome: reliable, fitness: 10000, bestLap: 12, finished: true },
  ];
  const options = { population: 20, elites: 1, tournamentK: 3, mutationRate: 0,
    mutationSigma: 0, bestLapEver: 11, genBestLap: 12 };
  for (let generation = 0; generation < 125; generation++) {
    const next = evolve(scored, options);
    assert.equal(next.length, 20);
    assert.deepEqual(next[0], reliable, 'reliable finisher is the protected elite');
    assert.deepEqual(next[1], fragile, 'fast lap remains available');
    assert.ok(next.slice(2).every(genome => genome.every(weight => weight === 2)));
    assert.equal(getBurstGensRemaining(), 0, 'poor completion suppresses automatic aggressive bursts');
  }
  assert.deepEqual(reliable, Float32Array.of(2, 2, 2));
  assert.deepEqual(fragile, Float32Array.of(1, 1, 1));
});

test('breeding can recover when no car finishes', t => {
  resetStagnation();
  t.after(resetStagnation);
  const next = evolve([{ genome: Float32Array.of(1, 2), fitness: 10, finished: false }],
    { population: 20, elites: 2, tournamentK: 3, mutationRate: 0.1, mutationSigma: 0.1 });
  assert.equal(next.length, 20);
  assert.ok(next.every(genome => genome.every(Number.isFinite)));
});

test('healthy trailing cars get fifteen seconds before the shared finish deadline', () => {
  const config = { ...CONFIG, collision: { ...CONFIG.collision, enabled: false },
    generation: { ...CONFIG.generation, timeLimit: 200 } };
  const sim = new Simulation(track(), config);
  sim.cars = sim.cars.slice(0, 2);
  sim.tireBarriers = null;
  for (const car of sim.cars) { car.update = () => {}; car.sense = () => {}; }
  sim.cars[0].finished = true;
  sim.cars[0].finishTime = 60;
  let ending = null;
  sim.endGeneration = reason => { ending = reason; };
  sim.step();
  assert.equal(sim.checkeredFlagTimer, 15);
  for (let i = 0; i < 9 * 60; i++) sim.step();
  assert.equal(ending, null, 'a healthy trailer is not cut off at the old four/five second deadline');
  assert.ok(sim.checkeredFlagTimer > 5);
  for (let i = 0; i < 7 * 60 && !ending; i++) sim.step();
  assert.equal(ending, 'finish-window');
  assert.ok(sim.time >= 15 && sim.time < 15.1);
});

test('a finished car score stays fixed while trailing cars complete the race', () => {
  const sim = new Simulation(track(), CONFIG);
  const car = sim.cars[0];
  Object.assign(car, { finished: true, finishTime: 60, time: 60, laps: 5,
    lapTimes: [12, 12, 12, 12, 12], maxIdx: 1000 });
  const fitness = car.fitness;
  car.time += 15;
  assert.equal(car.fitness, fitness);
});

test('training banner uses observed records and completion instead of old peak fitness', () => {
  const history = Array.from({ length: 100 }, (_, i) => ({ generation: i + 1,
    bestLap: 11.43, best: 280600, population: 20, finishers: 8 }));
  let status = trainingStatus(history, 11.43);
  assert.equal(status.statusText, 'COMPLETION NEEDS WORK');
  assert.match(status.message, /40% completed/);
  assert.match(status.message, /99 generations/);
  history.push({ ...history.at(-1), generation: 101, bestLap: 11.40 });
  assert.equal(trainingStatus(history, 11.40).statusText, 'PACE BREAKTHROUGH');
  for (let generation = 102; generation <= 104; generation++) history.push({ ...history.at(-1), generation });
  assert.equal(trainingStatus(history, 11.40).statusText, 'COMPLETION NEEDS WORK');
  assert.equal(trainingStatus(history.slice(-1), 11.40).statusText, 'TRAINING ACTIVE', 'one baseline is not evidence of a new record');
  const reliable = history.slice(0, 100).map(record => ({ ...record, finishers: 18 }));
  assert.equal(trainingStatus(reliable, 11.43).statusText, 'HIGH RACE COMPLETION', '99 generations is not yet a plateau');
  reliable.push({ ...reliable.at(-1), generation: 101 });
  assert.equal(trainingStatus(reliable, 11.43).statusText, 'PACE PLATEAU');
});

const kineticEnergy = cars => cars.reduce((sum, car) => sum +
  (car.vx * car.vx + car.vy * car.vy) * 0.5 + 72 * (car.yawRate || 0) ** 2 * 0.5, 0);

test('race outcomes distinguish crashes, stalls, wrong-way exits and cars left racing at the deadline', () => {
  const cars = [{ finished: true }, { crashed: true, deathReason: 'crash' },
    { crashed: true, deathReason: 'stalled' }, { crashed: true, deathReason: 'wrong way' },
    { alive: true }, { alive: false, deathReason: 'unknown' }];
  const counts = countRaceOutcomes(cars, 'finish-window');
  assert.deepEqual(counts, { finished: 1, crashed: 1, stalled: 1, timedOut: 1, wrongWay: 1, other: 1 });
  assert.equal(countRaceOutcomes(cars, 'time-limit').timedOut, 1);
  assert.equal(countRaceOutcomes(cars, 'race-ended').timedOut, 0, 'manual ending is not a timeout');
  const legacy = { generation: 1, population: 20, finishers: 12 };
  assert.equal(summarizeRaceOutcomes([legacy]).latest, null);
  assert.match(raceOutcomeMarkup([legacy]), /next completed race/);
  const record = { generation: 2, population: 6, finishers: 1, outcomes: counts, endReason: 'finish-window' };
  const summary = summarizeRaceOutcomes([legacy, record]);
  assert.equal(summary.recorded, 1);
  assert.equal(summary.window, 2);
  assert.deepEqual(summary.totals, counts, 'legacy outcomes are never fabricated');
  assert.match(raceOutcomeMarkup([legacy, record]), /1\/2 with breakdown/);
  assert.match(raceOutcomeMarkup([record]), /Finish window expired/);
});

test('generation outcomes are captured before population replacement and survive saving', t => {
  const memory = storageFixture(t);
  const sim = new Simulation(track(), CONFIG);
  sim.cars[0].finished = true;
  sim.cars[1].crashed = true; sim.cars[1].deathReason = 'crash';
  sim.cars[1].crashDiagnostic = { x: 123, y: 456, progress: 0.3, speed: 200, lap: 2, cause: 'off-track', recentContact: false };
  sim.cars[2].crashed = true; sim.cars[2].deathReason = 'stalled';
  sim.endGeneration('finish-window');
  const record = sim.history.at(-1);
  assert.equal(record.outcomes.finished, 1);
  assert.equal(record.outcomes.crashed, 1);
  assert.equal(record.outcomes.stalled, 1);
  assert.equal(record.outcomes.timedOut, CONFIG.ga.population - 3);
  assert.equal(record.endReason, 'finish-window');
  assert.equal(record.crashDiagnostics[0].x, 123);
  assert.equal(saveTrainingState(sim, layers), true);
  const saved = JSON.parse(memory.get('ai-racer:training-state:v2'));
  assert.deepEqual(saved.history.at(-1).outcomes, record.outcomes);
  assert.deepEqual(saved.history.at(-1).crashDiagnostics, record.crashDiagnostics);
});

test('dense tire smoke requires sustained physical sideways slip rather than hard control inputs', () => {
  const run = (changes, frames = 24) => {
    const renderer = Object.create(Renderer3D.prototype);
    renderer.camera = { position: new THREE.Vector3() };
    renderer.carPrevTires = new Map();
    let smoke = 0, marks = 0;
    renderer.addTireSmokePuff = () => smoke++;
    renderer.addSkidQuad = () => marks++;
    const car = { x: 0, y: 0, angle: 0, time: 0, alive: true, finished: false, crashed: false,
      speed: 180, steer: 1, slipAngle: 0.08, throttle: -1, brakeLock: 1, wheelSpin: 0, ...changes };
    for (let i = 0; i < frames; i++) {
      car.x += 4; car.time += 1 / 60;
      renderer.updateSkidmarks({ cars: [car] });
    }
    return { smoke, marks };
  };
  assert.equal(run({}).smoke, 0, 'full steering and locked brakes alone are insufficient');
  assert.equal(run({ speed: 40, throttle: 1, brakeLock: 0, wheelSpin: 1 }).smoke, 0, 'launch wheelspin is insufficient');
  assert.equal(run({ speed: 40, slipAngle: 0.8 }).smoke, 0, 'slow sliding is insufficient');
  assert.equal(run({ slipAngle: 0.16 }).smoke, 0, 'moderate slip is insufficient');
  assert.equal(run({ slipAngle: 0.6 }, 3).smoke, 0, 'a momentary slip spike is insufficient');
  const heavy = run({ speed: 130, slipAngle: 0.26 });
  assert.ok(heavy.smoke > 0, 'a sustained fast sideways skid still produces the dense plume');
  assert.ok(run({}).marks > 0, 'ordinary skids retain their tire marks');
});

test('lap celebrations animate their glow without repeatedly uploading unchanged scoreboard pixels', t => {
  let now = 1000;
  t.mock.method(performance, 'now', () => now);
  const renderer = Object.create(Renderer3D.prototype);
  renderer.lapPlateCtx = {};
  renderer.lapPlateDisplayMat = { emissiveIntensity: 1.4 };
  const paints = [];
  renderer.updateLapPlateTexture = data => paints.push(data);
  const leader = { alive: true, finished: false, laps: 1, carNumber: 44, bestLap: 12 };
  const sim = { time: 15, leader, cars: [leader], raceBestLap: 12, bestLapEver: 11.5, checkeredFlagTimer: null };
  renderer.triggerRecordCelebration(12, leader, 'race');
  renderer.updateLapPlate(sim, leader);
  const glow = renderer.lapPlateDisplayMat.emissiveIntensity;
  for (let i = 1; i <= 180; i++) {
    now = 1000 + i * 1000 / 60;
    renderer.updateLapPlate(sim, leader);
  }
  assert.equal(paints.length, 1, 'three seconds of celebration require only one text upload');
  assert.notEqual(renderer.lapPlateDisplayMat.emissiveIntensity, glow, 'the glow still animates');
  leader.finished = true; leader.laps = CONFIG.generation.maxLaps;
  sim.checkeredFlagTimer = 4.9;
  renderer.updateLapPlate(sim, leader);
  assert.equal(paints.length, 2, 'crossing the race finish immediately updates the scoreboard');
  sim.checkeredFlagTimer = 4.5;
  renderer.updateLapPlate(sim, leader);
  assert.equal(paints.length, 2, 'unchanged countdown text does not redraw');
  sim.checkeredFlagTimer = 3.9;
  renderer.updateLapPlate(sim, leader);
  assert.equal(paints.length, 3, 'the countdown still updates each displayed second');
  now = 8000;
  renderer.updateLapPlate(sim, leader);
  assert.equal(paints.length, 4, 'ending the celebration restores normal text');
  assert.equal(renderer.lapPlateDisplayMat.emissiveIntensity, 1.4);
});

test('scenery batching preserves geometry and transforms while culling each tree independently', () => {
  const box = new THREE.BoxGeometry(2, 2, 10);
  const cone = new THREE.ConeGeometry(3, 8, 6);
  const material = new THREE.MeshLambertMaterial({ transparent: true, opacity: 0.8 });
  const near = new THREE.Matrix4().makeTranslation(0, 0, 0);
  const far = new THREE.Matrix4().makeTranslation(5000, 0, 0);
  const [batch] = batchSceneryInstances([
    { geometry: box, material, matrices: [near, far] },
    { geometry: cone, material, matrices: [near] },
  ]);
  assert.equal(batch.instanceCount, 3);
  assert.equal(batch.geometry.attributes.position.count, box.attributes.position.count + cone.attributes.position.count,
    'repeated trees share geometry rather than duplicating vertices');
  assert.equal(batch.geometry.index.count, box.index.count + cone.index.count);
  assert.equal(batch.material, material);
  assert.equal(batch.sortObjects, true, 'transparent foliage retains distance sorting');
  assert.equal(batch.perObjectFrustumCulled, true);
  const actual = new THREE.Matrix4();
  batch.getMatrixAt(1, actual);
  assert.deepEqual(actual.elements, far.elements);
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 500);
  camera.up.set(0, 0, 1);
  camera.position.set(0, -100, 50);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  batch.updateMatrixWorld();
  batch.onBeforeRender(null, null, camera, batch.geometry, material);
  assert.equal(batch._multiDrawCount, 2, 'the distant tree is culled even though it shares the draw batch');
  camera.position.x = 5000;
  camera.lookAt(5000, 0, 0);
  camera.updateMatrixWorld();
  batch.onBeforeRender(null, null, camera, batch.geometry, material);
  assert.equal(batch._multiDrawCount, 1, 'culling follows the camera');
  let sourceDisposed = false;
  box.addEventListener('dispose', () => { sourceDisposed = true; });
  batch.dispose();
  assert.equal(sourceDisposed, false, 'rebuilding batches preserves reusable template geometry');
});

test('tight left-corner recovery does not toggle braking and throttle around its entry heading', () => {
  const circuit = track();
  const corner = circuit.curvature.findIndex((curvature, i) => i > 20 && curvature < -0.012);
  assert.ok(corner > 0, 'exercise the first sharp left section of the actual Grand Prix track');
  const car = new Car(circuit, { forward: () => [-0.8, -1] });
  const heading = Math.atan2(circuit.ty[corner], circuit.tx[corner]);
  const sample = degrees => {
    car.idx = corner; car.x = circuit.cx[corner]; car.y = circuit.cy[corner];
    car.angle = heading - degrees * Math.PI / 180;
    car.vx = 100 * Math.cos(car.angle); car.vy = 100 * Math.sin(car.angle);
    car.time = 10; car.crashed = false; car.alive = true;
    car.update(CONFIG.dt);
    return [car.steer, car.throttle];
  };
  assert.deepEqual(sample(71.9), [-0.8, -1], 'the brain still controls ordinary corner braking');
  assert.deepEqual(sample(72.1), [1, 0.8], 'recovery engages beyond its entry threshold');
  for (const error of [71.8, 72.2, 71.9, 68, 60, 54.1]) {
    assert.deepEqual(sample(error), [1, 0.8], 'sliding near the threshold must not alternate commands each tick');
  }
  assert.deepEqual(sample(53.9), [-0.8, -1], 'normal driving resumes once aligned sufficiently');
  assert.deepEqual(sample(65), [-0.8, -1], 'recovery does not immediately re-enter');
  sample(179);
  assert.deepEqual(sample(-179), [1, 0.8], 'crossing the angle wrap cannot reverse the recovery steering');
  car.reset();
  assert.equal(car.wrongWayRecoveryActive, false);
  assert.equal(car.recoveryTurnDirection, 0);
});

test('gentle side contact preserves shared forward pace and settles without repeated bounce', () => {
  const a = { x: 0, y: 0, angle: 0, vx: 350, vy: 1, yawRate: 0 };
  const b = { x: 0, y: 12, angle: 0, vx: 350, vy: -1, yawRate: 0 };
  const contact = getCarContact(a, b, 26, 13);
  const before = kineticEnergy([a, b]);
  assert.ok(resolveCarContact(a, b, contact));
  assert.equal(a.vx, 350, 'a tiny side rub must not brake a car by 14 units/s');
  assert.equal(b.vx, 350, 'the opposing car retains its shared forward velocity too');
  assert.ok(Math.abs(a.vy - b.vy) < 1e-10, 'gentle contact settles instead of bouncing');
  assert.ok(kineticEnergy([a, b]) < before);
  assert.equal(resolveCarContact(a, b, contact), null, 'settled contact receives no further impulse');
});

test('contact response is independent of the pack common velocity during a corner', () => {
  const run = (boostX, boostY) => {
    const a = { x: 0, y: 0, angle: 0.4, vx: 10 + boostX, vy: 30 + boostY, yawRate: 2 };
    const b = { x: 20, y: 10, angle: 0.6, vx: -10 + boostX, vy: -20 + boostY, yawRate: -1 };
    const momentum = { x: a.vx + b.vx, y: a.vy + b.vy };
    const energy = kineticEnergy([a, b]);
    assert.ok(resolveCarContact(a, b, getCarContact(a, b, 26, 13)));
    assert.ok(Math.abs(a.vx + b.vx - momentum.x) < 1e-9);
    assert.ok(Math.abs(a.vy + b.vy - momentum.y) < 1e-9);
    assert.ok(kineticEnergy([a, b]) <= energy + 1e-8);
    return [a.vx - boostX, a.vy - boostY, b.vx - boostX, b.vy - boostY, a.yawRate, b.yawRate];
  };
  const baseline = run(0, 0), fastCorner = run(300, -200);
  baseline.forEach((value, i) => assert.ok(Math.abs(value - fastCorner[i]) < 1e-9));
});

test('off-center sideswipes cannot create energy or repeat impulses after the contact separates', () => {
  const a = { x: 0, y: 0, angle: 0, vx: 0, vy: 100, yawRate: 0 };
  const b = { x: 20, y: 12, angle: 0, vx: 0, vy: 0, yawRate: 0 };
  const contact = getCarContact(a, b, 26, 13);
  const before = kineticEnergy([a, b]);
  assert.ok(resolveCarContact(a, b, contact, { scrub: 0 }));
  assert.ok(kineticEnergy([a, b]) < before, 'the old impulse increased 5,000 energy units to 7,112');
  const after = kineticEnergy([a, b]);
  assert.equal(resolveCarContact(a, b, contact, { scrub: 0 }), null, 'separating contact points must not receive another kick');
  assert.equal(kineticEnergy([a, b]), after);
});

test('elastic contact conserves total linear and angular motion including spin', () => {
  const a = { x: 0, y: 0, angle: 0, vx: 10, vy: 100, yawRate: 1 };
  const b = { x: 20, y: 12, angle: 0, vx: -5, vy: 0, yawRate: -1 };
  const measure = () => ({
    energy: kineticEnergy([a, b]), px: a.vx + b.vx, py: a.vy + b.vy,
    angular: a.x * a.vy - a.y * a.vx + b.x * b.vy - b.y * b.vx + 72 * (a.yawRate + b.yawRate),
  });
  const before = measure();
  resolveCarContact(a, b, getCarContact(a, b, 26, 13), { restitution: 1, friction: 0, scrub: 0 });
  const after = measure();
  for (const key of Object.keys(before)) assert.ok(Math.abs(before[key] - after[key]) < 1e-8, `${key} is conserved`);
});

test('oblique contacts with pre-existing spin dissipate energy instead of amplifying jitter', () => {
  let impacts = 0;
  for (let i = 0; i < 200; i++) {
    const a = { x: 0, y: 0, angle: i * 0.17, vx: Math.sin(i * 1.7) * 200, vy: Math.cos(i * 0.6) * 150, yawRate: Math.sin(i * 0.4) * 8 };
    const b = { x: Math.cos(i) * 14, y: Math.sin(i) * 10, angle: i * 0.31, vx: Math.cos(i * 2.3) * 130, vy: Math.sin(i * 0.7) * 120, yawRate: Math.cos(i * 0.3) * 8 };
    const contact = getCarContact(a, b, 26, 13);
    if (!contact) continue;
    const before = kineticEnergy([a, b]);
    if (resolveCarContact(a, b, contact, { scrub: 0 })) impacts++;
    assert.ok(kineticEnergy([a, b]) <= before + 1e-7, `contact ${i} must not add energy`);
  }
  assert.ok(impacts > 50, 'the test exercises many actual impacts');
});

test('parallel cars in separate lanes do not collide through an oversized circular boundary', () => {
  const a = { x: 0, y: 0, angle: 0 }, b = { x: 0, y: 18, angle: 0 };
  assert.equal(getCarContact(a, b, 26, 13), null);
  b.y = 12;
  const side = getCarContact(a, b, 26, 13);
  assert.ok(Math.abs(side.depth - 1) < 1e-9);
  assert.ok(Math.abs(side.nx) < 1e-9);
  assert.equal(side.ny, 1);
  b.x = 25; b.y = 0;
  assert.deepEqual(getCarContact(a, b, 26, 13), { nx: 1, ny: 0, depth: 1 });
  b.x = 0; b.angle = Math.PI / 2;
  const crossed = getCarContact(a, b, 26, 13);
  assert.ok(crossed && Number.isFinite(crossed.depth), 'fully overlapping cars separate deterministically');
  b.x = 30;
  assert.equal(getCarContact(a, b, 26, 13), null);
});

test('contact simulation leaves adjacent lanes alone and removes invisible eliminated cars', (t) => {
  const previous = { ...CONFIG.collision };
  t.after(() => Object.assign(CONFIG.collision, previous));
  Object.assign(CONFIG.collision, { enabled: true, warmupTime: 0, separationLeadTime: 0 });
  const sim = new Simulation(track(), CONFIG);
  sim.cars = sim.cars.slice(0, 2);
  sim.tireBarriers = null;
  const [a, b] = sim.cars;
  a.x = 1000; a.y = 1000; a.angle = 0;
  b.x = 1000; b.y = 1018; b.angle = 0;
  sim.step();
  assert.deepEqual([a.x, a.y, b.x, b.y], [1000, 1000, 1000, 1018]);
  b.x = 1001; b.y = 1000; b.crashed = true; b.alive = false;
  sim.step();
  assert.deepEqual([a.x, a.y], [1000, 1000], 'an invisible eliminated car cannot push a surviving car');
  assert.equal(sim._activeCars.includes(b), false);
  b.alive = true; b.deathTimer = 3;
  sim.step();
  assert.equal(sim._activeCars.includes(b), true, 'visible crash slides remain solid until removal');
  assert.ok(Math.hypot(a.x - 1000, a.y - 1000) > 0, 'genuine overlapping chassis still make contact');
});

test('preview capture waits asynchronously for GPU pixels and preserves image orientation and alpha', async () => {
  const preview = new CarSideviewRenderer();
  preview.snapshotTarget = { width: 1, height: 2, texture: {} };
  preview.snapshotPixels = new Uint8Array(8);
  preview.snapshotImage = { data: new Uint8ClampedArray(8) };
  let finishRead;
  const calls = [];
  preview.renderer = {
    domElement: { toBlob() { assert.fail('never snapshot the WebGL canvas synchronously'); } },
    copyFramebufferToTexture: texture => { assert.equal(texture, preview.snapshotTarget.texture); calls.push('gpu-copy'); },
    readRenderTargetPixelsAsync: async (target, x, y, width, height, pixels) => {
      assert.equal(target, preview.snapshotTarget);
      assert.deepEqual([x, y, width, height], [0, 0, 1, 2]);
      await new Promise(resolve => { finishRead = resolve; });
      pixels.set([10, 20, 30, 255, 25, 50, 100, 128]);
      calls.push('gpu-ready');
    },
  };
  preview.snapshotContext = { putImageData: image => {
    assert.deepEqual([...image.data], [50, 100, 199, 128, 10, 20, 30, 255]);
    calls.push('cpu-image');
  } };
  preview.snapshotCanvas = { toBlob: (resolve, type) => { assert.equal(type, 'image/png'); calls.push('encode'); resolve(new Blob(['png'])); } };
  const task = preview.capturePreviewBlob();
  assert.deepEqual(calls, ['gpu-copy'], 'CPU encoding never waits synchronously for GPU completion');
  finishRead();
  assert.ok((await task) instanceof Blob);
  assert.deepEqual(calls, ['gpu-copy', 'gpu-ready', 'cpu-image', 'encode']);
});

test('notification animations coalesce restarts without forcing page layout', () => {
  const callbacks = new Map();
  let next = 0;
  const scheduler = new ClassAnimationScheduler(fn => { callbacks.set(++next, fn); return next; }, id => callbacks.delete(id));
  const classes = new Set(['old-flash']);
  const element = { classList: { remove: (...names) => names.forEach(name => classes.delete(name)), add: name => classes.add(name) } };
  Object.defineProperty(element, 'offsetWidth', { get() { assert.fail('animation restarts must not flush layout'); } });
  scheduler.restart(element, 'record-flash', ['old-flash', 'record-flash']);
  scheduler.restart(element, 'record-flash', ['old-flash', 'record-flash']);
  assert.equal(callbacks.size, 1);
  assert.equal(classes.size, 0);
  [...callbacks.values()][0]();
  assert.deepEqual([...classes], ['record-flash']);
  scheduler.restart(null, 'record-flash');
});

test('close tracking cameras keep constant-speed cars framed through changing FPS and missed frames', () => {
  for (const preset of ['chase', 'action', 'action_rear']) {
    const renderer = Object.create(Renderer3D.prototype);
    renderer.track = track();
    renderer.scene = new THREE.Scene();
    renderer.camera = new THREE.PerspectiveCamera(65, 1.5, 5, 24000);
    renderer.camera.up.set(0, 0, 1);
    renderer.camera.position.set(-100, 80, 90);
    renderer.controls = { target: new THREE.Vector3(), update() {}, autoRotate: false };
    renderer.carPool = [new THREE.Group(), new THREE.Group()];
    renderer.carPool.forEach(mesh => renderer.scene.add(mesh));
    renderer.playerCar = new THREE.Group(); renderer.rayGroup = new THREE.Group();
    renderer.f1Loaded = true; renderer.lastGen = 1; renderer.lastSimTime = 20;
    renderer._lastActivePreset = preset;
    for (const method of ['updateGantryLights', 'updateLapPlate', 'updateTireBarriers', 'updateSkidmarks',
      'processDeathEvents', 'updateBursts', 'updateTireSmoke']) renderer[method] = () => {};
    renderer.renderer = { render: (scene, camera) => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); } };
    const car = { x: 200, y: 100, angle: 0, previousX: 200, previousY: 100, previousAngle: 0,
      alive: true, finished: false, crashed: false, laps: 1, idx: 0, totalIdx: 100, speed: 350, time: 20 };
    const opponent = { ...car, x: 178, previousX: 178, totalIdx: 90 };
    const sim = { generation: 1, time: 20, cars: [car, opponent], leader: car, player: null, bestLapEver: Infinity };
    const opts = { cameraPreset: preset, follow: true, renderAlpha: 1, renderDt: 1 / 60, recordGhost: false };
    for (let i = 0; i < 900; i++) renderer.render(sim, opts, car);
    const reference = new THREE.Vector3(car.x, -car.y, 1).project(renderer.camera);
    for (let frame = 0; frame < 140; frame++) {
      const dt = [1 / 144, 1 / 120, 1 / 60, 1 / 30, 1 / 20][frame % 5];
      car.x += car.speed * dt;
      opponent.x += opponent.speed * dt;
      sim.time += dt;
      renderer.render(sim, { ...opts, renderDt: dt }, car);
      const projected = new THREE.Vector3(car.x, -car.y, 1).project(renderer.camera);
      assert.ok(projected.distanceTo(reference) < 0.0001,
        `${preset} must not surge forward/backward when frame duration changes (drift ${projected.distanceTo(reference)})`);
      assert.equal(renderer.carPool[0].position.x, car.x);
    }
  }
});

test('onboard stays fixed to the rendered chassis at varying FPS without broadcast zoom or lag', () => {
  for (const fps of [30, 60, 120, 144]) {
    const renderer = Object.create(Renderer3D.prototype);
    renderer.track = track();
    renderer.scene = new THREE.Scene();
    renderer.camera = new THREE.PerspectiveCamera(65, 1.5, 5, 24000);
    renderer.camera.up.set(0, 0, 1);
    renderer.camera.position.set(-100, 80, 90);
    renderer.controls = { target: new THREE.Vector3(), update() {}, autoRotate: false };
    renderer.carPool = [new THREE.Group(), new THREE.Group()];
    renderer.carPool.forEach(mesh => renderer.scene.add(mesh));
    renderer.playerCar = new THREE.Group();
    renderer.rayGroup = new THREE.Group();
    renderer.f1Loaded = true;
    renderer.lastGen = 1;
    renderer.lastSimTime = 20;
    renderer._lastActivePreset = 'follow';
    renderer._dynamicZoomOutFov = 26;
    renderer._dynamicZoomOutDist = 45;
    renderer._camTransition = { active: true, startTime: performance.now(), duration: 1800 };
    for (const method of ['updateGantryLights', 'updateLapPlate', 'updateTireBarriers', 'updateSkidmarks',
      'processDeathEvents', 'updateBursts', 'updateTireSmoke']) renderer[method] = () => {};
    renderer.renderer = { render: (scene, camera) => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); } };
    const car = { x: 200, y: 100, angle: 0, previousX: 200, previousY: 100, previousAngle: 0,
      alive: true, finished: false, crashed: false, laps: 1, idx: 0, totalIdx: 100, speed: 350, time: 20 };
    const opponent = { ...car, x: -2000, y: -2000, previousX: -2000, previousY: -2000, totalIdx: 0 };
    const sim = { generation: 1, time: 20, cars: [car, opponent], leader: car, player: null, bestLapEver: Infinity };
    const clock = new FixedStepClock(1 / 60);
    let referenceNdc;
    for (let frame = 0; frame < fps; frame++) {
      clock.advance(1 / fps, 0.9, dt => {
        car.previousX = car.x; car.previousY = car.y; car.previousAngle = car.angle;
        car.angle += 0.5 * dt;
        car.x += Math.cos(car.angle) * car.speed * dt;
        car.y += Math.sin(car.angle) * car.speed * dt;
        car.time += dt; sim.time += dt;
      });
      renderer.render(sim, { cameraPreset: 'onboard', follow: true, renderAlpha: clock.alpha, recordGhost: false }, car);
      const mesh = renderer.carPool[0];
      const forward = new THREE.Vector3(Math.cos(mesh.rotation.z), Math.sin(mesh.rotation.z), 0);
      const offset = renderer.camera.position.clone().sub(mesh.position);
      assert.ok(Math.abs(offset.dot(forward) + 2) < 1e-8, `camera mount must not trail at ${fps} FPS`);
      assert.ok(Math.abs(offset.z - 5.8) < 1e-8);
      assert.equal(renderer.camera.fov, 44, 'a distant P2 must not zoom the onboard camera');
      assert.equal(renderer.camera.near, 0.2);
      const ndc = new THREE.Vector3(10, 0, 1).applyMatrix4(mesh.matrixWorld).project(renderer.camera);
      if (referenceNdc) assert.ok(ndc.distanceTo(referenceNdc) < 1e-8, 'the nose remains stationary in the onboard frame while the car translates and turns');
      referenceNdc = ndc;
    }
    assert.equal(renderer._camTransition, null, 'switching to onboard cancels an independent camera glide');
    assert.equal(renderer._dynamicZoomOutFov, 0);

    for (let i = 0; i < 30; i++) {
      sim.leader = i % 2 ? car : opponent;
      opponent.totalIdx = car.totalIdx + (i % 2 ? -1 : 1);
      renderer.render(sim, { cameraPreset: 'onboard', follow: true, renderAlpha: 1, recordGhost: false }, sim.leader);
      assert.equal(renderer.focusedCar, car, 'onboard remains attached when P1/P2 swap every frame in a corner');
    }
    renderer.render(sim, { cameraPreset: 'onboard', follow: true, renderAlpha: 1,
      manualFocusCar: opponent, recordGhost: false }, sim.leader);
    assert.equal(renderer.focusedCar, opponent, 'explicitly selecting another car still changes the onboard mount');
    opponent.crashed = true;
    renderer.render(sim, { cameraPreset: 'onboard', follow: true, renderAlpha: 1, recordGhost: false }, car);
    assert.equal(renderer.focusedCar, car, 'a retired onboard car releases its mount');
    opponent.crashed = false; opponent.totalIdx = 0; sim.leader = car;

    // A nearby opponent accelerates across a tick while the mounted car cruises.
    // Its screen-space velocity must join smoothly across that tick as well.
    Object.assign(car, { x: 5, y: 0, angle: 0, beforePreviousX: -5, previousX: 0,
      beforePreviousY: 0, previousY: 0, beforePreviousAngle: 0, previousAngle: 0 });
    Object.assign(opponent, { x: 61, y: 2, angle: 0, beforePreviousX: 49, previousX: 55,
      beforePreviousY: 2, previousY: 2, beforePreviousAngle: 0, previousAngle: 0 });
    const screenPosition = alpha => {
      renderer.render(sim, { cameraPreset: 'onboard', follow: true, renderAlpha: alpha, recordGhost: false }, car);
      return new THREE.Vector3(0, 0, 1).applyMatrix4(renderer.carPool[1].matrixWorld).project(renderer.camera);
    };
    const epsilon = 0.00001;
    const leftBefore = screenPosition(1 - epsilon), leftEnd = screenPosition(1);
    const incomingVelocity = leftEnd.clone().sub(leftBefore).divideScalar(epsilon);
    Object.assign(car, { beforePreviousX: 0, previousX: 5, x: 10 });
    Object.assign(opponent, { beforePreviousX: 55, previousX: 61, x: 68 });
    const rightStart = screenPosition(0), rightAfter = screenPosition(epsilon);
    const outgoingVelocity = rightAfter.clone().sub(rightStart).divideScalar(epsilon);
    assert.ok(leftEnd.distanceTo(rightStart) < 1e-8, 'nearby cars remain continuous across tick boundaries');
    assert.ok(incomingVelocity.distanceTo(outgoingVelocity) < 0.00001,
      'nearby opponents no longer switch displayed velocity abruptly at a tick boundary');

    renderer.render(sim, { cameraPreset: 'orbit', follow: false, renderAlpha: 1, recordGhost: false }, car);
    assert.equal(renderer.camera.near, 5, 'external views restore their normal clipping plane');
  }
});

test('the actual F1 asset retains every visible triangle in two draws per car', () => {
  const assetRoot = new URL('../public/full_f1_2022/', import.meta.url);
  const gltf = JSON.parse(readFileSync(new URL('scene.gltf', assetRoot), 'utf8'));
  const buffers = gltf.buffers.map(b => readFileSync(new URL(b.uri, assetRoot)));
  const attribute = (index) => {
    const accessor = gltf.accessors[index], view = gltf.bufferViews[accessor.bufferView];
    const size = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 }[accessor.type];
    const Type = { 5126: Float32Array, 5125: Uint32Array, 5123: Uint16Array }[accessor.componentType];
    const source = buffers[view.buffer];
    const offset = source.byteOffset + (view.byteOffset || 0) + (accessor.byteOffset || 0);
    const stride = (view.byteStride || size * Type.BYTES_PER_ELEMENT) / Type.BYTES_PER_ELEMENT;
    const input = new Type(source.buffer, offset, (accessor.count - 1) * stride + size);
    const values = new Type(accessor.count * size);
    for (let i = 0; i < accessor.count; i++) values.set(input.subarray(i * stride, i * stride + size), i * size);
    return new THREE.BufferAttribute(values, size, accessor.normalized || false);
  };
  const nodes = gltf.nodes.map(node => {
    const object = new THREE.Group();
    object.name = node.name || '';
    if (node.matrix) new THREE.Matrix4().fromArray(node.matrix).decompose(object.position, object.quaternion, object.scale);
    if (node.translation) object.position.fromArray(node.translation);
    if (node.rotation) object.quaternion.fromArray(node.rotation);
    if (node.scale) object.scale.fromArray(node.scale);
    if (node.mesh !== undefined) {
      for (const primitive of gltf.meshes[node.mesh].primitives) {
        const geometry = new THREE.BufferGeometry();
        for (const [semantic, index] of Object.entries(primitive.attributes)) {
          geometry.setAttribute({ POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv' }[semantic], attribute(index));
        }
        geometry.setIndex(attribute(primitive.indices));
        const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ roughness: 0.5, metalness: 0 }));
        mesh.name = node.name;
        object.add(mesh);
      }
    }
    return object;
  });
  gltf.nodes.forEach((node, i) => (node.children || []).forEach(child => nodes[i].add(nodes[child])));
  const template = new THREE.Group();
  gltf.scenes[gltf.scene || 0].nodes.forEach(index => template.add(nodes[index]));
  const renderer = Object.create(Renderer3D.prototype);
  renderer.f1Texture = new THREE.Texture();
  renderer.createRaceNumberTexture = (number) => {
    const texture = new THREE.Texture();
    texture.userData.number = number;
    return texture;
  };
  renderer.initF1DecalGeometries(template);
  const expected = template.clone(true);
  expected.scale.setScalar(6);
  expected.rotation.x = Math.PI / 2;
  expected.traverse(o => { if (/Plane|Sphere|Object_12|Object_4/.test(o.name)) o.visible = false; });
  const expectedRoot = new THREE.Group();
  expectedRoot.rotation.z = Math.PI;
  expectedRoot.add(expected);
  const bounds = root => {
    root.updateWorldMatrix(true, true);
    const box = new THREE.Box3();
    root.traverseVisible(o => {
      if (o.isMesh && !o.material.transparent) {
        o.geometry.computeBoundingBox();
        box.union(o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld));
      }
    });
    return box;
  };
  const cars = [renderer.createF1CarMesh(template, null, false, 0, 44), renderer.createF1CarMesh(template, null, false, 2, 16)];
  const meshes = [];
  cars[0].traverseVisible(o => { if (o.isMesh) meshes.push(o); });
  assert.equal(meshes.length, 2, 'one opaque body and one transparent decal draw');
  const body = meshes.find(m => !m.material.transparent);
  assert.equal(body.geometry.index.count / 3, 14762, 'body and both axles retain every source triangle');
  const before = bounds(expectedRoot), after = bounds(cars[0]);
  assert.ok(before.min.distanceTo(after.min) < 0.0001);
  assert.ok(before.max.distanceTo(after.max) < 0.0001);
  let otherBody;
  cars[1].traverseVisible(o => { if (o.isMesh && !o.material.transparent) otherBody = o; });
  assert.equal(body.material, otherBody.material, 'fleet shares its shader material');
  assert.notDeepEqual(body.geometry.attributes.liveryColor.array, otherBody.geometry.attributes.liveryColor.array,
    'each team keeps its own livery');
  const decalTriangles = Object.values(renderer.f1DecalGeometries).reduce((sum, geo) => sum + geo.attributes.position.count / 3, 0);
  assert.equal(meshes.find(m => m.material.transparent).geometry.attributes.position.count / 3, decalTriangles);
  assert.equal(meshes.find(m => m.material.transparent).material.map.userData.number, 44);
  let otherDecal;
  cars[1].traverseVisible(o => { if (o.isMesh && o.material.transparent) otherDecal = o; });
  assert.equal(otherDecal.material.map.userData.number, 16);
});

test('local tire batches cull distant barriers and track tires moved by collisions', (t) => {
  const renderer = Object.create(Renderer3D.prototype);
  renderer.track = track();
  renderer.scene = new THREE.Scene();
  const tires = renderer.generateTiresForTrack(renderer.track);
  const sim = { tireBarriers: { tires } };
  renderer.setupTireBarriers(sim);
  assert.equal(renderer.tireBatches.reduce((sum, batch) => sum + batch.count, 0), tires.length);
  const camera = new THREE.PerspectiveCamera(42, 1.5, 5, 900);
  camera.up.set(0, 0, 1);
  const first = tires[0];
  camera.position.set(first.x - 150, -first.y - 150, 120);
  camera.lookAt(first.x, -first.y, 0);
  camera.updateMatrixWorld();
  renderer.scene.updateMatrixWorld(true);
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const visibleCount = renderer.tireBatches.filter(batch => frustum.intersectsObject(batch)).reduce((sum, batch) => sum + batch.count, 0);
  assert.ok(visibleCount > 0 && visibleCount < tires.length / 2, `${visibleCount}/${tires.length} tires should be submitted near the start`);
  t.diagnostic(`Opening-grid camera submits ${visibleCount}/${tires.length} barrier tires with every placement retained.`);
  const { batch, slot } = renderer.tireInstances[0];
  const radius = batch.boundingSphere.radius;
  first.x += 5000; first.sleeping = false;
  renderer.updateTireBarriers(sim);
  const matrix = new THREE.Matrix4();
  batch.getMatrixAt(slot, matrix);
  assert.ok(Math.abs(matrix.elements[12] - first.x) < 0.001);
  assert.ok(batch.boundingSphere.radius > radius, 'bounds expand to include collision displacement');
  assert.equal(first.needsRenderUpdate, false);
  let disposed = 0;
  renderer.tireBatches.forEach(b => b.addEventListener('dispose', () => disposed++));
  const previousBatches = renderer.tireBatches.length;
  renderer.setupTireBarriers({ tireBarriers: { tires: [] } });
  assert.equal(disposed, previousBatches);
  assert.equal(renderer.tireBatches.length, 0);
});

test('pace insights measure closing pack gap and weight finish rates by actual starters', () => {
  const history = Array.from({ length: 50 }, (_, i) => ({
    generation: 100 + i, bestLap: i < 25 ? 12 : 11.9, avgLap: i < 25 ? 15 : 13.9,
    population: i < 25 ? 20 : 10, finishers: i < 25 ? 4 : 5,
  }));
  const model = buildPaceInsights(history);
  assert.ok(Math.abs(model.gapChange + 1) < 1e-8);
  assert.ok(Math.abs(model.recordGain - 0.1) < 1e-8);
  assert.equal(model.sinceRecord, 24);
  assert.equal(model.finishRate, 0.5);
  assert.equal(model.finished, 125);
  assert.equal(model.starters, 250);
  const mixed = buildPaceInsights([
    { generation: 1, bestLap: 12, population: 10, finishers: 10 },
    { generation: 2, bestLap: 12, population: 20, finishers: 0 },
  ]);
  assert.equal(mixed.finishRate, 1 / 3, 'use the proportion of cars, not an unweighted average of percentages');
});

test('pace insights preserve missing measurements and do not invent finishers or pack pace', () => {
  const history = [
    { generation: 1, bestLap: Infinity, avgLap: null },
    { generation: 2, bestLap: 12, avgLap: 11, population: 20 },
    { generation: 3, bestLap: 12, avgLap: 14, finishers: 10 },
  ];
  const model = buildPaceInsights(history);
  assert.equal(model.rows[0].best, null);
  assert.equal(model.rows[0].gap, null);
  assert.equal(model.rows[1].gap, null, 'inconsistent pack averages are unavailable');
  assert.equal(model.finishRate, null);
  assert.equal(model.recordGain, null);
  assert.equal(buildPaceInsights([]).rows.length, 0);
  assert.equal(buildPaceInsights([{ generation: 1, bestLap: 12 }]).gapChange, null);
  assert.equal('championMedian' in history[0], false, 'analysis never mutates saved history');
});

test('pace window retains the record established before the visible history', () => {
  const history = Array.from({ length: 220 }, (_, i) => ({
    generation: i + 1, bestLap: i === 0 ? 11 : 12, avgLap: 14, population: 20, finishers: 4,
  }));
  const model = buildPaceInsights(history, 200);
  assert.equal(model.rows.length, 200);
  assert.equal(model.first.generation, 21);
  assert.equal(model.last.record, 11);
  assert.equal(model.sinceRecord, 219);
  assert.equal(model.recordGain, 0);
  assert.equal(model.rows.at(-1).gapLow, 2);
  assert.equal(model.rows.at(-1).gapHigh, 2);
});

test('the full current fleet has static numbered previews without scheduling GPU work', () => {
  const preview = new CarSideviewRenderer(() => assert.fail('standard fleet previews must not schedule rendering'));
  preview.canRender = () => false;
  const sources = F1_CAR_NUMBERS.map((carNumber, i) => ({ carNumber, teamIdx: Math.floor(i / 2), isPlayer: false, mesh: new THREE.Group() }));
  sources.push({ carNumber: 7, teamIdx: 1, isPlayer: true, mesh: new THREE.Group() });
  for (const source of sources) {
    const key = carPreviewKey(source.teamIdx, source.isPlayer, source.carNumber);
    const path = carPreviewAsset(key);
    assert.equal(preview.getCarSideviewDataUrl(source.teamIdx, source.isPlayer, source.carNumber), path,
      'current car artwork is available immediately, even before model loading');
    const png = readFileSync(new URL(`../public${path}`, import.meta.url));
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    assert.equal(png.readUInt32BE(16), 320);
    assert.equal(png.readUInt32BE(20), 90);
    assert.ok(png.length > 5000, 'each preview contains the rendered current model');
  }
  preview.init(sources);
  assert.equal(preview.isReady, true);
  assert.equal(preview.renderer, null, 'the standard fleet does not need a thumbnail WebGL context');
  assert.equal(preview.pending.size, 0);
});

test('car previews defer work, deduplicate requests and retain shared fleet resources', async (t) => {
  const jobs = [];
  const preview = new CarSideviewRenderer((fn) => jobs.push(fn));
  preview.useStaticAssets = false;
  const source = new THREE.Group();
  const geometry = new THREE.BoxGeometry();
  let disposals = 0;
  geometry.addEventListener('dispose', () => disposals++);
  source.add(new THREE.Mesh(geometry, new THREE.MeshBasicMaterial()));
  const fleet = new THREE.Group();
  fleet.add(source);
  const key = carPreviewKey(0, false, 44);
  preview.sources.set(key, source);
  preview.isReady = true;
  preview.scene = new THREE.Scene();
  preview.camera = new THREE.Camera();
  const calls = [];
  preview.renderer = {
    compileAsync: async () => { calls.push('compile'); },
    render: () => { calls.push('render'); },
    domElement: { toBlob: (fn) => { calls.push('encode'); fn(new Blob(['preview'])); } },
  };
  preview.capturePreviewBlob = async () => { calls.push('encode'); return new Blob(['preview']); };
  let ready;
  preview.onPreviewReady((k, url) => { ready = { k, url }; });
  assert.equal(preview.getCarSideviewDataUrl(0, false, 44), null);
  assert.equal(preview.getCarSideviewDataUrl(0, false, 44), null);
  assert.equal(preview.getCarSideviewDataUrl(99, false, 99), null);
  assert.deepEqual(calls, [], 'UI getters perform no rendering work');
  assert.equal(jobs.length, 1);
  const task = jobs.shift()();
  await Promise.resolve();
  assert.deepEqual(calls, ['compile'], 'drawing waits until async compilation completes');
  jobs.shift()();
  await task;
  t.after(() => URL.revokeObjectURL(ready.url));
  assert.deepEqual(calls, ['compile', 'render', 'encode']);
  assert.equal(ready.k, key);
  assert.equal(preview.getCarSideviewDataUrl(0, false, 44), ready.url);
  assert.equal(preview.scene.children.length, 0);
  assert.equal(source.parent, fleet);
  assert.equal(disposals, 0);
  assert.equal(preview.pending.size, 0);
  assert.equal(preview.busy, false);
});

test('thumbnail GPU work waits for a pause and rechecks permission after asynchronous compilation', async t => {
  const jobs = [], calls = [];
  let offTrack = false;
  const preview = new CarSideviewRenderer(fn => jobs.push(fn));
  preview.useStaticAssets = false;
  preview.canRender = () => offTrack;
  preview.isReady = true;
  preview.scene = new THREE.Scene();
  preview.camera = new THREE.Camera();
  const key = carPreviewKey(0, false, 44);
  preview.sources.set(key, new THREE.Group());
  preview.renderer = { compileAsync: async () => { calls.push('compile'); }, render: () => calls.push('draw') };
  preview.capturePreviewBlob = async () => { calls.push('readback'); return new Blob(['preview']); };
  preview.getCarSideviewDataUrl(0, false, 44);
  assert.equal(jobs.length, 0, 'active racing cannot schedule shader or readback work');
  offTrack = true;
  preview.scheduleNext();
  offTrack = false;
  jobs.shift()();
  assert.deepEqual(calls, [], 'a pending idle callback is cancelled when the race resumes');
  assert.equal(preview.pending.size, 1);
  offTrack = true;
  preview.scheduleNext();
  const pending = jobs.shift()();
  await Promise.resolve();
  assert.deepEqual(calls, ['compile']);
  offTrack = false;
  jobs.shift()();
  await pending;
  assert.deepEqual(calls, ['compile'], 'resuming during compilation cannot start a GPU snapshot');
  assert.deepEqual(preview.queue, [key]);
  preview.getCarSideviewDataUrl(0, false, 44);
  assert.equal(preview.queue.length, 1, 'deferred requests remain deduplicated');
  offTrack = true;
  preview.scheduleNext();
  const resumed = jobs.shift()();
  await Promise.resolve();
  jobs.shift()();
  await resumed;
  assert.deepEqual(calls, ['compile', 'compile', 'draw', 'readback']);
  const url = preview.cache.get(key);
  t.after(() => URL.revokeObjectURL(url));
  offTrack = false;
  assert.equal(preview.getCarSideviewDataUrl(0, false, 44), url, 'cached 3D cars remain available during racing');
  assert.equal(preview.pending.size, 0);
});

test('a failed preview releases the queue so another car can render', async (t) => {
  const jobs = [];
  const preview = new CarSideviewRenderer((fn) => jobs.push(fn));
  preview.useStaticAssets = false;
  const warn = console.warn;
  console.warn = () => {};
  t.after(() => { console.warn = warn; });
  preview.isReady = true;
  preview.scene = new THREE.Scene();
  preview.camera = new THREE.Camera();
  preview.sources.set(carPreviewKey(0, false, 44), new THREE.Group());
  preview.sources.set(carPreviewKey(0, false, 63), new THREE.Group());
  preview.renderer = { compileAsync: async () => { throw new Error('context unavailable'); } };
  preview.getCarSideviewDataUrl(0, false, 44);
  preview.getCarSideviewDataUrl(0, false, 63);
  await jobs.shift()();
  assert.equal(preview.scene.children.length, 0);
  assert.equal(preview.pending.has(carPreviewKey(0, false, 44)), false);
  assert.equal(jobs.length, 1, 'the next car is scheduled after failure');
  await jobs.shift()();
  assert.equal(preview.pending.size, 0);
  assert.equal(preview.busy, false);
});

test('record ghost and cars share smooth display time at 30, 60, 120 and 144 FPS', () => {
  for (const fps of [30, 60, 120, 144]) {
    const sim = Object.create(Simulation.prototype);
    sim.config = { dt: 1 / 60, generation: { startDelay: 0 } };
    sim.time = 2;
    sim.bestLapEver = 12;
    sim.recordLapTelemetry = Array.from({ length: 13 }, (_, t) => ({ t, x: t * 100, y: 0, angle: 0, speed: 100 }));
    const car = { x: 200, y: 0, angle: 0, previousX: 200 - sim.config.dt * 100, previousY: 0, previousAngle: 0 };
    const clock = new FixedStepClock(sim.config.dt);
    let previousX;
    for (let frame = 0; frame < fps; frame++) {
      clock.advance(1 / fps, 0.9, (dt) => {
        car.previousX = car.x;
        car.x += dt * 100;
        sim.time += dt;
      });
      const ghost = sim.getRecordGhostRenderState(clock.alpha);
      assert.ok(Math.abs(ghost.x - getRenderPose(car, clock.alpha).x) < 1e-8,
        `ghost and car should stay aligned at ${fps} FPS`);
      if (previousX !== undefined) assert.ok(ghost.x > previousX, 'ghost moves even on frames without a physics tick');
      previousX = ghost.x;
    }
    const before = sim.getRecordGhostRenderState(0.5);
    Object.defineProperty(sim, 'leader', { value: { time: 100, lapStart: 99 } });
    assert.deepEqual(sim.getRecordGhostRenderState(0.5), before, 'leader switches never rephase ghost playback');
    sim.time = 0;
    assert.equal(sim.getRecordGhostRenderState(0).lapTime, 0, 'generation reset starts at zero');
  }
});

test('record ghost interpolates across the last sample and lap seam without holding still', () => {
  const sim = Object.create(Simulation.prototype);
  sim.bestLapEver = 12;
  sim.recordLapTelemetry = Array.from({ length: 12 }, (_, t) => ({
    t, x: Math.cos(t * Math.PI / 6), y: Math.sin(t * Math.PI / 6), angle: t * Math.PI / 6, speed: 100,
  }));
  const a = sim.getRecordGhostState(11.2), b = sim.getRecordGhostState(11.8);
  assert.ok(Math.hypot(b.x - a.x, b.y - a.y) > 0.2, 'the final interval continues moving');
  const before = sim.getRecordGhostState(11.999), after = sim.getRecordGhostState(12.001);
  assert.ok(Math.hypot(before.x - after.x, before.y - after.y) < 0.002, 'lap wrap is continuous');
  assert.ok(Math.abs(Math.atan2(Math.sin(after.angle - before.angle), Math.cos(after.angle - before.angle))) < 0.002);
});

test('terrain water data is reused for probes and regenerated on track changes', () => {
  const renderer = Object.create(Renderer3D.prototype);
  renderer.track = track();
  const water = renderer.getWaterBodies();
  assert.equal(water.lakes.length, 2);
  assert.equal(water.river.length, 61);
  assert.equal(renderer.getWaterBodies(), water);
  renderer.track = track('speedway-oval');
  assert.notEqual(renderer.getWaterBodies(), water);
  assert.notDeepEqual(renderer.getWaterBodies().lakes, water.lakes);
});

const layers = CONFIG.nn.layers;
const track = (key = 'grand-prix') => new Track(TRACK_PRESETS[key].points, CONFIG.track.width, CONFIG.track.samples);
const genome = () => Array(NeuralNetwork.genomeSize(layers)).fill(0.125);
const telemetry = () => Array.from({ length: 12 }, (_, i) => ({ t: i * 0.5, x: i, y: i, angle: 0, speed: 10 }));
function storageFixture(t) {
  const previous = globalThis.localStorage;
  const memory = new Map();
  globalThis.localStorage = {
    getItem: (key) => memory.get(key) ?? null,
    setItem: (key, value) => memory.set(key, String(value)),
  };
  t.after(() => { globalThis.localStorage = previous; });
  return memory;
}
const saved = () => ({ generation: 42, trackPreset: 'simple-loop', bestLapEver: 8.5,
  currentGenomes: [genome()], history: [{ generation: 41, best: 100 }],
  recordLapTelemetry: telemetry(), isRealCarTelemetry: true });

test('playback advances equally at 10, 30, 60, 120 and 144 FPS and multiple speeds', () => {
  for (const speed of [0.9, 1, 4.5, 45]) {
    for (const fps of [10, 30, 60, 120, 144]) {
      const clock = new FixedStepClock(CONFIG.dt);
      let elapsed = 0;
      for (let frame = 0; frame < fps * 10; frame++) {
        clock.advance(1 / fps, speed, (dt) => {
          assert.equal(dt, CONFIG.dt);
          elapsed += dt;
        });
      }
      assert.ok(Math.abs(elapsed - 10 * speed) < 1e-7, `${fps} FPS at speed ${speed}: ${elapsed}`);
    }
  }
});

test('playback bounds catch-up and can discard paused time', () => {
  const clock = new FixedStepClock(CONFIG.dt);
  assert.equal(clock.advance(60, 1, () => {}), 15);
  assert.equal(clock.advance(60, 50, () => {}), 720);
  clock.advance(CONFIG.dt / 2, 1, () => {});
  clock.reset();
  assert.equal(clock.advance(CONFIG.dt / 2, 1, () => {}), 0);
});

test('a truncated primary recovers genomes, history and track from the valid backup', (t) => {
  const memory = storageFixture(t);
  memory.set('ai-racer:training-state:v2', '{"generation":42,"broken":');
  memory.set('ai-racer:training-state:backup', JSON.stringify(saved()));
  const restored = loadTrainingState(layers);
  assert.equal(restored.generation, 42);
  assert.equal(restored.trackPreset, 'simple-loop');
  assert.deepEqual(Array.from(restored.currentGenomes[0]), genome());
  assert.equal(restored.history.length, 1);
});

test('structurally invalid primary saves also fall back to the backup', (t) => {
  const memory = storageFixture(t);
  memory.set('ai-racer:training-state:backup', JSON.stringify(saved()));
  for (const bad of [null, { generation: -1 }, { ...saved(), currentGenomes: [[null]] }]) {
    memory.set('ai-racer:training-state:v2', JSON.stringify(bad));
    assert.equal(loadTrainingState(layers).currentGenomes.length, 1);
  }
});

test('sub-8.80-second records and real telemetry survive save, load and resume', (t) => {
  storageFixture(t);
  const sim = new Simulation(track('simple-loop'), CONFIG);
  sim.generation = 42;
  sim.bestLapEver = 8.5;
  sim.recordLapTelemetry = telemetry();
  sim.isRealCarTelemetry = true;
  assert.equal(saveTrainingState(sim, layers, 'simple-loop'), true);
  const restored = loadTrainingState(layers);
  assert.equal(restored.bestLapEver, 8.5);
  sim.resumeState(restored);
  assert.equal(sim.bestLapEver, 8.5);
  assert.equal(sim.isRealCarTelemetry, true);
  assert.equal(sim.recordLapTelemetry.length, 12);
});

test('changing circuits clears circuit results while retaining generation and brains', () => {
  const sim = new Simulation(track(), CONFIG);
  sim.generation = 42;
  sim.bestLapEver = 9;
  sim.prevBestLapEver = 10;
  sim.history = [{ generation: 41, bestLap: 9 }];
  sim.allTimeBest = { genome: sim.cars[0].brain.genome, fitness: 100 };
  sim.recordLapTelemetry = telemetry();
  sim.isRealCarTelemetry = true;
  sim.setManual(true);
  sim.playerBestLap = 9;
  const brains = sim.cars.map((car) => Array.from(car.brain.genome));
  const nextTrack = track('simple-loop');
  sim.setTrack(nextTrack, true);
  assert.equal(sim.generation, 42);
  assert.deepEqual(sim.cars.map((car) => Array.from(car.brain.genome)), brains);
  assert.deepEqual(sim.history, []);
  assert.equal(sim.allTimeBest, null);
  assert.equal(sim.bestLapEver, Infinity);
  assert.equal(sim.raceBestLap, Infinity);
  assert.equal(sim.prevBestLapEver, null);
  assert.equal(sim.recordLapTelemetry, null);
  assert.equal(sim.isRealCarTelemetry, false);
  assert.equal(sim.player.track, nextTrack);
  assert.equal(sim.playerBestLap, Infinity);
});

test('zero collision warmup enables contact and opponent sensors immediately', (t) => {
  const previous = { ...CONFIG.collision };
  t.after(() => Object.assign(CONFIG.collision, previous));
  Object.assign(CONFIG.collision, { enabled: false, warmupTime: 0, separationLeadTime: 0 });
  const sim = new Simulation(track(), CONFIG);
  sim.cars = sim.cars.slice(0, 2);
  const [a, b] = sim.cars;
  a.x = 1000; a.y = 1000;
  b.x = 1001; b.y = 1000;
  sim.step();
  assert.equal(Math.hypot(a.x - b.x, a.y - b.y), 1, 'ghost mode stays non-solid');
  CONFIG.collision.enabled = true;
  sim.step();
  assert.ok(Math.hypot(a.x - b.x, a.y - b.y) > 1, 'contact separates overlapping cars immediately');
  a.sense(sim.cars);
  assert.equal(a._nearby.length, 2, 'opponent is detected without warmup');
});

test('only completed organic milestones capture their own tested champion and metrics', () => {
  const sim = new Simulation(track(), CONFIG);
  assert.deepEqual(sim.capturedPresets, [], 'generation 1 is not tested on entry');
  const observations = [];
  sim.onMilestoneCaptured = (preset) => {
    const champion = sim.cars.find((car) => car.brain.genome.every((v, i) => v === preset.genome[i]));
    assert.ok(champion, 'the captured genome actually raced in the completed generation');
    assert.equal(preset.gen, sim.generation);
    assert.equal(preset.bestLap, Number.isFinite(champion.bestLap) ? champion.bestLap : null);
    assert.equal(preset.topSpeed, champion.topSpeed);
    assert.equal(preset.laps, champion.laps);
    observations.push(preset.gen);
  };
  while (sim.generation < 3) sim.step();
  assert.deepEqual(observations, [1, 2]);
  assert.deepEqual(sim.capturedPresets.map((p) => p.gen), [1, 2]);
  assert.equal(compatibleCaptures(sim.capturedPresets, sim.track, CONFIG).length, 2);
  assert.equal(compatibleCaptures(sim.capturedPresets, track('simple-loop'), CONFIG).length, 0);
  const changedConfig = { ...CONFIG, car: { ...CONFIG.car, tireGrip: CONFIG.car.tireGrip + 1 } };
  assert.equal(compatibleCaptures(sim.capturedPresets, sim.track, changedConfig).length, 0);
});

test('general JSON export includes milestone genomes and remains importable as a brain', async () => {
  const captures = Object.values(PRESET_BRAINS);
  const best = { genome: genome(), generation: 5421, fitness: 123, bestLap: Infinity };
  const exported = buildBrainExport(best, layers, { track: 'grand-prix', capturedPresets: captures });
  assert.equal(exported.generation, 5421);
  assert.equal(exported.bestLap, null);
  assert.equal(exported.track, 'grand-prix');
  assert.deepEqual(exported.capturedPresets, captures);
  const imported = await importBrainFile({ text: async () => JSON.stringify(exported) }, layers);
  assert.equal(imported.generation, 5421);
  assert.deepEqual(imported.capturedPresets, captures);
  assert.equal(compatibleCaptures(imported.capturedPresets, track(), CONFIG).length, captures.length);
});

test('bundled tested brains are available to first-time players without changing live training', () => {
  const sim = new Simulation(track(), CONFIG);
  const bundled = Object.values(PRESET_BRAINS);
  const available = availableCaptures(bundled, sim.capturedPresets, sim.track, CONFIG);
  assert.ok(available.length >= 7);
  assert.equal(available.length, bundled.length, 'all bundles match the shipped track and network');
  assert.ok(available.every(p => p.source === 'organic-training' && typeof p.capturedAt === 'string'));
  assert.equal(sim.generation, 1);
  assert.deepEqual(sim.capturedPresets, [], 'bundles are separate from personally earned captures');
  const personal = { ...available[0], fitness: available[0].fitness + 1 };
  const merged = availableCaptures(bundled, [personal], sim.track, CONFIG);
  assert.equal(merged.length, available.length);
  assert.equal(merged[0], personal, 'personal tested checkpoint takes precedence');
  assert.equal(availableCaptures(bundled, [], track('simple-loop'), CONFIG).length, 0);
  const changedConfig = { ...CONFIG, car: { ...CONFIG.car, tireGrip: CONFIG.car.tireGrip + 1 } };
  assert.equal(availableCaptures(bundled, [], sim.track, changedConfig).length, 0);
  sim.reset();
  assert.equal(availableCaptures(bundled, sim.capturedPresets, sim.track, CONFIG).length, available.length);
});

test('captured milestones survive reload and are cleared by a training reset', (t) => {
  storageFixture(t);
  const sim = new Simulation(track(), CONFIG);
  while (sim.generation < 2) sim.step();
  const checkpoint = structuredClone(sim.capturedPresets[0]);
  assert.equal(saveTrainingState(sim, layers), true);
  const resumed = new Simulation(track(), CONFIG);
  resumed.resumeState(loadTrainingState(layers));
  assert.equal(resumed.captureEnabled, true);
  assert.deepEqual(resumed.capturedPresets, [checkpoint]);
  resumed.reset();
  assert.deepEqual(resumed.capturedPresets, []);
  assert.equal(resumed.generation, 1);
});

test('legacy saves, imported brains and preset replays cannot manufacture milestone captures', () => {
  const sim = new Simulation(track(), CONFIG);
  sim.resumeState(saved());
  assert.equal(sim.captureEnabled, false);
  sim.generation = 50;
  sim.endGeneration();
  assert.deepEqual(sim.capturedPresets, []);
  sim.reset();
  sim.seedFrom(genome(), { generation: 100, fitness: 1, bestLap: 9 });
  sim.endGeneration();
  assert.deepEqual(sim.capturedPresets, []);
  sim.reset();
  sim.captureEnabled = false;
  sim.endGeneration();
  assert.deepEqual(sim.capturedPresets, []);
});

test('fast-forward captures the tested race distance without inventing future checkpoints', (t) => {
  const previous = { ...CONFIG.generation };
  t.after(() => Object.assign(CONFIG.generation, previous));
  Object.assign(CONFIG.generation, { startDelay: 0.0001, maxLaps: 2, timeLimit: 50 });
  const sim = new Simulation(track(), CONFIG);
  sim.hyperRunning = true;
  sim.tireBarriers = null;
  while (sim.generation < 2) sim.step();
  assert.deepEqual(sim.capturedPresets.map((p) => p.gen), [1]);
  assert.equal(sim.capturedPresets[0].raceLaps, 2);
  Object.assign(CONFIG.generation, previous);
  assert.equal(compatibleCaptures(sim.capturedPresets, sim.track, CONFIG).length, 1);
});

test('render interpolation removes stop-start motion between fixed physics steps', () => {
  for (const fps of [30, 60, 120, 144]) {
    const clock = new FixedStepClock(CONFIG.dt);
    const car = { x: 0, y: 0, angle: 0, previousX: 0, previousY: 0, previousAngle: 0 };
    const samples = [];
    for (let frame = 0; frame < fps * 2; frame++) {
      clock.advance(1 / fps, 0.9, (dt) => {
        car.previousX = car.x;
        car.x += 300 * dt;
      });
      const physicalX = car.x;
      samples.push(getRenderPose(car, clock.alpha).x);
      assert.equal(car.x, physicalX, 'drawing must not change physics');
    }
    for (let i = 5; i < samples.length; i++) {
      assert.ok(Math.abs(samples[i] - samples[i - 1] - 270 / fps) < 1e-8,
        `motion must be uniform at ${fps} FPS, including frames without a physics tick`);
    }
  }
});

test('render poses share camera/body positions and interpolate angles across the wrap', () => {
  const car = { x: 10, y: 20, angle: -Math.PI + 0.1,
    previousX: 0, previousY: 10, previousAngle: Math.PI - 0.1 };
  const cameraPose = getRenderPose(car, 0.5);
  const bodyPose = getRenderPose(car, 0.5);
  assert.equal(cameraPose, bodyPose);
  assert.equal(bodyPose.x, 5);
  assert.equal(bodyPose.y, 15);
  assert.ok(Math.abs(bodyPose.angle - Math.PI) < 1e-10, 'take the short turn, not a full spin');
  assert.equal(getRenderPose(car, 1).x, 10, 'paused/turbo rendering can show the current tick');
});

test('render interpolation stays within endpoints through braking, stops, reversals and heading wrap', () => {
  for (const [before, start, end] of [[0, 5, 11], [0, 10, 10.1], [0, 10, 10], [0, 10, 9], [10, 0, -5]]) {
    const car = { beforePreviousX: before, previousX: start, x: end,
      beforePreviousY: 0, previousY: 0, y: 0,
      beforePreviousAngle: Math.PI - 0.2, previousAngle: Math.PI - 0.1, angle: -Math.PI + 0.1 };
    let previous = start;
    for (let i = 0; i <= 100; i++) {
      const pose = getRenderPose(car, i / 100);
      assert.ok(pose.x >= Math.min(start, end) - 1e-10 && pose.x <= Math.max(start, end) + 1e-10);
      assert.ok((end - start) * (pose.x - previous) >= -1e-10, 'rendering cannot introduce a backwards excursion');
      assert.ok(pose.angle >= Math.PI - 0.1 && pose.angle <= Math.PI + 0.1 + 1e-10);
      previous = pose.x;
    }
    assert.equal(getRenderPose(car, 0).x, start);
    assert.equal(getRenderPose(car, 1).x, end, 'no extra frame of display latency');
    assert.equal(car.x, end, 'render interpolation never changes physics');
  }
});

test('car resets synchronize render history instead of interpolating across a teleport', () => {
  const sim = new Simulation(track(), CONFIG);
  const car = sim.cars[0];
  car.x += 500;
  car.reset();
  const pose = getRenderPose(car, 0.25);
  assert.equal(pose.x, car.x);
  assert.equal(pose.y, car.y);
  assert.equal(pose.angle, car.angle);
  car.x += 2;
  const before = car.x;
  sim.step();
  assert.equal(car.previousX, before, 'physics steps preserve their starting pose');
});

test('routine saves coalesce outside the caller and flush the latest state on exit', () => {
  const tasks = new Set();
  let state = 1;
  const saved = [];
  const queue = new DeferredTask(() => saved.push(state), (callback) => {
    tasks.add(callback);
    return () => tasks.delete(callback);
  });
  queue.request(); queue.request(); queue.request();
  assert.deepEqual(saved, [], 'no storage work runs on the physics/caller stack');
  assert.equal(tasks.size, 1);
  state = 2;
  const callback = [...tasks][0];
  tasks.delete(callback); callback();
  assert.deepEqual(saved, [2], 'save the current state, not a stale queued snapshot');
  queue.request();
  state = 3;
  queue.flush();
  assert.equal(tasks.size, 0, 'lifecycle flush cancels the queued duplicate');
  assert.deepEqual(saved, [2, 3]);
});

test('static batching preserves triangles, world bounds, materials and dynamic lamps', () => {
  const root = new THREE.Group();
  root.position.set(17, -3, 5);
  root.rotation.z = 0.3;
  const material = new THREE.MeshStandardMaterial({ color: 0x8899aa });
  const nested = new THREE.Group();
  nested.position.set(4, 2, 0);
  for (let i = 0; i < 3; i++) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(2, 3, 4), material);
    mesh.position.set(i * 5, 0, 0);
    nested.add(mesh);
  }
  root.add(nested);
  const lampMaterial = new THREE.MeshStandardMaterial({ emissive: 0xff0000 });
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(1), lampMaterial);
  root.add(lamp);
  const before = new THREE.Box3().setFromObject(root, true);
  let trianglesBefore = 0;
  root.traverse((o) => { if (o.isMesh) trianglesBefore += o.geometry.index.count / 3; });
  batchStaticMeshes(root);
  const after = new THREE.Box3().setFromObject(root, true);
  assert.ok(before.min.distanceTo(after.min) < 1e-5);
  assert.ok(before.max.distanceTo(after.max) < 1e-5);
  let trianglesAfter = 0;
  let meshes = 0;
  root.traverse((o) => { if (o.isMesh) { meshes++; trianglesAfter += o.geometry.index.count / 3; } });
  assert.equal(trianglesAfter, trianglesBefore);
  assert.equal(meshes, 2);
  assert.equal(lamp.parent, root, 'individually animated lights keep their identity');
  material.color.setHex(0x224466);
  assert.ok(root.children.some((o) => o.isMesh && o.material === material));
});

test('the real gantry and starting grid batch to a small mesh count with live LEDs intact', (t) => {
  const previous = globalThis.document;
  t.after(() => { globalThis.document = previous; });
  globalThis.document = { createElement: () => ({ getContext: () => ({}) }) };
  const renderer = Object.create(Renderer3D.prototype);
  renderer.track = track();
  renderer.scene = new THREE.Scene();
  renderer.createAsphaltTextures = () => ({ diffuseMap: null, normalMap: null });
  renderer.createTarmacCheckeredTexture = () => new THREE.Texture();
  renderer.updateLapPlateTexture = () => {};
  renderer.setupTrack();
  let meshes = 0;
  renderer.decorGroup.traverse((o) => { if (o.isMesh) meshes++; });
  assert.ok(meshes < 40, `scenery should be batched, got ${meshes} meshes`);
  assert.equal(renderer.gantryLedMats.length, 5);
  renderer.updateGantryLights({ time: 3 });
  assert.ok(renderer.gantryLedMats.every((m) => m.emissiveIntensity > 0));
  renderer.setGridBoxVisible(false);
  assert.equal(renderer.gridBoxesGroup.visible, false);
});

test('save caching refreshes when the generation population is replaced', (t) => {
  const memory = storageFixture(t);
  const sim = new Simulation(track(), CONFIG);
  assert.equal(saveTrainingState(sim, layers), true);
  const first = JSON.parse(memory.get('ai-racer:training-state:v2')).currentGenomes;
  const replacement = Array(NeuralNetwork.genomeSize(layers)).fill(0.5);
  sim.startGeneration(sim.cars.map(() => replacement));
  assert.equal(saveTrainingState(sim, layers), true);
  const updated = JSON.parse(memory.get('ai-racer:training-state:v2')).currentGenomes;
  assert.notDeepEqual(updated, first);
  assert.deepEqual(updated[0], replacement);
});

test('spatial tree batches preserve all placements and cull off-screen instances', () => {
  const geometry = new THREE.BoxGeometry(2, 2, 10);
  const material = new THREE.MeshBasicMaterial();
  const matrices = [new THREE.Matrix4().makeTranslation(0, 0, 0),
    new THREE.Matrix4().makeTranslation(5, 5, 0), new THREE.Matrix4().makeTranslation(5000, 0, 0)];
  const cells = partitionInstances(matrices);
  assert.equal(cells.flat().length, matrices.length, 'no trees are removed');
  assert.deepEqual(new Set(cells.flat()), new Set(matrices), 'all original transforms are retained');
  const batches = cells.map((cell) => {
    const batch = new THREE.InstancedMesh(geometry, material, cell.length);
    cell.forEach((matrix, index) => batch.setMatrixAt(index, matrix));
    batch.computeBoundingSphere();
    return batch;
  });
  const camera = new THREE.PerspectiveCamera(60, 1, 1, 500);
  camera.up.set(0, 0, 1);
  camera.position.set(0, -100, 50);
  camera.lookAt(0, 0, 0);
  camera.updateMatrixWorld();
  const frustum = new THREE.Frustum().setFromProjectionMatrix(
    new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  assert.equal(batches.filter((batch) => frustum.intersectsObject(batch)).length, 1,
    'the nearby group draws while the distant group stays out of the render workload');
});
