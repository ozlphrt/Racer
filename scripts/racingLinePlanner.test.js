import test from 'node:test';
import assert from 'node:assert/strict';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { CONFIG } from '../js/config.js';
import { Car } from '../js/car.js';
import { makeRacingLine, makeSpeedProfile, RacingLinePlanner } from './racingLinePlanner.js';
import { readFileSync } from 'node:fs';
import { evaluatePlanner } from './plannerEvaluation.js';
import { PlannerRace } from '../js/plannerRace.js';

const track = new Track(TRACK_PRESETS['grand-prix'].points, CONFIG.track.width, CONFIG.track.samples);
test('relaxed line stays in the conservative corridor and leaves source geometry untouched', () => {
  const original = Array.from(track.cx), line = makeRacingLine(track, 600, 14);
  assert.deepEqual(Array.from(track.cx), original);
  assert.ok(line.offset.some(v => Math.abs(v) > 5));
  for (let i = 0; i < track.N; i++) {
    assert.ok(Math.abs(line.offset[i]) <= track.half - 14 + 1e-10);
    assert.ok(Number.isFinite(line.curvature[i]));
    assert.ok(line.distance[i] > 0);
    assert.ok(Math.abs(Math.hypot(line.x[i] - track.cx[i], line.y[i] - track.cy[i]) - Math.abs(line.offset[i])) < 1e-5);
  }
  const center = makeRacingLine(track, 0);
  assert.deepEqual(Array.from(center.x), original);
  assert.throws(() => makeRacingLine(track, 1, 2));
});

test('cyclic speed envelope respects corner, maximum-speed and braking limits across the seam', () => {
  const line = makeRacingLine(track), lateral = 450, braking = 240, speed = makeSpeedProfile(line, lateral, braking);
  for (let i = 0; i < track.N; i++) {
    assert.ok(Number.isFinite(speed[i]) && speed[i] > 0 && speed[i] <= CONFIG.car.maxSpeed);
    assert.ok(speed[i] ** 2 * Math.abs(line.curvature[i]) <= lateral + 1e-6);
    assert.ok(speed[i] ** 2 <= speed[(i + 1) % track.N] ** 2 + 2 * braking * line.distance[i] + 1e-6);
  }
  assert.throws(() => makeSpeedProfile(line, -1, braking));
});

test('planner emits bounded controls through a real race without modifying physics settings', () => {
  const before = structuredClone(CONFIG), line = makeRacingLine(track);
  const brain = new RacingLinePlanner(track, line, { lateralAcceleration: 300, brakingAcceleration: 220,
    lookaheadTime: 0.35, headingGain: 3, pedalGain: 0.03, brakeCap: 0.75 });
  assert.throws(() => brain.forward());
  const car = new Car(track, brain, 0); brain.car = car;
  for (let i = 0; i < 6600 && !car.finished && !car.crashed; i++) {
    car.update(CONFIG.dt); car.sense();
    const output = brain.forward();
    assert.ok(output.every(Number.isFinite));
    assert.ok(Math.abs(output[0]) <= 1 && output[1] >= -0.75 && output[1] <= 1);
  }
  assert.equal(car.finished, true);
  assert.equal(car.runoffRecoveryActive, false);
  assert.deepEqual(CONFIG, before);
});

test('validated preview planner stays contained and faster at all twenty solo grid starts', () => {
  const reference = JSON.parse(readFileSync(new URL('../experiments/corneringReference.json', import.meta.url), 'utf8'));
  const line = makeRacingLine(track, reference.line.iterations, reference.line.margin);
  const settings = structuredClone(CONFIG), originalRandom = Math.random;
  let championTime = 0, plannerTime = 0;
  for (let slot = 0; slot < 20; slot++) {
    const champion = evaluatePlanner(track, reference.genome, null, null, slot);
    const planner = evaluatePlanner(track, reference.genome, reference.options, line, slot);
    assert.equal(planner.finished, true); assert.equal(planner.assisted, false);
    assert.equal(planner.offTrackSeconds, 0);
    assert.ok(planner.flyingMean < champion.flyingMean);
    championTime += champion.raceTime; plannerTime += planner.raceTime;
  }
  assert.ok(plannerTime / 20 < championTime / 20 - 0.5);
  assert.equal(Math.random, originalRandom);
  assert.deepEqual(CONFIG, settings);
  assert.throws(() => new RacingLinePlanner(track, line, { ...reference.options, firstLapSpeedScale: 0 }));
});

test('experimental full grid finishes five laps with no runoff or training state', () => {
  const reference = JSON.parse(readFileSync(new URL('../experiments/corneringReference.json', import.meta.url), 'utf8'));
  const before = structuredClone(CONFIG);
  const race = new PlannerRace(track, reference.options, reference.line);
  for (let step = 0; step < 6600 && !race.complete; step++) race.step();
  assert.equal(race.complete, true);
  assert.equal(race.cars.length, 20);
  assert.ok(race.cars.every(c => c.finished && c.laps === 5 && c.plannerRunoffSeconds === 0 && !c.plannerAssisted));
  assert.ok(race.raceBestLap < 10.77);
  assert.ok(race.cars.every(c => c.brain instanceof RacingLinePlanner));
  assert.equal(race.leader.finishTime, Math.min(...race.cars.map(c => c.finishTime)));
  const finishedTime = race.time;
  race.step(); assert.equal(race.time, finishedTime);
  race.restart();
  assert.equal(race.time, 0); assert.equal(race.complete, false);
  assert.equal(race.raceBestLap, Infinity);
  assert.ok(race.cars.every(c => c.laps === 0));
  assert.equal('history' in race, false);
  assert.equal('capturedPresets' in race, false);
  assert.deepEqual(CONFIG, before);
});
