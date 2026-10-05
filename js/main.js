import { CONFIG } from './config.js';
import { Track, TRACK_PRESETS } from './track.js';
import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { Renderer3D } from './renderer3d.js';
import { NetworkViz } from './networkViz.js';
import { FitnessChart, compact } from './chart.js';
import { LeaderboardTower } from './leaderboard.js';
import { EliminationModalManager } from './eliminationModal.js';
import { audio } from './audio.js';
import * as storage from './storage.js';

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
  storage.loadPretrainedBrain(initialPreset, LAYERS).then((pretrained) => {
    if (pretrained && sim.generation === 1 && sim.history.length === 0) {
      sim.seedFrom(pretrained.genome);
      refreshSavedInfo();
    }
  });
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

sim.onCarEliminated = (car, reason) => {
  eliminationModals.show(car, sim, reason);
  const camPos = (state.view3d && renderer3d && renderer3d.camera)
    ? renderer3d.camera.position
    : { x: car.x, y: car.y, z: 300 };
  audio.playImpact(car.x, car.y, camPos, car.speed);
};

sim.onCarDeath = (car) => {
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
  $('saved-info').innerHTML = data
    ? `🏆 Peak Champion from <strong>Gen ${data.generation}</strong><br>` +
      `Fitness <strong>${compact(data.fitness)}</strong> · Best lap <strong>${fmtTime(data.bestLap)}</strong><br>` +
      `<span style="color:var(--text-muted); font-size:11px;">Active Session: Gen ${curGen} · Auto-saved ${timeAgo(data.savedAt)}</span>`
    : `Active: Gen <strong>${curGen}</strong><br><span style="color:var(--text-muted); font-size:11px;">No champion saved yet. Auto-saves when a new fitness record is set.</span>`;
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
  chart.draw(sim.history);
  if (renderer) {
    renderer.cam = null;
  }
  persistState();
};

sim.onNewBest = (best) => {
  pulse('stat-best-fitness-box');
  persistState();
};

sim.onNewBestLap = () => {
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
  chart.draw(sim.history);
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
  chart.draw(sim.history);
  hyperChart?.draw(sim.history);
  updateHud(sim.leader);
  const lapStr = data.bestLap && Number.isFinite(data.bestLap) ? ` (${data.bestLap.toFixed(2)}s lap)` : '';
  toast(`Population seeded from ${data.generation ? 'Gen ' + data.generation : 'Champion'} brain${lapStr}`, 'success');
});

$('btn-export').addEventListener('click', () => {
  const best = sim.allTimeBest ?? storage.loadBrain(LAYERS) ?? (sim.leader ? {
    genome: sim.leader.brain.genome,
    fitness: sim.leader.fitness,
    generation: sim.generation,
    bestLap: sim.leader.bestLap,
  } : null);
  if (!best) return toast('Nothing to export yet. Let a generation finish first', 'error');
  storage.exportBrain(best, LAYERS);
  toast(`Brain exported as JSON (Gen ${best.generation || sim.generation})`, 'success');
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
    chart.draw(sim.history);
    hyperChart?.draw(sim.history);
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
    storage.saveTrainingState(sim, LAYERS, $('track-select')?.value || 'grand-prix', true);
    chart.draw(sim.history);
    hyperChart?.draw(sim.history);
    refreshSavedInfo();
    updateHud(sim.leader);

    if (fromRunningModal && hyperModal && !hyperModal.hidden) {
      hyperStartGen = 1;
      hyperStartTime = performance.now();
      if (hyperMode === 'gens') {
        const count = Math.max(1, Math.min(10000, Number(hyperTargetInput?.value) || 50));
        hyperGenGoal = 1 + count;
        const targetInfo = $('hyper-target-info');
        if (targetInfo) {
          targetInfo.innerHTML = `Gen <strong id="hyper-cur-gen">1</strong> / <span>${hyperGenGoal}</span> (+${count} gens)`;
        }
      }
      hyperRunning = true;
      runHyperBatch();
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

// Keyboard
window.addEventListener('keydown', (e) => {
  if (e.target instanceof HTMLInputElement && e.target.type !== 'checkbox' && e.target.type !== 'range') return;
  if (e.key in keys) {
    keys[e.key] = true;
    if (state.manual) e.preventDefault();
    return;
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
      leaderboard.toggleCollapse();
      toast(leaderboard.isCollapsed ? 'Leaderboard collapsed' : 'Leaderboard expanded');
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
  if (hyperChart) hyperChart.resize();
});
ro.observe($('stage'));
ro.observe($('nn-canvas'));
ro.observe($('chart-canvas'));

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

function openHyperModal() {
  if (!hyperModal) return;
  hyperModal.hidden = false;
  if (!hyperRunning) {
    if (hyperSetupView) hyperSetupView.hidden = false;
    if (hyperRunningView) hyperRunningView.hidden = true;
  }
}

function closeHyperModal() {
  if (hyperRunning) {
    stopHyperTraining();
  }
  if (hyperModal) hyperModal.hidden = true;
}

$('btn-fast-forward')?.addEventListener('click', openHyperModal);
$('btn-hyper-train')?.addEventListener('click', openHyperModal);
$('btn-hyper-close')?.addEventListener('click', closeHyperModal);

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

function startHyperTraining() {
  hyperRunning = true;
  hyperStartGen = sim.generation;
  hyperStartTime = performance.now();

  const targetInfo = $('hyper-target-info');

  if (hyperMode === 'gens') {
    const count = Math.max(1, Math.min(10000, Number(hyperTargetInput?.value) || 50));
    hyperGenGoal = hyperStartGen + count;
    if (targetInfo) {
      targetInfo.innerHTML = `Gen <strong id="hyper-cur-gen">${sim.generation}</strong> / <span>${hyperGenGoal}</span> (+${count} gens)`;
    }
  } else {
    hyperDurationGoalMs = getTargetDurationMs();
    const durationFmt = fmtDuration(hyperDurationGoalMs / 1000);
    if (targetInfo) {
      targetInfo.innerHTML = `Gen <strong id="hyper-cur-gen">${sim.generation}</strong> · Target: <span>${durationFmt}</span>`;
    }
  }

  if (hyperSetupView) hyperSetupView.hidden = true;
  if (hyperRunningView) hyperRunningView.hidden = false;

  if (!hyperChart && $('hyper-chart-canvas')) {
    hyperChart = new FitnessChart($('hyper-chart-canvas'));
  }
  hyperChart?.draw(sim.history);

  runHyperBatch();
}

function runHyperBatch() {
  if (!hyperRunning) return;

  const t0 = performance.now();
  // Run tight headless physics and neural forward-passes for 28ms per time slice
  while (performance.now() - t0 < 28 && hyperRunning) {
    for (let k = 0; k < 12; k++) {
      sim.step();
      if (hyperMode === 'gens' && sim.generation >= hyperGenGoal) {
        finishHyperTraining();
        return;
      }
      if (hyperMode === 'time' && (performance.now() - hyperStartTime) >= hyperDurationGoalMs) {
        finishHyperTraining();
        return;
      }
    }
  }

  // Update modal progress and stats
  const now = performance.now();
  const elapsedMs = now - hyperStartTime;
  const elapsedSec = elapsedMs / 1000;
  const gensDone = sim.generation - hyperStartGen;
  const rate = elapsedSec > 0 ? (gensDone / elapsedSec).toFixed(1) : '0';

  let pct = 0;
  let remainingText = '–';

  if (hyperMode === 'gens') {
    const totalGens = Math.max(1, hyperGenGoal - hyperStartGen);
    pct = Math.min(100, Math.round((gensDone / totalGens) * 100));
    const genRateNum = Number(rate);
    if (genRateNum > 0 && gensDone < totalGens) {
      const remSec = (totalGens - gensDone) / genRateNum;
      remainingText = fmtDuration(remSec);
    } else {
      remainingText = '0.0s';
    }
  } else {
    pct = Math.min(100, Math.round((elapsedMs / hyperDurationGoalMs) * 100));
    const remSec = Math.max(0, (hyperDurationGoalMs - elapsedMs) / 1000);
    remainingText = fmtDuration(remSec);
  }

  const progPct = $('hyper-prog-pct');
  if (progPct) progPct.textContent = `${pct}%`;
  const curGen = $('hyper-cur-gen');
  if (curGen) curGen.textContent = sim.generation;
  const barFill = $('hyper-bar-fill');
  if (barFill) barFill.style.width = `${pct}%`;

  const lastRecord = sim.history.length ? sim.history[sim.history.length - 1] : null;

  const statTime = $('hyper-stat-time');
  if (statTime) statTime.textContent = fmtDuration(elapsedSec);
  const statRem = $('hyper-stat-rem');
  if (statRem) statRem.textContent = remainingText;
  const statRate = $('hyper-stat-rate');
  if (statRate) statRate.textContent = `${rate} gen/s`;
  const statAdded = $('hyper-stat-added');
  if (statAdded) statAdded.textContent = `+${gensDone}`;
  const statFit = $('hyper-stat-fitness');
  if (statFit) statFit.textContent = compact(sim.allTimeBest?.fitness);
  const statLap = $('hyper-stat-lap');
  if (statLap) statLap.textContent = fmtTime(sim.bestLapEver);

  // Purple line population dynamics
  const statPopAvg = $('hyper-stat-pop-avg');
  if (statPopAvg) statPopAvg.textContent = lastRecord ? compact(lastRecord.avg) : '–';

  const statPopMedian = $('hyper-stat-pop-median');
  if (statPopMedian) statPopMedian.textContent = lastRecord && lastRecord.median !== undefined ? compact(lastRecord.median) : '–';

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

  hyperChart?.draw(sim.history);

  if (hyperRunning) {
    requestAnimationFrame(runHyperBatch);
  }
}

function stopHyperTraining() {
  finishHyperTraining();
}

function finishHyperTraining() {
  const wasRunning = hyperRunning;
  hyperRunning = false;
  const elapsedSec = (performance.now() - hyperStartTime) / 1000;
  const elapsedFmt = fmtDuration(elapsedSec);
  const gensDone = sim.generation - hyperStartGen;

  persistState();
  chart.draw(sim.history);
  refreshSavedInfo();
  updateHud(sim.leader);

  if (hyperModal) hyperModal.hidden = true;
  if (wasRunning) {
    toast(`⚡ Hyper training completed: +${gensDone} generations in ${elapsedFmt}!`, 'success');
  }
}

$('btn-hyper-start')?.addEventListener('click', startHyperTraining);
$('btn-hyper-stop')?.addEventListener('click', stopHyperTraining);

// ---------- HUD ----------
function updateHud(leader) {
  const isRaceMode = sim.mode === 'race';
  const pop = isRaceMode ? 20 : CONFIG.ga.population;
  const setTxt = (id, val) => {
    const el = $(id);
    if (el) el.textContent = val;
  };

  setTxt('pill-pop', pop);
  setTxt('hud-gen', sim.generation);
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

  const car = state.manual && sim.player ? sim.player : leader;
  setTxt('leader-title', state.manual ? 'You' : 'Leader');
  $('leader-dot')?.classList.toggle('player', state.manual);
  if (car) {
    const maxLaps = CONFIG.generation.maxLaps;
    setTxt('leader-lap', state.manual
      ? `LAP ${car.laps + 1} · ${fmtTime(car.time - car.lapStart)}`
      : `LAP ${Math.min(car.laps + 1, maxLaps)}/${maxLaps}`);
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
    setTxt('leader-pos-badge', `P.${rank}`);

    const prog = Math.min(100, Math.max(0, car.lapProgress * 100));
    const pb = $('leader-progress-bar');
    if (pb) pb.style.width = `${prog}%`;
  } else {
    setTxt('leader-pos-badge', 'P.1');
    setTxt('stat-leader-contacts', '0 (Clean ✨)');
  }
  if (state.manual) setTxt('player-best-lap', fmtTime(sim.playerBestLap));
}

// Smooth 60fps cockpit animation states & cached DOM elements
let smoothSteer = 0;
let smoothBrake = 0;
let smoothGas = 0;
const elCockpitWheel = $('cockpit-wheel');
const elCockpitSteerVal = $('cockpit-steer-val');
const elPedalBrakeFill = $('pedal-brake-fill');
const elPedalGasFill = $('pedal-gas-fill');

function updateCockpitAnimation() {
  const car = state.manual && sim.player ? sim.player : sim.leader;
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
  const absDeg = Math.abs(steerDeg);
  const steerText = absDeg < 0.5 ? '0°' : steerDeg > 0 ? `R ${absDeg.toFixed(0)}°` : `L ${absDeg.toFixed(0)}°`;
  if (elCockpitSteerVal) elCockpitSteerVal.textContent = steerText;

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
let frameCount = 0;
let fpsTimer = last;
let currentFps = 60;

function frame(now) {
  const realDt = Math.min(0.05, (now - last) / 1000);
  last = now;

  if (hyperRunning) {
    requestAnimationFrame(frame);
    return;
  }

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
      const simSpeed = state.manual ? 1.0 : state.speed;
      if (simSpeed <= 1.0) {
        // Continuous, frame-synced 60Hz physics (guarantees exactly 1 smooth step per display frame)
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

  const activeFocus = (focusedFollowCar && (focusedFollowCar.alive || focusedFollowCar.finished))
    ? focusedFollowCar
    : sim.leader;

  if (state.view3d && renderer3d) {
    renderer3d.render(sim, state, activeFocus);
  } else {
    renderer.render(sim, state, activeFocus);
  }

  // Update F1 Live Leaderboard Tower with smooth overtake animations
  leaderboard.update(sim, activeFocus);

  // Update Spatial Car Audio Engine (engine pitch, spatial panning, distance attenuation, skids)
  audio.update(sim, state, activeFocus, renderer3d, renderer);

  if (panelEl?.classList.contains('is-open')) {
    nnViz.draw(activeFocus?.brain ?? null);
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
  // 60FPS smooth continuous cockpit telemetry animation
  updateCockpitAnimation();

  if (now - hudTimer > 80) {
    updateHud(activeFocus);
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
updateHud(sim.leader);
chart.draw(sim.history);
requestAnimationFrame(frame);
