import test from 'node:test';
import assert from 'node:assert/strict';
import { CONFIG } from '../js/config.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { CUSTOM_TRACKS_KEY, inspectCustomTrack, simplifyStroke, readCustomTracks,
  saveCustomTrack, registerCustomTracks, savedCircuitMatches } from '../js/customTracks.js';
import { validateChampion } from '../js/championValidation.js';
import { physicsSignature } from '../js/milestones.js';
import { NeuralNetwork } from '../js/neuralNetwork.js';
import { Simulation } from '../js/simulation.js';
import { saveTrainingState, loadTrainingState } from '../js/storage.js';

const oval = () => Array.from({ length: 12 }, (_, i) => ({
  x: 800 + Math.cos(i / 12 * Math.PI * 2) * 500,
  y: 500 + Math.sin(i / 12 * Math.PI * 2) * 280,
}));
function storage() {
  const data = new Map();
  return { data, getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, String(v)), removeItem: k => data.delete(k) };
}

test('drawn circuits produce a smooth, closed, finite road with the requested start direction', () => {
  const inspection = inspectCustomTrack(oval());
  assert.equal(inspection.valid, true, inspection.message);
  const track = inspection.track;
  assert.ok(track.length > 2000 && track.length < 3500);
  assert.ok(Array.from(track.cx).every(Number.isFinite));
  assert.ok(Math.hypot(track.cx[0] - track.cx.at(-1), track.cy[0] - track.cy.at(-1)) < track.spacing * 1.1);
  const reversed = inspectCustomTrack([oval()[0], ...oval().slice(1).reverse()]).track;
  assert.ok(track.tx[0] * reversed.tx[0] + track.ty[0] * reversed.ty[0] < -0.99);
});

test('reject malformed, tiny, boundary-clipping, crossing and overlapping custom circuits', () => {
  for (const points of [[], oval().slice(0, 3), [{ x: NaN, y: 20 }, ...oval()],
    Array.from({ length: 81 }, () => ({ x: 500, y: 500 })),
    [{ x: 700, y: 450 }, { x: 800, y: 450 }, { x: 800, y: 550 }, { x: 700, y: 550 }],
    oval().map(p => ({ x: p.x + 300, y: p.y })),
    [{ x: 300, y: 250 }, { x: 1300, y: 750 }, { x: 300, y: 750 }, { x: 1300, y: 250 }],
    [{ x: 300, y: 460 }, { x: 1300, y: 460 }, { x: 1300, y: 540 }, { x: 300, y: 540 }],
  ]) assert.equal(inspectCustomTrack(points).valid, false);
});

test('freehand simplification retains the drawn loop and removes redundant samples', () => {
  const stroke = Array.from({ length: 361 }, (_, i) => ({
    x: 800 + Math.cos(i * Math.PI / 180) * 500,
    y: 500 + Math.sin(i * Math.PI / 180) * 280,
  }));
  const simplified = simplifyStroke(stroke);
  assert.ok(simplified.length >= 8 && simplified.length < 50);
  assert.equal(inspectCustomTrack(simplified).valid, true);
  assert.ok(simplified.every(p => Math.abs(((p.x - 800) / 500) ** 2 + ((p.y - 500) / 280) ** 2 - 1) < 0.01));
  assert.ok(Math.hypot(simplified[0].x - simplified.at(-1).x, simplified[0].y - simplified.at(-1).y) > 25);
});

test('saved custom circuits survive reload, update by id, and cannot overwrite builtin presets', t => {
  const local = storage(), source = { id: 'custom-test', name: 'My circuit', points: oval() };
  saveCustomTrack(source, local);
  source.points[0].x = 0;
  assert.equal(readCustomTracks(local)[0].points[0].x, 1300);
  saveCustomTrack({ id: 'custom-test', name: 'Renamed', points: oval() }, local);
  assert.equal(readCustomTracks(local).length, 1);
  registerCustomTracks(local);
  t.after(() => delete TRACK_PRESETS['custom-test']);
  assert.equal(TRACK_PRESETS['custom-test'].name, 'Renamed');
  assert.throws(() => saveCustomTrack({ id: 'grand-prix', name: 'Overwrite', points: oval() }, local));
  assert.equal(TRACK_PRESETS['grand-prix'].name, 'Grand Prix (Default)');
  local.setItem(CUSTOM_TRACKS_KEY, 'invalid json');
  assert.deepEqual(readCustomTracks(local), []);
});

test('invalid library entries are isolated and storage failures retain previously saved geometry', () => {
  const local = storage();
  const good = { id: 'custom-good', name: 'Valid', points: oval() };
  local.setItem(CUSTOM_TRACKS_KEY, JSON.stringify([null, { ...good, id: '__proto__' }, good,
    { ...good, id: 'custom-corrupt', points: [{ x: null, y: 0 }] }]));
  assert.deepEqual(readCustomTracks(local), [good]);
  const before = local.getItem(CUSTOM_TRACKS_KEY);
  local.setItem = () => { throw new Error('Quota exceeded'); };
  assert.throws(() => saveCustomTrack({ ...good, name: 'Edited' }, local), /Quota exceeded/);
  assert.equal(local.getItem(CUSTOM_TRACKS_KEY), before);
});

test('custom geometry accompanies training saves and detects edited or removed layouts', t => {
  const previous = globalThis.localStorage, local = storage();
  globalThis.localStorage = local;
  t.after(() => { globalThis.localStorage = previous; delete TRACK_PRESETS['custom-save']; });
  saveCustomTrack({ id: 'custom-save', name: 'Save circuit', points: oval() }, local);
  registerCustomTracks(local);
  const config = structuredClone(CONFIG);
  const track = new Track(oval(), config.track.width, config.track.samples);
  const sim = new Simulation(track, config); sim.generation = 5000;
  assert.equal(saveTrainingState(sim, config.nn.layers, 'custom-save'), true);
  const loaded = loadTrainingState(config.nn.layers);
  assert.equal(loaded.trackPreset, 'custom-save');
  assert.equal(savedCircuitMatches(loaded), true);
  const restored = new Simulation(track, config); restored.resumeState(loaded);
  assert.equal(restored.generation, 5000);
  assert.deepEqual(Array.from(restored.cars[0].brain.genome), Array.from(loaded.currentGenomes[0]));
  TRACK_PRESETS['custom-save'].points = oval().map(p => ({ x: p.x, y: p.y + 5 }));
  assert.equal(savedCircuitMatches(loaded), false, 'edited layouts must not inherit stale records');
  delete TRACK_PRESETS['custom-save'];
  assert.equal(savedCircuitMatches(loaded), false, 'deleted circuits must not lend records to a fallback circuit');
});

test('champion worker validates supplied custom geometry and rejects a mismatched layout', async () => {
  const config = structuredClone(CONFIG);
  config.generation.timeLimit = 0.1; config.generation.maxLaps = 1;
  const customTrack = { name: 'Worker circuit', points: oval() };
  const track = new Track(customTrack.points, config.track.width, config.track.samples);
  const request = { config, genome: Array(NeuralNetwork.genomeSize(config.nn.layers)).fill(0),
    trackKey: 'custom-worker', customTrack, signature: physicsSignature(track, config) };
  assert.equal(TRACK_PRESETS['custom-worker'], undefined, 'workers have no browser track library');
  const result = await validateChampion(request);
  assert.equal(result.tested, 20);
  await assert.rejects(validateChampion({ ...request, customTrack: { ...customTrack,
    points: oval().map(p => ({ x: p.x, y: p.y + 10 })) } }), /Track or physics changed/);
});
