/**
 * Subtle Formula 1 V10 Acoustic Engine for AI Racer.
 * Provides a gentle, refined, and subtle racing engine sound:
 *  - Primary focus car (followed car / player) is pleasant, soft, and clear
 *  - Surrounding cars provide a very subtle, soft background ambience
 *  - Smooth, non-fatiguing harmonic saturation and formant filters
 *  - Continuous radial distance attenuation
 */
import { CONFIG } from './config.js';

// Smooth, warm soft-clipping saturation curve
function makeDistortionCurve(amount = 8, n_samples = 2048) {
  const curve = new Float32Array(n_samples);
  const deg = Math.PI / 180;
  for (let i = 0; i < n_samples; ++i) {
    const x = (i * 2) / n_samples - 1;
    curve[i] = ((3 + amount) * x * 20 * deg) / (Math.PI + amount * Math.abs(x));
  }
  return curve;
}

// Gentle pink noise for subtle road texture
function generatePinkNoise(ctx, duration = 1.5) {
  const sampleRate = ctx.sampleRate;
  const length = Math.floor(sampleRate * duration);
  const buffer = ctx.createBuffer(1, length, sampleRate);
  const data = buffer.getChannelData(0);

  let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.96900 * b2 + white * 0.1538520;
    b3 = 0.86650 * b3 + white * 0.3104856;
    b4 = 0.55000 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.0168980;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.08;
    b6 = white * 0.115926;
  }
  return buffer;
}

/**
 * An individual car's real-time physical acoustic voice.
 */
class RealtimeF1Voice {
  constructor(ctx, masterCompressor, distortionCurve, pinkNoiseBuffer) {
    this.ctx = ctx;
    this.activeCar = null;

    // Master Voice Gain Node
    this.gainNode = ctx.createGain();
    this.gainNode.gain.setValueAtTime(0, ctx.currentTime);

    // Distance & Air Absorption Low-Pass Filter
    this.airFilter = ctx.createBiquadFilter();
    this.airFilter.type = 'lowpass';
    this.airFilter.frequency.setValueAtTime(14000, ctx.currentTime);

    // Stereo Panner
    if (ctx.createStereoPanner) {
      this.pannerNode = ctx.createStereoPanner();
      this.pannerNode.pan.setValueAtTime(0, ctx.currentTime);
    } else {
      this.pannerNode = null;
    }

    // --- REFINED FORMANT FILTERS ---
    // 1. Warm Collector Mid-Range (1150 Hz)
    this.formant1 = ctx.createBiquadFilter();
    this.formant1.type = 'peaking';
    this.formant1.frequency.setValueAtTime(1150, ctx.currentTime);
    this.formant1.gain.setValueAtTime(3.0, ctx.currentTime);
    this.formant1.Q.setValueAtTime(1.8, ctx.currentTime);

    // 2. Soft Tailpipe Shimmer (3000 Hz)
    this.formant2 = ctx.createBiquadFilter();
    this.formant2.type = 'peaking';
    this.formant2.frequency.setValueAtTime(3000, ctx.currentTime);
    this.formant2.gain.setValueAtTime(2.0, ctx.currentTime);
    this.formant2.Q.setValueAtTime(2.0, ctx.currentTime);

    // Soft Saturation WaveShaper
    this.shaper = ctx.createWaveShaper();
    this.shaper.curve = distortionCurve;
    this.shaper.oversample = '2x';

    // --- OSCILLATOR SYNTHESIS NETWORK ---
    // 1. Primary Firing Oscillator (Sawtooth at f_fire = RPM/60 * 5)
    this.oscA = ctx.createOscillator();
    this.oscA.type = 'sawtooth';
    this.oscA.frequency.setValueAtTime(250, ctx.currentTime);
    this.gainA = ctx.createGain();
    this.gainA.gain.setValueAtTime(0.22, ctx.currentTime);
    this.oscA.connect(this.gainA);

    // 2. Detuned Bank Oscillator (+6 cents)
    this.oscB = ctx.createOscillator();
    this.oscB.type = 'sawtooth';
    this.oscB.frequency.setValueAtTime(250, ctx.currentTime);
    this.oscB.detune.setValueAtTime(6, ctx.currentTime);
    this.gainB = ctx.createGain();
    this.gainB.gain.setValueAtTime(0.18, ctx.currentTime);
    this.oscB.connect(this.gainB);

    // 3. Sub-Harmonic Cylinder Bank Pulse (0.5 * f_fire)
    this.oscSub = ctx.createOscillator();
    this.oscSub.type = 'sawtooth';
    this.oscSub.frequency.setValueAtTime(125, ctx.currentTime);
    this.gainSub = ctx.createGain();
    this.gainSub.gain.setValueAtTime(0.14, ctx.currentTime);
    this.oscSub.connect(this.gainSub);

    // 4. Crankshaft Mechanical Body (0.2 * f_fire, triangle)
    this.oscCrank = ctx.createOscillator();
    this.oscCrank.type = 'triangle';
    this.oscCrank.frequency.setValueAtTime(50, ctx.currentTime);
    this.gainCrank = ctx.createGain();
    this.gainCrank.gain.setValueAtTime(0.12, ctx.currentTime);
    this.oscCrank.connect(this.gainCrank);

    // 5. Subtle Gear Whine
    this.oscWhine = ctx.createOscillator();
    this.oscWhine.type = 'sine';
    this.oscWhine.frequency.setValueAtTime(400, ctx.currentTime);
    this.gainWhine = ctx.createGain();
    this.gainWhine.gain.setValueAtTime(0, ctx.currentTime);
    this.oscWhine.connect(this.gainWhine);

    // Mix Oscillators into Shaper & Filters
    const oscMix = ctx.createGain();
    oscMix.gain.setValueAtTime(0.40, ctx.currentTime);

    this.gainA.connect(oscMix);
    this.gainB.connect(oscMix);
    this.gainSub.connect(oscMix);
    this.gainCrank.connect(oscMix);

    oscMix.connect(this.shaper);
    this.shaper.connect(this.formant1);
    this.formant1.connect(this.formant2);
    this.formant2.connect(this.airFilter);
    this.gainWhine.connect(this.airFilter);

    // --- TIRE ASPHALT SCRUB NOISE ---
    this.tireSource = ctx.createBufferSource();
    this.tireSource.buffer = pinkNoiseBuffer;
    this.tireSource.loop = true;
    this.tireFilter = ctx.createBiquadFilter();
    this.tireFilter.type = 'bandpass';
    this.tireFilter.frequency.setValueAtTime(1100, ctx.currentTime);
    this.tireFilter.Q.setValueAtTime(1.5, ctx.currentTime);
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

    // Start running continuous oscillators
    this.oscA.start();
    this.oscB.start();
    this.oscSub.start();
    this.oscCrank.start();
    this.oscWhine.start();
    this.tireSource.start();

    // Internal simulation state
    this.currentRpm = 4000;
    this.lastGear = 1;
    this.shiftCutTimer = 0;
  }

  update(car, dist, pan, maxDist = 2200, isFocused = false) {
    this.activeCar = car;
    const now = this.ctx.currentTime;
    const ramp = 0.04;

    if (!car || !car.alive) {
      this.gainNode.gain.setTargetAtTime(0, now, 0.08);
      this.tireGain.gain.setTargetAtTime(0, now, 0.08);
      return;
    }

    // 1. Subtle, gentle distance attenuation
    const dRef = 60;
    const normDist = Math.min(1, Math.max(0, (dist - dRef) / (maxDist - dRef)));

    let distGain = 0;
    let airCutoff = 14000;
    let baseMixGain = 0.05; // Very subtle for background cars

    if (isFocused) {
      // Primary follow car: comfortable, pleasant volume
      distGain = 1.0;
      airCutoff = 15000;
      baseMixGain = 0.28;
    } else {
      // Competitors: soft distant murmur
      distGain = Math.max(0, Math.pow(1 - normDist, 1.8));
      airCutoff = 500 + (7500 - 500) * Math.pow(1 - normDist, 2.0);
      baseMixGain = 0.05;
    }

    this.airFilter.frequency.setTargetAtTime(airCutoff, now, ramp);

    // 2. Stereo Panning
    if (this.pannerNode) {
      const panVal = isFocused ? pan * 0.20 : pan;
      this.pannerNode.pan.setTargetAtTime(Math.max(-1, Math.min(1, panVal)), now, ramp);
    }

    // 3. F1 7-Speed Sequential Gearbox RPM Simulation
    const maxSpeed = CONFIG.car.maxSpeed || 440;
    const speed = Math.max(0, car.speed || 0);
    const speedRatio = Math.min(1.15, speed / maxSpeed);
    const throttle = Math.max(0, car.throttle || 0);

    const gearMaxSpeeds = [0.12, 0.24, 0.38, 0.54, 0.70, 0.86, 1.15];
    let gear = 1;
    let gearMinRatio = 0;
    let gearMaxRatio = gearMaxSpeeds[0];

    for (let g = 0; g < gearMaxSpeeds.length; g++) {
      if (speedRatio <= gearMaxSpeeds[g] || g === gearMaxSpeeds.length - 1) {
        gear = g + 1;
        gearMinRatio = g === 0 ? 0 : gearMaxSpeeds[g - 1] * 0.78;
        gearMaxRatio = gearMaxSpeeds[g];
        break;
      }
    }

    if (gear !== this.lastGear) {
      this.lastGear = gear;
      this.shiftCutTimer = 0.04;
    }

    const gearSpan = gearMaxRatio - gearMinRatio || 0.01;
    const gearProgress = Math.min(1.0, Math.max(0, (speedRatio - gearMinRatio) / gearSpan));

    const idleRpm = 3800;
    const redlineRpm = 17500;
    const targetRpm = idleRpm + gearProgress * (redlineRpm - idleRpm) + throttle * 400;

    if (this.shiftCutTimer > 0) {
      this.shiftCutTimer -= 0.016;
      this.currentRpm = this.currentRpm * 0.92;
    } else {
      this.currentRpm += (targetRpm - this.currentRpm) * 0.20;
    }

    const clampedRpm = Math.max(3400, Math.min(18500, this.currentRpm));

    // 4. Continuous Firing Frequencies
    const fFire = (clampedRpm / 60) * 5;
    const fBank = fFire * 0.5;
    const fCrank = clampedRpm / 60;

    this.oscA.frequency.setTargetAtTime(fFire, now, ramp);
    this.oscB.frequency.setTargetAtTime(fFire, now, ramp);
    this.oscSub.frequency.setTargetAtTime(fBank, now, ramp);
    this.oscCrank.frequency.setTargetAtTime(fCrank, now, ramp);

    // 5. Gentle Gear Whine
    const fWhine = Math.max(180, speed * 3.8);
    this.oscWhine.frequency.setTargetAtTime(fWhine, now, ramp);
    const whineVol = isFocused
      ? Math.min(1, speedRatio * 1.5) * 0.025 * (0.6 + throttle * 0.4)
      : Math.min(1, speedRatio * 1.2) * distGain * 0.008;
    this.gainWhine.gain.setTargetAtTime(whineVol, now, ramp);

    // 6. Dynamic Subtle Volume
    const throttleBoost = isFocused ? (0.75 + throttle * 0.35) : (0.70 + throttle * 0.25);
    const voiceVol = distGain * baseMixGain * throttleBoost;
    this.gainNode.gain.setTargetAtTime(voiceVol, now, ramp);

    // 7. Subtle Tire Scrub
    const slipSpeed = Math.abs(car.slipAngle || 0) * speed;
    const isDrifting = slipSpeed > 24 || (car.crashed && speed > 25);
    if (isDrifting) {
      const scrubFactor = Math.min(1, (slipSpeed - 20) / 70);
      const scrubVol = scrubFactor * (isFocused ? 0.12 : distGain * 0.04);
      this.tireGain.gain.setTargetAtTime(scrubVol, now, 0.02);
      this.tireFilter.frequency.setTargetAtTime(900 + scrubFactor * 600, now, 0.03);
    } else {
      this.tireGain.gain.setTargetAtTime(0, now, 0.05);
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
    this.maxVoices = 5;
    this.voices = [];
    this.inited = false;
    this.maxAudibleDist = 2000;
    this.crashBuffer = null;

    this.init();
  }

  init() {
    if (this.inited) return;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    try {
      this.ctx = new AudioCtx();

      // Master Studio Dynamics Compressor for warm, gentle control
      this.compressor = this.ctx.createDynamicsCompressor();
      this.compressor.threshold.setValueAtTime(-16, this.ctx.currentTime);
      this.compressor.knee.setValueAtTime(14, this.ctx.currentTime);
      this.compressor.ratio.setValueAtTime(4.0, this.ctx.currentTime);
      this.compressor.attack.setValueAtTime(0.005, this.ctx.currentTime);
      this.compressor.release.setValueAtTime(0.12, this.ctx.currentTime);

      // Subtle, gentle master volume
      this.masterGain = this.ctx.createGain();
      this.masterGain.gain.setValueAtTime(0.40, this.ctx.currentTime);

      this.compressor.connect(this.masterGain);
      this.masterGain.connect(this.ctx.destination);

      const distortionCurve = makeDistortionCurve(8);
      const pinkNoiseBuffer = generatePinkNoise(this.ctx, 2.0);

      for (let i = 0; i < this.maxVoices; i++) {
        this.voices.push(
          new RealtimeF1Voice(this.ctx, this.compressor, distortionCurve, pinkNoiseBuffer)
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
      const decay = Math.exp(-t * 11);
      const noise = (Math.random() * 2 - 1) * 0.4;
      const metal = Math.sin(2 * Math.PI * (140 * Math.exp(-t * 8)) * t) * 0.5;
      data[i] = (noise + metal) * decay * 0.25;
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
    const volume = Math.max(0, (1 - normDist) * Math.min(1, Math.max(0.3, speed / 180)) * 0.20);

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
      const targetGain = this.enabled ? 0.40 : 0;
      this.masterGain.gain.setTargetAtTime(targetGain, this.ctx.currentTime, 0.04);
    }
    return this.enabled;
  }

  update(sim, state, activeFocus, renderer3d, renderer) {
    if (!this.enabled || !this.inited || !this.ctx || state.paused) {
      if (this.voices) {
        for (let i = 0; i < this.voices.length; i++) {
          this.voices[i].silence();
        }
      }
      return;
    }

    if (this.ctx.state === 'suspended') {
      this.resume();
      return;
    }

    // 1. Determine active camera position and binaural pan vector
    let camX = 0, camY = 0, camZ = 350;
    let rightX = 1, rightY = 0;

    if (state.view3d && renderer3d && renderer3d.camera) {
      const cam = renderer3d.camera;
      const target = (renderer3d.controls && renderer3d.controls.target)
        ? renderer3d.controls.target
        : { x: 0, y: 0, z: 0 };

      camX = cam.position.x;
      camY = cam.position.y;
      camZ = cam.position.z;

      const fwdX = target.x - camX;
      const fwdY = target.y - camY;
      const fwdLen = Math.hypot(fwdX, fwdY) || 1;
      const normFwdX = fwdX / fwdLen;
      const normFwdY = fwdY / fwdLen;

      rightX = -normFwdY;
      rightY = normFwdX;
    } else if (renderer) {
      if (renderer.cam) {
        camX = renderer.cam.x || 0;
        camY = renderer.cam.y || 0;
      } else if (renderer.track) {
        camX = renderer.track.cx || 0;
        camY = renderer.track.cy || 0;
      }
      camZ = 450;
      rightX = 1;
      rightY = 0;
    }

    // 2. Primary Follow Car (Voice 0)
    const focusCar = (state.manual && sim.player && sim.player.alive)
      ? sim.player
      : (activeFocus && activeFocus.alive ? activeFocus : (sim.leader && sim.leader.alive ? sim.leader : null));

    if (focusCar) {
      const dx = focusCar.x - camX;
      const dy = focusCar.y - camY;
      const dz = 0 - camZ;
      const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);

      const toCarX = focusCar.x - camX;
      const toCarY = focusCar.y - camY;
      const toCarLen = Math.hypot(toCarX, toCarY) || 1;
      const pan = ((toCarX / toCarLen) * rightX) + ((toCarY / toCarLen) * rightY);

      this.voices[0].update(focusCar, dist, pan, this.maxAudibleDist, true);
    } else {
      this.voices[0].silence();
    }

    // 3. Subtle background layer for competitors (Voices 1 to 4)
    const otherCandidates = [];
    if (sim.cars) {
      for (let i = 0; i < sim.cars.length; i++) {
        const c = sim.cars[i];
        if (c && c.alive && c !== focusCar) {
          const dx = c.x - camX;
          const dy = c.y - camY;
          const dz = 0 - camZ;
          const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
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

        const toCarX = car.x - camX;
        const toCarY = car.y - camY;
        const toCarLen = Math.hypot(toCarX, toCarY) || 1;
        const pan = ((toCarX / toCarLen) * rightX) + ((toCarY / toCarLen) * rightY);

        voice.update(car, dist, pan, this.maxAudibleDist, false);
      } else {
        voice.silence();
      }
    }
  }
}

export const audio = new SpatialAudioEngine();
