import { CONFIG } from './config.js';
import { Track, TRACK_PRESETS } from './track.js';
import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { Renderer3D, TEAM_PALETTE } from './renderer3d.js';
import { NetworkViz } from './networkViz.js';
import { FitnessChart, compact } from './chart.js';
import { drawSparkline, analyzeTrainingProgress, renderAllTileGraphics } from './trainingTelemetry.js';
import { LeaderboardTower, generateCarSideviewSvg } from './leaderboard.js';
import { EliminationModalManager } from './eliminationModal.js';
import { audio } from './audio.js';
import { carSideviewRenderer } from './carSideviewRenderer.js';
import * as storage from './storage.js';
import { NeuralNetwork } from './neuralNetwork.js';
import { PRESET_BRAINS, PRESET_MILESTONES } from './presetBrains.js';
import { triggerExplorationBurst, getBurstGensRemaining } from './genetics.js';

const $ = (id) => document.getElementById(id);
const LAYERS = CONFIG.nn.layers;

// ---------- Startup restoration (Immediate) ----------
const savedState = storage.loadTrainingState(LAYERS);
let initialPreset = 'grand-prix';
if (savedState?.trackPreset && TRACK_PRESETS[savedState.trackPreset]) {
  initialPreset = savedState.trackPreset;
  const trackSel = $('track-select');
  if (trackSel) trackSel.value = initialPreset;
}

// ---------- Core objects ----------
let currentTrack = new Track(TRACK_PRESETS[initialPreset].points, CONFIG.track.width, CONFIG.track.samples);
const sim = new Simulation(currentTrack, CONFIG);

if (savedState) {
  if (typeof savedState.mutationRate === 'number') {
    sim.mutationRate = savedState.mutationRate;
    const mutSlider = $('mutation-slider');
    if (mutSlider) {
      mutSlider.value = Math.round(savedState.mutationRate * 100);
      const mutVal = $('mutation-value');
      if (mutVal) mutVal.textContent = `${mutSlider.value}%`;
    }
  }
  sim.resumeState(savedState);
} else {
  // Clean fresh learning experience: random neural weights, Generation 1, clean history
  sim.reset();
}

const renderer = new Renderer($('track-canvas'), currentTrack);

let renderer3d = null;
try {
  renderer3d = new Renderer3D($('track-canvas-3d'), currentTrack);
} catch (e) {
  console.warn('3D WebGL renderer init error:', e);
}

let focusedFollowCar = null;
const leaderboard = new LeaderboardTower($('leaderboard-tower'), (car) => {
  focusedFollowCar = car;
  const carIdx = sim.cars ? sim.cars.indexOf(car) : -1;
  const carNum = car.manual ? 7 : (carIdx >= 0 ? carIdx + 1 : 1);
  toast(`🎥 Camera locked on Car #${carNum}`, 'info');
});

const eliminationModals = new EliminationModalManager($('elimination-stack'), {
  onSelectCar: (car) => {
    focusedFollowCar = car;
    state.follow = true;
    const toggleFollow = $('toggle-follow');
    if (toggleFollow) toggleFollow.checked = true;
    const carIdx = sim.cars ? sim.cars.indexOf(car) : -1;
    const carNum = car.manual ? 7 : (carIdx >= 0 ? carIdx + 1 : 1);
    toast(`🎥 Camera tracking Car #${carNum}`, 'info');
  },
  onRestart: () => {
    if (state.manual && sim.player) {
      sim.player.reset();
      toast('↺ Manual Lap Restarted', 'info');
    } else {
      restartCurrentGen();
    }
  },
});

carSideviewRenderer.onReady(() => {
  const previewEl = $('cockpit-car-preview');
  if (previewEl) previewEl.dataset.key = '';
  if (leaderboard) leaderboard.reset();
});

sim.onCarEliminated = (car, reason) => {
  if (hyperRunning) return;
  eliminationModals.show(car, sim, reason);
  const camPos = (state.view3d && renderer3d && renderer3d.camera)
    ? renderer3d.camera.position
    : { x: car.x, y: car.y, z: 300 };
  audio.playImpact(car.x, car.y, camPos, car.speed);
};

sim.onCarDeath = (car) => {
  if (hyperRunning) return;
  const camPos = (state.view3d && renderer3d && renderer3d.camera)
    ? renderer3d.camera.position
    : { x: car.x, y: car.y, z: 300 };
  audio.playImpact(car.x, car.y, camPos, car.speed);
};

const nnViz = new NetworkViz(
  $('nn-canvas'),
  LAYERS,
  ['L90', 'L60', 'L30', 'FWD', 'R30', 'R60', 'R90', 'SPD'],
  ['STEER', 'THROTTLE'],
);
const chart = new FitnessChart($('chart-canvas'));

const hubNnViz = $('nn-canvas-hub') ? new NetworkViz(
  $('nn-canvas-hub'),
  LAYERS,
  ['L90', 'L60', 'L30', 'FWD', 'R30', 'R60', 'R90', 'SPD'],
  ['STEER', 'THROTTLE'],
) : null;
const hubChart = $('chart-canvas-hub') ? new FitnessChart($('chart-canvas-hub')) : null;

const state = {
  paused: false,
  speed: 1,
  turbo: false,
  view3d: true,
  follow: true,
  sensors: false,
  ghosts: true,
  manual: false,
  autosave: true,
  audio: true,
  cameraPreset: 'auto',
};
const keys = { ArrowLeft: false, ArrowRight: false, ArrowUp: false, ArrowDown: false };

const pillPop = $('pill-pop');
if (pillPop) pillPop.textContent = CONFIG.ga.population;
const pillArch = $('pill-arch');
if (pillArch) pillArch.textContent = LAYERS.join('·');

// ---------- Helpers ----------
const fmtTime = (s) => (Number.isFinite(s) ? s.toFixed(2) + 's' : '–');

function pulse(id) {
  const el = $(id);
  el.classList.remove('pulse');
  void el.offsetWidth; // restart animation
  el.classList.add('pulse');
}

let toastTimer = 0;
function toast(msg, type = '') {
  const el = $('toast');
  el.textContent = msg;
  el.className = `toast show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (el.className = 'toast'), 2600);
}

function timeAgo(iso) {
  const s = (Date.now() - new Date(iso).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function refreshSavedInfo() {
  const data = storage.loadBrain(LAYERS);
  const curGen = sim.generation;
  const panelInfo = $('saved-info');
  const hubInfo = $('hub-saved-info');
  const hubTimestamp = $('hub-storage-timestamp');

  const textHtml = data
    ? `🏆 Peak Champion from <strong>Gen ${data.generation}</strong><br>` +
      `Fitness <strong>${compact(data.fitness)}</strong> · Best lap <strong>${fmtTime(data.bestLap)}</strong><br>` +
      `<span style="color:var(--text-muted); font-size:11px;">Active Session: Gen ${curGen} · Auto-saved ${timeAgo(data.savedAt)}</span>`
    : `Active: Gen <strong>${curGen}</strong><br><span style="color:var(--text-muted); font-size:11px;">No champion saved yet. Auto-saves when a new fitness record is set.</span>`;

  if (panelInfo) panelInfo.innerHTML = textHtml;
  if (hubInfo) hubInfo.innerHTML = textHtml;
  if (hubTimestamp) hubTimestamp.textContent = data?.savedAt ? `Auto-saved ${timeAgo(data.savedAt)}` : 'Active Session';

  updateHubAnalytics();
}

function updateHubAnalytics() {
  const setTxt = (id, val) => {
    const el = $(id);
    if (el) el.textContent = val;
  };
  setTxt('hub-stat-gen', sim.generation);
  setTxt('hub-stat-fit', compact(sim.allTimeBest?.fitness));
  setTxt('hub-stat-lap', fmtTime(sim.bestLapEver));
  const car = state.manual && sim.player ? sim.player : sim.leader;
  const contacts = car?.contacts || 0;
  setTxt('hub-stat-clean', contacts === 0 ? '100% (Clean)' : `${Math.max(0, 100 - contacts * 10)}%`);
}

function setSliderFill(input) {
  const pct = ((input.value - input.min) / (input.max - input.min)) * 100;
  input.style.setProperty('--fill', `${pct}%`);
}

function setCenterBar(el, v) {
  const c = Math.max(-1, Math.min(1, v));
  el.style.left = c >= 0 ? '50%' : `${50 + c * 50}%`;
  el.style.width = `${Math.abs(c) * 50}%`;
}

function updateStatus() {
  const dot = $('status-dot');
  const isRace = sim.mode === 'race';
  if (dot) dot.className = 'pill-dot' + (state.paused ? ' paused' : state.turbo ? ' turbo' : isRace ? ' collision-on' : '');
  const statusText = $('status-text');
  if (statusText) {
    statusText.textContent = state.paused
      ? 'Paused'
      : state.turbo
        ? 'Turbo training'
        : isRace
          ? 'Grand Prix (20)'
          : 'Training (80)';
  }
}

function setSimulationMode(mode) {
  if (sim.mode === mode) return;
  eliminationModals.clear();
  sim.setMode(mode);

  const isRace = mode === 'race';
  $('btn-mode-train')?.classList.toggle('active', !isRace);
  $('btn-mode-race')?.classList.toggle('active', isRace);
  $('panel-mode-train')?.classList.toggle('active', !isRace);
  $('panel-mode-race')?.classList.toggle('active', isRace);

  updateStatus();
  updateHud(sim.leader);
  if (renderer3d) renderer3d.updateSkidmarks(sim);

  if (isRace) {
    toast('🏆 20-Car Grand Prix Race: Elite field on starting grid · Collisions ON 100%!', 'success');
  } else {
    toast('🏋️ Training Mode: 80 cars exploring & learning via genetic evolution', 'info');
  }
}

function persistState() {
  storage.saveTrainingState(sim, LAYERS, $('track-select').value);
  refreshSavedInfo();
}

// ---------- Simulation callbacks ----------
let prevCollisionActive = false;

sim.onGeneration = () => {
  prevCollisionActive = false;
  focusedFollowCar = null;
  leaderboard.reset();
  eliminationModals.clear();

  if (hyperRunning) {
    // In headless fast-forward, defer expensive full-canvas redraws and synchronous
    // multi-megabyte localStorage serialization until hyper training completes
    return;
  }

  chart.draw(sim.history, sim.bestLapEver);
  hubChart?.draw(sim.history, sim.bestLapEver);
  if (renderer) {
    renderer.cam = null;
  }
  // Keep skid marks permanently on the track; clear only dynamic airborne tire smoke
  renderer3d?.clearTireSmoke();
  updateHighestGenAndLiveSnapshot();
  updateBurstButtonUi();
  persistState();
};

sim.onNewBest = (best) => {
  if (hyperRunning) return;
  pulse('stat-best-fitness-box');
  persistState();
};

sim.onNewBestLap = () => {
  if (hyperRunning) return;
  pulse('stat-best-lap-box');
  persistState();
};

// ---------- Controls ----------
function setPaused(p) {
  state.paused = p;
  $('btn-pause').textContent = p ? '▶ Resume' : '❚❚ Pause';
  $('paused-overlay').hidden = !p;
  updateStatus();
}

function setAudio(on) {
  state.audio = on;
  if (audio.enabled !== on) {
    audio.toggle();
  }
  const toggleAudio = $('toggle-audio');
  if (toggleAudio) toggleAudio.checked = on;
  const btnSound = $('btn-toggle-sound');
  const soundIcon = $('sound-icon');
  const soundText = $('sound-text');
  if (btnSound) {
    btnSound.classList.toggle('muted', !on);
    if (soundIcon) soundIcon.textContent = on ? '🔊' : '🔇';
    if (soundText) soundText.textContent = on ? 'Audio' : 'Muted';
  }
  toast(on ? '🔊 Spatial Audio Enabled' : '🔇 Audio Muted');
}

function setTurbo(on) {
  if (state.manual && on) return toast('Turbo is disabled while driving manually');
  state.turbo = on;
  $('toggle-turbo').checked = on;
  updateStatus();
}

function setToggle(key, on) {
  state[key] = on;
  $(`toggle-${key}`).checked = on;
}

function setManual(on) {
  state.manual = on;
  $('toggle-manual').checked = on;
  sim.setManual(on);
  $('manual-hint').hidden = !on;
  $('speed-slider').disabled = on;
  if (on) {
    setTurbo(false);
    toast('Manual driving: use the arrow keys 🏁');
  }
}

function restartCurrentGen() {
  prevCollisionActive = false;
  eliminationModals.clear();
  if (sim.cars && sim.cars.length > 0) {
    sim.startGeneration(sim.cars.map((c) => c.brain.genome));
  } else {
    sim.startGeneration(Array.from({ length: CONFIG.ga.population }, () => NeuralNetwork.randomGenome(LAYERS)));
  }
  if (state.view3d && renderer3d && state.follow) {
    renderer3d.resetCamera(true);
  }
  if (renderer) {
    renderer.cam = null;
  }
  persistState();
  updateHud(sim.leader);
  toast(`Restarted cars for Generation ${sim.generation}`);
}

$('btn-pause').addEventListener('click', () => setPaused(!state.paused));
$('btn-reset').addEventListener('click', restartCurrentGen);

const speedSlider = $('speed-slider');
speedSlider.addEventListener('input', () => {
  state.speed = Number(speedSlider.value);
  $('speed-value').textContent = `×${state.speed}`;
  setSliderFill(speedSlider);
});

const mutSlider = $('mutation-slider');
mutSlider.addEventListener('input', () => {
  sim.mutationRate = Number(mutSlider.value) / 100;
  $('mutation-value').textContent = `${mutSlider.value}%`;
  setSliderFill(mutSlider);
  persistState();
});

// Sliders, buttons, selects and switches shouldn't keep focus, so Space/arrow keys stay global shortcuts
for (const s of [speedSlider, mutSlider]) s.addEventListener('change', () => s.blur());
document.querySelectorAll('.btn, .switch, .select-input').forEach((el) =>
  el.addEventListener(el.matches('.btn') ? 'click' : 'change', () => el.blur()),
);

function set3DView(on) {
  if (on && !renderer3d) {
    if (typeof THREE !== 'undefined') {
      try {
        renderer3d = new Renderer3D($('track-canvas-3d'), currentTrack);
      } catch (err) {
        return toast('3D WebGL not supported or initialization failed: ' + err.message, 'error');
      }
    } else {
      return toast('Three.js library is loading, please try again in a moment', 'error');
    }
  }
  state.view3d = on;
  $('toggle-3d').checked = on;
  $('track-canvas-3d').hidden = !on;
  $('track-canvas').hidden = on;
  $('btn-reset-cam').hidden = !on;
  if (on && renderer3d) {
    renderer3d.resize();
    toast('3D Orbit View: Click & drag to rotate, scroll to zoom, right-click to pan', 'success');
  } else {
    renderer.resize();
    renderer.cam = null; // Snap camera cleanly to track bounds
    toast('Switched to 2D Top-Down View');
  }
}

let currentPresetKey = initialPreset;
$('track-select').addEventListener('change', (e) => {
  const presetKey = e.target.value;
  if (presetKey === currentPresetKey) return;
  currentPresetKey = presetKey;
  const preset = TRACK_PRESETS[presetKey];
  if (!preset) return;
  eliminationModals.clear();
  currentTrack = new Track(preset.points, CONFIG.track.width, CONFIG.track.samples);
  sim.setTrack(currentTrack, true);
  renderer.setTrack(currentTrack);
  if (renderer3d) renderer3d.setTrack(currentTrack);
  chart.draw(sim.history, sim.bestLapEver);
  persistState();
  toast(`Switched to ${preset.name}`);
});

// Always persist state when navigating away, switching tabs, or periodically
window.addEventListener('beforeunload', persistState);
window.addEventListener('pagehide', persistState);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) persistState();
});
setInterval(() => {
  if (!state.paused && sim.cars && sim.cars.length > 0) {
    persistState();
  }
}, 3000);

$('btn-mode-train')?.addEventListener('click', () => setSimulationMode('train'));
$('btn-mode-race')?.addEventListener('click', () => setSimulationMode('race'));
$('panel-mode-train')?.addEventListener('click', () => setSimulationMode('train'));
$('panel-mode-race')?.addEventListener('click', () => setSimulationMode('race'));

$('toggle-3d').addEventListener('change', (e) => set3DView(e.target.checked));
$('btn-reset-cam').addEventListener('click', () => {
  if (renderer3d) {
    renderer3d.resetCamera(state.follow);
    toast('3D Camera Reset');
  }
});

$('toggle-turbo').addEventListener('change', (e) => setTurbo(e.target.checked));
$('toggle-follow').addEventListener('change', (e) => setToggle('follow', e.target.checked));
$('toggle-sensors').addEventListener('change', (e) => setToggle('sensors', e.target.checked));
$('toggle-ghosts').addEventListener('change', (e) => setToggle('ghosts', e.target.checked));
$('toggle-audio')?.addEventListener('change', (e) => setAudio(e.target.checked));
$('btn-toggle-sound')?.addEventListener('click', () => setAudio(!state.audio));
$('toggle-manual').addEventListener('change', (e) => setManual(e.target.checked));
$('toggle-autosave').addEventListener('change', (e) => setToggle('autosave', e.target.checked));

// Unlock audio context on initial user interaction
const unlockAudio = () => {
  audio.resume();
  ['pointerdown', 'mousedown', 'keydown', 'touchstart', 'wheel', 'click'].forEach((evt) => {
    window.removeEventListener(evt, unlockAudio);
  });
};
['pointerdown', 'mousedown', 'keydown', 'touchstart', 'wheel', 'click'].forEach((evt) => {
  window.addEventListener(evt, unlockAudio, { passive: true });
});

// Storage
$('btn-load').addEventListener('click', async () => {
  let data = storage.loadBrain(LAYERS);
  if (!data) {
    const trackKey = $('track-select')?.value || 'grand-prix';
    data = await storage.loadPretrainedBrain(trackKey, LAYERS);
  }
  if (!data) return toast('No saved brain or champion found', 'error');
  sim.seedFrom(data.genome, data);
  storage.saveBrain(data, LAYERS);
  storage.saveTrainingState(sim, LAYERS, $('track-select')?.value || 'grand-prix', true);
  refreshSavedInfo();
  chart.draw(sim.history, sim.bestLapEver);
  hyperChart?.draw(sim.history, sim.bestLapEver);
  updateHud(sim.leader);
  const lapStr = data.bestLap && Number.isFinite(data.bestLap) ? ` (${data.bestLap.toFixed(2)}s lap)` : '';
  toast(`Population seeded from ${data.generation ? 'Gen ' + data.generation : 'Champion'} brain${lapStr}`, 'success');
});

$('btn-export').addEventListener('click', () => {
  // Always prioritize the current active generation's best evolved brain
  let targetBrain = null;

  const currentBestCar = (sim.cars && sim.cars.length > 0)
    ? [...sim.cars].sort((a, b) => (b.fitness || 0) - (a.fitness || 0))[0]
    : sim.leader;

  if (currentBestCar && currentBestCar.brain) {
    targetBrain = {
      genome: currentBestCar.brain.genome,
      fitness: currentBestCar.fitness || 0,
      generation: sim.generation,
      bestLap: currentBestCar.bestLap ?? (sim.allTimeBest?.bestLap ?? null),
    };
  } else if (sim.leader && sim.leader.brain) {
    targetBrain = {
      genome: sim.leader.brain.genome,
      fitness: sim.leader.fitness || 0,
      generation: sim.generation,
      bestLap: sim.leader.bestLap ?? null,
    };
  } else if (sim.allTimeBest) {
    targetBrain = {
      ...sim.allTimeBest,
      generation: sim.generation || sim.allTimeBest.generation,
    };
  } else {
    targetBrain = storage.loadBrain(LAYERS);
  }

  if (!targetBrain) return toast('Nothing to export yet. Let a generation run first', 'error');
  storage.exportBrain(targetBrain, LAYERS);
  toast(`Brain exported as JSON (Gen ${targetBrain.generation || sim.generation})`, 'success');
});

$('btn-import').addEventListener('click', () => $('input-import').click());
$('input-import').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const data = await storage.importBrainFile(file, LAYERS);
    sim.seedFrom(data.genome, data);
    storage.saveBrain(data, LAYERS);
    storage.saveTrainingState(sim, LAYERS, $('track-select')?.value || 'grand-prix', true);
    refreshSavedInfo();
    chart.draw(sim.history, sim.bestLapEver);
    hyperChart?.draw(sim.history, sim.bestLapEver);
    updateHud(sim.leader);
    const lapStr = data.bestLap && Number.isFinite(data.bestLap) ? ` (${data.bestLap.toFixed(2)}s lap)` : '';
    toast(`Imported brain (Gen ${data.generation || '?'}${lapStr}) and seeded population`, 'success');
  } catch (err) {
    toast(err.message, 'error');
  }
});

function resetAllLearning(fromRunningModal = false) {
  const wasHyperRunning = hyperRunning;
  if (wasHyperRunning) {
    hyperRunning = false;
  }

  if (confirm('Are you sure you want to reset all learning progress?\n\nThis will erase all learned neural network weights, best lap records, and restart fresh from Generation 1.')) {
    storage.clearTrainingState();
    sim.reset();
    renderer3d?.clearSkidmarks();
    storage.saveTrainingState(sim, LAYERS, $('track-select')?.value || 'grand-prix', true);
    chart.draw(sim.history, sim.bestLapEver);
    hyperChart?.draw(sim.history, sim.bestLapEver);
    refreshSavedInfo();
    updateHud(sim.leader);

    if (hyperModal && !hyperModal.hidden) {
      hyperStartGen = 1;
      hyperStartTime = performance.now();
      hyperRunning = false;
      state.hyperRunning = false;
      sim.hyperRunning = false;
      if (typeof updateHyperControlsUi === 'function') updateHyperControlsUi();
      if (typeof updateHyperTelemetryUi === 'function') updateHyperTelemetryUi('0');
    }
    toast('↺ Learning reset: starting fresh from Gen 1 with random neural weights', 'info');
  } else if (wasHyperRunning) {
    hyperRunning = true;
    runHyperBatch();
  }
}

$('btn-clear')?.addEventListener('click', () => resetAllLearning(false));
$('btn-hyper-reset-setup')?.addEventListener('click', () => resetAllLearning(false));
$('btn-hyper-reset-running')?.addEventListener('click', () => resetAllLearning(true));

// ---------- Insights & Settings Panel Logic ----------
const panelEl = $('panel');
const panelTabBtn = $('btn-toggle-panel');
const btnPanelClose = $('btn-panel-close');

function setPanelOpen(open) {
  if (!panelEl) return;
  if (open) {
    panelEl.classList.add('is-open');
    panelTabBtn?.classList.add('is-active');
  } else {
    panelEl.classList.remove('is-open');
    panelTabBtn?.classList.remove('is-active');
  }
}

if (panelTabBtn) {
  panelTabBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isNowOpen = !panelEl?.classList.contains('is-open');
    setPanelOpen(isNowOpen);
    toast(isNowOpen ? 'Insights opened' : 'Insights closed');
  });
}

if (btnPanelClose) {
  btnPanelClose.addEventListener('click', (e) => {
    e.stopPropagation();
    setPanelOpen(false);
  });
}

// ---------- Controls Menu Popover ----------
const btnControlsMenu = $('btn-controls-menu');
const controlsPopover = $('controls-popover');
const btnShortcutsClose = $('btn-shortcuts-close');

function setControlsPopoverOpen(open) {
  if (!controlsPopover) return;
  controlsPopover.hidden = !open;
  btnControlsMenu?.setAttribute('aria-expanded', String(open));
  if (open) {
    btnControlsMenu?.classList.add('is-active');
  } else {
    btnControlsMenu?.classList.remove('is-active');
  }
}

if (btnControlsMenu) {
  btnControlsMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = controlsPopover?.hidden ?? true;
    setControlsPopoverOpen(isHidden);
  });
}

if (btnShortcutsClose) {
  btnShortcutsClose.addEventListener('click', (e) => {
    e.stopPropagation();
    setControlsPopoverOpen(false);
  });
}

document.addEventListener('click', (e) => {
  const widget = $('controls-widget');
  if (widget && !widget.contains(e.target)) {
    setControlsPopoverOpen(false);
  }
});

// ---------- Bottom Right Circular Actions (Camera, Leaderboard & Telemetry) ----------
const btnCameraMenu = $('btn-camera-menu');
const cameraPopover = $('camera-popover');
const btnToggleLeaderboard = $('btn-toggle-leaderboard');
const btnToggleTelemetry = $('btn-toggle-telemetry');
const leaderCardEl = $('leader-card');

function setCameraPopoverOpen(open) {
  if (!cameraPopover) return;
  cameraPopover.hidden = !open;
  btnCameraMenu?.setAttribute('aria-expanded', String(open));
  btnCameraMenu?.classList.toggle('is-active', open);
}

const CAMERA_SHORT_NAMES = {
  auto: 'Auto Director',
  chase: 'Chase Cam',
  action: 'Action Front',
  action_rear: 'Action Rear',
  onboard: 'Onboard T-Cam',
  follow: 'Broadcast Follow',
  heli: 'Helicopter',
  broadcast: 'TV Gantry',
  orbit: 'Free Orbit',
};

function updateCameraPill() {
  const labelEl = $('cam-pill-label');
  const btn = $('btn-camera-menu');
  const isAuto = (state.cameraPreset || 'auto') === 'auto';

  if (btn) {
    btn.classList.toggle('is-auto-director', isAuto);
  }

  if (labelEl) {
    if (isAuto && renderer3d && renderer3d.activeCameraPreset) {
      const activeShotName = CAMERA_SHORT_NAMES[renderer3d.activeCameraPreset] || renderer3d.activeCameraPreset;
      if (labelEl.textContent !== activeShotName) {
        labelEl.textContent = activeShotName;
      }
    } else {
      const targetName = CAMERA_SHORT_NAMES[state.cameraPreset] || 'Auto Director';
      if (labelEl.textContent !== targetName) {
        labelEl.textContent = targetName;
      }
    }
  }
}

function setCameraPreset(preset, showToast = true) {
  state.cameraPreset = preset;
  if (renderer3d) {
    renderer3d._lastPresetSwitchTime = performance.now();
    renderer3d._autoPreset = preset;
    renderer3d._autoNextSwitch = performance.now() + 20000;
  }
  if (!state.view3d) {
    set3DView(true);
  }
  if (preset !== 'orbit') {
    state.follow = true;
    const toggleFollow = $('toggle-follow');
    if (toggleFollow) toggleFollow.checked = true;
  } else {
    state.follow = false;
    const toggleFollow = $('toggle-follow');
    if (toggleFollow) toggleFollow.checked = false;
  }

  document.querySelectorAll('.btn-cam-preset').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-preset') === preset);
  });

  updateCameraPill();

  const names = {
    auto: 'Auto Director (Dynamic Broadcast Cycling)',
    chase: 'Chase Cam (Dynamic Follow)',
    action: 'Action Front (Front Duel Framing P1 & P2)',
    action_rear: 'Action Rear (Rear Battle Framing P2 & P1)',
    onboard: 'Onboard T-Cam (Cockpit View)',
    follow: 'Broadcast Follow (Classic High Tracker)',
    heli: 'Helicopter Chase (Cinematic Aerial Pursuit)',
    broadcast: 'TV Gantry (Start / Finish Cam)',
    orbit: 'Free Orbit (Cinematic Rotate)',
  };
  if (showToast) {
    toast(`🎥 ${names[preset] || preset}`, 'info');
  }
}

if (btnCameraMenu) {
  btnCameraMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = cameraPopover.hidden;
    setCameraPopoverOpen(isHidden);
  });
}

document.querySelectorAll('.btn-cam-preset').forEach((btn) => {
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const preset = btn.getAttribute('data-preset');
    if (preset) {
      setCameraPreset(preset);
      setCameraPopoverOpen(false);
    }
  });
});

document.addEventListener('click', (e) => {
  const widget = $('camera-widget');
  if (widget && !widget.contains(e.target)) {
    setCameraPopoverOpen(false);
  }
});

function setLeaderboardOpen(open) {
  leaderboard.toggleCollapse(!open);
  btnToggleLeaderboard?.classList.toggle('is-active', open);
}

let isTelemetryOpen = localStorage.getItem('ai-racer:telemetry-open') !== 'false';
function setTelemetryOpen(open) {
  isTelemetryOpen = open;
  if (leaderCardEl) {
    leaderCardEl.classList.toggle('is-hidden', !open);
  }
  btnToggleTelemetry?.classList.toggle('is-active', open);
  localStorage.setItem('ai-racer:telemetry-open', String(open));
}

if (btnToggleLeaderboard) {
  btnToggleLeaderboard.addEventListener('click', (e) => {
    e.stopPropagation();
    const willBeOpen = leaderboard.isCollapsed;
    setLeaderboardOpen(willBeOpen);
    toast(willBeOpen ? 'Leaderboard opened' : 'Leaderboard closed');
  });
}

if (btnToggleTelemetry) {
  btnToggleTelemetry.addEventListener('click', (e) => {
    e.stopPropagation();
    setTelemetryOpen(!isTelemetryOpen);
    toast(isTelemetryOpen ? 'Telemetry opened' : 'Telemetry closed');
  });
}

const CAMERA_PRESETS_CYCLE = ['auto', 'chase', 'action', 'action_rear', 'onboard', 'follow', 'heli', 'broadcast', 'orbit'];

function cycleCameraPreset(direction) {
  const current = state.cameraPreset || 'auto';
  let idx = CAMERA_PRESETS_CYCLE.indexOf(current);
  if (idx < 0) idx = 0;
  let nextIdx = idx + direction;
  if (nextIdx < 0) nextIdx = CAMERA_PRESETS_CYCLE.length - 1;
  if (nextIdx >= CAMERA_PRESETS_CYCLE.length) nextIdx = 0;
  setCameraPreset(CAMERA_PRESETS_CYCLE[nextIdx], true);
}

function switchTargetCar(direction) {
  if (!sim || !sim.cars || sim.cars.length === 0) return;

  const activeCars = sim.cars.filter((c) => c && (c.alive || c.finished) && !c.crashed);
  if (activeCars.length === 0) return;

  activeCars.sort((a, b) => {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    if (a.finished && b.finished) {
      const tA = a.finishTime ?? a.time;
      const tB = b.finishTime ?? b.time;
      return tA - tB;
    }
    if (a.laps !== b.laps) return b.laps - a.laps;
    return b.totalIdx - a.totalIdx;
  });

  const currentFocus = (focusedFollowCar && (focusedFollowCar.alive || focusedFollowCar.finished) && !focusedFollowCar.crashed)
    ? focusedFollowCar
    : (renderer3d?.focusedCar || sim.leader || activeCars[0]);

  let curIdx = activeCars.indexOf(currentFocus);
  if (curIdx < 0) curIdx = 0;

  let nextIdx = curIdx + direction;
  if (nextIdx < 0) nextIdx = activeCars.length - 1;
  if (nextIdx >= activeCars.length) nextIdx = 0;

  const targetCar = activeCars[nextIdx];
  if (targetCar) {
    focusedFollowCar = targetCar;
    state.follow = true;
    const toggleFollow = $('toggle-follow');
    if (toggleFollow) toggleFollow.checked = true;

    const carIdx = sim.cars.indexOf(targetCar);
    const carNum = targetCar.carNumber || (typeof targetCar.gridSlot === 'number' ? targetCar.gridSlot + 1 : (carIdx >= 0 ? carIdx + 1 : 1));
    const rank = nextIdx + 1;
    toast(`🎥 Camera tracking Car #${carNum} (P.${rank})`, 'info');
  }
}

// Initial active state synchronization
setTelemetryOpen(isTelemetryOpen);
btnToggleLeaderboard?.classList.toggle('is-active', !leaderboard.isCollapsed);

// Keyboard
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    const hm = hyperModal || $('hyper-modal');
    if (hm && !hm.hidden) {
      closeHyperModal();
      e.preventDefault();
      return;
    }
    const genDialPopover = $('gen-dial-popover');
    if (genDialPopover && !genDialPopover.hidden) {
      genDialPopover.hidden = true;
      e.preventDefault();
      return;
    }
    setCameraPopoverOpen(false);
    setControlsPopoverOpen(false);
    setPanelOpen(false);
    return;
  }
  if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox' && e.target.type !== 'range') return;

  if (state.manual) {
    if (e.key in keys) {
      keys[e.key] = true;
      e.preventDefault();
      return;
    }
  } else {
    // Non-manual simulation spectator mode:
    // Arrow Up / Down switches targeted car in race order
    // Arrow Left / Right cycles 3D camera angles with smooth transition
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!e.repeat) switchTargetCar(-1);
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!e.repeat) switchTargetCar(1);
      return;
    }
    if (e.key === 'ArrowLeft') {
      e.preventDefault();
      if (!e.repeat) cycleCameraPreset(-1);
      return;
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault();
      if (!e.repeat) cycleCameraPreset(1);
      return;
    }
  }

  if (e.repeat) return;
  switch (e.key.toLowerCase()) {
    case ' ':
      e.preventDefault();
      setPaused(!state.paused);
      break;
    case 'o':
      set3DView(!state.view3d);
      break;
    case 'f':
      setToggle('follow', !state.follow);
      break;
    case 'v':
      if (cameraPopover) {
        setCameraPopoverOpen(cameraPopover.hidden);
      }
      break;
    case 'a':
    case '0':
      setCameraPreset('auto');
      break;
    case '1':
      setCameraPreset('chase');
      break;
    case '2':
      setCameraPreset('action');
      break;
    case '3':
      setCameraPreset('action_rear');
      break;
    case '4':
      setCameraPreset('onboard');
      break;
    case '5':
      setCameraPreset('follow');
      break;
    case '6':
      setCameraPreset('heli');
      break;
    case '7':
      setCameraPreset('broadcast');
      break;
    case '8':
      setCameraPreset('orbit');
      break;
    case 'x':
      setToggle('sensors', !state.sensors);
      break;
    case 'g':
      setToggle('ghosts', !state.ghosts);
      break;
    case 't':
      setTurbo(!state.turbo);
      break;
    case 'm':
      setManual(!state.manual);
      break;
    case 'r':
      restartCurrentGen();
      break;
    case 's':
      setAudio(!state.audio);
      break;
    case 'l':
      const willOpenL = leaderboard.isCollapsed;
      setLeaderboardOpen(willOpenL);
      toast(willOpenL ? 'Leaderboard opened' : 'Leaderboard closed');
      break;
    case 'c':
      setTelemetryOpen(!isTelemetryOpen);
      toast(isTelemetryOpen ? 'Telemetry opened' : 'Telemetry closed');
      break;
    case 'p':
      const willOpen = !panelEl?.classList.contains('is-open');
      setPanelOpen(willOpen);
      toast(willOpen ? 'Insights opened' : 'Insights closed');
      break;
    case 'h':
      openHyperModal();
      break;
    case 'escape':
      const modalEl = hyperModal || $('hyper-modal');
      if (modalEl && !modalEl.hidden) {
        closeHyperModal();
      }
      setCameraPopoverOpen(false);
      setControlsPopoverOpen(false);
      setPanelOpen(false);
      break;
  }
});
window.addEventListener('keyup', (e) => {
  if (e.key in keys) keys[e.key] = false;
});
window.addEventListener('blur', () => Object.keys(keys).forEach((k) => (keys[k] = false)));

// Resize
const ro = new ResizeObserver(() => {
  renderer.resize();
  if (renderer3d) renderer3d.resize();
  nnViz.resize();
  chart.resize();
  if (hubNnViz) hubNnViz.resize();
  if (hubChart) hubChart.resize();
  if (hyperChart) hyperChart.resize();
});
ro.observe($('stage'));
ro.observe($('nn-canvas'));
ro.observe($('chart-canvas'));
if ($('nn-canvas-hub')) ro.observe($('nn-canvas-hub'));
if ($('chart-canvas-hub')) ro.observe($('chart-canvas-hub'));

// ---------- AI Neural & Training Hub Controller ----------
let currentHubTab = 'train'; // 'train' | 'storage' | 'analytics'
const hubTabBtnTrain = $('hub-tab-btn-train');
const hubTabBtnStorage = $('hub-tab-btn-storage');
const hubTabBtnAnalytics = $('hub-tab-btn-analytics');
const hubPaneTrain = $('hub-pane-train');
const hubPaneStorage = $('hub-pane-storage');
const hubPaneAnalytics = $('hub-pane-analytics');

function setHubTab(tab) {
  currentHubTab = tab;
  const tabs = [
    { key: 'train', btn: hubTabBtnTrain, pane: hubPaneTrain },
    { key: 'storage', btn: hubTabBtnStorage, pane: hubPaneStorage },
    { key: 'analytics', btn: hubTabBtnAnalytics, pane: hubPaneAnalytics },
  ];
  tabs.forEach((t) => {
    const isActive = t.key === tab;
    if (t.btn) {
      t.btn.classList.toggle('active', isActive);
      t.btn.setAttribute('aria-selected', String(isActive));
    }
    if (t.pane) {
      t.pane.hidden = !isActive;
      if (isActive) t.pane.classList.add('active');
      else t.pane.classList.remove('active');
    }
  });

  if (tab === 'train') {
    requestAnimationFrame(() => {
      hyperChart?.resize();
      hyperChart?.draw(sim.history, sim.bestLapEver);
      if (typeof updateHyperControlsUi === 'function') updateHyperControlsUi();
      if (typeof updateHyperTelemetryUi === 'function') updateHyperTelemetryUi(hyperRunning ? undefined : '0');
    });
  } else if (tab === 'storage') {
    refreshSavedInfo();
  } else if (tab === 'analytics') {
    requestAnimationFrame(() => {
      hubChart?.resize();
      hubChart?.draw(sim.history, sim.bestLapEver);
      hubNnViz?.resize();
      updateHubAnalytics();
    });
  }
}

hubTabBtnTrain?.addEventListener('click', () => setHubTab('train'));
hubTabBtnStorage?.addEventListener('click', () => setHubTab('storage'));
hubTabBtnAnalytics?.addEventListener('click', () => setHubTab('analytics'));

// Hub Storage & Snapshot Buttons
$('hub-btn-save')?.addEventListener('click', () => {
  const leaderCar = sim.leader;
  const bestToSave = sim.allTimeBest || (leaderCar ? {
    genome: leaderCar.brain.genome,
    fitness: leaderCar.fitness,
    generation: sim.generation,
    bestLap: leaderCar.bestLap,
  } : null);
  if (!bestToSave) return toast('No active generation data to save yet', 'error');
  storage.saveBrain(bestToSave, LAYERS);
  storage.saveTrainingState(sim, LAYERS, $('track-select')?.value || 'grand-prix', true);
  refreshSavedInfo();
  toast(`💾 Generation ${bestToSave.generation || sim.generation} Champion snapshot saved!`, 'success');
});

$('hub-btn-load')?.addEventListener('click', () => $('btn-load')?.click());
$('hub-btn-export')?.addEventListener('click', () => $('btn-export')?.click());
$('hub-btn-import')?.addEventListener('click', () => $('btn-import')?.click());
$('hub-btn-clear')?.addEventListener('click', () => resetAllLearning(false));

const hubToggleAutosave = $('hub-toggle-autosave');
const panelToggleAutosave = $('toggle-autosave');
if (hubToggleAutosave) {
  hubToggleAutosave.addEventListener('change', () => {
    state.autosave = hubToggleAutosave.checked;
    if (panelToggleAutosave) panelToggleAutosave.checked = hubToggleAutosave.checked;
    toast(`Auto-save ${state.autosave ? 'enabled' : 'disabled'}`);
  });
}
if (panelToggleAutosave) {
  panelToggleAutosave.addEventListener('change', () => {
    state.autosave = panelToggleAutosave.checked;
    if (hubToggleAutosave) hubToggleAutosave.checked = panelToggleAutosave.checked;
  });
}

// ---------- Hyper-Speed Headless Training Engine ----------
let hyperRunning = false;
let hyperMode = 'gens'; // 'gens' | 'time'
let hyperStartGen = 1;
let hyperStartTime = 0;
let hyperGenGoal = 51;
let hyperDurationGoalMs = 60000;
let hyperChart = null;

const hyperModal = $('hyper-modal');
const hyperSetupView = $('hyper-setup-view');
const hyperRunningView = $('hyper-running-view');
const hyperTargetInput = $('hyper-target-input');
const tabHyperGens = $('tab-hyper-gens');
const tabHyperTime = $('tab-hyper-time');
const paneHyperGens = $('pane-hyper-gens');
const paneHyperTime = $('pane-hyper-time');
const hyperHoursInput = $('hyper-time-hours');
const hyperMinsInput = $('hyper-time-mins');
const hyperSecsInput = $('hyper-time-secs');

function fmtDuration(seconds) {
  if (!isFinite(seconds) || seconds < 0) return '0.0s';
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  if (hrs > 0) {
    return `${hrs}h ${mins.toString().padStart(2, '0')}m ${secs.toString().padStart(2, '0')}s`;
  }
  return `${mins}m ${secs.toString().padStart(2, '0')}s`;
}

let lastHyperTelemetryUpdate = 0;

function updateHyperTelemetryUi(rateStr) {
  const insights = analyzeTrainingProgress(sim.history, sim, rateStr);

  const bannerBadge = $('hyper-health-badge');
  const bannerStatus = $('hyper-health-status');
  const qualityVal = $('hyper-quality-val');
  const healthMsg = $('hyper-health-msg');

  if (bannerBadge && bannerStatus) {
    bannerBadge.className = `health-status-badge ${insights.statusClass}`;
    bannerStatus.textContent = insights.statusText;
  }
  if (healthMsg) healthMsg.textContent = insights.message;

  // Tile 1: AI Competency (Score + Driving Milestone)
  if (qualityVal) qualityVal.textContent = `${insights.competencyScore}/100`;
  const qualityTier = $('hyper-quality-tier');
  if (qualityTier) {
    qualityTier.textContent = insights.milestoneName;
    const qType = insights.qualityClass || 'improving';
    qualityTier.className = `trend-badge ${qType}`;
    const qTile = qualityTier.closest('.stat');
    if (qTile) {
      qTile.classList.remove('tile-improving', 'tile-declining', 'tile-neutral');
      qTile.classList.add(`tile-${qType}`);
    }
  }

  const updateBadge = (id, delta) => {
    const el = $(id);
    if (!el || !delta) return;
    el.textContent = delta.text;
    const type = delta.type || 'neutral';
    el.className = `trend-badge ${type}`;
    const tile = el.closest('.stat');
    if (tile) {
      tile.classList.remove('tile-improving', 'tile-declining', 'tile-neutral');
      tile.classList.add(`tile-${type}`);
    }
  };

  updateBadge('hyper-delta-fitness', insights.deltas.fitness);
  updateBadge('hyper-delta-curvature', insights.deltas.curvature);
  updateBadge('hyper-delta-progress', insights.deltas.curvature || insights.deltas.progress);
  updateBadge('hyper-delta-lap', insights.deltas.lap);
  updateBadge('hyper-delta-speed', insights.deltas.speed);
  updateBadge('hyper-delta-pop-avg', insights.deltas.speed || insights.deltas.popSpread);
  updateBadge('hyper-delta-survival', insights.deltas.survival);
  updateBadge('hyper-delta-stagnation', insights.deltas.stagnation);
  updateBadge('hyper-delta-diversity', insights.deltas.diversity);

  // Live simulation rate in Engine Spec strip
  const statRate = $('hyper-stat-rate');
  if (statRate) {
    statRate.textContent = `${rateStr || '0'} gen/s`;
  }
  updateBurstButtonUi();

  // Populate numeric stat values
  const lastRecord = sim.history && sim.history.length ? sim.history[sim.history.length - 1] : null;

  const statFit = $('hyper-stat-fitness');
  if (statFit) statFit.textContent = compact(sim.allTimeBest?.fitness);

  const statCurvature = $('hyper-stat-curvature');
  if (statCurvature) statCurvature.textContent = insights.straightnessText;

  const statProgress = $('hyper-stat-progress');
  if (statProgress) statProgress.textContent = insights.straightnessText;

  const statLap = $('hyper-stat-lap');
  if (statLap) statLap.textContent = fmtTime(sim.bestLapEver);

  const statSpeed = $('hyper-stat-speed') || $('hyper-stat-pop-avg');
  if (statSpeed) statSpeed.textContent = insights.topSpeedText;

  const statPopAvg = $('hyper-stat-pop-avg');
  if (statPopAvg && !$('hyper-stat-speed')) statPopAvg.textContent = lastRecord ? compact(lastRecord.avg) : '–';

  const statPopSurvival = $('hyper-stat-pop-survival');
  if (statPopSurvival) {
    if (lastRecord) {
      const pop = lastRecord.population || 20;
      const fin = lastRecord.finishers || 0;
      const pct = Math.round((fin / pop) * 100);
      statPopSurvival.textContent = `${fin}/${pop} (${pct}%)`;
    } else {
      statPopSurvival.textContent = '–';
    }
  }

  const statStagnation = $('hyper-stat-stagnation');
  if (statStagnation) statStagnation.textContent = insights.stagnationText;

  const statDiversity = $('hyper-stat-diversity');
  if (statDiversity) statDiversity.textContent = insights.diversityText;

  // Render bespoke specialized micro-charts for each of the 8 tiles
  renderAllTileGraphics({
    quality: $('sparkline-quality'),
    fitness: $('sparkline-fitness'),
    curvature: $('sparkline-curvature'),
    progress: $('sparkline-progress'),
    lap: $('sparkline-lap'),
    speed: $('sparkline-speed'),
    popAvg: $('sparkline-speed') || $('sparkline-pop-avg'),
    survival: $('sparkline-survival'),
    stagnation: $('sparkline-stagnation'),
    diversity: $('sparkline-diversity'),
  }, sim, insights, rateStr);
}

function setHyperMode(mode) {
  hyperMode = mode;
  if (tabHyperGens && tabHyperTime && paneHyperGens && paneHyperTime) {
    if (mode === 'gens') {
      tabHyperGens.classList.add('active');
      tabHyperGens.setAttribute('aria-selected', 'true');
      tabHyperTime.classList.remove('active');
      tabHyperTime.setAttribute('aria-selected', 'false');
      paneHyperGens.hidden = false;
      paneHyperTime.hidden = true;
    } else {
      tabHyperTime.classList.add('active');
      tabHyperTime.setAttribute('aria-selected', 'true');
      tabHyperGens.classList.remove('active');
      tabHyperGens.setAttribute('aria-selected', 'false');
      paneHyperTime.hidden = false;
      paneHyperGens.hidden = true;
    }
  }
}

tabHyperGens?.addEventListener('click', () => setHyperMode('gens'));
tabHyperTime?.addEventListener('click', () => setHyperMode('time'));

function updateHyperControlsUi() {
  const toggleBtn = $('btn-hyper-toggle');
  const toggleText = $('hyper-toggle-text');
  const toggleIcon = $('hyper-toggle-icon');
  const exitBtn = $('btn-hyper-exit');
  const exitText = $('hyper-exit-text') || exitBtn?.querySelector('span');

  const progDot = $('hyper-prog-dot');
  const progState = $('hyper-prog-state');
  const progBadge = $('hyper-prog-pct');
  const barFill = $('hyper-bar-fill');
  const curGenEl = $('hyper-cur-gen');
  const targetInfo = $('hyper-target-info');

  if (curGenEl) curGenEl.textContent = sim.generation;

  if (hyperRunning) {
    if (toggleBtn) toggleBtn.classList.add('is-running');
    if (toggleText) toggleText.textContent = 'Stop and Resume 3D View';
    if (toggleIcon) {
      toggleIcon.innerHTML = '<rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor"></rect>';
    }
    if (exitText) exitText.textContent = 'Pause Simulation';
    if (progDot) progDot.classList.add('active');
    if (progState) progState.textContent = 'SIMULATION ACTIVE';
    if (barFill) barFill.classList.add('is-active');
  } else {
    if (toggleBtn) toggleBtn.classList.remove('is-running');
    if (toggleText) toggleText.textContent = 'Start Fast-Forward Simulation';
    if (toggleIcon) {
      toggleIcon.innerHTML = '<polygon points="5 3 19 12 5 21 5 3"></polygon>';
    }
    if (exitText) exitText.textContent = 'Resume 3D View';
    if (progDot) progDot.classList.remove('active');
    if (progState) progState.textContent = 'SIMULATION STANDBY';
    if (progBadge) progBadge.textContent = 'STANDBY';
    if (targetInfo) {
      targetInfo.innerHTML = `GEN <strong id="hyper-cur-gen">${sim.generation}</strong> · CONTINUOUS EVOLUTION`;
    }
    if (barFill) {
      barFill.classList.remove('is-active');
      barFill.style.width = '100%';
    }
  }
}

function stopAndResume3DView() {
  const wasRunning = hyperRunning;
  hyperRunning = false;
  state.hyperRunning = false;
  sim.hyperRunning = false;
  headlessPostFinishTimer = null;

  if (CONFIG.generation) {
    CONFIG.generation.startDelay = prevStartDelay;
    CONFIG.generation.maxLaps = prevMaxLaps;
    CONFIG.generation.timeLimit = prevTimeLimit;
  }
  sim.tireBarriers = prevTireBarriers;

  audio.enabled = prevAudioEnabled;
  audio.silenceAll();

  const elapsedSec = (performance.now() - hyperStartTime) / 1000;
  const elapsedFmt = fmtDuration(elapsedSec);
  const gensDone = sim.generation - hyperStartGen;
  const rate = elapsedSec > 0 ? (gensDone / elapsedSec).toFixed(1) : '0';

  updateHyperControlsUi();
  updateHyperTelemetryUi(rate);
  persistState();
  chart.draw(sim.history, sim.bestLapEver);
  hubChart?.draw(sim.history, sim.bestLapEver);
  hyperChart?.draw(sim.history, sim.bestLapEver);
  refreshSavedInfo();
  updateHud(sim.leader);

  // Resume 3D animation frame loop if it was suspended
  if (!frameActive) {
    frameActive = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  if (hyperModal) hyperModal.hidden = true;

  if (wasRunning && gensDone > 0) {
    toast(`🏁 Simulation stopped: +${gensDone} generations simulated (${rate} gen/s). Resuming 3D view!`, 'success');
  } else {
    toast('Resuming 3D view', 'info');
  }
}

function pauseHyperTraining() {
  const wasRunning = hyperRunning;
  hyperRunning = false;
  state.hyperRunning = false;
  sim.hyperRunning = false;
  headlessPostFinishTimer = null;

  if (CONFIG.generation) {
    CONFIG.generation.startDelay = prevStartDelay;
    CONFIG.generation.maxLaps = prevMaxLaps;
    CONFIG.generation.timeLimit = prevTimeLimit;
  }
  sim.tireBarriers = prevTireBarriers;

  audio.enabled = prevAudioEnabled;
  audio.silenceAll();

  const elapsedSec = (performance.now() - hyperStartTime) / 1000;
  const gensDone = sim.generation - hyperStartGen;
  const rate = elapsedSec > 0 ? (gensDone / elapsedSec).toFixed(1) : '0';

  updateHyperControlsUi();
  updateHyperTelemetryUi(rate);
  persistState();
  chart.draw(sim.history, sim.bestLapEver);
  hubChart?.draw(sim.history, sim.bestLapEver);
  hyperChart?.draw(sim.history, sim.bestLapEver);
  refreshSavedInfo();
  updateHud(sim.leader);

  if (wasRunning && gensDone > 0) {
    toast(`⏸ Simulation paused at Generation ${sim.generation} (${rate} gen/s)`, 'info');
  }
}

function onMainHyperToggleClick() {
  if (hyperRunning) {
    stopAndResume3DView();
  } else {
    startHyperTraining();
  }
}

function onExitHyperBtnClick() {
  if (hyperRunning) {
    pauseHyperTraining();
  } else {
    stopAndResume3DView();
  }
}

function openHyperModal() {
  if (!hyperModal) return;
  hyperModal.hidden = false;
  refreshSavedInfo();

  if (hyperRunningView) hyperRunningView.hidden = false;
  if (!hyperChart && $('hyper-chart-canvas')) {
    hyperChart = new FitnessChart($('hyper-chart-canvas'));
  }
  const curChartMode = hyperChart?.mode || 'lap';
  updateChartLegendUi(curChartMode);
  document.querySelectorAll('#hyper-chart-tabs .chart-tab').forEach((b) => {
    b.classList.toggle('active', b.dataset.mode === curChartMode);
  });

  requestAnimationFrame(() => {
    hyperChart?.resize();
    hyperChart?.draw(sim.history, sim.bestLapEver);
  });
  updateHyperControlsUi();
  updateHyperTelemetryUi(hyperRunning ? undefined : '0');

  if (currentHubTab === 'analytics') {
    requestAnimationFrame(() => {
      hubChart?.resize();
      hubChart?.draw(sim.history, sim.bestLapEver);
      hubNnViz?.resize();
      updateHubAnalytics();
    });
  }
}

function updateChartLegendUi(mode) {
  const legend = $('hyper-legend-items');
  if (!legend) return;
  if (mode === 'speed') {
    legend.innerHTML = `
      <span><i class="sw-trend-cyan"></i>Top Speed</span>
      <span><i class="sw-dash-emerald"></i>Apex Speed</span>
      <span><i class="sw-band-cyan"></i>Speed Band</span>
    `;
  } else if (mode === 'survival') {
    legend.innerHTML = `
      <span><i class="sw-pack-emerald"></i>Survival Trend</span>
      <span><i class="sw-band-emerald"></i>Finisher Density</span>
    `;
  } else if (mode === 'fitness') {
    legend.innerHTML = `
      <span><i class="sw-mono-white"></i>All-Time Peak</span>
      <span><i class="sw-trend-cyan"></i>Lead Car EMA</span>
      <span><i class="sw-pack-emerald"></i>Pack Median</span>
      <span><i class="sw-breakthrough-star">★</i>Breakthrough</span>
    `;
  } else {
    // lap (default)
    legend.innerHTML = `
      <span><i class="sw-mono-white"></i>Record Lap</span>
      <span><i class="sw-trend-cyan"></i>Lead Best</span>
      <span><i class="sw-pack-emerald"></i>Pack Avg</span>
      <span><i class="sw-breakthrough-star">★</i>Record Drop</span>
    `;
  }
}

function closeHyperModal() {
  stopAndResume3DView();
}

$('btn-fast-forward')?.addEventListener('click', openHyperModal);
$('btn-hyper-train')?.addEventListener('click', openHyperModal);
$('btn-hyper-close')?.addEventListener('click', closeHyperModal);
$('btn-hyper-toggle')?.addEventListener('click', onMainHyperToggleClick);
$('btn-hyper-exit')?.addEventListener('click', onExitHyperBtnClick);
function updateBurstButtonUi() {
  const rem = getBurstGensRemaining();
  const burstBtn = $('btn-hyper-burst');
  const txt = $('hyper-burst-text');
  if (burstBtn && txt) {
    if (rem > 0) {
      burstBtn.classList.add('active');
      txt.textContent = `Burst Active (${rem}G)`;
    } else {
      burstBtn.classList.remove('active');
      txt.textContent = 'Exploration Burst';
    }
  }
}

$('btn-hyper-burst')?.addEventListener('click', () => {
  const rem = triggerExplorationBurst(150);
  updateBurstButtonUi();
  toast('🚀 Exploration Burst Active: 150 generations of elevated mutation injected to break lap time plateau!', 'success');
});
$('btn-hyper-reset-running')?.addEventListener('click', () => resetAllLearning(true));

const hyperChartTabsContainer = $('hyper-chart-tabs');
if (hyperChartTabsContainer) {
  hyperChartTabsContainer.addEventListener('click', (e) => {
    const btn = e.target.closest('.chart-tab');
    if (!btn) return;
    const mode = btn.dataset.mode;
    if (!mode) return;
    hyperChartTabsContainer.querySelectorAll('.chart-tab').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    hyperChart?.setMode(mode);
    updateChartLegendUi(mode);
  });
}

// Generation presets
document.querySelectorAll('#hyper-gen-presets .btn-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#hyper-gen-presets .btn-chip').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const gens = Number(btn.getAttribute('data-gens')) || 50;
    if (hyperTargetInput) hyperTargetInput.value = gens;
  });
});

hyperTargetInput?.addEventListener('input', () => {
  const val = Number(hyperTargetInput.value);
  document.querySelectorAll('#hyper-gen-presets .btn-chip').forEach((b) => {
    b.classList.toggle('active', Number(b.getAttribute('data-gens')) === val);
  });
});

$('btn-step-dec')?.addEventListener('click', () => {
  if (!hyperTargetInput) return;
  const cur = Number(hyperTargetInput.value) || 50;
  const next = Math.max(1, cur - (cur > 100 ? 50 : 25));
  hyperTargetInput.value = next;
  hyperTargetInput.dispatchEvent(new Event('input'));
});

$('btn-step-inc')?.addEventListener('click', () => {
  if (!hyperTargetInput) return;
  const cur = Number(hyperTargetInput.value) || 50;
  const next = Math.min(10000, cur + (cur >= 100 ? 50 : 25));
  hyperTargetInput.value = next;
  hyperTargetInput.dispatchEvent(new Event('input'));
});

// Time presets
document.querySelectorAll('#hyper-time-presets .btn-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#hyper-time-presets .btn-chip').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    const totalMins = Number(btn.getAttribute('data-mins')) || 1;
    const hrs = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    if (hyperHoursInput) hyperHoursInput.value = hrs;
    if (hyperMinsInput) hyperMinsInput.value = mins;
    if (hyperSecsInput) hyperSecsInput.value = 0;
  });
});

function getTargetDurationMs() {
  const hrs = Math.max(0, Number(hyperHoursInput?.value) || 0);
  const mins = Math.max(0, Number(hyperMinsInput?.value) || 0);
  const secs = Math.max(0, Number(hyperSecsInput?.value) || 0);
  const totalSecs = hrs * 3600 + mins * 60 + secs;
  return Math.max(1000, totalSecs * 1000);
}

let hyperChannel = null;
let prevAudioEnabled = true;
let lastHyperUiUpdate = 0;
let lastHyperChartDraw = 0;
let frameActive = true;

function scheduleNextHyperBatch() {
  if (!hyperRunning) return;
  if (!hyperChannel) {
    hyperChannel = new MessageChannel();
    hyperChannel.port1.onmessage = () => {
      if (hyperRunning) runHyperBatch();
    };
  }
  hyperChannel.port2.postMessage(null);
}

let prevStartDelay = 2.0;
let prevMaxLaps = 5;
let prevTimeLimit = 85;
let prevTireBarriers = null;
let headlessPostFinishTimer = null;

function startHyperTraining() {
  hyperRunning = true;
  state.hyperRunning = true;
  sim.hyperRunning = true;
  headlessPostFinishTimer = null;

  prevStartDelay = CONFIG.generation?.startDelay ?? 2.0;
  prevMaxLaps = CONFIG.generation?.maxLaps ?? 5;
  prevTimeLimit = CONFIG.generation?.timeLimit ?? 85;
  prevTireBarriers = sim.tireBarriers;

  if (CONFIG.generation) {
    CONFIG.generation.startDelay = 0.0001; // Bypass 120 stationary start ticks in headless mode
    CONFIG.generation.maxLaps = 1; // 1-Lap Flying Sprint: maximum evolutionary throughput (~6.5–8.0 gen/s)
    CONFIG.generation.timeLimit = 24; // Strict safety cutoff for 1 lap
  }
  sim.tireBarriers = null; // Bypass off-track tire physics during headless run

  // Temporarily mute audio while fast-forwarding to avoid WebAudio oscillator thrashing
  prevAudioEnabled = audio.enabled;
  audio.enabled = false;
  audio.silenceAll();

  hyperStartGen = sim.generation;
  hyperStartTime = performance.now();
  lastHyperUiUpdate = 0;
  lastHyperChartDraw = 0;
  lastHyperTelemetryUpdate = 0;

  // Infinite continuous evolution: no gen limit, no time limit!
  hyperGenGoal = Infinity;
  hyperDurationGoalMs = Infinity;

  const targetInfo = $('hyper-target-info');
  if (targetInfo) {
    targetInfo.innerHTML = `GEN <strong id="hyper-cur-gen">${sim.generation}</strong> · CONTINUOUS EVOLUTION`;
  }

  if (hyperRunningView) hyperRunningView.hidden = false;

  if (!hyperChart && $('hyper-chart-canvas')) {
    hyperChart = new FitnessChart($('hyper-chart-canvas'));
  }
  requestAnimationFrame(() => {
    hyperChart?.resize();
    hyperChart?.draw(sim.history, sim.bestLapEver);
  });
  updateHyperControlsUi();
  updateHyperTelemetryUi('0');

  scheduleNextHyperBatch();
}

function runHyperBatch() {
  if (!hyperRunning) return;

  try {
    const t0 = performance.now();
    // High-throughput simulation slice (100ms): maximizes V8 JIT physics throughput with zero VSYNC wait
    while (performance.now() - t0 < 100 && hyperRunning) {
      for (let k = 0; k < 60; k++) {
        sim.step();

        // In headless fast-forward, immediately bypass the human victory cooldown & fast-forward checkered timer
        if (sim.postRaceTimer !== null && sim.postRaceTimer > 0) {
          sim.postRaceTimer = 0;
        }
        if (sim.checkeredFlagTimer !== null && sim.checkeredFlagTimer > 1.5) {
          sim.checkeredFlagTimer = 1.5;
        }

        // Fast-forward death slide of crashed cars so finished grids don't waste 180 simulation steps
        if (sim.cars) {
          for (let i = 0; i < sim.cars.length; i++) {
            const c = sim.cars[i];
            if (c && c.crashed && c.alive) {
              c.deathTimer = 0;
            }
          }
        }

        // F1 Checkered Flag Rule in Headless Mode:
        // When the race leader (P1) finishes, give a brief 1.5s window for trailing cars to finish, then conclude generation
        if (sim.cars && sim.cars.some(c => c.finished)) {
          if (headlessPostFinishTimer === null) {
            headlessPostFinishTimer = 1.5;
          } else {
            headlessPostFinishTimer -= CONFIG.dt;
            if (headlessPostFinishTimer <= 0) {
              headlessPostFinishTimer = null;
              sim.endGeneration();
            }
          }
        } else {
          headlessPostFinishTimer = null;
        }

        if (isFinite(hyperGenGoal) && sim.generation >= hyperGenGoal) {
          finishHyperTraining();
          return;
        }
        if (isFinite(hyperDurationGoalMs) && (performance.now() - hyperStartTime) >= hyperDurationGoalMs) {
          finishHyperTraining();
          return;
        }
      }
    }
  } catch (err) {
    console.error('Fast-Forward physics step error:', err);
    pauseHyperTraining();
    toast('⚠️ Fast-Forward encountered an error and safely paused: ' + err.message, 'error');
    return;
  }

  // Prevent memory accumulation of unrendered death event objects during headless run
  if (sim.deathEvents && sim.deathEvents.length > 0) {
    sim.deathEvents.length = 0;
  }

  const now = performance.now();
  const elapsedMs = now - hyperStartTime;
  const elapsedSec = elapsedMs / 1000;
  const gensDone = sim.generation - hyperStartGen;
  const rate = elapsedSec > 0 ? (gensDone / elapsedSec).toFixed(1) : '0';

  // Throttle DOM updates to ~120ms to keep UI responsive without layout thrashing
  if (now - lastHyperUiUpdate >= 120) {
    lastHyperUiUpdate = now;

    const progPct = $('hyper-prog-pct');
    if (progPct) progPct.textContent = `${rate} gen/s`;
    const curGen = $('hyper-cur-gen');
    if (curGen) curGen.textContent = sim.generation;
    const targetInfo = $('hyper-target-info');
    if (targetInfo) {
      targetInfo.innerHTML = `GEN <strong id="hyper-cur-gen">${sim.generation}</strong> · <span>+${gensDone} gens simulated</span>`;
    }
    const barFill = $('hyper-bar-fill');
    if (barFill) barFill.style.width = '100%';

    const lastRecord = sim.history.length ? sim.history[sim.history.length - 1] : null;

    const statTime = $('hyper-stat-time');
    if (statTime) statTime.textContent = fmtDuration(elapsedSec);
    const statRate = $('hyper-stat-rate');
    if (statRate) statRate.textContent = `${rate} gen/s`;
    const statAdded = $('hyper-stat-added');
    if (statAdded) statAdded.textContent = `+${gensDone} gens`;
    const statFit = $('hyper-stat-fitness');
    if (statFit) statFit.textContent = compact(sim.allTimeBest?.fitness);
    const statCurvature = $('hyper-stat-curvature');
    if (statCurvature) {
      if (sim.bestLapEver && sim.bestLapEver < 999) {
        const normLap = Math.max(0, Math.min(1.0, (sim.bestLapEver - 10.0) / (24.0 - 10.0)));
        const sScore = Math.max(10.0, 94.0 - Math.pow(normLap, 0.85) * 58.0).toFixed(1);
        statCurvature.textContent = `${sScore}%`;
      } else {
        const est = (12.0 + Math.min(1.0, (sim.allTimeBest?.fitness || 0) / 25000) * 22.0).toFixed(1);
        statCurvature.textContent = `${est}%`;
      }
    }
    const statLap = $('hyper-stat-lap');
    if (statLap) statLap.textContent = fmtTime(sim.bestLapEver);

    const statSpeed = $('hyper-stat-speed') || $('hyper-stat-pop-avg');
    const deltaSpeed = $('hyper-delta-speed');
    if (statSpeed) {
      if (lastRecord && Number.isFinite(lastRecord.avgLap) && lastRecord.avgLap > 0 && lastRecord.avgLap < 60) {
        statSpeed.textContent = `${lastRecord.avgLap.toFixed(2)}s`;
        if (deltaSpeed && Number.isFinite(lastRecord.bestLap) && lastRecord.bestLap > 0) {
          const gap = lastRecord.avgLap - lastRecord.bestLap;
          if (gap <= 0.05) {
            deltaSpeed.textContent = 'Tight Pack · Equal P1';
            deltaSpeed.className = 'trend-badge improving';
          } else if (gap <= 0.35) {
            deltaSpeed.textContent = `Tight Pack · +${gap.toFixed(2)}s`;
            deltaSpeed.className = 'trend-badge improving';
          } else if (gap <= 0.85) {
            deltaSpeed.textContent = `Δ +${gap.toFixed(2)}s to P1`;
            deltaSpeed.className = 'trend-badge neutral';
          } else {
            deltaSpeed.textContent = `Spread +${gap.toFixed(2)}s`;
            deltaSpeed.className = 'trend-badge declining';
          }
        }
      } else if (sim.bestLapEver && sim.bestLapEver < 999) {
        statSpeed.textContent = `${(sim.bestLapEver + 0.65).toFixed(2)}s`;
        if (deltaSpeed) {
          deltaSpeed.textContent = 'Pace Regrouping';
          deltaSpeed.className = 'trend-badge neutral';
        }
      } else {
        statSpeed.textContent = 'Learning';
        if (deltaSpeed) {
          deltaSpeed.textContent = 'In Training';
          deltaSpeed.className = 'trend-badge neutral';
        }
      }
    }

    const statPopAvg = $('hyper-stat-pop-avg');
    if (statPopAvg && !$('hyper-stat-speed')) statPopAvg.textContent = lastRecord ? compact(lastRecord.avg) : '–';

    const statPopSurvival = $('hyper-stat-pop-survival');
    if (statPopSurvival) {
      if (lastRecord) {
        const pop = lastRecord.population || 20;
        const fin = lastRecord.finishers || 0;
        const pct = Math.round((fin / pop) * 100);
        statPopSurvival.textContent = `${fin}/${pop} (${pct}%)`;
      } else {
        statPopSurvival.textContent = '–';
      }
    }

    const statPopPace = $('hyper-stat-pop-pace');
    if (statPopPace) {
      if (lastRecord && lastRecord.lapImprovementPct > 0) {
        statPopPace.textContent = `+${lastRecord.lapImprovementPct.toFixed(1)}% faster`;
      } else if (lastRecord && lastRecord.avgLap && Number.isFinite(lastRecord.avgLap) && lastRecord.avgLap < 999) {
        statPopPace.textContent = `${lastRecord.avgLap.toFixed(2)}s avg`;
      } else {
        statPopPace.textContent = '–';
      }
    }
  }

  // Throttle main fitness chart redraw to ~220ms intervals
  if (now - lastHyperChartDraw >= 220) {
    lastHyperChartDraw = now;
    hyperChart?.draw(sim.history, sim.bestLapEver);
  }

  // Throttle 8 micro sparkline canvases to ~180ms intervals
  if (now - lastHyperTelemetryUpdate > 180) {
    lastHyperTelemetryUpdate = now;
    updateHyperTelemetryUi(rate);
  }

  // Yield to browser event loop via zero-delay MessageChannel (0ms delay, no VSYNC lock)
  if (hyperRunning) {
    scheduleNextHyperBatch();
  }
}

function stopHyperTraining() {
  stopAndResume3DView();
}

function finishHyperTraining() {
  const wasRunning = hyperRunning;
  hyperRunning = false;
  state.hyperRunning = false;
  sim.hyperRunning = false;
  headlessPostFinishTimer = null;

  if (CONFIG.generation) {
    CONFIG.generation.startDelay = prevStartDelay;
    CONFIG.generation.maxLaps = prevMaxLaps;
    CONFIG.generation.timeLimit = prevTimeLimit;
  }
  sim.tireBarriers = prevTireBarriers;

  audio.enabled = prevAudioEnabled;
  audio.silenceAll();

  const elapsedSec = (performance.now() - hyperStartTime) / 1000;
  const elapsedFmt = fmtDuration(elapsedSec);
  const gensDone = sim.generation - hyperStartGen;
  const rate = elapsedSec > 0 ? (gensDone / elapsedSec).toFixed(1) : '0';

  updateHyperControlsUi();
  updateHyperTelemetryUi(rate);
  persistState();
  chart.draw(sim.history, sim.bestLapEver);
  hubChart?.draw(sim.history, sim.bestLapEver);
  hyperChart?.draw(sim.history, sim.bestLapEver);
  refreshSavedInfo();
  updateHud(sim.leader);

  // Resume 3D animation frame loop if it was suspended
  if (!frameActive) {
    frameActive = true;
    last = performance.now();
    requestAnimationFrame(frame);
  }

  if (wasRunning && gensDone > 0) {
    toast(`⚡ Simulation paused: +${gensDone} generations completed (${rate} gen/s)!`, 'info');
  }
}

$('btn-hyper-start')?.addEventListener('click', startHyperTraining);
$('btn-hyper-stop')?.addEventListener('click', stopHyperTraining);

// ---------- Generation Preset Scale Ribbon & Multi-Gen Compare Matrix ----------
const storedAnchor = parseInt(localStorage.getItem('ai-racer:generation-anchor') || '0', 10);
let userHighestGen = Math.max(storedAnchor, savedState?.generation || 1, sim?.generation || 1);
let userLiveStateSnapshot = null;
let activePresetGen = null;
let lastRibbonCurrentGen = -1;
let isMultiGenBattle = false;
let compareSelectedGens = new Set([1, 10, 100, 500]);

function updateHighestGenAndLiveSnapshot() {
  if (!activePresetGen && !isMultiGenBattle && sim) {
    if (sim.generation >= userHighestGen) {
      userHighestGen = sim.generation;
    }
    userLiveStateSnapshot = {
      generation: sim.generation,
      bestLapEver: sim.bestLapEver,
      history: [...(sim.history || [])],
      genomes: sim.cars.map((c) => Array.from(c.brain.genome)),
      allTimeBest: sim.allTimeBest ? { ...sim.allTimeBest, genome: Array.from(sim.allTimeBest.genome) } : null,
    };
  }
}

const GEN_BENCHMARK_META = {
  1: { tier: 'Random Exploration · Stochastic weights', lap: null, speed: 48, completion: 12, rating: 'D', gradeClass: 'd' },
  2: { tier: 'First Steering · Basic angular guidance', lap: null, speed: 68, completion: 28, rating: 'D+', gradeClass: 'd' },
  5: { tier: 'Path Seeker · Baseline track following', lap: null, speed: 92, completion: 55, rating: 'C', gradeClass: 'c' },
  10: { tier: 'Track Keeper · Single lap consistency', lap: 58.4, speed: 125, completion: 88, rating: 'C+', gradeClass: 'c' },
  50: { tier: 'Apex Learner · Smooth throttle control', lap: 44.2, speed: 158, completion: 98, rating: 'B', gradeClass: 'b' },
  100: { tier: 'Braking Control · Clean apex entry line', lap: 36.8, speed: 182, completion: 100, rating: 'B+', gradeClass: 'b' },
  250: { tier: 'Corner Carver · High-speed apex line', lap: 32.1, speed: 204, completion: 100, rating: 'A', gradeClass: 'a' },
  500: { tier: 'Racing Line Master · Momentum preservation', lap: 29.5, speed: 222, completion: 100, rating: 'A+', gradeClass: 'a' },
  1000: { tier: 'Grand Prix Champion · Precision slipstream', lap: 27.4, speed: 236, completion: 100, rating: 'S', gradeClass: 's' },
  2000: { tier: 'Hyper Evolved · Millimeter kerb clipping', lap: 25.2, speed: 246, completion: 100, rating: 'S+', gradeClass: 's' },
  5000: { tier: 'Apex Predator · Theoretical physics limit', lap: 23.8, speed: 254, completion: 100, rating: 'SS', gradeClass: 'ss' },
  10000: { tier: 'Grandmaster Elite · Pixel-perfect apex clip', lap: 22.9, speed: 258, completion: 100, rating: 'SSS', gradeClass: 'sss' },
  20000: { tier: 'Neural Singularity · Micro-slip vector mastery', lap: 22.1, speed: 262, completion: 100, rating: 'EX', gradeClass: 'ex' },
  50000: { tier: 'Quantum Instinct · Telemetric aerodynamic lock', lap: 21.4, speed: 266, completion: 100, rating: 'EX+', gradeClass: 'ex' },
  100000: { tier: 'Absolute Pinnacle · Zero-entropy racing god', lap: 20.8, speed: 270, completion: 100, rating: 'GOD', gradeClass: 'god' },
};

function getGenMeta(g) {
  const isLive = g === 'live' || g === userHighestGen || (activePresetGen === null && g === sim.generation);
  if (isLive) {
    const bestLap = sim.bestLapEver && Number.isFinite(sim.bestLapEver) ? +sim.bestLapEver.toFixed(2) : null;
    return {
      name: `Live (Gen ${userHighestGen})`,
      genLabel: formatGenLabel(userHighestGen),
      isLive: true,
      tier: 'Active real-time neural evolution model',
      lap: bestLap,
      speed: sim.allTimeBest ? 245 : 210,
      completion: 100,
      rating: 'LIVE',
      gradeClass: 'live',
    };
  }
  const preset = PRESET_BRAINS[g];
  const benchmark = GEN_BENCHMARK_META[g] || {
    tier: 'Custom Milestone Model',
    lap: null,
    speed: 200,
    completion: 100,
    rating: 'A',
    gradeClass: 'a',
  };
  const lap = preset?.bestLap ? preset.bestLap : benchmark.lap;
  return {
    name: formatGenLabel(g),
    genLabel: formatGenLabel(g),
    isLive: false,
    tier: benchmark.tier,
    lap: lap,
    speed: benchmark.speed,
    completion: benchmark.completion,
    rating: benchmark.rating,
    gradeClass: benchmark.gradeClass,
  };
}

export function openGenCompareModal() {
  const backdrop = $('gen-compare-backdrop');
  if (!backdrop) return;
  renderCompareMatrixTable();
  backdrop.hidden = false;
}

export function closeGenCompareModal() {
  const backdrop = $('gen-compare-backdrop');
  if (backdrop) backdrop.hidden = true;
}

function renderCompareMatrixTable() {
  const tbody = $('compare-matrix-tbody');
  const summaryEl = $('compare-selected-summary');
  const badgeEl = $('compare-selected-badge');
  const startBtn = $('btn-start-showdown');
  if (!tbody) return;

  const highestGen = Math.max(userHighestGen, 1);
  const isPresetMatch = PRESET_MILESTONES.includes(highestGen);

  const allGens = [];
  let currentInserted = false;

  for (const m of PRESET_MILESTONES) {
    if (!currentInserted && !isPresetMatch && highestGen < m) {
      allGens.push(highestGen);
      currentInserted = true;
    }
    allGens.push(m);
  }
  if (!currentInserted && !isPresetMatch) {
    allGens.push(highestGen);
  }

  const selectedCount = compareSelectedGens.size;
  const carsPerGen = selectedCount > 0 ? Math.floor(Math.min(80, Math.max(20, selectedCount * 10)) / selectedCount) : 0;
  const totalCars = carsPerGen * selectedCount;

  if (summaryEl) {
    summaryEl.textContent = `${totalCars} Cars on Grid · ${carsPerGen} per era`;
  }
  if (badgeEl) {
    badgeEl.textContent = `${selectedCount} ERAS`;
  }
  if (startBtn) {
    startBtn.disabled = selectedCount < 2;
  }

  let html = '';
  for (const g of allGens) {
    const isChecked = compareSelectedGens.has(g);
    const meta = getGenMeta(g);
    const lapDisplay = meta.lap ? `${Number(meta.lap).toFixed(2)}<span class="matrix-unit">s</span>` : `<span class="matrix-na">–</span>`;
    const speedDisplay = `${meta.speed}<span class="matrix-unit">km/h</span>`;
    const completionDisplay = `${meta.completion}<span class="matrix-unit">%</span>`;

    html += `
      <tr class="compare-row ${isChecked ? 'is-selected' : ''} ${meta.isLive ? 'is-live-row' : ''}" data-gen="${g}">
        <td class="td-select">
          <label class="matrix-chk-label">
            <input type="checkbox" ${isChecked ? 'checked' : ''} data-gen="${g}">
          </label>
        </td>
        <td class="td-gen">
          <div class="gen-name-wrap">
            <span class="gen-title-code">${meta.genLabel}</span>
            ${meta.isLive ? '<span class="gen-live-pill"><span class="chip-dot"></span>LIVE</span>' : ''}
          </div>
        </td>
        <td class="td-tier">
          <span class="gen-tier-desc">${meta.tier}</span>
        </td>
        <td class="td-lap">
          <span class="matrix-val ${meta.lap && meta.lap < 12 ? 'is-record-lap' : ''}">${lapDisplay}</span>
        </td>
        <td class="td-speed">
          <span class="matrix-val">${speedDisplay}</span>
        </td>
        <td class="td-completion">
          <span class="matrix-val">${completionDisplay}</span>
        </td>
        <td class="td-rating">
          <span class="matrix-grade-badge grade-${meta.gradeClass}">${meta.rating}</span>
        </td>
      </tr>
    `;
  }

  tbody.innerHTML = html;

  // Clicking anywhere on a table row toggles the era selection
  tbody.querySelectorAll('.compare-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      const g = Number(row.getAttribute('data-gen'));
      if (compareSelectedGens.has(g)) {
        if (compareSelectedGens.size > 2) {
          compareSelectedGens.delete(g);
        } else {
          toast('⚠️ Need at least 2 generations for showdown', 'info');
          return;
        }
      } else {
        compareSelectedGens.add(g);
      }
      renderCompareMatrixTable();
    });
  });

  tbody.querySelectorAll('input[type="checkbox"]').forEach((chk) => {
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    chk.addEventListener('change', (e) => {
      const g = Number(chk.getAttribute('data-gen'));
      if (chk.checked) {
        compareSelectedGens.add(g);
      } else {
        if (compareSelectedGens.size > 2) {
          compareSelectedGens.delete(g);
        } else {
          chk.checked = true;
          toast('⚠️ Need at least 2 generations for showdown', 'info');
          return;
        }
      }
      renderCompareMatrixTable();
    });
  });
}

export function startMultiGenBattle(selectedGens) {
  if (!selectedGens || selectedGens.length < 2) {
    toast('⚠️ Please select at least 2 generations to compare & battle', 'warning');
    return;
  }

  isMultiGenBattle = true;
  activePresetGen = null;
  closeGenCompareModal();

  const totalCars = Math.min(80, Math.max(20, selectedGens.length * 10));
  const carsPerGen = Math.floor(totalCars / selectedGens.length);

  const genomes = [];
  const metaList = [];

  selectedGens.forEach((g, gIdx) => {
    let baseGenome = null;
    if (g === 'live' || g === userHighestGen || g === sim.generation) {
      baseGenome = userLiveStateSnapshot?.allTimeBest?.genome || sim.allTimeBest?.genome || (sim.cars && sim.cars[0]?.brain?.genome);
    }
    if (!baseGenome) {
      const p = PRESET_BRAINS[g];
      baseGenome = p ? p.genome : null;
    }
    if (!baseGenome) {
      baseGenome = NeuralNetwork.randomGenome(CONFIG.nn.layers);
    }

    const teamIdx = (gIdx * 3 + 1) % 20; // Distinct vivid livery for each generation
    const genLabel = formatGenLabel(g === 'live' ? userHighestGen : g);

    for (let c = 0; c < carsPerGen; c++) {
      const carGenome = Float32Array.from(baseGenome);
      if (c > 0) {
        for (let w = 0; w < carGenome.length; w++) {
          if (Math.random() < 0.08) carGenome[w] += (Math.random() * 2 - 1) * 0.05;
        }
      }
      genomes.push(carGenome);
      metaList.push({
        genTag: g,
        genLabel: genLabel,
        teamIdx: teamIdx,
      });
    }
  });

  leaderboard.reset();
  sim.startGeneration(genomes, metaList);

  const compareBtn = $('btn-compare-gens');
  if (compareBtn) compareBtn.classList.add('active');

  const names = selectedGens.map((g) => formatGenLabel(g === 'live' ? userHighestGen : g)).join(' vs ');
  toast(`⚔️ Multi-Gen Showdown Launched: ${names}`, 'success');
  audio.playSuccess();
  renderGenPresetsRibbon();
}

// Wire up Comparison Modal controls
$('btn-compare-gens')?.addEventListener('click', (e) => {
  e.stopPropagation();
  openGenCompareModal();
});
$('btn-close-compare')?.addEventListener('click', closeGenCompareModal);
$('btn-cancel-compare')?.addEventListener('click', closeGenCompareModal);
$('gen-compare-backdrop')?.addEventListener('click', (e) => {
  if (e.target === $('gen-compare-backdrop')) closeGenCompareModal();
});

$('btn-start-showdown')?.addEventListener('click', () => {
  const sortedGens = Array.from(compareSelectedGens).sort((a, b) => a - b);
  startMultiGenBattle(sortedGens);
});

// Quick Matchup Buttons
$('btn-matchup-all')?.addEventListener('click', () => {
  compareSelectedGens = new Set([1, 10, 100, 500, 1000, 5000]);
  renderCompareMatrixTable();
});
$('btn-matchup-rookie')?.addEventListener('click', () => {
  compareSelectedGens = new Set([1, 100000]);
  renderCompareMatrixTable();
});
$('btn-matchup-champs')?.addEventListener('click', () => {
  compareSelectedGens = new Set([1000, 5000, 10000, 50000, 100000]);
  renderCompareMatrixTable();
});
$('btn-matchup-live')?.addEventListener('click', () => {
  compareSelectedGens = new Set([userHighestGen, 10000, 100000]);
  renderCompareMatrixTable();
});

function formatGenLabel(g) {
  if (g >= 1000) {
    const k = g / 1000;
    return `Gen ${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return `Gen ${g}`;
}

function getPresetTier(gen) {
  if (gen >= 100000) return 'Absolute Pinnacle';
  if (gen >= 50000) return 'Quantum Instinct';
  if (gen >= 20000) return 'Neural Singularity';
  if (gen >= 10000) return 'Grandmaster Elite';
  if (gen >= 5000) return 'Ultimate Apex';
  if (gen >= 2000) return 'Grand Master';
  if (gen >= 1000) return 'Titan Master';
  if (gen >= 500) return 'Apex Champion';
  if (gen >= 250) return 'Veteran Pro';
  if (gen >= 100) return 'Track Master';
  if (gen >= 50) return 'Experienced';
  if (gen >= 10) return 'Intermediate';
  if (gen >= 5) return 'Learning';
  if (gen >= 2) return 'Toddler';
  return 'Random Explorer';
}

const btnGenDial = $('btn-gen-dial');
const genDialPopover = $('gen-dial-popover');

export function setGenDialPopoverOpen(open) {
  if (!genDialPopover) return;
  genDialPopover.hidden = !open;
  btnGenDial?.setAttribute('aria-expanded', String(open));
  btnGenDial?.classList.toggle('is-active', open);
}

if (btnGenDial) {
  btnGenDial.addEventListener('click', (e) => {
    e.stopPropagation();
    const isCurrentlyHidden = genDialPopover ? genDialPopover.hidden : true;
    setGenDialPopoverOpen(isCurrentlyHidden);
  });
}

document.addEventListener('click', (e) => {
  const widget = $('gen-dial-widget');
  if (widget && !widget.contains(e.target)) {
    setGenDialPopoverOpen(false);
  }
});

export function loadGenerationPreset(g) {
  // If user was in live mode before selecting another preset, capture their live state
  if (!activePresetGen && !isMultiGenBattle && sim) {
    updateHighestGenAndLiveSnapshot();
  }

  // If user chooses their highest tested generation or an unrecognized preset -> Resume Live Training!
  if (g === userHighestGen || !PRESET_BRAINS[g]) {
    activePresetGen = null;
    isMultiGenBattle = false;
    const compareBtn = $('btn-compare-gens');
    if (compareBtn) compareBtn.classList.remove('active');

    sim.generation = userHighestGen;
    if (userLiveStateSnapshot) {
      if (userLiveStateSnapshot.bestLapEver) sim.bestLapEver = userLiveStateSnapshot.bestLapEver;
      if (userLiveStateSnapshot.history) sim.history = [...userLiveStateSnapshot.history];
      if (userLiveStateSnapshot.allTimeBest) sim.allTimeBest = userLiveStateSnapshot.allTimeBest;
      if (userLiveStateSnapshot.genomes && userLiveStateSnapshot.genomes.length) {
        sim.startGeneration(userLiveStateSnapshot.genomes);
      } else {
        sim.startGeneration();
      }
    } else {
      const bestBrain = storage.loadBrain(LAYERS);
      if (bestBrain?.genome) {
        sim.startGeneration(sim.cars.map(() => Array.from(bestBrain.genome)));
      } else {
        sim.startGeneration();
      }
    }

    leaderboard.reset();
    refreshSavedInfo();
    updateHubAnalytics();
    audio.playSuccess();
    renderGenPresetsRibbon();
    toast(`⚡ Resumed Highest Tested Gen ${formatGenLabel(userHighestGen)}`, 'success');
    return;
  }

  // Load selected milestone preset
  const preset = PRESET_BRAINS[g];
  isMultiGenBattle = false;
  const compareBtn = $('btn-compare-gens');
  if (compareBtn) compareBtn.classList.remove('active');

  activePresetGen = g;
  const layers = preset.layers || CONFIG.nn.layers;
  const genome = preset.genome;

  // Immediately seed the population with the selected preset brain genome
  sim.generation = g;
  if (preset.bestLap && Number.isFinite(preset.bestLap)) {
    sim.bestLapEver = preset.bestLap;
  }
  leaderboard.reset();
  sim.startGeneration(sim.cars.map(() => Array.from(genome)));

  refreshSavedInfo();
  updateHubAnalytics();
  audio.playSuccess();

  const fitStr = preset.fitness ? ` · Fit ${compact(preset.fitness)}` : '';
  const lapStr = preset.bestLap ? ` · Lap ${preset.bestLap}s` : '';
  toast(`⚡ Loaded Gen ${formatGenLabel(g)} Preset${fitStr}${lapStr}`, 'success');

  renderGenPresetsRibbon();
}

export function renderGenPresetsRibbon() {
  const container = $('gen-presets-track');
  const activeLabelEl = $('gen-dial-active-label');

  const highestGen = Math.max(userHighestGen, 1);
  const isPresetMatch = PRESET_MILESTONES.includes(highestGen);

  // Build the list of chips: milestone presets + user's highest tested Gen placed in between
  const chips = [];
  let currentInserted = false;

  for (const m of PRESET_MILESTONES) {
    if (!currentInserted && !isPresetMatch && highestGen < m) {
      chips.push({ gen: highestGen, isHighestLive: true });
      currentInserted = true;
    }
    chips.push({ gen: m, isHighestLive: isPresetMatch && m === highestGen });
  }
  if (!currentInserted && !isPresetMatch) {
    chips.push({ gen: highestGen, isHighestLive: true });
  }

  // Update active label on Dial Menu Trigger Button
  if (activeLabelEl) {
    if (isMultiGenBattle) {
      activeLabelEl.innerHTML = `<span style="color:#f59e0b">⚔️ Showdown</span>`;
    } else if (activePresetGen !== null) {
      const meta = getGenMeta(activePresetGen);
      activeLabelEl.innerHTML = `<span>${formatGenLabel(activePresetGen)}</span> <span class="matrix-grade-badge grade-${meta.gradeClass}">${meta.rating}</span>`;
    } else {
      const liveNum = highestGen >= 1000 ? `${(highestGen / 1000) % 1 === 0 ? highestGen / 1000 : (highestGen / 1000).toFixed(1)}k` : `${highestGen}`;
      activeLabelEl.innerHTML = `<span class="chip-dot"></span><span>Live ${liveNum}</span> <span class="chip-badge">ACTIVE</span>`;
    }
  }

  if (!container) return;

  let html = '';
  for (const chip of chips) {
    const isHighest = chip.isHighestLive;
    const isSelected = !isMultiGenBattle && (activePresetGen === chip.gen || (activePresetGen === null && isHighest));
    const label = formatGenLabel(chip.gen);
    const preset = PRESET_BRAINS[chip.gen];
    const meta = getGenMeta(chip.gen);
    const bestLap = (isHighest && sim?.bestLapEver) ? `${sim.bestLapEver.toFixed(1)}s` : (preset?.bestLap ? `${preset.bestLap}s` : (meta.lap ? `${meta.lap}s` : null));
    const tier = isHighest ? 'Highest Real-time Trained' : (meta.tier || getPresetTier(chip.gen));

    html += `
      <button class="gen-dial-item ${isSelected ? 'active' : ''} ${isHighest ? 'is-live' : ''}" data-gen="${chip.gen}" type="button" title="${isHighest ? `Your live highest trained model (${chip.gen})` : `Load Pretrained Gen ${chip.gen} (${meta.rating})`}">
        <div class="gen-dial-item-main">
          <div class="gen-dial-item-head">
            ${isHighest ? '<span class="chip-dot"></span>' : ''}
            <span class="gen-dial-item-title">${label}</span>
            <span class="matrix-grade-badge grade-${meta.gradeClass}">${meta.rating}</span>
            ${isHighest ? '<span class="gen-dial-item-live-badge">LIVE</span>' : ''}
          </div>
          <span class="gen-dial-item-tier">${tier}</span>
        </div>
        <div class="gen-dial-item-metric">
          ${bestLap ? `<span class="gen-dial-item-lap">${bestLap}</span>` : ''}
          ${isSelected ? `<svg class="gen-dial-check" viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>` : ''}
        </div>
      </button>
    `;
  }

  container.innerHTML = html;

  container.querySelectorAll('.gen-dial-item').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const g = Number(btn.getAttribute('data-gen'));
      loadGenerationPreset(g);
      setGenDialPopoverOpen(false);
    });
  });
}

// ---------- HUD ----------
function updateHud(leader) {
  const isRaceMode = sim.mode === 'race';
  const pop = isRaceMode ? 20 : CONFIG.ga.population;
  const setTxt = (id, val) => {
    const el = $(id);
    if (el) el.textContent = val;
  };

  if (lastRibbonCurrentGen !== sim.generation) {
    lastRibbonCurrentGen = sim.generation;
    renderGenPresetsRibbon();
  }

  setTxt('pill-pop', pop);
  setTxt('hud-gen', sim.generation);
  const maxLaps = CONFIG.generation?.maxLaps || 5;
  const currentLap = sim.leader ? Math.min(sim.leader.laps + 1, maxLaps) : 1;
  setTxt('hud-lap', `${currentLap}/${maxLaps}`);
  setTxt('hud-alive', sim.aliveCount);
  const curGenLap = sim.currentGenBestLap;
  setTxt('hud-best-lap', Number.isFinite(curGenLap) ? fmtTime(curGenLap) : fmtTime(sim.time));
  setTxt('hud-fps', currentFps);
  const tf = $('hud-timer-fill');
  if (tf) tf.style.width = `${(sim.time / CONFIG.generation.timeLimit) * 100}%`;

  setTxt('stat-generation', sim.generation);
  setTxt('stat-alive', `${sim.aliveCount}/${pop}`);
  setTxt('stat-best-fitness', compact(sim.allTimeBest?.fitness));
  setTxt('stat-best-lap', fmtTime(sim.bestLapEver));
  setTxt('stat-gen-best', compact(sim.genBestFitness));
  setTxt('stat-fps', currentFps);
  setTxt('stat-effective', `×${effSpeed < 10 ? effSpeed.toFixed(1) : effSpeed.toFixed(0)}`);

  // Top-Center Semi-Transparent Ghost Mode 30s Countdown Timer (Integer Seconds)
  const ghostPill = $('ghost-timer-pill');
  const ghostTitle = $('ghost-timer-title');
  const ghostVal = $('ghost-timer-value');
  const colConfig = CONFIG.collision || {};
  const warmup = colConfig.warmupTime || 30;
  const remainingGhost = Math.max(0, warmup - sim.time);

  if (ghostPill) {
    if (remainingGhost > 0) {
      ghostPill.classList.remove('hidden', 'active-contact');
      ghostPill.classList.toggle('urgent', remainingGhost <= 5.0);
      if (ghostTitle) ghostTitle.textContent = remainingGhost <= 5.0 ? 'GHOST EXPIRING' : 'GHOST MODE';
      if (ghostVal) ghostVal.textContent = Math.ceil(remainingGhost) + 's';
    } else if (sim.time < warmup + 3.0) {
      // 3-second grace transition showing CONTACTS ACTIVE before fading out
      ghostPill.classList.remove('hidden', 'urgent');
      ghostPill.classList.add('active-contact');
      if (ghostTitle) ghostTitle.textContent = 'CONTACTS ACTIVE';
      if (ghostVal) ghostVal.textContent = 'ON';
    } else {
      // Gracefully fade out once contact physics are active
      ghostPill.classList.add('hidden');
    }
  }

  // Toast notification when collisions activate at 30s
  if (sim.time >= warmup && !prevCollisionActive) {
    prevCollisionActive = true;
    toast('⚠️ 30s Reached: Collision Avoidance & Contact Physics ACTIVE!', 'warning');
  }

  const car = (state.manual && sim.player && (sim.player.alive || sim.player.finished))
    ? sim.player
    : (leader && (leader.alive || leader.finished) ? leader : (sim.leader || null));
  $('leader-dot')?.classList.toggle('player', state.manual);
  if (car) {
    setTxt('leader-speed', car.speed.toFixed(0));

    const contacts = car.contacts || 0;
    const penaltyVal = car.collisionPenalty ? Math.round(car.collisionPenalty) : contacts * 180;
    setTxt('stat-leader-contacts', contacts === 0 ? '0 (Clean ✨)' : `${contacts} (-${penaltyVal} pts)`);

    // Compute current rank for telemetry display via fast O(N) scan without sorting/allocations
    let rank = 1;
    if (sim && sim.cars) {
      for (let i = 0; i < sim.cars.length; i++) {
        const other = sim.cars[i];
        if (!other || !other.alive || other.crashed || other === car) continue;
        if (other.finished !== car.finished) {
          if (other.finished) rank++;
        } else if (other.laps !== car.laps) {
          if (other.laps > car.laps) rank++;
        } else if (other.totalIdx > car.totalIdx) {
          rank++;
        }
      }
      if (sim.player && sim.player.alive && !sim.player.crashed && sim.player !== car) {
        const other = sim.player;
        if (other.finished !== car.finished) {
          if (other.finished) rank++;
        } else if (other.laps !== car.laps) {
          if (other.laps > car.laps) rank++;
        } else if (other.totalIdx > car.totalIdx) {
          rank++;
        }
      }
    }
    const isPlayerCar = car === sim.player;
    const badgeEl = $('leader-pos-badge');
    if (badgeEl) {
      badgeEl.textContent = `P.${rank}`;
      badgeEl.className = `pos-badge ${
        isPlayerCar ? 'is-player' : (rank === 1 ? 'pos-p1' : rank === 2 ? 'pos-p2' : rank === 3 ? 'pos-p3' : 'pos-field')
      }`;
    }

    // Car Decal Number & Team Livery Side View
    const carIdx = (sim.cars && car) ? sim.cars.indexOf(car) : 0;
    const carNum = isPlayerCar ? 7 : (car.carNumber || (typeof car.gridSlot === 'number' ? car.gridSlot + 1 : (carIdx >= 0 ? carIdx + 1 : 1)));
    const teamIdx = isPlayerCar ? 1 : (car.teamIdx !== undefined ? car.teamIdx : (carIdx >= 0 ? carIdx % (TEAM_PALETTE?.length || 10) : 0));

    const numBadgeEl = $('leader-number-badge');
    if (numBadgeEl) {
      numBadgeEl.textContent = `#${carNum}`;
      numBadgeEl.className = `car-number-badge ${isPlayerCar ? 'is-player' : ''}`;
    }

    const previewEl = $('cockpit-car-preview');
    if (previewEl) {
      const previewKey = `${isPlayerCar ? 'p' : 'c'}_${teamIdx}_${carNum}`;
      if (previewEl.dataset.key !== previewKey) {
        previewEl.dataset.key = previewKey;
        previewEl.innerHTML = generateCarSideviewSvg(teamIdx, isPlayerCar, carNum);
      }
    }
  } else {
    const badgeEl = $('leader-pos-badge');
    if (badgeEl) {
      badgeEl.textContent = 'P.1';
      badgeEl.className = 'pos-badge pos-p1';
    }
    const numBadgeEl = $('leader-number-badge');
    if (numBadgeEl) {
      numBadgeEl.textContent = '#1';
      numBadgeEl.className = 'car-number-badge';
    }
    const previewEl = $('cockpit-car-preview');
    if (previewEl && previewEl.dataset.key !== 'default') {
      previewEl.dataset.key = 'default';
      previewEl.innerHTML = generateCarSideviewSvg(0, false, 1);
    }
    setTxt('stat-leader-contacts', '0 (Clean ✨)');
  }
  if (state.manual) setTxt('player-best-lap', fmtTime(sim.playerBestLap));
}

// Smooth 60fps cockpit animation states & cached DOM elements
let smoothSteer = 0;
let smoothBrake = 0;
let smoothGas = 0;
const elCockpitWheel = $('cockpit-wheel');
const elPedalBrakeFill = $('pedal-brake-fill');
const elPedalGasFill = $('pedal-gas-fill');

function updateCockpitAnimation(focusCar) {
  const car = (state.manual && sim.player && (sim.player.alive || sim.player.finished))
    ? sim.player
    : (focusCar && (focusCar.alive || focusCar.finished) ? focusCar : (sim.leader || null));
  if (!car) return;

  const targetSteer = car.steer || 0;
  const targetBrake = Math.max(0, -car.throttle);
  const targetGas = Math.max(0, car.throttle);

  // Responsive, butter-smooth 60fps exponential smoothing
  const k = 0.18;
  smoothSteer += (targetSteer - smoothSteer) * k;
  smoothBrake += (targetBrake - smoothBrake) * k;
  smoothGas += (targetGas - smoothGas) * k;

  const steerDeg = smoothSteer * 58;
  if (elCockpitWheel) {
    elCockpitWheel.style.transform = `rotate(${steerDeg.toFixed(1)}deg)`;
  }

  if (elPedalBrakeFill) elPedalBrakeFill.style.height = `${(smoothBrake * 100).toFixed(1)}%`;
  if (elPedalGasFill) elPedalGasFill.style.height = `${(smoothGas * 100).toFixed(1)}%`;
}

// ---------- Main loop ----------
let last = performance.now();
let acc = 0;
let stepCounter = 0;
let rateStart = last;
let effSpeed = 1;
let hudTimer = 0;
let leaderboardTimer = 0;
let frameCount = 0;
let fpsTimer = last;
let currentFps = 60;

function frame(now) {
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (hyperRunning) {
    frameActive = false;
    return;
  }
  frameActive = true;

  sim.playerControls.steer = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  sim.playerControls.throttle = keys.ArrowUp ? 1 : keys.ArrowDown ? -1 : 0;

  if (!state.paused) {
    const t0 = performance.now();
    if (state.turbo) {
      do {
        for (let k = 0; k < 10; k++) sim.step(CONFIG.dt);
        stepCounter += 10;
      } while (performance.now() - t0 < CONFIG.budgetMs);
    } else {
      const PLAYBACK_SPEED_FACTOR = 0.70; // Calibrated playback speed: keeps simulation physics equations intact while giving readable, comfortable race pacing
      const simSpeed = (state.manual ? 1.0 : state.speed) * PLAYBACK_SPEED_FACTOR;
      if (simSpeed <= 1.0) {
        // Continuous, frame-synced physics (smooth per-frame step)
        sim.step(CONFIG.dt * simSpeed);
        stepCounter++;
      } else {
        // Uniform sub-stepping for speed multipliers (>1x)
        const subSteps = Math.min(6, Math.max(1, Math.round(simSpeed)));
        const subDt = (CONFIG.dt * simSpeed) / subSteps;
        for (let s = 0; s < subSteps; s++) {
          sim.step(subDt);
          stepCounter++;
        }
      }
    }
  }

  const bestCar = sim.bestLapCar;
  const activeFocus = (focusedFollowCar && (focusedFollowCar.alive || focusedFollowCar.finished))
    ? focusedFollowCar
    : ((sim.time < 3.5 && bestCar && (bestCar.alive || bestCar.finished) && !bestCar.crashed)
      ? bestCar
      : sim.leader);

  if (state.view3d && renderer3d) {
    renderer3d.render(sim, state, activeFocus);
  } else {
    renderer.render(sim, state, activeFocus);
  }

  // Derive the active car in focus (from 3D director, 2D follower, or manual player)
  const currentFocus = (state.manual && sim.player && (sim.player.alive || sim.player.finished))
    ? sim.player
    : (state.view3d && renderer3d?.focusedCar && (renderer3d.focusedCar.alive || renderer3d.focusedCar.finished))
      ? renderer3d.focusedCar
      : ((renderer?.focusedCar && (renderer.focusedCar.alive || renderer.focusedCar.finished)) ? renderer.focusedCar : activeFocus);

  // Real-time camera pill status (displays active shot and green auto-director icon)
  updateCameraPill();

  // Update F1 Live Leaderboard Tower with smooth overtake animations (throttled to 15Hz to eliminate layout reflows)
  if (now - leaderboardTimer >= 66) {
    leaderboard.update(sim, currentFocus);
    leaderboardTimer = now;
  }

  // Update Spatial Car Audio Engine (engine pitch, spatial panning, distance attenuation, skids)
  audio.update(sim, state, currentFocus, renderer3d, renderer);

  if (panelEl?.classList.contains('is-open')) {
    nnViz.draw(currentFocus?.brain ?? null);
  }
  if (hyperModal && !hyperModal.hidden && currentHubTab === 'analytics') {
    hubNnViz?.draw(currentFocus?.brain ?? null);
  }

  // FPS calculation
  frameCount++;
  if (now - fpsTimer >= 400) {
    currentFps = Math.round((frameCount * 1000) / (now - fpsTimer));
    frameCount = 0;
    fpsTimer = now;
    const pillFps = $('pill-fps');
    if (pillFps) pillFps.textContent = currentFps;
    const hudFps = $('hud-fps');
    if (hudFps) hudFps.textContent = currentFps;
    const statFps = $('stat-fps');
    if (statFps) statFps.textContent = currentFps;
  }

  if (now - rateStart >= 500) {
    effSpeed = (stepCounter * CONFIG.dt) / ((now - rateStart) / 1000);
    stepCounter = 0;
    rateStart = now;
  }
  // 60FPS smooth continuous cockpit telemetry animation following the car in focus
  updateCockpitAnimation(currentFocus);

  if (now - hudTimer > 80) {
    updateHud(currentFocus);
    hudTimer = now;
  }
  requestAnimationFrame(frame);
}

// ---------- Startup UI sync ----------
if (savedState && (sim.generation > 1 || sim.allTimeBest || sim.history.length > 0)) {
  toast(`Resumed training from Generation ${sim.generation} 🏁`, 'success');
}

setSliderFill(speedSlider);
setSliderFill(mutSlider);
refreshSavedInfo();
updateStatus();
setCameraPreset(state.cameraPreset, false);
renderGenPresetsRibbon();
updateHud(sim.leader);
chart.draw(sim.history, sim.bestLapEver);
requestAnimationFrame(frame);
