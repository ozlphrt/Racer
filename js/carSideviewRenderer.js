import * as THREE from 'three';
import { carPreviewAsset } from './carPreviewAssets.js';


/**
 * CarSideviewRenderer
 * Renders high-fidelity, crisp, authentic orthographic side profiles of the real 3D F1 2022 car model
 * with full team liveries, shaders, Pirelli tires, aero wings, halo, and side number decals.
 */
export function carPreviewKey(teamIdx, isPlayer, carNumber) {
  return `${isPlayer ? 'p' : 'c'}_${isPlayer ? 1 : teamIdx}_${carNumber}`;
}

const idle = (fn) => {
  if (typeof requestIdleCallback === 'function') requestIdleCallback(fn);
  else setTimeout(fn, 0);
};

export class CarSideviewRenderer {
  constructor(schedule = idle) {
    this.schedule = schedule;
    this.canRender = () => true;
    this.useStaticAssets = true;
    this.sources = new Map();
    this.pending = new Set();
    this.queue = [];
    this.busy = false;
    this.previewListeners = [];
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.cache = new Map(); // key -> page-lifetime blob URL; bounded by fleet sources
    this.isReady = false;
    this.listeners = [];
  }

  init(sources) {
    if (this.isReady) return;
    for (const source of sources) {
      this.sources.set(carPreviewKey(source.teamIdx, source.isPlayer, source.carNumber), source.mesh);
    }

    if (this.useStaticAssets && sources.length && [...this.sources.keys()].every(carPreviewAsset)) {
      this.isReady = true;
      this.listeners.forEach(fn => { try { fn(); } catch (_) {} });
      this.listeners = [];
      return;
    }

    if (typeof window === 'undefined' || typeof document === 'undefined') return;

    try {
      const width = 320;
      const height = 90;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      this.renderer = new THREE.WebGLRenderer({
        canvas,
        alpha: true,
        antialias: true,
        powerPreference: 'low-power'
      });
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(1);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;
      // Copy finished (tone-mapped, antialiased) pixels on the GPU, then read them asynchronously.
      this.snapshotTarget = new THREE.WebGLRenderTarget(width, height, { depthBuffer: false, stencilBuffer: false });
      this.renderer.initRenderTarget(this.snapshotTarget);
      this.snapshotPixels = new Uint8Array(width * height * 4);
      this.snapshotCanvas = document.createElement('canvas');
      this.snapshotCanvas.width = width;
      this.snapshotCanvas.height = height;
      this.snapshotContext = this.snapshotCanvas.getContext('2d');
      this.snapshotImage = this.snapshotContext.createImageData(width, height);

      this.scene = new THREE.Scene();

      // Studio Lighting for immaculate side silhouette & aero highlights
      const ambientLight = new THREE.AmbientLight(0xffffff, 2.0);
      this.scene.add(ambientLight);

      // Key light directly illuminating right body flank, nosecone, and sidepod
      const keyLight = new THREE.DirectionalLight(0xffffff, 2.8);
      keyLight.position.set(-6, -26, 14);
      this.scene.add(keyLight);

      // Fill light for front wing & nose tip
      const fillFront = new THREE.DirectionalLight(0xffffff, 1.6);
      fillFront.position.set(15, -20, 8);
      this.scene.add(fillFront);

      // Top/back rim light for halo, dorsal fin, and rear wing endplates
      const rimLight = new THREE.DirectionalLight(0x93c5fd, 1.2);
      rimLight.position.set(0, 20, 10);
      this.scene.add(rimLight);

      // Subtle underbody bounce
      const underBounce = new THREE.DirectionalLight(0x64748b, 0.5);
      underBounce.position.set(0, -10, -5);
      this.scene.add(underBounce);

      // Orthographic camera framing the car precisely
      const aspect = width / height; // 3.555
      const halfW = 15.6;
      const halfH = halfW / aspect; // ~4.388
      const centerZ = 2.15;

      this.camera = new THREE.OrthographicCamera(
        -halfW,
        halfW,
        centerZ + halfH,
        centerZ - halfH,
        0.1,
        100
      );
      this.camera.position.set(0, -32, centerZ);
      this.camera.lookAt(0, 0, centerZ);
      this.camera.up.set(0, 0, 1);
      this.camera.updateProjectionMatrix();

      this.isReady = true;

      // Notify any waiting components
      this.listeners.forEach((fn) => {
        try { fn(); } catch (e) {}
      });
      this.listeners = [];
    } catch (err) {
      console.warn('CarSideviewRenderer initialization error:', err);
    }
  }

  onReady(fn) {
    if (this.isReady) {
      fn();
    } else {
      this.listeners.push(fn);
    }
  }

  onPreviewReady(fn) {
    this.previewListeners.push(fn);
  }

  // A cache miss must never render or read pixels inside a simulation update.
  getCarSideviewDataUrl(teamIdx = 0, isPlayer = false, carNumber = 1) {
    const key = carPreviewKey(teamIdx, isPlayer, carNumber);
    const asset = this.useStaticAssets && carPreviewAsset(key);
    if (asset) return asset;
    if (this.cache.has(key)) return this.cache.get(key);
    if (this.isReady && this.sources.has(key) && !this.pending.has(key)) {
      this.pending.add(key);
      this.queue.push(key);
      this.scheduleNext();
    }
    return null;
  }

  scheduleNext() {
    if (this.busy || !this.queue.length || !this.canRender()) return;
    this.busy = true;
    const preview = this;
    this.schedule(function prepareCarPreview() {
      if (!preview.canRender()) { preview.busy = false; return; }
      return preview.renderNext();
    });
  }

  async capturePreviewBlob() {
    const { width, height } = this.snapshotTarget;
    // This copy stays on the GPU. Canvas.toBlob on the WebGL canvas would first force a readback.
    this.renderer.copyFramebufferToTexture(this.snapshotTarget.texture);
    await this.renderer.readRenderTargetPixelsAsync(this.snapshotTarget, 0, 0, width, height, this.snapshotPixels);
    const rowBytes = width * 4;
    for (let y = 0; y < height; y++) {
      const source = (height - 1 - y) * rowBytes;
      this.snapshotImage.data.set(this.snapshotPixels.subarray(source, source + rowBytes), y * rowBytes);
    }
    // The WebGL drawing buffer uses premultiplied alpha; ImageData expects straight alpha.
    for (let i = 0; i < this.snapshotImage.data.length; i += 4) {
      const alpha = this.snapshotImage.data[i + 3];
      if (alpha > 0 && alpha < 255) {
        for (let channel = 0; channel < 3; channel++) {
          this.snapshotImage.data[i + channel] = Math.min(255, Math.round(this.snapshotImage.data[i + channel] * 255 / alpha));
        }
      }
    }
    this.snapshotContext.putImageData(this.snapshotImage, 0, 0);
    return new Promise(resolve => this.snapshotCanvas.toBlob(resolve, 'image/png'));
  }

  async renderNext() {
    const key = this.queue.shift();
    let mesh;
    let compileMs = 0, drawMs = 0;
    let deferred = false;
    try {
      // Share prepared fleet buffers and materials; never dispose their resources.
      mesh = this.sources.get(key).clone(true);
      this.scene.add(mesh);
      const compileStart = performance.now();
      const compilation = this.renderer.compileAsync(this.scene, this.camera);
      compileMs = performance.now() - compileStart;
      await compilation;
      await new Promise((resolve) => this.schedule(resolve));
      // Shader compilation can finish after racing resumes. Keep the pending
      // request for the next pause instead of starting a GPU readback now.
      if (!this.canRender()) {
        this.queue.unshift(key);
        deferred = true;
        return;
      }
      const drawStart = performance.now();
      this.renderer.render(this.scene, this.camera);
      drawMs = performance.now() - drawStart;
      const blob = await this.capturePreviewBlob();
      if (blob) {
        const url = URL.createObjectURL(blob);
        this.cache.set(key, url);
        for (const fn of this.previewListeners) fn(key, url);
      }
    } catch (err) {
      console.warn('Error rendering 3D car side view:', err);
    } finally {
      if (compileMs + drawMs > 8) {
        console.info(`[BACKGROUND] Preview ${key}: compile ${compileMs.toFixed(1)}ms | draw ${drawMs.toFixed(1)}ms`);
      }
      if (mesh) this.scene.remove(mesh);
      if (!deferred) this.pending.delete(key);
      this.busy = false;
      this.scheduleNext();
    }
  }
}

export const carSideviewRenderer = new CarSideviewRenderer();
