import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { Car } from '../js/car.js';
import { NeuralNetwork } from '../js/neuralNetwork.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { PRESET_BRAINS } from '../js/presetBrains.js';
import { LookaheadBrain, upgradeGenome, LOOKAHEAD_LAYERS } from './lookaheadBrain.js';

const circuit = () => new Track(TRACK_PRESETS['grand-prix'].points, CONFIG.track.width, CONFIG.track.samples);
const genome = PRESET_BRAINS['grand-prix:5000'].genome;

test('adding zero-weight lookahead inputs preserves existing policy outputs exactly', () => {
  const original = new NeuralNetwork(CONFIG.nn.layers, genome), brain = new LookaheadBrain(upgradeGenome(genome));
  const car = new Car(circuit(), brain); brain.car = car;
  const buffer = brain.expandedInputs;
  for (let i = 0; i < 100; i++) {
    const inputs = Float32Array.from({ length: 8 }, (_, j) => Math.sin(i * 0.1 + j));
    assert.deepEqual([...brain.forward(inputs)], [...original.forward(inputs)]);
    assert.equal(brain.expandedInputs, buffer);
  }
  assert.deepEqual(CONFIG.nn.layers, [8, 12, 8, 2]);
  assert.equal(brain.genome.length, NeuralNetwork.genomeSize(LOOKAHEAD_LAYERS));
  assert.throws(() => upgradeGenome([1, 2]), /Expected/);
});

test('lookahead features wrap the track and distinguish lateral sides with bounded finite values', () => {
  const track = circuit(), brain = new LookaheadBrain(upgradeGenome(genome));
  const car = new Car(track, brain); brain.car = car; car.idx = track.N - 1;
  for (const side of [-1, 1]) {
    car.x = track.cx[car.idx] - track.ty[car.idx] * 60 * side;
    car.y = track.cy[car.idx] + track.tx[car.idx] * 60 * side;
    brain.forward(new Float32Array(8));
    assert.equal(brain.expandedInputs[8], side);
    assert.ok([...brain.expandedInputs].every(v => Number.isFinite(v) && v >= -1 && v <= 1));
  }
  brain.masked = true; brain.forward(new Float32Array(8));
  assert.deepEqual([...brain.expandedInputs.slice(8)], [0, 0, 0, 0]);
});

test('zero-weight transferred policy preserves full five-lap trajectories', () => {
  const track = circuit();
  for (const slot of [0, 7, 19]) {
    const original = new Car(track, new NeuralNetwork(CONFIG.nn.layers, genome), slot);
    const brain = new LookaheadBrain(upgradeGenome(genome)), extended = new Car(track, brain, slot);
    brain.car = extended;
    for (let tick = 0; tick < 6600 && !original.finished && !original.crashed; tick++) {
      original.update(CONFIG.dt); original.sense(); extended.update(CONFIG.dt); extended.sense();
    }
    assert.ok(original.finished && extended.finished);
    assert.deepEqual([extended.x, extended.y, extended.angle, extended.lapTimes],
      [original.x, original.y, original.angle, original.lapTimes]);
  }
});
