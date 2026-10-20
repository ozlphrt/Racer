// Isolated preview. No browser saves, population breeding or milestone captures.
import reference from './corneringReference.json';
import { CONFIG } from '../js/config.js';
import { Car } from '../js/car.js';
import { NeuralNetwork } from '../js/neuralNetwork.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { TireBarrierSystem } from '../js/tireBarriers.js';
import { Renderer3D } from '../js/renderer3d.js';
import { makeRacingLine, RacingLinePlanner } from '../scripts/racingLinePlanner.js';
import { PlannerRace } from '../js/plannerRace.js';

const $ = id => document.getElementById(id);
window.addEventListener('error', event => { $('error').hidden = false; $('error').textContent = event.message; });
const track = new Track(TRACK_PRESETS[reference.track].points, CONFIG.track.width, CONFIG.track.samples);
const line = makeRacingLine(track, reference.line.iterations, reference.line.margin);
const renderer = new Renderer3D($('view'), track);
let cars, barriers, runStats, time, accumulator = 0, paused = false, complete = false, lastFrame, lastHud = -1;
let gridRace = null, onboardCar = null;
$('mode').value = new URLSearchParams(location.search).get('mode') === 'grid' ? 'grid' : 'comparison';
const view = { track, generation: 0, cars: [], time: 0, player: null, deathEvents: [],
  checkeredFlagTimer: null, raceBestLap: Infinity, bestLapEver: Infinity, raceGhostLap: Infinity };
function restart() {
  const grid = $('mode').value === 'grid';
  const priorFocus = $('focus').value;
  $('focus').replaceChildren(...(grid ? ['leader', ...Array.from({ length: 20 }, (_, i) => String(i))] : ['planner', 'champion'])
    .map(value => { const option = document.createElement('option'); option.value = value;
      option.textContent = grid ? value === 'leader' ? 'Leader' : `Car #${Number(value) + 1}` : value === 'planner' ? 'Planner' : 'Champion'; return option; }));
  if ([...$('focus').options].some(o => o.value === priorFocus)) $('focus').value = priorFocus;
  $('heading').textContent = grid ? 'Experimental Planner Grand Prix' : 'Cornering comparison';
  $('description').textContent = grid ? '20 map-based drivers · 5 laps · non-contact race · separate from neural training' :
    'Saved Gen 11464 brain vs map-based planner · separate solo runs · training saves untouched';
  $('champion-heading').textContent = grid ? 'Race field' : 'Saved champion';
  $('planner-heading').textContent = grid ? 'Selected car' : 'Experimental planner';
  gridRace = grid ? new PlannerRace(track, reference.options, reference.line) : null;
  onboardCar = null;
  const planner = new RacingLinePlanner(track, line, reference.options);
  cars = { champion: new Car(track, new NeuralNetwork(reference.layers, reference.genome), 0),
    planner: new Car(track, planner, 0) };
  planner.car = cars.planner;
  cars.champion.carIndex = 0; cars.champion.carNumber = 44;
  cars.planner.carIndex = 2; cars.planner.carNumber = 16;
  barriers = { champion: new TireBarrierSystem(track), planner: new TireBarrierSystem(track) };
  runStats = { champion: { runoff: 0, assisted: false }, planner: { runoff: 0, assisted: false } };
  time = 0; accumulator = 0; paused = false; complete = false; lastHud = -1;
  view.generation++; renderer.focusedCar = null;
  if (gridRace) gridRace.generation = view.generation;
  $('pause').disabled = false; $('pause').textContent = 'Pause'; $('error').hidden = true;
}
function step() {
  if (gridRace) {
    gridRace.step(); time = gridRace.time;
    if (gridRace.complete) { paused = true; complete = true; $('pause').textContent = 'Finished'; $('pause').disabled = true; }
    return;
  }
  for (const key of ['champion', 'planner']) {
    const car = cars[key];
    if (!car.finished && !car.crashed && car.alive) {
      car.beforePreviousX = car.previousX; car.beforePreviousY = car.previousY; car.beforePreviousAngle = car.previousAngle;
      car.previousX = car.x; car.previousY = car.y; car.previousAngle = car.angle;
      car.update(CONFIG.dt);
      if (!car.finished && !car.crashed) barriers[key].update(CONFIG.dt, [car]);
      car.sense();
      if (car.isOffTrack(Math.cos(car.angle), Math.sin(car.angle))) runStats[key].runoff += CONFIG.dt;
      runStats[key].assisted ||= car.runoffRecoveryActive || car.wrongWayRecoveryActive;
    }
  }
  time += CONFIG.dt;
  if (Object.values(cars).every(c => c.finished || c.crashed || !c.alive) || time >= CONFIG.generation.timeLimit) {
    paused = true; complete = true; $('pause').textContent = 'Finished'; $('pause').disabled = true;
  }
}
function hud() {
  if (gridRace) {
    const selected = selectedCar(), finished = gridRace.cars.filter(c => c.finished).length;
    $('champion-stats').textContent = `Finished ${finished}/20 · ${gridRace.time.toFixed(1)}s\nBest ${Number.isFinite(gridRace.raceBestLap) ? gridRace.raceBestLap.toFixed(2) + 's' : '—'}\nRunoff ${gridRace.cars.reduce((s, c) => s + c.plannerRunoffSeconds, 0).toFixed(2)}s`;
    $('champion-stats').style.whiteSpace = 'pre-line';
    $('champion-brake').textContent = 'Non-contact · no training'; $('champion-bar').style.width = '0%';
    const brake = Math.round(Math.max(0, -selected.throttle) * 100);
    $('planner-stats').textContent = `Car #${selected.carNumber} · ${selected.finished ? 'Finished' : 'Lap ' + Math.min(5, selected.laps + 1) + '/5'}\n${(selected.speed * (5.63 / 26) * 3.6).toFixed(0)} km/h · Best ${selected.lapTimes.length ? Math.min(...selected.lapTimes).toFixed(2) + 's' : '—'}`;
    $('planner-stats').style.whiteSpace = 'pre-line';
    $('planner-brake').textContent = `Brake ${brake}%`; $('planner-bar').style.width = `${brake}%`;
    $('status').textContent = `${complete ? 'Race complete' : paused ? 'Paused' : 'Running'} · experimental map controller · collisions off`;
    return;
  }
  for (const key of ['champion', 'planner']) {
    const car = cars[key], brake = Math.round(Math.max(0, -car.throttle) * 100);
    const best = car.lapTimes.length ? Math.min(...car.lapTimes).toFixed(2) + 's' : '—';
    const state = car.finished ? 'Finished' : car.crashed ? 'Crashed' : `Lap ${Math.min(5, car.laps + 1)}/5`;
    $(`${key}-stats`).textContent = `${state} · ${(car.speed * (5.63 / 26) * 3.6).toFixed(0)} km/h\nBest ${best} · ${car.time.toFixed(1)}s\nRunoff ${runStats[key].runoff.toFixed(2)}s · recovery ${runStats[key].assisted ? 'yes' : 'no'}`;
    $(`${key}-stats`).style.whiteSpace = 'pre-line';
    $(`${key}-brake`).textContent = `Brake ${brake}%`;
    $(`${key}-bar`).style.width = `${brake}%`;
  }
  $('status').textContent = `${complete ? 'Race complete' : paused ? 'Paused' : 'Running'} · validated ${reference.validation.unassistedFinishes}/${reference.validation.starts} starts · collisions off`;
}
function selectedCar() {
  if (!gridRace) return cars[$('focus').value];
  if ($('focus').value !== 'leader') return gridRace.cars[Number($('focus').value)];
  if ($('camera').value !== 'onboard') return gridRace.leader;
  // Hold an onboard attachment when P1 swaps during a corner or at launch.
  if (!onboardCar || onboardCar.crashed || !onboardCar.alive) onboardCar = gridRace.leader;
  return onboardCar;
}
function frame(now) {
  const dt = lastFrame === undefined ? 0 : Math.min(0.1, (now - lastFrame) / 1000); lastFrame = now;
  if (!paused) {
    accumulator += dt * Number($('speed').value);
    let steps = 0;
    while (accumulator >= CONFIG.dt && steps++ < 12 && !paused) { step(); accumulator -= CONFIG.dt; }
  }
  const key = $('focus').value, car = selectedCar();
  view.cars = [car]; view.leader = car; view.time = time; view.tireBarriers = gridRace ? gridRace.tireBarriers : barriers[key];
  view.raceBestLap = car.lapTimes.length ? Math.min(...car.lapTimes) : Infinity;
  renderer.render(gridRace || view, { follow: true, cameraPreset: $('camera').value, manualFocusCar: car,
    renderDt: dt, renderAlpha: paused || car.finished || car.crashed ? 1 : Math.min(1, accumulator / CONFIG.dt),
    showRays: false, showGhost: false }, car);
  if (now - lastHud >= 100) { hud(); lastHud = now; }
  requestAnimationFrame(frame);
}
$('pause').addEventListener('click', () => { paused = !paused; $('pause').textContent = paused ? 'Resume' : 'Pause'; });
$('restart').addEventListener('click', restart);
$('mode').addEventListener('change', restart);
$('focus').addEventListener('change', () => { renderer.focusedCar = null; onboardCar = null; view.generation++; });
new ResizeObserver(() => renderer.resize()).observe($('view').parentElement);
restart(); requestAnimationFrame(frame);
