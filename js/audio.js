/**
 * High-Fidelity Deep GT / V8 Race Engine Acoustic Synthesizer.
 * Provides a deep, throaty, organic exhaust roar:
 *  - Deep bass fundamental pulse (35 Hz – 240 Hz) instead of high-pitched buzzy synthesizers
 *  - Organic combustion air turbulence & exhaust cavity resonance
 *  - Warm analog low-pass filtering (eliminates harsh high frequencies)
 *  - Realistic 6-speed sequential gearbox with smooth rev-drops
 *  - Smooth binaural stereo panning & distance air absorption
 */
import { CONFIG } from './config.js';

// Soft-saturation tube distortion curve (warms up low frequencies, rounds off harsh peaks)
function makeWarmDistortionCurve(amount = 4, n_samples = 2048) {
  const curve = new Float32Array(n_samples);
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    // Soft hyperbolic tangent saturation
    curve[i] = Math.tanh(x * (1 + amount * 0.4));
  }
  return curve;
}

// Organic filtered brown noise for combustion turbulence and tire contact
function generateBrownNoise(ctx, duration = 2.0) {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let lastOut = 0.0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    lastOut = (lastOut + 0.02 * white) / 1.02;
    data[i] = lastOut * 3.5;
  }
  return buffer;
}

/**
 * An individual car's deep physical acoustic voice.
 */
class RealtimeEngineVoice {
  constructor(ctx, masterCompressor, distortionCurve, brownNoiseBuffer) {
    this.ctx = ctx;
    this.activeCar = null;

    // Master Voice Gain Node
    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(0, ctx.currentTime);

    // Distance & Air Absorption Low-Pass Filter
    this.airFilter = ctx.createBiquadFilter();
    this.airFilter.type = 'lowpass';
    this.airFilter.frequency.setValueAtTime(2200, ctx.currentTime);

    // Stereo Panner
    if (ctx.createStereoPanner) {
      this.pannerNode = ctx.createStereoPanner();
      this.pannerNode.pan.setValueAtTime(0, ctx.currentTime);
    } else {
      this.pannerNode = null;
    }

    // --- DEEP EXHAUST RESONATOR FILTERS ---
    // 1. Throaty Engine Block Resonator (220 Hz growl peak)
    this.exhaustResonator = ctx.createBiquadFilter();
    this.exhaustResonator.type = 'peaking';
    this.exhaustResonator.frequency.setValueAtTime(220, ctx.currentTime);
    this.exhaustResonator.gain.setValueAtTime(4.5, ctx.currentTime);
    this.exhaustResonator.Q.setValueAtTime(1.6, ctx.currentTime);

    // 2. High Frequency Anti-Screech Cutoff (Rolls off all harsh frequencies above 1200 Hz)
    this.engineBodyFilter = ctx.createBiquadFilter();
    this.engineBodyFilter.type = 'lowpass';
    this.engineBodyFilter.frequency.setValueAtTime(1100, ctx.currentTime);
    this.engineBodyFilter.Q.setValueAtTime(0.85, ctx.currentTime);

    // Soft Saturation WaveShaper for warm exhaust distortion
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = distortionCurve;
    this.shaper.oversample = '2x';

    // --- OSCILLATOR SYNTHESIS NETWORK (DEEP V8 FUNDAMENTALS) ---
    // 1. Sub-Bass Crankcase Rumble (35 Hz – 90 Hz, Triangle)
    this.oscSub = ctx.createOscillator();
    this.oscSub.type = 'triangle';
    this.oscSub.frequency.setValueAtTime(45, ctx.currentTime);
    this.gainSub = ctx.createGain();
    this.gainSub.gain.setValueAtTime(0.48, ctx.currentTime);
    this.oscSub.connect(this.gainSub);

    // 2. Main Cylinder Combustion Stroke (70 Hz – 180 Hz, Triangle + Sine mix)
    this.oscPulse = ctx.createOscillator();
    this.oscPulse.type = 'triangle';
    this.oscPulse.frequency.setValueAtTime(80, ctx.currentTime);
    this.gainPulse = ctx.createGain();
    this.gainPulse.gain.setValueAtTime(0.45, ctx.currentTime);
    this.oscPulse.connect(this.gainPulse);

    // 3. Exhaust Manifold Harmonic (140 Hz – 360 Hz, Sine with warm undertone)
    this.oscHarmonic = ctx.createOscillator();
    this.oscHarmonic.type = 'sine';
    this.oscHarmonic.frequency.setValueAtTime(160, ctx.currentTime);
    this.gainHarmonic = ctx.createGain();
    this.gainHarmonic.gain.setValueAtTime(0.35, ctx.currentTime);
    this.oscHarmonic.connect(this.gainHarmonic);

    // 4. Organic Exhaust Air Turbulence (Modulated Brown Noise)
    this.airSource = ctx.createBufferSource();
    this.airSource.buffer = brownNoiseBuffer;
    this.airSource.loop = true;
    this.airFilterNoise = ctx.createBiquadFilter();
    this.airFilterNoise.type = 'bandpass';
    this.airFilterNoise.frequency.setValueAtTime(280, ctx.currentTime);
    this.airFilterNoise.Q.setValueAtTime(1.8, ctx.currentTime);
    this.airNoiseGain = ctx.createGain();
    this.airNoiseGain.gain.setValueAtTime(0.20, ctx.currentTime);

    this.airSource.connect(this.airFilterNoise);
    this.airFilterNoise.connect(this.airNoiseGain);

    // Mix Oscillators into Shaper & Resonators
    const engineMix = ctx.createGain();
    engineMix.gain.setValueAtTime(0.85, ctx.currentTime);

    this.gainSub.connect(engineMix);
    this.gainPulse.connect(engineMix);
    this.gainHarmonic.connect(engineMix);
    this.airNoiseGain.connect(engineMix);

    engineMix.connect(this.shaper);
    this.shaper.connect(this.exhaustResonator);
    this.exhaustResonator.connect(this.engineBodyFilter);
    this.engineBodyFilter.connect(this.airFilter);

    // --- TIRE CONTACT / ASPHALT SCRUB ---
    this.tireSource = ctx.createBufferSource();
    this.tireSource.buffer = brownNoiseBuffer;
    this.tireSource.loop = true;
    this.tireFilter = ctx.createBiquadFilter();
    this.tireFilter.type = 'lowpass';
    this.tireFilter.frequency.setValueAtTime(650, ctx.currentTime);
    this.tireGain = ctx.createGain();
    this.tireGain.gain.setValueAtTime(0, ctx.currentTime);

    this.tireSource.connect(this.tireFilter);
    this.tireFilter.connect(this.tireGain);
    this.tireGain.connect(this.airFilter);

    // Output routing
    if (this.pannerNode) {
      this.airFilter.connect(this.pannerNode);
      this.pannerNode.connect(this.gainNode);
    } else {
      this.airFilter.connect(this.gainNode);
    }
    this.gainNode.connect(masterCompressor);

    // Start running continuous sources
    this.oscSub.start();
    this.oscPulse.start();
    this.oscHarmonic.start();
    this.airSource.start();
    this.tireSource.start();

    // Internal simulation state
    this.currentRpm = 1800;
    this.lastGear = 1;
    this.shiftCutTimer = 0;
  }

  update(car, dist, pan, maxDist = 2200, isFocused = false) {
    this.activeCar = car;
    const now = this.ctx.currentTime;
    const ramp = 0.05;

    if (!car || !car.alive) {
      this.gainNode.gain.setTargetAtTime(0, now, 0.08);
      this.tireGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // 1. Natural distance attenuation
    const dRef = 50;
    const normDist = Math.min(1, Math.max(0, (dist - dRef) / (maxDist - dRef)));

    let distGain = 0;
    let airCutoff = 2200;
    let baseMixGain = 0.18; // Competitor cars ambient level

    if (isFocused) {
      // Primary follow car: deep, warm, powerful volume
      distGain = 1.0;
      airCutoff = 2400;
      baseMixGain = 0.75;
    } else {
      // Competitor cars: warm, trackside roar
      distGain = Math.max(0, Math.pow(1 - normDist, 1.9));
      airCutoff = 350 + (1400 - 350) * Math.pow(1 - normDist, 1.8);
      baseMixGain = 0.18;
    }

    this.airFilter.frequency.setTargetAtTime(airCutoff, now, ramp);

    // 2. Stereo Panning
    if (this.pannerNode) {
      const panVal = isFocused ? pan * 0.22 : pan;
      this.pannerNode.pan.setTargetAtTime(Math.max(-1, Math.min(1, panVal)), now, ramp);
    }

    // 3. Realistic 6-Speed V8 Gearbox Engine RPM Model (1,100 RPM – 6,800 RPM)
    const maxSpeed = CONFIG.car.maxSpeed || 440;
    const speed = Math.max(0, car.speed || 0);
    const speedRatio = Math.min(1.10, speed / maxSpeed);
    const throttle = Math.max(0, car.throttle || 0);

    const gearMaxSpeeds = [0.16, 0.32, 0.50, 0.68, 0.88, 1.15];
    let gear = 1;
    let gearMinRatio = 0;
    let gearMaxRatio = gearMaxSpeeds[0];

    for (let g = 0; g < gearMaxSpeeds.length; g++) {
      if (speedRatio <= gearMaxSpeeds[g] || g === gearMaxSpeeds.length - 1) {
        gear = g + 1;
        gearMinRatio = g === 0 ? 0 : gearMaxSpeeds[g - 1] * 0.80;
        gearMaxRatio = gearMaxSpeeds[g];
        break;
      }
    }

    if (gear !== this.lastGear) {
      this.lastGear = gear;
      this.shiftCutTimer = 0.06;
    }

    const gearSpan = gearMaxRatio - gearMinRatio || 0.01;
    const gearProgress = Math.min(1.0, Math.max(0, (speedRatio - gearMinRatio) / gearSpan));

    // Realistic RPM range: idle at 1,150 RPM, peak redline at 6,500 RPM
    const idleRpm = 1150;
    const redlineRpm = 6500;
    const targetRpm = idleRpm + gearProgress * (redlineRpm - idleRpm) + throttle * 350;

    if (this.shiftCutTimer > 0) {
      this.shiftCutTimer -= 0.016;
      this.currentRpm = this.currentRpm * 0.90;
    } else {
      this.currentRpm += (targetRpm - this.currentRpm) * 0.16;
    }

    const clampedRpm = Math.max(1050, Math.min(7200, this.currentRpm));

    // 4. Fundamental V8 Firing Frequencies (DEEP, THROATY BASS)
    // f0 (fundamental cylinder pulse): 35 Hz to 240 Hz
    const fPulse = (clampedRpm / 60) * 2.0; // ~38 Hz at idle, ~216 Hz at redline
    const fSub = fPulse * 0.5; // ~19 Hz to 108 Hz deep sub rumble
    const fHarmonic = fPulse * 2.0; // ~76 Hz to 432 Hz exhaust manifold

    this.oscSub.frequency.setTargetAtTime(fSub, now, ramp);
    this.oscPulse.frequency.setTargetAtTime(fPulse, now, ramp);
    this.oscHarmonic.frequency.setTargetAtTime(fHarmonic, now, ramp);

    // Dynamic exhaust resonator following the engine load
    const resonatorFreq = 180 + (clampedRpm / 7200) * 220;
    this.exhaustResonator.frequency.setTargetAtTime(resonatorFreq, now, ramp);
    this.airFilterNoise.frequency.setTargetAtTime(resonatorFreq * 1.2, now, ramp);

    // 5. Dynamic Organic Volume Modulation
    const throttleBoost = isFocused ? (0.85 + throttle * 0.35) : (0.75 + throttle * 0.25);
    const voiceVol = distGain * baseMixGain * throttleBoost;
    this.gainNode.gain.setTargetAtTime(voiceVol, now, ramp);

    // 6. Deep Tire Road Texture & Scrub
    const slipSpeed = Math.abs(car.slipAngle || 0) * speed;
    const isDrifting = slipSpeed > 22 || (car.crashed && speed > 20);
    if (isDrifting) {
      const scrubFactor = Math.min(1, (slipSpeed - 20) / 60);
      const scrubVol = scrubFactor * (isFocused ? 0.32 : distGain * 0.10);
      this.tireGain.gain.setTargetAtTime(scrubVol, now, 0.03);
      this.tireFilter.frequency.setTargetAtTime(450 + scrubFactor * 400, now, 0.04);
    } else {
      this.tireGain.gain.setTargetAtTime(0, now, 0.06);
    }
  }

  silence() {
    const now = this.ctx.currentTime;
    this.gainNode.gain.setTargetAtTime(0, now, 0.08);
    this.tireGain.gain.setTargetAtTime(0, now, 0.08);
    this.activeCar = null;
  }
}

export class SpatialAudioEngine {
  constructor() {
    this.ctx = null;
    this.masterGain = null;
    this.compressor = null;
    this.enabled = true;
    this.maxVoices = 4;
    this.voices = [];
    this.inited = false;
    this.maxAudibleDist = 2000;
    this.crashBuffer = null;

    this.init();
  }

  init() {
    if (this.inited || typeof window === 'undefined') return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();

      // Master Studio Dynamics Compressor for warm, punchy transparent limiting
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-8.0, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(10, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(3.0, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

      // Warm, balanced master gain calibrated for clear audibility at standard system volume
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.85, this.ctx.currentTime);

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      const distortionCurve = makeWarmDistortionCurve(4);
      const brownNoiseBuffer = generateBrownNoise(this.ctx, 2.0);

      for (let i = 0; i < this.maxVoices; i++) {
        this.voices.push(
          new RealtimeEngineVoice(this.ctx, this.compressor, distortionCurve, brownNoiseBuffer)
        );
      }

      this.createCrashBuffer();
      this.inited = true;
      this.enabled = true;

      this._setupAutoUnlock();
    } catch (err) {
      console.warn('AudioContext initialization error:', err);
    }
  }

  _setupAutoUnlock() {
    if (typeof window === 'undefined') return;

    const unlockHandler = () => {
      this.resume();
      if (this.ctx && this.ctx.state === 'running') {
        const events = ['click', 'pointerdown', 'mousedown', 'mouseup', 'keydown', 'touchstart', 'touchend', 'mousemove', 'wheel', 'focus'];
        events.forEach((evt) => window.removeEventListener(evt, unlockHandler, { capture: true }));
      }
    };

    const events = ['click', 'pointerdown', 'mousedown', 'mouseup', 'keydown', 'touchstart', 'touchend', 'mousemove', 'wheel', 'focus'];
    events.forEach((evt) => {
      window.addEventListener(evt, unlockHandler, { capture: true, passive: true });
    });
  }

  createCrashBuffer() {
    if (!this.ctx) return;
    const sampleRate = this.ctx.sampleRate;
    const duration = 0.45;
    const frameCount = Math.floor(sampleRate * duration);
    const buffer = this.ctx.createBuffer(1, frameCount, sampleRate);
    const data = buffer.getChannelData(0);

    for (let i = 0; i < frameCount; i++) {
      const t = i / sampleRate;
      const decay = Math.exp(-t * 12);
      const noise = (Math.random() * 2 - 1) * 0.35;
      const thud = Math.sin(2 * Math.PI * (85 * Math.exp(-t * 9)) * t) * 0.45;
      data[i] = (noise + thud) * decay * 0.35;
    }
    this.crashBuffer = buffer;
  }

  playImpact(x, y, camPos, speed = 150) {
    if (!this.enabled || !this.ctx || !this.crashBuffer) return;
    this.resume();

    const dx = x - (camPos.x || 0);
    const dy = y - (camPos.y || 0);
    const dz = 0 - (camPos.z || 300);
    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

    if (dist > this.maxAudibleDist) return;

    const normDist = Math.min(1, Math.max(0, dist / this.maxAudibleDist));
    const volume = Math.max(0, (1 - normDist) * Math.min(1, Math.max(0.3, speed / 180)) * 0.50);

    if (volume <= 0.01) return;

    try {
      const source = this.ctx.createBufferSource();
      source.buffer = this.crashBuffer;

      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(volume, this.ctx.currentTime);

      source.connect(gain);
      gain.connect(this.compressor || this.masterGain);
      source.start();
    } catch (e) {
      // Ignore
    }
  }

  resume() {
    if (!this.inited) this.init();
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
  }

  toggle() {
    if (!this.inited) {
      this.init();
    }
    this.resume();
    this.enabled = !this.enabled;
    if (this.masterGain && this.ctx) {
      const targetGain = this.enabled ? 0.85 : 0;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.04);
    }
    return this.enabled;
  }

  silenceAll() {
    if (this.voices) {
      for (let i = 0; i < this.voices.length; i++) {
        this.voices[i].silence();
      }
    }
  }

  update(sim, state, activeFocus, renderer3d, renderer) {
    const isTraining = state?.hyperRunning || sim?.hyperRunning || state?.inTrainingMode;
    if (!this.enabled || !this.inited || !this.ctx || state?.paused || isTraining) {
      this.silenceAll();
      return;
    }

    if (this.ctx.state === 'suspended') {
      this.resume();
      return;
    }

    // 1. Determine active camera position and binaural pan vector in simulation space
    let camSimX = 0, camSimY = 0, camSimZ = 350;
    let rightX = 1, rightY = 0;

    if (state.view3d && renderer3d && renderer3d.camera) {
      const cam = renderer3d.camera;
      const target = (renderer3d.controls && renderer3d.controls.target)
        ? renderer3d.controls.target
        : { x: 0, y: 0, z: 0 };

      // In Three.js: world X is sim.x, world Y is -sim.y, world Z is elevation
      camSimX = cam.position.x;
      camSimY = -cam.position.y;
      camSimZ = cam.position.z;

      const targetSimX = target.x;
      const targetSimY = -target.y;

      const fwdX = targetSimX - camSimX;
      const fwdY = targetSimY - camSimY;
      const fwdLen = Math.hypot(fwdX, fwdY) || 1;
      const normFwdX = fwdX / fwdLen;
      const normFwdY = fwdY / fwdLen;

      // In sim 2D plane (where Y is positive downwards):
      // A 90-degree clockwise (right) rotation maps (x, y) -> (-y, x)
      rightX = -normFwdY;
      rightY = normFwdX;
    } else if (renderer) {
      if (renderer.cam) {
        camSimX = renderer.cam.x || 0;
        camSimY = renderer.cam.y || 0;
      } else if (renderer.track) {
        camSimX = renderer.track.cx || 0;
        camSimY = renderer.track.cy || 0;
      }
      camSimZ = 450;
      rightX = 1;
      rightY = 0;
    }

    // 2. Primary Follow Car (Voice 0) - Locked to camera focused car or manual player
    const focusCar = (state.manual && sim.player && (sim.player.alive || sim.player.finished))
      ? sim.player
      : (activeFocus && (activeFocus.alive || activeFocus.finished) ? activeFocus : (sim.leader && (sim.leader.alive || sim.leader.finished) ? sim.leader : null));

    if (focusCar) {
      const dx = focusCar.x - camSimX;
      const dy = focusCar.y - camSimY;
      const dz = (focusCar.elev || 0) - camSimZ;
      const dist = Math.hypot(dx, dy, dz);

      const toCarX = focusCar.x - camSimX;
      const toCarY = focusCar.y - camSimY;
      const toCarLen = Math.hypot(toCarX, toCarY) || 1;
      const pan = Math.max(-1, Math.min(1, ((toCarX / toCarLen) * rightX) + ((toCarY / toCarLen) * rightY)));

      this.voices[0].update(focusCar, dist, pan, this.maxAudibleDist, true);
    } else {
      this.voices[0].silence();
    }

    // 3. Subtle background layer for competitors (Voices 1 to 3)
    const otherCandidates = [];
    if (sim.cars) {
      for (let i = 0; i < sim.cars.length; i++) {
        const c = sim.cars[i];
        if (c && (c.alive || c.finished) && c !== focusCar) {
          const dx = c.x - camSimX;
          const dy = c.y - camSimY;
          const dz = (c.elev || 0) - camSimZ;
          const dist = Math.hypot(dx, dy, dz);
          if (dist <= this.maxAudibleDist) {
            otherCandidates.push({ car: c, dist });
          }
        }
      }
    }

    otherCandidates.sort((a, b) => a.dist - b.dist);

    const availableVoices = this.maxVoices - 1;
    const count = Math.min(otherCandidates.length, availableVoices);

    for (let i = 0; i < availableVoices; i++) {
      const voiceIndex = i + 1;
      const voice = this.voices[voiceIndex];

      if (i < count) {
        const item = otherCandidates[i];
        const car = item.car;
        const dist = item.dist;

        const toCarX = car.x - camSimX;
        const toCarY = car.y - camSimY;
        const toCarLen = Math.hypot(toCarX, toCarY) || 1;
        const pan = Math.max(-1, Math.min(1, ((toCarX / toCarLen) * rightX) + ((toCarY / toCarLen) * rightY)));

        voice.update(car, dist, pan, this.maxAudibleDist, false);
      } else {
        voice.silence();
      }
    }
  }

  playStartBeep(isGreen = false) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    try {
      const now = this.ctx.currentTime;
      const master = this.masterGain;

      if (!isGreen) {
        // --- CRISP MOTORSPORT COUNTDOWN TONE (Gran Turismo / F1 Marshal Beep) ---
        // Clean fundamental at 880 Hz with sharp transient attack & overtone
        const baseFreq = 880;
        const dur = 0.14;

        // Primary Oscillator (Pure sine with pitch envelope attack for click/snap)
        const osc1 = this.ctx.createOscillator();
        const gain1 = this.ctx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(baseFreq * 1.35, now);
        osc1.frequency.exponentialRampToValueAtTime(baseFreq, now + 0.012);

        gain1.gain.setValueAtTime(0.0001, now);
        gain1.gain.linearRampToValueAtTime(0.42, now + 0.004);
        gain1.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        osc1.connect(gain1);
        gain1.connect(master);
        osc1.start(now);
        osc1.stop(now + dur + 0.01);

        // Harmonic Overtone (Triangle 2nd harmonic for clarity and presence)
        const osc2 = this.ctx.createOscillator();
        const gain2 = this.ctx.createGain();
        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(baseFreq * 2, now); // 1760 Hz

        gain2.gain.setValueAtTime(0.0001, now);
        gain2.gain.linearRampToValueAtTime(0.18, now + 0.004);
        gain2.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.7);

        osc2.connect(gain2);
        gain2.connect(master);
        osc2.start(now);
        osc2.stop(now + dur + 0.01);
      } else {
        // --- HIGH-ENERGY RACE LAUNCH CHIME & IMPACT (Lights Out / Green Flag) ---
        // Authoritative resonant high start chord (1760 Hz + 2640 Hz) + Sub Bass Launch Thump
        const dur = 0.55;

        // 1. High Start Tone (1760 Hz A6)
        const oscHigh = this.ctx.createOscillator();
        const gainHigh = this.ctx.createGain();
        oscHigh.type = 'sine';
        oscHigh.frequency.setValueAtTime(1760, now);

        gainHigh.gain.setValueAtTime(0.0001, now);
        gainHigh.gain.linearRampToValueAtTime(0.50, now + 0.005);
        gainHigh.gain.exponentialRampToValueAtTime(0.0001, now + dur);

        oscHigh.connect(gainHigh);
        gainHigh.connect(master);
        oscHigh.start(now);
        oscHigh.stop(now + dur + 0.01);

        // 2. Harmonic 5th Chime (2640 Hz E7)
        const oscFifth = this.ctx.createOscillator();
        const gainFifth = this.ctx.createGain();
        oscFifth.type = 'sine';
        oscFifth.frequency.setValueAtTime(2640, now);

        gainFifth.gain.setValueAtTime(0.0001, now);
        gainFifth.gain.linearRampToValueAtTime(0.24, now + 0.005);
        gainFifth.gain.exponentialRampToValueAtTime(0.0001, now + dur * 0.85);

        oscFifth.connect(gainFifth);
        gainFifth.connect(master);
        oscFifth.start(now);
        oscFifth.stop(now + dur + 0.01);

        // 3. Sub-Bass Launch Impact (180 Hz -> 48 Hz kick drop for visceral start punch)
        const oscSub = this.ctx.createOscillator();
        const gainSub = this.ctx.createGain();
        oscSub.type = 'sine';
        oscSub.frequency.setValueAtTime(180, now);
        oscSub.frequency.exponentialRampToValueAtTime(48, now + 0.22);

        gainSub.gain.setValueAtTime(0.0001, now);
        gainSub.gain.linearRampToValueAtTime(0.55, now + 0.008);
        gainSub.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);

        oscSub.connect(gainSub);
        gainSub.connect(master);
        oscSub.start(now);
        oscSub.stop(now + 0.30);
      }
    } catch {}
  }

  playTireThump(intensity = 1.0) {
    if (!this.enabled || !this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    if (this._lastTireSoundTime && now - this._lastTireSoundTime < 0.08) return;
    this._lastTireSoundTime = now;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(120, now);
      osc.frequency.exponentialRampToValueAtTime(32, now + 0.16);

      const vol = Math.min(0.65, 0.32 * (intensity / 30));
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(vol, now + 0.005);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);

      osc.connect(gain);
      gain.connect(this.masterGain);
      osc.start(now);
      osc.stop(now + 0.24);
    } catch {}
  }

  playSuccess() {
    // Optional success chime
  }
}

export const audio = new SpatialAudioEngine();
