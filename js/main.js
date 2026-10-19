import { CONFIG } from './config.js';
import { FixedStepClock } from './fixedStepClock.js';
import { DeferredTask } from './deferredTask.js';
import { installFrameDiagnostics } from './frameDiagnostics.js';
import { ClassAnimationScheduler } from './uiAnimations.js';
import { raceOutcomeMarkup } from './raceOutcomes.js';
import { Track, TRACK_PRESETS } from './track.js';
import { Simulation } from './simulation.js';
import { Renderer } from './renderer.js';
import { Renderer3D, TEAM_PALETTE, getCarNumber } from './renderer3d.js';
import { NetworkViz } from './networkViz.js';
import { FitnessChart, compact } from './chart.js';
import { drawSparkline, analyzeTrainingProgress, renderAllTileGraphics } from './trainingTelemetry.js';
import { LeaderboardTower, generateCarSideviewSvg } from './leaderboard.js';
import { EliminationModalManager } from './eliminationModal.js';
import { audio } from './audio.js';
import { carSideviewRenderer } from './carSideviewRenderer.js';
import * as storage from './storage.js';
import { NeuralNetwork } from './neuralNetwork.js';
import { availableCaptures } from './milestones.js';
import { PRESET_BRAINS } from './presetBrains.js';
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
  window.renderer3d = renderer3d;
} catch (e) {
  console.warn('3D WebGL renderer init error:', e);
}

let focusedFollowCar = null;
const leaderboard = new LeaderboardTower($('leaderboard-tower'), (car) => {
  focusedFollowCar = car;
  const carIdx = sim.cars ? sim.cars.indexOf(car) : -1;
  const carNum = car.manual ? 7 : (car.carNumber || (carIdx >= 0 ? getCarNumber(carIdx) : 1));
  toast(`🎥 Camera locked on Car #${carNum}`, 'info');
});

const eliminationModals = new EliminationModalManager($('elimination-stack'), {
  onSelectCar: (car) => {
    focusedFollowCar = car;
    setToggle('follow', true, false);
    const carIdx = sim.cars ? sim.cars.indexOf(car) : -1;
    const carNum = car.manual ? 7 : (car.carNumber || (carIdx >= 0 ? getCarNumber(carIdx) : 1));
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

// Async GPU readback can still stall inside the graphics driver. Keep cached
// 3D previews during racing and fill missing thumbnails while off-track.
carSideviewRenderer.canRender = () => state.paused || state.hyperRunning;
carSideviewRenderer.onReady(() => {
  const previewEl = $('cockpit-car-preview');
  if (previewEl) previewEl.dataset.key = '';
  if (leaderboard) leaderboard.reset();
});

carSideviewRenderer.onPreviewReady((key, url) => {
  for (const placeholder of document.querySelectorAll('svg[data-preview-key]')) {
    if (placeholder.dataset.previewKey !== key) continue;
    const image = document.createElement('img');
    image.className = 'car-sideview-img';
    image.src = url;
    image.alt = `F1 3D Car #${key.split('_').pop()}`;
    placeholder.replaceWith(image);
  }
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
  gridBox: true,
  recordGhost: localStorage.getItem('ai-racer:recordGhost') !== 'false',
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
export const SPEED_TO_KMH = (5.63 / 26) * 3.6; // ~0.7795 (aligns 26-unit car model with 5.63m real F1 chassis)
const fmtTime = (s) => (Number.isFinite(s) ? s.toFixed(2) + 's' : '–');

const classAnimations = new ClassAnimationScheduler();
function pulse(id) {
  classAnimations.restart($(id), 'pulse');
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

let lastSavedInfoHtml = '';
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

  if (textHtml !== lastSavedInfoHtml) {
    if (panelInfo) panelInfo.innerHTML = textHtml;
    if (hubInfo) hubInfo.innerHTML = textHtml;
    lastSavedInfoHtml = textHtml;
  }
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
    // Camera starts in broadcast auto mode by default at the start of each race
    setToggle('follow', true, false);
    if (!state.cameraPreset || state.cameraPreset === 'orbit') {
      setCameraPreset('auto', false);
    }
    if (state.view3d && renderer3d) {
      renderer3d.resetCamera(true);
    }
    if (renderer) {
      renderer.cam = null;
    }
    toast('🏆 20-Car Grand Prix Race: Elite field on starting grid · Collisions ON 100%!', 'success');
  } else {
    toast('🏋️ Training Mode: 80 cars exploring & learning via genetic evolution', 'info');
  }
}

const saveQueue = new DeferredTask(writeTrainingState);
function persistState() {
  saveQueue.request();
}

function writeTrainingState() {
  if (activePresetGen !== null || isMultiGenBattle) return;
  const saveStart = performance.now();
  storage.saveTrainingState(sim, LAYERS, $('track-select').value);
  refreshSavedInfo();
  lastSaveMs = performance.now() - saveStart;
  lastSaveAt = performance.now();
}

// ---------- Simulation callbacks ----------
let prevCollisionActive = false;

sim.onGeneration = (record) => {
  prevCollisionActive = false;
  focusedFollowCar = null;
  if (renderer3d) {
    renderer3d._currentActionPair = null;
    renderer3d._lastActionPairTime = null;
    renderer3d.focusedCar = null;
  }
  leaderboard.reset();
  eliminationModals.clear();

  // Camera starts in broadcast auto mode by default at the start of each race
  if (sim.mode === 'race') {
    setToggle('follow', true, false);
    if (!state.cameraPreset || state.cameraPreset === 'orbit') {
      setCameraPreset('auto', false);
    }
  }
  if (state.view3d && renderer3d && state.follow) {
    renderer3d.resetCamera(true);
  }

  if (sim.captureEnabled && sim.capturedPresets.some((p) => p.gen === record.generation)) {
    if (hyperRunning) storage.saveTrainingState(sim, LAYERS, $('track-select').value);
    renderGenPresetsRibbon();
  }
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

let recordCelebrationTimeout = null;

function showRecordCelebration(lapDuration, car, prevRecord, recordType = 'overall') {
  const overlay = $('record-celebration-overlay');
  const timeEl = $('record-overlay-time');
  const deltaEl = $('record-overlay-delta');
  const carEl = $('record-overlay-car');
  const carPreviewEl = $('record-overlay-car-preview');
  const genEl = $('record-overlay-gen');
  const tagEl = $('record-header-tag');
  const starLeft = $('record-star-left');
  const starRight = $('record-star-right');
  const metaLabel = $('record-meta-label');
  const lapBox = document.querySelector('.hud-item.hud-lap-box');

  const isRaceFastest = recordType === 'race';
  const isPlayer = !!car && (car === sim.player || car.manual);
  const carIdx = car ? sim.cars.indexOf(car) : -1;
  const gridSlot = carIdx >= 0 ? carIdx : (car?.gridSlot ?? car?.idx ?? 0);
  const carNum = isPlayer ? 7 : (car?.carNumber || getCarNumber(gridSlot));
  const teamIdx = isPlayer ? 1 : (car?.teamIdx ?? Math.floor(gridSlot / 2) % TEAM_PALETTE.length);
  const carName = car ? (car.manual ? 'PLAYER' : `CAR #${carNum}`) : 'P1';
  const genText = `GEN ${sim?.generation || ''}`;

  if (timeEl) timeEl.textContent = `${lapDuration.toFixed(2)}s`;
  if (carEl) carEl.textContent = carName;
  if (carPreviewEl) {
    carPreviewEl.innerHTML = generateCarSideviewSvg(teamIdx, isPlayer, carNum);
    carPreviewEl.setAttribute('aria-label', `${carName} — record-setting car`);
  }
  if (genEl) genEl.textContent = genText;

  if (tagEl) {
    tagEl.textContent = isRaceFastest ? 'FASTEST LAP OF THE RACE' : 'NEW ALL-TIME CIRCUIT RECORD';
  }
  if (starLeft) starLeft.textContent = isRaceFastest ? '⚡' : '👑';
  if (starRight) starRight.textContent = isRaceFastest ? '⚡' : '👑';
  if (metaLabel) {
    metaLabel.textContent = isRaceFastest ? 'RACE PACE LEADER' : 'ALL-TIME PEAK PACE';
  }

  if (deltaEl) {
    if (prevRecord && Number.isFinite(prevRecord) && prevRecord > lapDuration) {
      const diff = lapDuration - prevRecord;
      deltaEl.textContent = `${diff.toFixed(2)}s`;
      deltaEl.hidden = false;
    } else {
      deltaEl.textContent = isRaceFastest ? '★ RACE BEST' : '★ ALL-TIME';
      deltaEl.hidden = false;
    }
  }

  // Flash top HUD lap box with distinct glow animation
  if (lapBox) {
    classAnimations.restart(lapBox, isRaceFastest ? 'is-race-fastest-flash' : 'is-record-flash',
      ['is-record-flash', 'is-race-fastest-flash']);
  }

  // Activate 3D arch celebration (overhead scoreboard + F1 LED pods strobe)
  if (renderer3d && typeof renderer3d.triggerRecordCelebration === 'function') {
    renderer3d.triggerRecordCelebration(lapDuration, car, recordType);
  }

  // Play audio sound effect
  if (isRaceFastest) {
    audio?.playRaceFastestChime?.();
  } else {
    audio?.playRecordFanfare?.();
  }

  // Show large broadcast overlay on main screen with corresponding color palette
  if (overlay) {
    const wasActive = overlay.classList.contains('is-active');
    overlay.classList.remove('is-overall-record', 'is-race-fastest');
    overlay.classList.add(isRaceFastest ? 'is-race-fastest' : 'is-overall-record');
    if (!wasActive) {
      overlay.classList.add('is-active');
    }
    overlay.setAttribute('aria-hidden', 'false');

    if (recordCelebrationTimeout) clearTimeout(recordCelebrationTimeout);
    recordCelebrationTimeout = setTimeout(() => {
      overlay.classList.remove('is-active', 'is-overall-record', 'is-race-fastest');
      overlay.setAttribute('aria-hidden', 'true');
      if (lapBox) lapBox.classList.remove('is-record-flash', 'is-race-fastest-flash');
    }, isRaceFastest ? 3800 : 4800);
  }
}

sim.onNewBestLap = (lapDuration, car, prevRecord, recordType = 'overall') => {
  if (hyperRunning) return;
  pulse('stat-best-lap-box');
  const bestNum = car ? (car.manual ? 7 : (car.carNumber || (typeof car.idx === 'number' ? car.idx + 1 : 1))) : 1;
  const carName = car ? (car.manual ? 'Player' : `Car #${bestNum}`) : 'Car';
  const timeTxt = Number.isFinite(lapDuration) ? `${lapDuration.toFixed(2)}s` : '';
  if (recordType === 'race') {
    toast(`⚡ Fastest Lap of the Race: ${carName} (${timeTxt})`, 'info');
  } else {
    toast(`👑 All-Time Circuit Record Smashed: ${carName} (${timeTxt})`, 'success');
  }
  showRecordCelebration(lapDuration, car, prevRecord, recordType);
  persistState();
};

// ---------- Controls ----------
function setPaused(p) {
  state.paused = p;
  if (p) carSideviewRenderer.scheduleNext();
  $('btn-pause').textContent = p ? '▶ Resume' : '❚❚ Pause';
  $('paused-overlay').hidden = !p;
  updateStatus();
}

function setAudio(on, showToast = true) {
  state.audio = on;
  audio.enabled = on;
  if (on) {
    audio.resume();
  } else {
    audio.silenceAll();
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
  const audioBadge = $('settings-audio-badge');
  if (audioBadge) {
    audioBadge.textContent = on ? 'ON' : 'OFF';
    audioBadge.style.color = on ? '#22c55e' : '#94a3b8';
  }
  if (showToast) {
    toast(on ? '🔊 Spatial Audio Enabled' : '🔇 Audio Muted');
  }
}

function setTurbo(on) {
  if (state.manual && on) return toast('Turbo is disabled while driving manually');
  state.turbo = on;
  $('toggle-turbo').checked = on;
  updateStatus();
}

function setGhostMode(on, showToast = true) {
  state.ghosts = on;
  CONFIG.collision = CONFIG.collision || {};
  if (on) {
    CONFIG.collision.enabled = false;
    CONFIG.collision.warmupTime = Infinity;
  } else {
    CONFIG.collision.enabled = true;
    CONFIG.collision.warmupTime = 0;
  }
  localStorage.setItem('ai-racer:ghosts', String(on));

  const toggle = $('toggle-ghosts');
  if (toggle) toggle.checked = on;

  const badge = $('settings-ghost-badge');
  if (badge) {
    badge.textContent = on ? 'ON' : 'OFF';
    badge.style.color = on ? '#22c55e' : '#94a3b8';
  }

  const ghostPill = $('ghost-timer-pill');
  const ghostTitle = $('ghost-timer-title');
  const ghostVal = $('ghost-timer-value');
  if (ghostPill) {
    if (on) {
      ghostPill.classList.remove('hidden', 'urgent', 'active-contact');
      if (ghostTitle) ghostTitle.textContent = 'GHOST MODE';
      if (ghostVal) ghostVal.textContent = 'ON';
    } else {
      ghostPill.classList.remove('hidden', 'urgent');
      ghostPill.classList.add('active-contact');
      if (ghostTitle) ghostTitle.textContent = 'CONTACTS';
      if (ghostVal) ghostVal.textContent = 'ACTIVE';
    }
  }

  if (showToast) {
    toast(on ? '👻 Ghost Mode ON (no collisions)' : '💥 Ghost Mode OFF (collisions active)');
  }
}

function setGridBox(on, showToast = true) {
  state.gridBox = on;
  CONFIG.gridBox = on;
  localStorage.setItem('ai-racer:gridBox', String(on));

  const badge = $('settings-gridbox-badge');
  if (badge) {
    badge.textContent = on ? 'ON' : 'OFF';
    badge.style.color = on ? '#22c55e' : '#94a3b8';
  }

  if (renderer3d) {
    renderer3d.setGridBoxVisible(on);
  }

  // If cars are waiting at the start line, immediately align them to the new formation
  if (sim && sim.cars && (sim.time === undefined || sim.time < (CONFIG.generation?.startDelay || 2.0))) {
    for (let i = 0; i < sim.cars.length; i++) {
      const c = sim.cars[i];
      if (c && c.alive && !c.crashed) {
        c.reset(i);
      }
    }
    if (sim.player && sim.player.alive && !sim.player.crashed) {
      sim.player.reset(0);
    }
  }

  if (showToast) {
    toast(on ? '🏁 Starting Grid Boxes ON' : '🏁 Starting Grid Boxes OFF');
  }
}

function setRecordGhost(on, showToast = true) {
  state.recordGhost = on;
  localStorage.setItem('ai-racer:recordGhost', String(on));

  const badge = $('settings-record-ghost-badge');
  if (badge) {
    badge.textContent = on ? 'ON' : 'OFF';
    badge.style.color = on ? '#22c55e' : '#94a3b8';
  }

  if (showToast) {
    toast(on ? '⚡ Record Ghost ON (Benchmark lap car visible)' : '⚡ Record Ghost OFF');
  }
}

function handleResetLapRecord() {
  if (!sim) return;
  const newRec = sim.resetLapRecord();

  persistState();
  chart.draw(sim.history, sim.bestLapEver);
  hubChart?.draw(sim.history, sim.bestLapEver);
  hyperChart?.draw(sim.history, sim.bestLapEver);
  refreshSavedInfo();
  updateHud(sim.leader);

  if (Number.isFinite(newRec) && newRec < 60) {
    toast(`⏱️ Circuit Record recalibrated to current baseline: ${newRec.toFixed(2)}s!`, 'success');
  } else {
    toast(`⏱️ Circuit Record reset! Next completed lap will establish the new benchmark.`, 'info');
  }
}

function setMaxLaps(laps, showToast = true) {
  const numLaps = Math.max(1, parseInt(laps, 10) || 5);
  CONFIG.generation = CONFIG.generation || {};
  CONFIG.generation.maxLaps = numLaps;
  CONFIG.generation.timeLimit = numLaps === 1 ? 26 : (numLaps === 2 ? 50 : numLaps * 22);
  localStorage.setItem('ai-racer:maxLaps', String(numLaps));

  const select = $('settings-laps-select');
  if (select && select.value !== String(numLaps)) {
    select.value = String(numLaps);
  }

  const maxLaps = numLaps;
  const currentLap = sim?.leader ? Math.min(sim.leader.laps + 1, maxLaps) : 1;
  const hudLap = $('hud-lap');
  if (hudLap) hudLap.textContent = `${currentLap}/${maxLaps}`;

  if (showToast) {
    toast(`🏁 Race distance set to ${numLaps} ${numLaps === 1 ? 'lap' : 'laps'}`);
  }
}

function setToggle(key, on, showToast = true) {
  const changed = state[key] !== on;
  state[key] = on;
  $(`toggle-${key}`) && ($(`toggle-${key}`).checked = on);
  if (key === 'ghosts') {
    setGhostMode(on, showToast);
  } else if (key === 'gridBox') {
    setGridBox(on, showToast);
  } else if (key === 'follow') {
    try {
      localStorage.setItem('ai-racer:follow', String(on));
    } catch (_) {}
    if (on) {
      if (state.cameraPreset === 'orbit' || !state.cameraPreset) {
        setCameraPreset('auto', false);
      }
    } else {
      if (state.cameraPreset !== 'orbit') {
        setCameraPreset('orbit', false);
      }
    }
    updateCameraPill();
    if (showToast && changed) {
      flashCameraNameBadge(on ? '🎥 Follow Leader: ON (Broadcast)' : '🌐 Follow: OFF (Free Orbit)', on);
      toast(on ? '🎥 Follow Leader: ON (Broadcast Director tracking P1)' : '🌐 Follow Leader: OFF (Circuit Orbit Overview)', 'info');
    }
  }
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
  focusedFollowCar = null;
  eliminationModals.clear();
  if (sim.mode === 'race') {
    setToggle('follow', true, false);
    if (!state.cameraPreset || state.cameraPreset === 'orbit') {
      setCameraPreset('auto', false);
    }
  }
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
  const bestCar = sim.bestLapCar || (sim.cars && sim.cars[0]);
  updateHud(bestCar || sim.leader);
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
  focusedFollowCar = null;
  eliminationModals.clear();
  currentTrack = new Track(preset.points, CONFIG.track.width, CONFIG.track.samples);
  sim.setTrack(currentTrack, true);
  activePresetGen = null;
  isMultiGenBattle = false;
  userHighestGen = sim.generation;
  userLiveStateSnapshot = null;
  compareSelectedGens.clear();
  lastRibbonCurrentGen = -1;
  renderGenPresetsRibbon();
  renderCompareMatrixTable();
  leaderboard.reset();
  prevCollisionActive = false;
  renderer.setTrack(currentTrack);
  if (renderer3d) renderer3d.setTrack(currentTrack);
  chart.draw(sim.history, sim.bestLapEver);
  hubChart?.draw(sim.history, sim.bestLapEver);
  hyperChart?.draw(sim.history, sim.bestLapEver);
  persistState();
  toast(`Switched to ${preset.name}`);
});

// Always persist state when navigating away, switching tabs, or periodically
window.addEventListener('beforeunload', () => saveQueue.flush());
window.addEventListener('pagehide', () => saveQueue.flush());
document.addEventListener('visibilitychange', () => {
  if (document.hidden) saveQueue.flush();
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
  const data = storage.loadBrain(LAYERS);
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
  storage.exportBrain(targetBrain, LAYERS, {
    track: $('track-select').value,
    capturedPresets: availablePresets(),
  });
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
    activePresetGen = null;
    isMultiGenBattle = false;
    userHighestGen = 1;
    userLiveStateSnapshot = null;
    compareSelectedGens.clear();
    lastRibbonCurrentGen = -1;
    leaderboard.reset();
    eliminationModals.clear();
    focusedFollowCar = null;
    renderGenPresetsRibbon();
    renderCompareMatrixTable();
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

// ---------- Consolidated Settings Menu & Popover ----------
const btnSettingsMenu = $('btn-settings-menu');
const settingsPopover = $('settings-popover');
const btnSettingsClose = $('btn-settings-close');
const btnSettingsShortcuts = $('btn-settings-shortcuts');
const btnSettingsAudio = $('btn-settings-audio');
const btnSettingsGhost = $('btn-settings-ghost');
const btnSettingsGridbox = $('btn-settings-gridbox');
const settingsLapsSelect = $('settings-laps-select');
const btnSettingsPanel = $('btn-settings-panel');
const btnSettingsGuide = $('btn-settings-guide');

function setSettingsPopoverOpen(open) {
  if (!settingsPopover) return;
  settingsPopover.hidden = !open;
  btnSettingsMenu?.setAttribute('aria-expanded', String(open));
  btnSettingsMenu?.classList.toggle('is-active', open);

  if (open) {
    const ghostBadge = $('settings-ghost-badge');
    if (ghostBadge) {
      ghostBadge.textContent = state.ghosts ? 'ON' : 'OFF';
      ghostBadge.style.color = state.ghosts ? '#22c55e' : '#94a3b8';
    }
    const gridBadge = $('settings-gridbox-badge');
    if (gridBadge) {
      gridBadge.textContent = state.gridBox ? 'ON' : 'OFF';
      gridBadge.style.color = state.gridBox ? '#22c55e' : '#94a3b8';
    }
    const recGhostBadge = $('settings-record-ghost-badge');
    if (recGhostBadge) {
      recGhostBadge.textContent = state.recordGhost ? 'ON' : 'OFF';
      recGhostBadge.style.color = state.recordGhost ? '#22c55e' : '#94a3b8';
    }
  }
}

if (btnSettingsMenu) {
  btnSettingsMenu.addEventListener('click', (e) => {
    e.stopPropagation();
    const isHidden = settingsPopover?.hidden ?? true;
    setSettingsPopoverOpen(isHidden);
  });
}

if (btnSettingsClose) {
  btnSettingsClose.addEventListener('click', (e) => {
    e.stopPropagation();
    setSettingsPopoverOpen(false);
  });
}

btnSettingsShortcuts?.addEventListener('click', (e) => {
  e.stopPropagation();
  setSettingsPopoverOpen(false);
  setControlsPopoverOpen(true);
});

btnSettingsAudio?.addEventListener('click', (e) => {
  e.stopPropagation();
  setAudio(!state.audio);
});

btnSettingsGhost?.addEventListener('click', (e) => {
  e.stopPropagation();
  setGhostMode(!state.ghosts);
});

btnSettingsGridbox?.addEventListener('click', (e) => {
  e.stopPropagation();
  setGridBox(!state.gridBox);
});

const btnSettingsRecordGhost = $('btn-settings-record-ghost');
btnSettingsRecordGhost?.addEventListener('click', (e) => {
  e.stopPropagation();
  setRecordGhost(!state.recordGhost);
});

const btnSettingsResetRecord = $('btn-settings-reset-record');
btnSettingsResetRecord?.addEventListener('click', (e) => {
  e.stopPropagation();
  handleResetLapRecord();
});

settingsLapsSelect?.addEventListener('click', (e) => {
  e.stopPropagation();
});

settingsLapsSelect?.addEventListener('change', (e) => {
  setMaxLaps(e.target.value);
});

btnSettingsPanel?.addEventListener('click', (e) => {
  e.stopPropagation();
  setSettingsPopoverOpen(false);
  setPanelOpen(!panelEl?.classList.contains('is-open'));
});

btnSettingsGuide?.addEventListener('click', (e) => {
  e.stopPropagation();
  setSettingsPopoverOpen(false);
  openWelcomeGuide();
});

document.addEventListener('click', (e) => {
  const widget = $('settings-widget');
  if (widget && !widget.contains(e.target)) {
    setSettingsPopoverOpen(false);
  }
});

// ---------- Controls & Keyboard Shortcuts Popover ----------
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
  const popover = $('controls-popover');
  const btn = $('btn-settings-shortcuts');
  if (popover && !popover.hidden && !popover.contains(e.target) && (!btn || !btn.contains(e.target))) {
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

let lastCameraFlashPreset = null;
let cameraNameBadgeTimer = null;

export function flashCameraNameBadge(shotName, isAuto = false) {
  const badge = $('cam-temp-badge');
  if (!badge) return;
  badge.textContent = shotName;
  badge.classList.remove('is-hidden');
  badge.classList.add('is-visible');
  badge.classList.toggle('is-auto', isAuto);

  if (cameraNameBadgeTimer) clearTimeout(cameraNameBadgeTimer);
  cameraNameBadgeTimer = setTimeout(() => {
    badge.classList.remove('is-visible');
    badge.classList.add('is-hidden');
  }, 2400);
}

let lastPillIsAuto = null;
let lastPillIsFollow = null;

function updateCameraPill() {
  const isAuto = (state.cameraPreset || 'auto') === 'auto';
  const isFollow = Boolean(state.follow);

  if (isAuto !== lastPillIsAuto || isFollow !== lastPillIsFollow) {
    lastPillIsAuto = isAuto;
    lastPillIsFollow = isFollow;
    const btn = $('btn-camera-menu');
    const dot = $('cam-active-dot');

    if (btn) {
      btn.classList.toggle('is-auto-director', isAuto && isFollow);
    }

    if (dot) {
      if (!isFollow) {
        dot.style.background = '#94a3b8';
        dot.style.boxShadow = '0 0 6px rgba(148, 163, 184, 0.4)';
      } else if (isAuto) {
        dot.style.background = '#22c55e';
        dot.style.boxShadow = '0 0 6px #22c55e';
      } else {
        dot.style.background = '#38bdf8';
        dot.style.boxShadow = '0 0 6px #38bdf8';
      }
    }
  }

  const effectivePreset = (isAuto && renderer3d?.activeCameraPreset)
    ? renderer3d.activeCameraPreset
    : (state.cameraPreset || 'auto');

  if (effectivePreset !== lastCameraFlashPreset) {
    const isFirstRun = lastCameraFlashPreset === null;
    lastCameraFlashPreset = effectivePreset;
    if (!isFirstRun) {
      const displayName = CAMERA_SHORT_NAMES[effectivePreset] || effectivePreset;
      flashCameraNameBadge(displayName, isAuto);
    }
  }
}

function setCameraPreset(preset, showToast = true) {
  state.cameraPreset = preset;
  if (renderer3d) {
    renderer3d._lastPresetSwitchTime = performance.now();
    renderer3d._autoPreset = (preset === 'auto') ? 'follow' : preset;
    renderer3d._autoNextSwitch = performance.now() + 34000;
  }
  if (!state.view3d) {
    set3DView(true);
  }
  if (preset !== 'orbit') {
    if (!state.follow) setToggle('follow', true, false);
  } else {
    if (state.follow) setToggle('follow', false, false);
  }

  document.querySelectorAll('.btn-cam-preset').forEach((btn) => {
    btn.classList.toggle('active', btn.getAttribute('data-preset') === preset);
  });

  const displayName = CAMERA_SHORT_NAMES[preset] || preset;
  flashCameraNameBadge(displayName, preset === 'auto');

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
    setToggle('follow', true, false);

    if (renderer3d) {
      renderer3d.focusedCar = targetCar;
      renderer3d._currentActionPair = { carA: targetCar, carB: null };
      renderer3d._lastActionPairTime = performance.now();
    }
    if (renderer) {
      renderer.focusedCar = targetCar;
    }

    // Immediately trigger cockpit telemetry & HUD updates
    updateCockpitAnimation(targetCar);
    updateHud(targetCar);

    const carIdx = sim.cars.indexOf(targetCar);
    const carNum = targetCar.carNumber || (carIdx >= 0 ? getCarNumber(carIdx) : 1);
    const rank = nextIdx + 1;
    toast(`🎥 Camera tracking Car #${carNum} (P.${rank})`, 'info');
  }
}

// Initial active state synchronization
setTelemetryOpen(isTelemetryOpen);
btnToggleLeaderboard?.classList.toggle('is-active', !leaderboard.isCollapsed);

// ---------- First-Time User Experience & Onboarding Guide ----------
const welcomeGuide = $('welcome-guide-backdrop');
const btnWelcomeClose = $('btn-welcome-close');
const btnWelcomeDismiss = $('btn-welcome-dismiss');
const btnGuideLoadAi = $('btn-guide-load-ai');
const btnGuideOpenHub = $('btn-guide-open-hub');

export function openWelcomeGuide() {
  if (!welcomeGuide) return;
  welcomeGuide.hidden = false;
  $('btn-gen-dial')?.classList.add('guide-beacon-pulse');
  $('btn-fast-forward')?.classList.add('guide-beacon-pulse');
}

export function closeWelcomeGuide(dismissForever = true) {
  if (!welcomeGuide) return;
  welcomeGuide.hidden = true;
  $('btn-gen-dial')?.classList.remove('guide-beacon-pulse');
  $('btn-fast-forward')?.classList.remove('guide-beacon-pulse');
  if (dismissForever) {
    try {
      localStorage.setItem('ai-racer:welcome-guide-seen', 'true');
    } catch (_) {}
  }
}

btnWelcomeClose?.addEventListener('click', () => closeWelcomeGuide(true));
btnWelcomeDismiss?.addEventListener('click', () => closeWelcomeGuide(true));
$('btn-reopen-guide')?.addEventListener('click', () => {
  setControlsPopoverOpen(false);
  openWelcomeGuide();
});
welcomeGuide?.addEventListener('click', (e) => {
  if (e.target === welcomeGuide) closeWelcomeGuide(true);
});

btnGuideLoadAi?.addEventListener('click', () => {
  closeWelcomeGuide(true);
  const genDialPopover = $('gen-dial-popover');
  const btnGenDial = $('btn-gen-dial');
  if (genDialPopover && btnGenDial) {
    genDialPopover.hidden = false;
    btnGenDial.setAttribute('aria-expanded', 'true');
    btnGenDial.classList.add('is-active');
  }
  toast('Milestones appear here after completing their training generation.', 'info');
});

btnGuideOpenHub?.addEventListener('click', () => {
  closeWelcomeGuide(true);
  openHyperModal();
  toast('⚡ AI Training Hub: Evolve or run fast-forward bursts!', 'info');
});

// Keyboard
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    if (welcomeGuide && !welcomeGuide.hidden) {
      closeWelcomeGuide(true);
      e.preventDefault();
      return;
    }
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

  const isTextTarget = e.target instanceof HTMLInputElement && e.target.type !== 'checkbox' && e.target.type !== 'range';
  if (isTextTarget || e.target instanceof HTMLTextAreaElement) return;

  const isArrow = e.key === 'ArrowUp' || e.key === 'ArrowDown' || e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                  e.code === 'ArrowUp' || e.code === 'ArrowDown' || e.code === 'ArrowLeft' || e.code === 'ArrowRight';

  if (isArrow) {
    e.preventDefault();
    if (document.activeElement && document.activeElement !== document.body && typeof document.activeElement.blur === 'function') {
      document.activeElement.blur();
    }

    if (state.manual) {
      if (e.key in keys) {
        keys[e.key] = true;
      }
      return;
    }

    if (e.key === 'ArrowUp' || e.code === 'ArrowUp') {
      if (!e.repeat) switchTargetCar(-1);
      return;
    }
    if (e.key === 'ArrowDown' || e.code === 'ArrowDown') {
      if (!e.repeat) switchTargetCar(1);
      return;
    }
    if (e.key === 'ArrowLeft' || e.code === 'ArrowLeft') {
      if (!e.repeat) cycleCameraPreset(-1);
      return;
    }
    if (e.key === 'ArrowRight' || e.code === 'ArrowRight') {
      if (!e.repeat) cycleCameraPreset(1);
      return;
    }
  }

  if (e.repeat) return;
  switch (e.key.toLowerCase()) {
    case '?':
      openWelcomeGuide();
      break;
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
  const outcomePanel = $('hyper-race-outcomes');
  if (outcomePanel && !outcomePanel.querySelector('.approach-inspector[open]')) {
    const markup = raceOutcomeMarkup(sim.history, sim.track);
    // Keep an inspected snapshot stable while new races finish in the background.
    if (outcomePanel.innerHTML !== markup) outcomePanel.innerHTML = markup;
  }
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
      const modeDesc = hyperLaps === 1 ? '1-LAP SPRINT' : (hyperLaps === 2 ? '2-LAP FLYING BENCHMARK' : `${hyperLaps}-LAP FULL GP`);
      targetInfo.innerHTML = `GEN <strong id="hyper-cur-gen">${sim.generation}</strong> · ${modeDesc}`;
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
  setHyperLaps(hyperLaps);
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
  const rem = triggerExplorationBurst(40);
  updateBurstButtonUi();
  toast('🚀 Stagnation Breaker Active: 40 generations of exploration wildcards injected!', 'success');
});
$('btn-hyper-reset-record')?.addEventListener('click', handleResetLapRecord);
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
let prevTimeLimit = 110;
let prevTireBarriers = null;

let hyperLaps = 5;
try {
  // Apply the requested new race distance once; later manual choices remain saved.
  if (localStorage.getItem('ai-racer:5-lap-distance') !== '1') {
    localStorage.setItem('ai-racer:maxLaps', '5');
    localStorage.setItem('ai-racer:hyperLaps', '5');
    localStorage.setItem('ai-racer:5-lap-distance', '1');
  }
  const savedHyperLaps = localStorage.getItem('ai-racer:hyperLaps');
  if (savedHyperLaps) {
    hyperLaps = Math.max(1, parseInt(savedHyperLaps, 10) || 5);
  }
} catch (_) {}

function setHyperLaps(laps) {
  hyperLaps = Math.max(1, parseInt(laps, 10) || 5);
  try {
    localStorage.setItem('ai-racer:hyperLaps', String(hyperLaps));
  } catch (_) {}

  document.querySelectorAll('#hub-lap-chips .hub-lap-chip').forEach((btn) => {
    const isCur = Number(btn.getAttribute('data-laps')) === hyperLaps;
    btn.classList.toggle('active', isCur);
    btn.setAttribute('aria-checked', String(isCur));
  });

  const hintEl = $('hub-lap-hint');
  if (hintEl) {
    if (hyperLaps === 1) {
      hintEl.textContent = '1-Lap Sprint (Standing Start from Grid · Max Throughput ~8 gen/s)';
    } else if (hyperLaps === 2) {
      hintEl.textContent = 'Lap 1 Launch + Lap 2 Flying Benchmark (Matches Live GP · ~4.7 gen/s)';
    } else {
      hintEl.textContent = `${hyperLaps}-Lap Full Race Distance (Complete Grand Prix Simulation)`;
    }
  }

  const targetInfo = $('hyper-target-info');
  if (targetInfo) {
    const modeDesc = hyperLaps === 1 ? '1-LAP SPRINT' : (hyperLaps === 2 ? '2-LAP FLYING BENCHMARK' : `${hyperLaps}-LAP FULL GP`);
    targetInfo.innerHTML = `GEN <strong id="hyper-cur-gen">${sim.generation}</strong> · ${modeDesc}`;
  }

  if (hyperRunning && CONFIG.generation) {
    CONFIG.generation.maxLaps = hyperLaps;
    CONFIG.generation.timeLimit = hyperLaps === 1 ? 26 : (hyperLaps === 2 ? 50 : (hyperLaps * 22));
  }
}

document.querySelectorAll('#hub-lap-chips .hub-lap-chip').forEach((btn) => {
  btn.addEventListener('click', () => {
    const laps = Number(btn.getAttribute('data-laps')) || 2;
    setHyperLaps(laps);
    toast(
      laps === 1
        ? '⚡ 1-Lap Sprint: Max evolutionary throughput (~8 gen/s)'
        : (laps === 2
          ? '🎯 2-Lap Flying Benchmark: Lap 1 Launch + Lap 2 Flying Lap (Matches Live GP)'
          : `🏁 ${laps}-Lap Full Race: Complete Grand Prix endurance parity`),
      'info'
    );
  });
});

function startHyperTraining() {
  hyperRunning = true;
  state.hyperRunning = true;
  carSideviewRenderer.scheduleNext();
  sim.hyperRunning = true;

  prevStartDelay = CONFIG.generation?.startDelay ?? 2.0;
  prevMaxLaps = CONFIG.generation?.maxLaps ?? 5;
  prevTimeLimit = CONFIG.generation?.timeLimit ?? 110;
  prevTireBarriers = sim.tireBarriers;

  if (CONFIG.generation) {
    CONFIG.generation.startDelay = 0.0001; // Bypass 120 stationary start ticks in headless mode
    CONFIG.generation.maxLaps = hyperLaps;
    CONFIG.generation.timeLimit = hyperLaps === 1 ? 26 : (hyperLaps === 2 ? 50 : (hyperLaps * 22));
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
    const modeDesc = hyperLaps === 1 ? '1-LAP SPRINT' : (hyperLaps === 2 ? '2-LAP FLYING BENCHMARK' : `${hyperLaps}-LAP FULL GP`);
    targetInfo.innerHTML = `GEN <strong id="hyper-cur-gen">${sim.generation}</strong> · ${modeDesc}`;
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

        // Skip the presentation cooldown once every car has stopped racing.
        if (sim.postRaceTimer !== null && sim.postRaceTimer > 0) {
          sim.postRaceTimer = 0;
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

        // Finish early when every surviving car has finished. Otherwise the
        // simulation owns the same configured deadline as the live race.
        if (sim.cars && sim.cars.some(c => c.finished)) {
          const nonCrashed = sim.cars.filter(c => !c.crashed);
          const allSurvivingFinished = nonCrashed.length > 0 && nonCrashed.every(c => c.finished);

          if (allSurvivingFinished) {
            sim.endGeneration('all-finished');
          }
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
let compareSelectedGens = new Set();

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
      currentGenomes: sim.cars.map((c) => Array.from(c.brain.genome)),
      capturedPresets: [...sim.capturedPresets],
      captureEnabled: sim.captureEnabled,
      recordLapTelemetry: sim.recordLapTelemetry,
      isRealCarTelemetry: sim.isRealCarTelemetry,
    };
  }
}

function availablePresets() {
  return availableCaptures(Object.values(PRESET_BRAINS), sim.capturedPresets, currentTrack, CONFIG);
}

function getGenMeta(g) {
  const preset = availablePresets().find((p) => p.gen === g);
  if (!preset) return null;
  const bundled = Object.values(PRESET_BRAINS).includes(preset);
  return {
    name: formatGenLabel(g), genLabel: formatGenLabel(g), isLive: false,
    tier: (bundled ? 'Bundled · ' : 'Tested ') + preset.laps + '/' + preset.raceLaps + ' laps · ' + (preset.collisions ? 'contacts enabled' : 'ghost mode'),
    lap: preset.bestLap, speed: Math.round(preset.topSpeed * SPEED_TO_KMH),
    completion: Math.round(100 * Math.min(1, preset.laps / preset.raceLaps)),
    rating: preset.finished ? 'FINISHED' : 'TESTED', gradeClass: preset.finished ? 'a' : 'c',
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

  const allGens = availablePresets().map((p) => p.gen);
  compareSelectedGens = new Set([...compareSelectedGens].filter((g) => allGens.includes(g)));

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

  let html = allGens.length ? '' : '<tr><td colspan="7">No tested milestones yet. Complete a milestone generation to capture its brain.</td></tr>';
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
      if (compareSelectedGens.has(g)) compareSelectedGens.delete(g);
      else compareSelectedGens.add(g);

      renderCompareMatrixTable();
    });
  });

  tbody.querySelectorAll('input[type="checkbox"]').forEach((chk) => {
    chk.addEventListener('click', (e) => {
      e.stopPropagation();
    });
    chk.addEventListener('change', (e) => {
      const g = Number(chk.getAttribute('data-gen'));
      if (chk.checked) compareSelectedGens.add(g);
      else compareSelectedGens.delete(g);

      renderCompareMatrixTable();
    });
  });
}

export function startMultiGenBattle(selectedGens) {
  if (!selectedGens || selectedGens.length < 2) {
    toast('⚠️ Please select at least 2 generations to compare & battle', 'warning');
    return;
  }

  const captures = availablePresets();
  if (!selectedGens.every((g) => captures.some((p) => p.gen === g))) {
    toast('Only captured and tested milestones can enter a showdown.', 'warning');
    return;
  }
  if (activePresetGen === null && !isMultiGenBattle) updateHighestGenAndLiveSnapshot();
  saveQueue.flush();
  sim.captureEnabled = false;
  isMultiGenBattle = true;
  activePresetGen = null;
  sim.history = [];
  sim.allTimeBest = null;
  sim.bestLapEver = Infinity;
  sim.prevBestLapEver = null;
  sim.recordLapTelemetry = null;
  sim.isRealCarTelemetry = false;
  closeGenCompareModal();

  const totalCars = Math.min(80, Math.max(20, selectedGens.length * 10));
  const carsPerGen = Math.floor(totalCars / selectedGens.length);

  const genomes = [];
  const metaList = [];

  selectedGens.forEach((g, gIdx) => {
    const baseGenome = captures.find((p) => p.gen === g).genome;

    const teamIdx = (gIdx * 3 + 1) % 20; // Distinct vivid livery for each generation
    const genLabel = formatGenLabel(g === 'live' ? userHighestGen : g);

    for (let c = 0; c < carsPerGen; c++) {
      const carGenome = Float32Array.from(baseGenome);


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

// Quick matchups only use checkpoints that this run has actually tested.
function selectCapturedMatchup(select) {
  compareSelectedGens = new Set(select(availablePresets().map((p) => p.gen)));
  renderCompareMatrixTable();
}
$('btn-matchup-all')?.addEventListener('click', () => selectCapturedMatchup((gens) => gens));
$('btn-matchup-rookie')?.addEventListener('click', () => selectCapturedMatchup((gens) => gens.length > 1 ? [gens[0], gens.at(-1)] : gens));
$('btn-matchup-champs')?.addEventListener('click', () => selectCapturedMatchup((gens) => gens.slice(-5)));
$('btn-matchup-live')?.addEventListener('click', () => selectCapturedMatchup((gens) => gens.slice(-2)));

function formatGenLabel(g) {
  if (g >= 1000) {
    const k = g / 1000;
    return `Gen ${k % 1 === 0 ? k : k.toFixed(1)}k`;
  }
  return `Gen ${g}`;
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
  if (g === 'live') {
    if (!userLiveStateSnapshot || (activePresetGen === null && !isMultiGenBattle)) return;
    sim.resumeState(userLiveStateSnapshot);
    activePresetGen = null;
    isMultiGenBattle = false;
  } else {
    const preset = availablePresets().find((p) => p.gen === g);
    if (!preset) return toast('That milestone has not been captured and tested.', 'info');
    if (activePresetGen === null && !isMultiGenBattle) updateHighestGenAndLiveSnapshot();
    saveQueue.flush();
    sim.captureEnabled = false;
    activePresetGen = g;
    isMultiGenBattle = false;
    sim.generation = g;
    sim.history = [];
    sim.allTimeBest = null;
    sim.bestLapEver = Infinity;
    sim.prevBestLapEver = null;
    sim.recordLapTelemetry = null;
    sim.isRealCarTelemetry = false;
    sim.startGeneration(Array.from({ length: CONFIG.ga.population }, () => preset.genome));
  }
  $('btn-compare-gens')?.classList.remove('active');
  leaderboard.reset();
  focusedFollowCar = null;
  refreshSavedInfo();
  updateHubAnalytics();
  renderGenPresetsRibbon();
  toast(g === 'live' ? 'Resumed live training' : 'Loaded tested ' + formatGenLabel(g), 'success');
}

export function renderGenPresetsRibbon() {
  const container = $('gen-presets-track');
  const activeLabelEl = $('gen-dial-label') || $('gen-dial-active-label');
  const presets = availablePresets();
  const badge = $('captured-presets-count');
  if (badge) badge.textContent = presets.length + ' AVAILABLE';
  const exportButton = $('btn-export-presets');
  if (exportButton) exportButton.disabled = presets.length === 0;
  if (activeLabelEl) activeLabelEl.textContent = isMultiGenBattle ? 'Showdown' :
    (activePresetGen !== null ? 'Tested ' + formatGenLabel(activePresetGen) : 'Milestone brains (' + presets.length + ')');
  if (!container) return;
  let html = '<button class="gen-dial-item is-live" data-gen="live" type="button">↩ Live training · Gen ' + userHighestGen + '</button>';
  if (!presets.length) html += '<p class="gen-dial-item-tier">No tested milestones yet. Brains are captured after each milestone generation completes.</p>';
  for (const preset of presets) {
    const meta = getGenMeta(preset.gen);
    const lap = preset.bestLap === null ? 'No completed lap' : preset.bestLap.toFixed(2) + 's';
    html += '<button class="gen-dial-item ' + (activePresetGen === preset.gen ? 'active' : '') + '" data-gen="' + preset.gen + '" type="button">' +
      '<div class="gen-dial-item-main"><span class="gen-dial-item-title">' + formatGenLabel(preset.gen) + '</span>' +
      '<span class="gen-dial-item-tier">' + meta.tier + '</span></div><span class="gen-dial-item-lap">' + lap + '</span></button>';
  }
  container.innerHTML = html;
  container.querySelectorAll('[data-gen]').forEach((button) => button.addEventListener('click', (event) => {
    event.stopPropagation();
    const value = button.getAttribute('data-gen');
    loadGenerationPreset(value === 'live' ? 'live' : Number(value));
    setGenDialPopoverOpen(false);
  }));
}

$('btn-export-presets')?.addEventListener('click', () => {
  const presets = availablePresets();
  if (!presets.length) return;
  const blob = new Blob([JSON.stringify({ version: 1, track: $('track-select').value, presets }, null, 2)], { type: 'application/json' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'ai-racer-captured-milestones.json';
  link.click();
  setTimeout(() => URL.revokeObjectURL(link.href), 1000);
});

// ---------- HUD ----------
function updateHud(leader) {
  if (activePresetGen === null && !isMultiGenBattle) userHighestGen = sim.generation;
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

  // Focus car lap timing & delta gap
  const focusTarget = (state.view3d && renderer3d?.focusedCar) ? renderer3d.focusedCar : (leader || sim.leader || (sim.cars && sim.cars[0]));
  const lapLabel = $('hud-lap-label');
  const lapVal = $('hud-best-lap');
  const lapGap = $('hud-lap-gap');

  if (focusTarget) {
    const lapTimes = focusTarget.lapTimes || [];
    const bestEver = sim.bestLapEver;

    if (lapTimes.length > 0) {
      const lastLap = lapTimes[lapTimes.length - 1];
      if (lapVal) lapVal.textContent = `${lastLap.toFixed(2)}s`;
      if (lapLabel) lapLabel.textContent = 'Last Lap';

      if (lapGap) {
        if (Number.isFinite(bestEver) && bestEver < 100) {
          const gap = lastLap - bestEver;
          const raceBest = sim.raceBestLap;
          if (gap <= 0.005) {
            lapGap.textContent = 'RECORD';
            lapGap.className = 'hud-lap-gap record';
          } else if (Number.isFinite(raceBest) && Math.abs(lastLap - raceBest) <= 0.005) {
            lapGap.textContent = 'RACE BEST';
            lapGap.className = 'hud-lap-gap race-fastest';
          } else {
            lapGap.textContent = `+${gap.toFixed(2)}s`;
            lapGap.className = 'hud-lap-gap positive';
          }
          lapGap.hidden = false;
        } else {
          lapGap.textContent = '';
          lapGap.hidden = true;
        }
      }
    } else {
      const runningLapTime = Math.max(0, focusTarget.time - (focusTarget.lapStart || 0));
      if (lapVal) lapVal.textContent = `${runningLapTime.toFixed(1)}s`;
      if (lapLabel) lapLabel.textContent = 'Lap Time';
      if (lapGap) {
        lapGap.textContent = '';
        lapGap.hidden = true;
      }
    }
  } else {
    if (lapVal) lapVal.textContent = '–';
    if (lapGap) lapGap.hidden = true;
  }

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

  // Top-Center Semi-Transparent Ghost Mode Indicator
  const ghostPill = $('ghost-timer-pill');
  const ghostTitle = $('ghost-timer-title');
  const ghostVal = $('ghost-timer-value');
  const colConfig = CONFIG.collision || {};
  const isPermanentGhost = !colConfig.enabled || colConfig.warmupTime === Infinity;

  if (ghostPill) {
    if (isPermanentGhost) {
      ghostPill.classList.remove('hidden', 'urgent', 'active-contact');
      if (ghostTitle) ghostTitle.textContent = 'GHOST MODE';
      if (ghostVal) ghostVal.textContent = 'ON';
    } else {
      const warmup = colConfig.warmupTime ?? 30;
      const remainingGhost = Math.max(0, warmup - sim.time);
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
  }

  // Toast notification when collisions activate
  if (!isPermanentGhost && sim.time >= (colConfig.warmupTime ?? 30) && !prevCollisionActive) {
    prevCollisionActive = true;
    toast('⚠️ Collision Avoidance & Contact Physics ACTIVE!', 'warning');
  }

  const car = (state.manual && sim.player && (sim.player.alive || sim.player.finished))
    ? sim.player
    : (leader && (leader.alive || leader.finished) ? leader : (sim.leader || null));
  $('leader-dot')?.classList.toggle('player', state.manual);
  if (car) {
    const kmh = Math.round(car.speed * SPEED_TO_KMH);
    setTxt('leader-speed', kmh);

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
    const carNum = isPlayerCar ? 7 : (car.carNumber || (carIdx >= 0 ? getCarNumber(carIdx) : 1));
    const teamIdx = isPlayerCar ? 1 : (car.teamIdx !== undefined ? car.teamIdx : (carIdx >= 0 ? Math.floor(carIdx / 2) % (TEAM_PALETTE?.length || 10) : 0));


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
let lastRenderedSteerDeg = -999;
let lastRenderedBrakePct = -999;
let lastRenderedGasPct = -999;
const elCockpitWheel = $('cockpit-wheel');
const elPedalBrakeFill = $('pedal-brake-fill');
const elPedalGasFill = $('pedal-gas-fill');

function updateCockpitAnimation(focusCar) {
  if (!isTelemetryOpen) return;
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
  if (elCockpitWheel && Math.abs(steerDeg - lastRenderedSteerDeg) >= 0.12) {
    lastRenderedSteerDeg = steerDeg;
    elCockpitWheel.style.transform = `rotate(${steerDeg.toFixed(1)}deg)`;
  }

  const brakePct = smoothBrake * 100;
  if (elPedalBrakeFill && Math.abs(brakePct - lastRenderedBrakePct) >= 0.25) {
    lastRenderedBrakePct = brakePct;
    elPedalBrakeFill.style.height = `${brakePct.toFixed(1)}%`;
  }

  const gasPct = smoothGas * 100;
  if (elPedalGasFill && Math.abs(gasPct - lastRenderedGasPct) >= 0.25) {
    lastRenderedGasPct = gasPct;
    elPedalGasFill.style.height = `${gasPct.toFixed(1)}%`;
  }
}

// ---------- Main loop ----------
let last = performance.now();
const playbackClock = new FixedStepClock(CONFIG.dt);
let stepCounter = 0;
let rateStart = last;
let effSpeed = 1;
let hudTimer = 0;
let leaderboardTimer = 0;
let frameCount = 0;
let fpsTimer = last;
let currentFps = 60;
let lowFpsStreak = 0;
let simTimeAccum = 0;
let renderTimeAccum = 0;
let profFrameCount = 0;
let lastPerfLog = 0;
let lastSaveMs = 0;
let lastSaveAt = -Infinity;
let lastStutterLog = 0;
let worstFrameMs = 0;
let previousSimMs = 0;
let previousRenderMs = 0;
let previousUiMs = 0;
let diagnosticFocus = null;
let diagnosticCamera = null;
let lastFocusChangeAt = -Infinity;
let lastCameraChangeAt = -Infinity;
installFrameDiagnostics();
const motionDebug = new URLSearchParams(window.location.search).has('motionDebug');
sim.motionDebug = motionDebug;

function frame(now) {
  const realDt = (now - last) / 1000;
  worstFrameMs = Math.max(worstFrameMs, realDt * 1000);
  last = now;

  if (hyperRunning) {
    playbackClock.reset();
    frameActive = false;
    return;
  }
  frameActive = true;

  if (!document.hidden && realDt > 0.034 && now - lastStutterLog > 1000) {
    lastStutterLog = now;
    console.info(`[STUTTER] Gap ${(realDt * 1000).toFixed(1)}ms | Previous sim ${previousSimMs.toFixed(1)}ms | Render ${previousRenderMs.toFixed(1)}ms | UI ${previousUiMs.toFixed(1)}ms | Save ${lastSaveMs.toFixed(1)}ms (${(performance.now() - lastSaveAt).toFixed(0)}ms ago) | Focus changed ${(now - lastFocusChangeAt).toFixed(0)}ms ago | Camera changed ${(now - lastCameraChangeAt).toFixed(0)}ms ago`);
  }

  sim.playerControls.steer = (keys.ArrowRight ? 1 : 0) - (keys.ArrowLeft ? 1 : 0);
  sim.playerControls.throttle = keys.ArrowUp ? 1 : keys.ArrowDown ? -1 : 0;

  const tSimStart = performance.now();
  if (!state.paused) {
    const t0 = performance.now();
    if (state.turbo) {
      playbackClock.reset();
      do {
        for (let k = 0; k < 10; k++) sim.step(CONFIG.dt);
        stepCounter += 10;
      } while (performance.now() - t0 < CONFIG.budgetMs);
    } else {
      const PLAYBACK_SPEED_FACTOR = 0.90; // Calibrated playback speed: aligns real visual velocity with authentic F1 300+ km/h speeds
      const simSpeed = (state.manual ? 1.0 : state.speed) * PLAYBACK_SPEED_FACTOR;
      stepCounter += playbackClock.advance(realDt, simSpeed, (dt) => sim.step(dt));
    }
  } else {
    playbackClock.reset();
  }
  const tSim = performance.now() - tSimStart;
  simTimeAccum += tSim;

  const userManualCar = (focusedFollowCar && (focusedFollowCar.alive || focusedFollowCar.finished) && !focusedFollowCar.crashed)
    ? focusedFollowCar
    : null;

  // Active P1 race leader: always track the physical race leader (P1)
  const p1Leader = (state.manual && sim.player && (sim.player.alive || sim.player.finished) && !sim.player.crashed)
    ? sim.player
    : (sim.leader || sim.bestLapCar || (sim.cars && sim.cars[0]) || null);

  const activeFocus = userManualCar || p1Leader;

  const renderOpts = { ...state, manualFocusCar: userManualCar,
    motionDebug,
    renderDt: realDt,
    renderAlpha: state.paused || state.turbo ? 1 : playbackClock.alpha };

  const tRenderStart = performance.now();
  if (state.view3d && renderer3d) {
    renderer3d.render(sim, renderOpts, activeFocus);
  } else {
    renderer.render(sim, renderOpts, activeFocus);
  }
  const tRender = performance.now() - tRenderStart;
  const tUiStart = performance.now();
  renderTimeAccum += tRender;
  profFrameCount++;

  // Derive the active car in focus (from 3D director, 2D follower, or manual player)
  const currentFocus = (state.manual && sim.player && (sim.player.alive || sim.player.finished))
    ? sim.player
    : (state.view3d && renderer3d?.focusedCar && (renderer3d.focusedCar.alive || renderer3d.focusedCar.finished))
      ? renderer3d.focusedCar
      : ((renderer?.focusedCar && (renderer.focusedCar.alive || renderer.focusedCar.finished)) ? renderer.focusedCar : activeFocus);
  if (currentFocus !== diagnosticFocus) lastFocusChangeAt = now;
  diagnosticFocus = currentFocus;
  const cameraName = state.view3d ? renderer3d?.activeCameraPreset : '2D';
  if (cameraName !== diagnosticCamera) lastCameraChangeAt = now;
  diagnosticCamera = cameraName;

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

  // FPS calculation & adaptive resolution scaling
  frameCount++;
  if (now - fpsTimer >= 400) {
    currentFps = Math.round((frameCount * 1000) / (now - fpsTimer));
    const avgSimMs = profFrameCount > 0 ? (simTimeAccum / profFrameCount).toFixed(1) : '0';
    const avgRenderMs = profFrameCount > 0 ? (renderTimeAccum / profFrameCount).toFixed(1) : '0';
    simTimeAccum = 0;
    renderTimeAccum = 0;
    profFrameCount = 0;
    frameCount = 0;
    fpsTimer = now;

    const calls = (state.view3d && renderer3d?.renderer?.info?.render?.calls) || 0;
    const tris = (state.view3d && renderer3d?.renderer?.info?.render?.triangles) || 0;
    const perfDetail = `FPS: ${currentFps} | Sim: ${avgSimMs}ms | Render: ${avgRenderMs}ms | Worst frame: ${worstFrameMs.toFixed(1)}ms | Save: ${lastSaveMs.toFixed(1)}ms | Calls: ${calls} | Tris: ${(tris / 1000).toFixed(0)}k`;

    const pillFps = $('pill-fps');
    if (pillFps) {
      pillFps.textContent = currentFps;
      pillFps.title = perfDetail;
    }
    const hudFps = $('hud-fps');
    if (hudFps) {
      hudFps.textContent = currentFps;
      hudFps.title = perfDetail;
    }
    const statFps = $('stat-fps');
    if (statFps) {
      statFps.textContent = currentFps;
      statFps.title = perfDetail;
    }

    if (now - lastPerfLog >= 3000) {
      lastPerfLog = now;
      console.log(`[PERF 3D] ${perfDetail}`);
      worstFrameMs = 0;
    }
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
  previousSimMs = tSim;
  previousRenderMs = tRender;
  previousUiMs = performance.now() - tUiStart;
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
setAudio(true, false);
audio.resume();

// Sync settings from localStorage
const savedFollow = localStorage.getItem('ai-racer:follow');
setToggle('follow', savedFollow !== null ? savedFollow !== 'false' : true, false);

const savedGhosts = localStorage.getItem('ai-racer:ghosts');
setGhostMode(savedGhosts !== null ? savedGhosts !== 'false' : true, false);

const savedGridBox = localStorage.getItem('ai-racer:gridBox');
setGridBox(savedGridBox !== null ? savedGridBox !== 'false' : true, false);

const savedLaps = localStorage.getItem('ai-racer:maxLaps');
setMaxLaps(savedLaps !== null ? parseInt(savedLaps, 10) : (CONFIG.generation?.maxLaps || 5), false);

// Every session starts with Auto Director; manual camera choices last this session.
setCameraPreset('auto', false);
renderGenPresetsRibbon();
updateHud(sim.leader);
chart.draw(sim.history, sim.bestLapEver);
requestAnimationFrame(frame);

// Show gentle welcome onboarding guide for new users
try {
  const guideSeen = localStorage.getItem('ai-racer:welcome-guide-seen');
  const hasHistory = savedState && (sim.generation > 1 || sim.allTimeBest || (sim.history && sim.history.length > 0));
  if (!guideSeen && !hasHistory) {
    setTimeout(() => {
      if (!localStorage.getItem('ai-racer:welcome-guide-seen') && !hyperRunning) {
        openWelcomeGuide();
      }
    }, 1200);
  }
} catch (_) {}
