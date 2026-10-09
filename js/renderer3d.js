import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { CONFIG } from './config.js';
import { RAY_ANGLES } from './car.js';
import { audio } from './audio.js';
import { TireBarrierSystem } from './tireBarriers.js';

// F1 Number Decals Configuration (Calibrated in 3D Decal Studio)
export const F1_DECAL_CONFIG = {
  front: { posX: -5.58, posY: 0.01,  posZ: 3.02, scaleX: 2.6,  scaleY: 1.7,  rotX: 70,  rotY: 0,   rotZ: -90 },
  top:   { posX: 0.82,  posY: 0.24,  posZ: 3.29, scaleX: 3.75, scaleY: 3.9,  rotX: 0,   rotY: 10,  rotZ: -90 },
  rear:  { posX: 12.14, posY: 0.03,  posZ: 4.24, scaleX: 3.45, scaleY: 2.75, rotX: 5,   rotY: 0,   rotZ: 90 },
  left:  { posX: 5.1,   posY: -1.05, posZ: 2.06, scaleX: 3.25, scaleY: 2.85, rotX: 90,  rotY: 0,   rotZ: 0 },
  right: { posX: 4.3,   posY: 2.0,   posZ: 1.84, scaleX: 3.0,  scaleY: 2.3,  rotX: -90, rotY: 180, rotZ: 0 }
};

export const TEAM_PALETTE = [
  // --- MULTI-COLOR LIVERIES (2 to 4 Vivid Contrasting Colors) ---
  // 1. Monza Carbon/Volt/Crimson (3-Color): Matte Carbon + Volt Lime + Crimson Red
  {
    name: 'Monza Carbon/Volt/Crimson (3-Color)',
    colors: 3,
    hex: 0x18181b,       // Body: Matte Carbon
    secHex: 0x84cc16,    // Nose & Stripes: Volt Neon Lime
    accHex: 0xef4444,    // Wing & Fin: Crimson Red
    quadHex: 0x84cc16,   // Sidepods: Volt Neon Lime
    rgb: [24, 24, 27],
    secRgb: [132, 204, 22],
    accRgb: [239, 68, 68],
    quadRgb: [132, 204, 22],
  },
  // 2. Rosso Corsa/Giallo/Bianco (3-Color): Rosso Corsa + Modena Yellow + Bianco White
  {
    name: 'Rosso Corsa/Giallo/Bianco (3-Color)',
    colors: 3,
    hex: 0xdc2626,       // Body: Rosso Corsa Red
    secHex: 0xfacc15,    // Nose & Stripes: Modena Giallo Yellow
    accHex: 0xffffff,    // Wing & Fin: Bianco White
    quadHex: 0xfacc15,   // Sidepods: Modena Giallo Yellow
    rgb: [220, 38, 38],
    secRgb: [250, 204, 21],
    accRgb: [255, 255, 255],
    quadRgb: [250, 204, 21],
  },

  // --- 2-COLOR LIVERIES (Iconic Dual-Tones) ---
  // 3. Scuderia Red/Yellow (2-Color): Rosso Red + Giallo Yellow
  {
    name: 'Scuderia Red/Yellow (2-Color)',
    colors: 2,
    hex: 0xe11d48,
    secHex: 0xfacc15,
    accHex: 0xe11d48,
    quadHex: 0xfacc15,
    rgb: [225, 29, 72],
    secRgb: [250, 204, 21],
    accRgb: [225, 29, 72],
    quadRgb: [250, 204, 21],
  },
  // 4. McLaren Papaya/Blue (2-Color): Papaya Orange + Alpine Blue
  {
    name: 'McLaren Papaya/Blue (2-Color)',
    colors: 2,
    hex: 0xff6b00,
    secHex: 0x0284c7,
    accHex: 0xff6b00,
    quadHex: 0x0284c7,
    rgb: [255, 107, 0],
    secRgb: [2, 132, 199],
    accRgb: [255, 107, 0],
    quadRgb: [2, 132, 199],
  },
  // 5. Aston Emerald/Lime (2-Color): British Emerald + Volt Neon Lime
  {
    name: 'Aston Emerald/Lime (2-Color)',
    colors: 2,
    hex: 0x059669,
    secHex: 0x84cc16,
    accHex: 0x059669,
    quadHex: 0x84cc16,
    rgb: [5, 150, 105],
    secRgb: [132, 204, 22],
    accRgb: [5, 150, 105],
    quadRgb: [132, 204, 22],
  },
  // 6. Lotus Black/Gold (2-Color): Onyx Black + Imperial Gold
  {
    name: 'Lotus Black/Gold (2-Color)',
    colors: 2,
    hex: 0x111827,
    secHex: 0xeab308,
    accHex: 0x111827,
    quadHex: 0xeab308,
    rgb: [17, 24, 39],
    secRgb: [234, 179, 8],
    accRgb: [17, 24, 39],
    quadRgb: [234, 179, 8],
  },
  // 7. Subaru Rally Blue/Gold (2-Color): WRC Blue + Solar Gold
  {
    name: 'Subaru Rally Blue/Gold (2-Color)',
    colors: 2,
    hex: 0x2563eb,
    secHex: 0xf59e0b,
    accHex: 0x2563eb,
    quadHex: 0xf59e0b,
    rgb: [37, 99, 235],
    secRgb: [245, 158, 11],
    accRgb: [37, 99, 235],
    quadRgb: [245, 158, 11],
  },
  // 8. BWT Pink/Aqua (2-Color): Bubblegum Pink + Aqua Cyan
  {
    name: 'BWT Pink/Aqua (2-Color)',
    colors: 2,
    hex: 0xf472b6,
    secHex: 0x06b6d4,
    accHex: 0xf472b6,
    quadHex: 0x06b6d4,
    rgb: [244, 114, 182],
    secRgb: [6, 182, 212],
    accRgb: [244, 114, 182],
    quadRgb: [6, 182, 212],
  },

  // --- 3-COLOR LIVERIES (Classic Tricolors) ---
  // 9. Gulf Heritage (3-Color): Powder Sky Blue + Papaya Orange + Navy
  {
    name: 'Gulf Blue/Orange/Navy (3-Color)',
    colors: 3,
    hex: 0x38bdf8,
    secHex: 0xf97316,
    accHex: 0x0f172a,
    quadHex: 0xf97316,
    rgb: [56, 189, 248],
    secRgb: [249, 115, 22],
    accRgb: [15, 23, 42],
    quadRgb: [249, 115, 22],
  },
  // 10. Red Bull Championship (3-Color): Midnight Navy + Racing Yellow + Crimson Red
  {
    name: 'Midnight Bull (3-Color)',
    colors: 3,
    hex: 0x1e1b4b,
    secHex: 0xfacc15,
    accHex: 0xef4444,
    quadHex: 0xfacc15,
    rgb: [30, 27, 75],
    secRgb: [250, 204, 21],
    accRgb: [239, 68, 68],
    quadRgb: [250, 204, 21],
  },
  // 11. Alpine Sport (3-Color): Royal Blue + Punch Hot Pink + Pure White
  {
    name: 'Alpine Blue/Pink/White (3-Color)',
    colors: 3,
    hex: 0x2563eb,
    secHex: 0xec4899,
    accHex: 0xffffff,
    quadHex: 0xec4899,
    rgb: [37, 99, 235],
    secRgb: [236, 72, 153],
    accRgb: [255, 255, 255],
    quadRgb: [236, 72, 153],
  },
  // 12. Mercedes Silver Arrows (3-Color): Liquid Silver + Petronas Turquoise + Volt Green
  {
    name: 'Silver/Turquoise/Volt (3-Color)',
    colors: 3,
    hex: 0x94a3b8,
    secHex: 0x06b6d4,
    accHex: 0x84cc16,
    quadHex: 0x06b6d4,
    rgb: [148, 163, 184],
    secRgb: [6, 182, 212],
    accRgb: [132, 204, 22],
    quadRgb: [6, 182, 212],
  },
  // 13. Martini Racing (3-Color): Frost White + Sky Cyan + Crimson Red
  {
    name: 'Martini White/Cyan/Red (3-Color)',
    colors: 3,
    hex: 0xf8fafc,
    secHex: 0x38bdf8,
    accHex: 0xef4444,
    quadHex: 0x38bdf8,
    rgb: [248, 250, 252],
    secRgb: [56, 189, 248],
    accRgb: [239, 68, 68],
    quadRgb: [56, 189, 248],
  },
  // 14. Porsche Motorsport (3-Color): Pure White + Lava Red + Carbon Black
  {
    name: 'Porsche White/Red/Black (3-Color)',
    colors: 3,
    hex: 0xf8fafc,
    secHex: 0xdc2626,
    accHex: 0x0f172a,
    quadHex: 0xdc2626,
    rgb: [248, 250, 252],
    secRgb: [220, 38, 38],
    accRgb: [15, 23, 42],
    quadRgb: [220, 38, 38],
  },
  // 15. Williams Legacy (3-Color): Cobalt Blue + Sky Cyan + Pure White
  {
    name: 'Williams Cobalt/Cyan/White (3-Color)',
    colors: 3,
    hex: 0x1d4ed8,
    secHex: 0x38bdf8,
    accHex: 0xffffff,
    quadHex: 0x38bdf8,
    rgb: [29, 78, 216],
    secRgb: [56, 189, 248],
    accRgb: [255, 255, 255],
    quadRgb: [56, 189, 248],
  },

  // --- 4-COLOR LIVERIES (Multi-Zone Masterpieces) ---
  // 16. Cyberpunk Synthwave (4-Color): Deep Purple + Electric Magenta + Neon Cyan + Cyber Yellow
  {
    name: 'Cyberpunk Synthwave (4-Color)',
    colors: 4,
    hex: 0x7c3aed,       // Body: Deep Purple
    secHex: 0xf43f5e,    // Nose: Electric Magenta
    accHex: 0xfacc15,    // Wing/Halo: Cyber Yellow
    quadHex: 0x06b6d4,   // Sidepods: Neon Cyan
    rgb: [124, 58, 237],
    secRgb: [244, 63, 94],
    accRgb: [250, 204, 21],
    quadRgb: [6, 182, 212],
  },
  // 17. Tokyo Midnight Drift (4-Color): Neon Turquoise + Sunset Coral + Ultraviolet + Electric Gold
  {
    name: 'Tokyo Midnight Drift (4-Color)',
    colors: 4,
    hex: 0x06b6d4,       // Body: Neon Turquoise
    secHex: 0xf97316,    // Nose: Sunset Coral
    accHex: 0xeab308,    // Wing/Halo: Electric Gold
    quadHex: 0xa855f7,   // Sidepods: Ultraviolet
    rgb: [6, 182, 212],
    secRgb: [249, 115, 22],
    accRgb: [234, 179, 8],
    quadRgb: [168, 85, 247],
  },
  // 18. World Champion Quad (4-Color): Midnight Obsidian + Imperial Gold + Crimson Red + Sky Blue
  {
    name: 'World Champion Quad (4-Color)',
    colors: 4,
    hex: 0x090d16,       // Body: Midnight Obsidian
    secHex: 0xf59e0b,    // Nose: Imperial Gold
    accHex: 0x38bdf8,    // Wing/Halo: Sky Blue
    quadHex: 0xef4444,   // Sidepods: Crimson Red
    rgb: [9, 13, 22],
    secRgb: [245, 158, 11],
    accRgb: [56, 189, 248],
    quadRgb: [239, 68, 68],
  },
  // 19. Hyper Velocity Volt (4-Color): Volt Neon Lime + Deep Violet + Electric Cyan + Blazing Orange
  {
    name: 'Hyper Velocity Volt (4-Color)',
    colors: 4,
    hex: 0x84cc16,       // Body: Volt Neon Lime
    secHex: 0x6d28d9,    // Nose: Deep Violet
    accHex: 0xf97316,    // Wing/Halo: Blazing Orange
    quadHex: 0x06b6d4,   // Sidepods: Electric Cyan
    rgb: [132, 204, 22],
    secRgb: [109, 40, 217],
    accRgb: [249, 115, 22],
    quadRgb: [6, 182, 212],
  },
  // 20. Safari Desert Rally (4-Color): Sand Khaki + Olive Green + Matte Black + Signal Orange
  {
    name: 'Safari Desert Rally (4-Color)',
    colors: 4,
    hex: 0xd4a373,       // Body: Sand Khaki
    secHex: 0x4f772d,    // Nose: Olive Green
    accHex: 0xf97316,    // Wing/Halo: Signal Orange
    quadHex: 0x1f2937,   // Sidepods: Matte Black
    rgb: [212, 163, 115],
    secRgb: [79, 119, 45],
    accRgb: [249, 115, 22],
    quadRgb: [31, 41, 55],
  }
];

const C = {
  grass: 0x244222,
  asphalt: 0x242832,
  kerbRed: 0xdc2626,
  kerbWhite: 0xf8fafc,
  edgeLine: 0xffffff,
  leader: 0xffea00, // Vibrant electric racing yellow
  player: 0x00e626, // High-visibility lime green
  ghost: 0x00e5ff,  // Electric cyan
};

export class Renderer3D {
  constructor(canvas, track) {
    this.canvas = canvas;
    this.track = track;
    this.w = canvas.clientWidth || 800;
    this.h = canvas.clientHeight || 600;

    // 1. Three.js Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x8ac0f4);

    this.camera = new THREE.PerspectiveCamera(42, this.w / this.h, 5, 24000);
    this.camera.filmGauge = 35;
    this.camera.setFocalLength(32);
    this.camera.up.set(0, 0, 1); // Z is the vertical altitude axis in our world
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.w, this.h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.25));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFShadowMap;

    // 2. OrbitControls with smooth auto spin
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.45; // Slow, cinematic broadcast spin around track
    this.controls.maxPolarAngle = Math.PI / 2 - 0.03; // don't go under ground
    this.controls.minDistance = 20;
    this.controls.maxDistance = 5000;

    this.setupLighting();
    this.setupSky();
    this.setupTerrain();
    this.setupWater();
    this.setupTrack();
    this.setupCars();
    this.setupRays();
    this.setupTrees();
    this.setupRocks();
    this.setupTireBarriers();
    this.setupBursts();
    this.setupSkidmarks();
    this.setupTireSmoke();

    this._rankedCars = [];
    this._carRankMap = new Map();

    this.resetCamera();
  }

  setupSky() {
    // 1. Procedural atmospheric vibrant afternoon sky canvas
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Natural, vibrant afternoon sky gradient: rich azure zenith down to warm golden-blue horizon
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0.00, '#1a5ea8'); // Clear rich azure zenith
    grad.addColorStop(0.25, '#2875c4'); // Vibrant afternoon cobalt
    grad.addColorStop(0.50, '#4695db'); // Bright open sky blue
    grad.addColorStop(0.70, '#74b6ed'); // Soft cerulean
    grad.addColorStop(0.83, '#aed9f7'); // Luminous lower sky
    grad.addColorStop(0.91, '#fae1bd'); // Warm golden afternoon sun haze
    grad.addColorStop(0.96, '#f3d1a3'); // Gentle horizon warmth
    grad.addColorStop(1.00, '#b8cfbd'); // Grassy horizon blend

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 1024);

    // Soft procedural cirrus cloud bands with bright afternoon sunlight
    ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
    for (let i = 0; i < 14; i++) {
      const cy = 200 + i * 36 + Math.sin(i * 1.8) * 14;
      const ch = 10 + (i % 4) * 7;
      ctx.beginPath();
      ctx.ellipse(256 + Math.cos(i) * 90, cy, 260, ch, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant soft mountain silhouette along the horizon in airy afternoon haze
    ctx.fillStyle = 'rgba(70, 95, 115, 0.45)';
    ctx.beginPath();
    ctx.moveTo(0, 930);
    for (let x = 0; x <= 512; x += 16) {
      const my = 890 + Math.sin(x * 0.038) * 16 + Math.cos(x * 0.082) * 9;
      ctx.lineTo(x, my);
    }
    ctx.lineTo(512, 1024);
    ctx.lineTo(0, 1024);
    ctx.closePath();
    ctx.fill();

    const skyTex = new THREE.CanvasTexture(canvas);
    skyTex.wrapS = THREE.RepeatWrapping;
    skyTex.wrapT = THREE.ClampToEdgeWrapping;

    // Dome hemisphere/sphere inverted mesh
    const skyGeo = new THREE.SphereGeometry(14000, 48, 32);
    // Rotate sphere so top pole points along +Z (our vertical world axis)
    skyGeo.rotateX(Math.PI / 2);

    const skyMat = new THREE.MeshBasicMaterial({
      map: skyTex,
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
    this.skyMesh.renderOrder = -100;
    this.scene.add(this.skyMesh);

    // Soft airy blue afternoon aerial perspective
    this.scene.fog = new THREE.Fog(0xc2daf0, 4000, 16000);
  }

  setupLighting() {
    // Bright afternoon hemisphere: crisp sky blue dome with warm grassy ground bounce
    const hemiLight = new THREE.HemisphereLight(0x8ac0f4, 0x628455, 1.05);
    this.scene.add(hemiLight);

    // Bright, crisp warm golden-white afternoon sunlight
    this.dirLight = new THREE.DirectionalLight(0xfff6e8, 2.05);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 1024;
    this.dirLight.shadow.mapSize.height = 1024;
    this.dirLight.shadow.camera.near = 100;
    this.dirLight.shadow.camera.far = 8000;
    this.dirLight.shadow.bias = -0.0001;
    this.dirLight.shadow.normalBias = 0.03;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    // Daylight ambient fill keeping shadowed surfaces and car underbodies clean and readable
    const ambLight = new THREE.AmbientLight(0x607488, 0.48);
    this.scene.add(ambLight);

    this.updateLightPosition();
  }

  updateLightPosition() {
    if (!this.dirLight) return;
    const b = this.track.bounds;
    const cx = b.cx;
    const cy = -b.cy;
    const spanX = (b.maxX - b.minX) * 0.6;
    const spanY = (b.maxY - b.minY) * 0.6;
    const span = Math.max(spanX, spanY) + 300;

    // Pleasant afternoon sun angle (~40 deg above horizon) from South-West
    // Generates distinct angled shadows revealing terrain relief, barriers, and cars,
    // while keeping the track and landscape bright, clear, and vibrant (not dark dusk).
    const sunDistance = span * 1.9;
    const sunAngle = 2.10; // South-West azimuth (~120 degrees)
    const sunX = cx + Math.cos(sunAngle) * sunDistance;
    const sunY = cy + Math.sin(sunAngle) * sunDistance;
    const sunZ = span * 1.55; // Natural ~40 deg afternoon elevation

    this.dirLight.position.set(sunX, sunY, sunZ);
    this.dirLight.target.position.set(cx, cy, 0);

    const d = span * 1.35;
    this.dirLight.shadow.camera.near = 100;
    this.dirLight.shadow.camera.far = sunDistance * 2.6;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.updateProjectionMatrix();
  }

  getMinDistToTrack(tx, ty) {
    const t = this.track;
    if (!t) return 99999;
    const b = t.bounds;
    const margin = 2800;
    if (tx >= b.minX - margin && tx <= b.maxX + margin &&
        ty >= b.minY - margin && ty <= b.maxY + margin) {
      let minDSq = Infinity;
      const N = t.N;
      // High-precision distance checking against track spline
      for (let k = 0; k < N; k += 2) {
        const dx = t.cx[k] - tx;
        const dy = t.cy[k] - ty;
        const dSq = dx * dx + dy * dy;
        if (dSq < minDSq) minDSq = dSq;
      }
      return Math.sqrt(minDSq);
    }
    const dx = Math.max(0, Math.max(b.minX - tx, tx - b.maxX));
    const dy = Math.max(0, Math.max(b.minY - ty, ty - b.maxY));
    return Math.hypot(dx, dy);
  }

  createTerrainDetailMaps() {
    if (this._terrainDetailMaps) {
      return this._terrainDetailMaps;
    }

    const size = 512;

    const dCanvas = document.createElement('canvas');
    dCanvas.width = size;
    dCanvas.height = size;
    const dCtx = dCanvas.getContext('2d');
    const dImg = dCtx.createImageData(size, size);
    const dData = dImg.data;

    const nCanvas = document.createElement('canvas');
    nCanvas.width = size;
    nCanvas.height = size;
    const nCtx = nCanvas.getContext('2d');
    const nImg = nCtx.createImageData(size, size);
    const nData = nImg.data;

    const rCanvas = document.createElement('canvas');
    rCanvas.width = size;
    rCanvas.height = size;
    const rCtx = rCanvas.getContext('2d');
    const rImg = rCtx.createImageData(size, size);
    const rData = rImg.data;

    // High-performance integer hashing for non-repeating stochastic lattice
    function hash2D(i, j, seed) {
      let n = (Math.imul(i + 137, 374761393) + Math.imul(j + 283, 668265263) + Math.imul(seed + 541, 1013904223)) | 0;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296.0;
    }

    // Seamless continuous periodic Value Noise on torus [0, 1) x [0, 1)
    function periodicNoise(u, v, freq, seed) {
      const px = u * freq;
      const py = v * freq;
      const x0 = Math.floor(px);
      const y0 = Math.floor(py);
      const fx = px - x0;
      const fy = py - y0;
      // Quintic smootherstep curve: 6t^5 - 15t^4 + 10t^3
      const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
      const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      const i0 = ((x0 % freq) + freq) % freq;
      const j0 = ((y0 % freq) + freq) % freq;
      const i1 = (i0 + 1) % freq;
      const j1 = (j0 + 1) % freq;
      const v00 = hash2D(i0, j0, seed);
      const v10 = hash2D(i1, j0, seed);
      const v01 = hash2D(i0, j1, seed);
      const v11 = hash2D(i1, j1, seed);
      const vx0 = v00 + sx * (v10 - v00);
      const vx1 = v01 + sx * (v11 - v01);
      return vx0 + sy * (vx1 - vx0);
    }

    // Micro-scale turf grain frequencies for seamless isotropic surface detail (no macro periodic spots)
    const octaves = [
      { freq: 16, weight: 0.38 },
      { freq: 32, weight: 0.30 },
      { freq: 64, weight: 0.20 },
      { freq: 128, weight: 0.12 },
    ];

    const heights = new Float32Array(size * size);

    // Compute seamless fine organic micro-surface
    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;

        // Continuous organic multi-frequency domain warp for completely irregular, non-geometric micro-bumps
        const warpU = (periodicNoise(u, v, 8, 101) - 0.5) * 0.10 + (periodicNoise(u, v, 16, 303) - 0.5) * 0.05;
        const warpV = (periodicNoise(u, v, 8, 203) - 0.5) * 0.10 + (periodicNoise(u, v, 16, 404) - 0.5) * 0.05;
        const wu = ((u + warpU) % 1.0 + 1.0) % 1.0;
        const wv = ((v + warpV) % 1.0 + 1.0) % 1.0;

        let sum = 0;
        for (let o = 0; o < octaves.length; o++) {
          const { freq, weight } = octaves[o];
          sum += periodicNoise(wu, wv, freq, o * 19 + 7) * weight;
        }
        heights[y * size + x] = sum;
      }
    }

    // Generate balanced, seamless diffuse albedo, normal, and roughness
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const idx = (y * size + x) * 4;
        const h = heights[y * size + x];

        const x0 = (x - 1 + size) % size;
        const x1 = (x + 1) % size;
        const y0 = (y - 1 + size) % size;
        const y1 = (y + 1) % size;

        const hL = heights[y * size + x0];
        const hR = heights[y * size + x1];
        const hU = heights[y0 * size + x];
        const hD = heights[y1 * size + x];

        // Natural pronounced micro-bump normal relief (completely irregular, organic clumps and sod)
        const dx = (hR - hL) * 3.0;
        const dy = (hD - hU) * 3.0;
        const dz = 1.0;
        const len = Math.hypot(dx, dy, dz) || 1;

        nData[idx] = ((-dx / len) * 0.5 + 0.5) * 255;
        nData[idx + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
        nData[idx + 2] = ((dz / len) * 0.5 + 0.5) * 255;
        nData[idx + 3] = 255;

        // Fine blade fiber grain: smooth, subtle, and uniform (NO dark circles or speckles)
        const bladeNoise = (hash2D(x, y, 777) - 0.5) * 14;
        const bladeRelief = (h - 0.5) * 24;

        // Darker, desaturated organic turf base with gentle blade variation
        const rOut = Math.min(255, Math.max(0, Math.round(92 + bladeRelief * 0.7 + bladeNoise * 0.5)));
        const gOut = Math.min(255, Math.max(0, Math.round(118 + bladeRelief * 0.8 + bladeNoise * 0.6)));
        const bOut = Math.min(255, Math.max(0, Math.round(74 + bladeRelief * 0.5 + bladeNoise * 0.4)));

        dData[idx] = rOut;
        dData[idx + 1] = gOut;
        dData[idx + 2] = bOut;
        dData[idx + 3] = 255;

        // Realistic matte turf roughness (0.84 - 0.90)
        const rough = Math.floor(218 + (0.5 - h) * 24);
        rData[idx] = Math.min(255, Math.max(0, rough));
        rData[idx + 1] = rData[idx];
        rData[idx + 2] = rData[idx];
        rData[idx + 3] = 255;
      }
    }

    dCtx.putImageData(dImg, 0, 0);
    nCtx.putImageData(nImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);

    const maxAniso = (this.renderer && this.renderer.capabilities) ? this.renderer.capabilities.getMaxAnisotropy() : 8;

    // High repeat count for fine, seamless micro-detail across the landscape
    const diffuseMap = new THREE.CanvasTexture(dCanvas);
    diffuseMap.wrapS = diffuseMap.wrapT = THREE.RepeatWrapping;
    diffuseMap.repeat.set(120, 120);
    diffuseMap.generateMipmaps = true;
    diffuseMap.anisotropy = Math.min(maxAniso, 4);

    const normalMap = new THREE.CanvasTexture(nCanvas);
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.repeat.set(120, 120);
    normalMap.generateMipmaps = true;
    normalMap.anisotropy = Math.min(maxAniso, 2);

    this._terrainDetailMaps = { diffuseMap, normalMap };
    return this._terrainDetailMaps;
  }

  createAsphaltTextures() {
    if (this._asphaltTextures) return this._asphaltTextures;

    const size = 512;
    const totalPixels = size * size;

    const dCanvas = document.createElement('canvas');
    dCanvas.width = size;
    dCanvas.height = size;
    const dCtx = dCanvas.getContext('2d');
    const dImg = dCtx.createImageData(size, size);
    const dData = dImg.data;

    const nCanvas = document.createElement('canvas');
    nCanvas.width = size;
    nCanvas.height = size;
    const nCtx = nCanvas.getContext('2d');
    const nImg = nCtx.createImageData(size, size);
    const nData = nImg.data;

    const rCanvas = document.createElement('canvas');
    rCanvas.width = size;
    rCanvas.height = size;
    const rCtx = rCanvas.getContext('2d');
    const rImg = rCtx.createImageData(size, size);
    const rData = rImg.data;

    function hash2D(i, j, seed = 0) {
      let n = (Math.imul(i + 137, 374761393) + Math.imul(j + 283, 668265263) + Math.imul(seed + 541, 1013904223)) | 0;
      n = Math.imul(n ^ (n >>> 13), 1274126177);
      return ((n ^ (n >>> 16)) >>> 0) / 4294967296.0;
    }

    // Seamless continuous periodic Value Noise on torus [0, 1) x [0, 1)
    function periodicNoise(u, v, freq, seed) {
      const px = u * freq;
      const py = v * freq;
      const x0 = Math.floor(px);
      const y0 = Math.floor(py);
      const fx = px - x0;
      const fy = py - y0;
      // Quintic smootherstep curve: 6t^5 - 15t^4 + 10t^3
      const sx = fx * fx * fx * (fx * (fx * 6 - 15) + 10);
      const sy = fy * fy * fy * (fy * (fy * 6 - 15) + 10);
      const i0 = ((x0 % freq) + freq) % freq;
      const j0 = ((y0 % freq) + freq) % freq;
      const i1 = (i0 + 1) % freq;
      const j1 = (j0 + 1) % freq;
      const v00 = hash2D(i0, j0, seed);
      const v10 = hash2D(i1, j0, seed);
      const v01 = hash2D(i0, j1, seed);
      const v11 = hash2D(i1, j1, seed);
      return (v00 + sx * (v10 - v00)) + sy * ((v01 + sx * (v11 - v01)) - (v00 + sx * (v10 - v00)));
    }

    const octaves = [
      { freq: 8, weight: 0.32 },
      { freq: 16, weight: 0.34 },
      { freq: 32, weight: 0.22 },
      { freq: 64, weight: 0.12 },
    ];

    const heights = new Float32Array(totalPixels);

    // Pass 1: Multi-scale organic fractal noise with continuous domain warping
    // Completely eliminates grid-like cell repetition or linear stripe patterns
    for (let y = 0; y < size; y++) {
      const v = y / size;
      const yOffset = y * size;

      for (let x = 0; x < size; x++) {
        const u = x / size;
        const idx = yOffset + x;

        // Continuous organic domain warp breaking any rectilinear lattice alignment
        const warpU = (periodicNoise(u, v, 4, 101) - 0.5) * 0.08 + (periodicNoise(u, v, 8, 203) - 0.5) * 0.04;
        const warpV = (periodicNoise(u, v, 4, 307) - 0.5) * 0.08 + (periodicNoise(u, v, 8, 409) - 0.5) * 0.04;
        const wu = ((u + warpU) % 1.0 + 1.0) % 1.0;
        const wv = ((v + warpV) % 1.0 + 1.0) % 1.0;

        let noiseSum = 0;
        for (let o = 0; o < octaves.length; o++) {
          noiseSum += periodicNoise(wu, wv, octaves[o].freq, o * 53 + 17) * octaves[o].weight;
        }

        // Per-pixel stochastic mineral grit (zero grid frequency)
        const grit1 = hash2D(x, y, 777);
        const grit2 = hash2D(x * 2 + 13, y * 2 + 37, 888);
        const mineralGrit = (grit1 - 0.5) * 0.14 + (grit2 - 0.5) * 0.08;

        const h = Math.max(0, Math.min(1.0, noiseSum + mineralGrit));
        heights[idx] = h;

        // Authentic dark motorsport asphalt color:
        // Centered around C.asphalt = 0x242832 (R:36, G:40, B:50)
        // Bitumen crevices: ~26, 30, 38
        // Median tarmac: ~36, 40, 50
        // Aggregate mineral flecks: ~46, 50, 60
        const hRel = h - 0.5;
        const isSpeck = grit1 > 0.982;

        let baseR = 35 + hRel * 16;
        let baseG = 39 + hRel * 17;
        let baseB = 49 + hRel * 20;

        if (isSpeck) {
          baseR += 16;
          baseG += 18;
          baseB += 24;
        }

        const cIdx = idx * 4;
        dData[cIdx] = Math.round(Math.max(18, Math.min(75, baseR)));
        dData[cIdx + 1] = Math.round(Math.max(22, Math.min(80, baseG)));
        dData[cIdx + 2] = Math.round(Math.max(28, Math.min(95, baseB)));
        dData[cIdx + 3] = 255;

        // Realistic matte bitumen roughness (0.84 - 0.92)
        const rough = Math.round(Math.max(210, Math.min(245, (0.92 - h * 0.10) * 255)));
        rData[cIdx] = rough;
        rData[cIdx + 1] = rough;
        rData[cIdx + 2] = rough;
        rData[cIdx + 3] = 255;
      }
    }

    // Pass 2: Sobel Normal Map (seamless toroidal finite differences)
    const bump = 2.2;
    for (let y = 0; y < size; y++) {
      const ym = (y - 1 + size) % size;
      const yp = (y + 1) % size;
      const yOffset = y * size;
      const ymOffset = ym * size;
      const ypOffset = yp * size;

      for (let x = 0; x < size; x++) {
        const xm = (x - 1 + size) % size;
        const xp = (x + 1) % size;
        const idx = yOffset + x;

        const dx = (heights[yOffset + xp] - heights[yOffset + xm]) * bump;
        const dy = (heights[ypOffset + x] - heights[ymOffset + x]) * bump;
        const dz = 1.0;

        const len = Math.sqrt(dx * dx + dy * dy + 1.0);
        const nIdx = idx * 4;
        nData[nIdx] = Math.round((-dx / len * 0.5 + 0.5) * 255);
        nData[nIdx + 1] = Math.round((-dy / len * 0.5 + 0.5) * 255);
        nData[nIdx + 2] = Math.round((dz / len * 0.5 + 0.5) * 255);
        nData[nIdx + 3] = 255;
      }
    }

    dCtx.putImageData(dImg, 0, 0);
    nCtx.putImageData(nImg, 0, 0);
    rCtx.putImageData(rImg, 0, 0);

    const maxAniso = (this.renderer && this.renderer.capabilities) ? this.renderer.capabilities.getMaxAnisotropy() : 8;

    const diffuseMap = new THREE.CanvasTexture(dCanvas);
    diffuseMap.wrapS = diffuseMap.wrapT = THREE.RepeatWrapping;
    diffuseMap.colorSpace = THREE.SRGBColorSpace;
    diffuseMap.generateMipmaps = true;
    diffuseMap.anisotropy = Math.min(maxAniso, 4);

    const normalMap = new THREE.CanvasTexture(nCanvas);
    normalMap.wrapS = normalMap.wrapT = THREE.RepeatWrapping;
    normalMap.generateMipmaps = true;
    normalMap.anisotropy = Math.min(maxAniso, 2);

    this._asphaltTextures = { diffuseMap, normalMap };
    return this._asphaltTextures;
  }

  createWaterNormalMap() {
    if (this._waterNormalMap) return this._waterNormalMap;
    const size = 256;
    const TWO_PI = Math.PI * 2;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    const img = ctx.createImageData(size, size);
    const data = img.data;

    for (let y = 0; y < size; y++) {
      const v = y / size;
      for (let x = 0; x < size; x++) {
        const u = x / size;
        const x0 = ((x - 1 + size) % size) / size;
        const x1 = ((x + 1) % size) / size;
        const y0 = ((y - 1 + size) % size) / size;
        const y1 = ((y + 1) % size) / size;

        const wL = Math.sin(TWO_PI * (4 * x0 + 2 * v)) + Math.cos(TWO_PI * (6 * x0 - 4 * v) + 0.8) * 0.5;
        const wR = Math.sin(TWO_PI * (4 * x1 + 2 * v)) + Math.cos(TWO_PI * (6 * x1 - 4 * v) + 0.8) * 0.5;
        const wU = Math.sin(TWO_PI * (4 * u + 2 * y0)) + Math.cos(TWO_PI * (6 * u - 4 * y0) + 0.8) * 0.5;
        const wD = Math.sin(TWO_PI * (4 * u + 2 * y1)) + Math.cos(TWO_PI * (6 * u - 4 * y1) + 0.8) * 0.5;

        const dx = (wR - wL) * 1.8;
        const dy = (wD - wU) * 1.8;
        const dz = 1.0;
        const len = Math.hypot(dx, dy, dz) || 1;

        const idx = (y * size + x) * 4;
        data[idx] = ((-dx / len) * 0.5 + 0.5) * 255;
        data[idx + 1] = ((-dy / len) * 0.5 + 0.5) * 255;
        data[idx + 2] = ((dz / len) * 0.5 + 0.5) * 255;
        data[idx + 3] = 255;
      }
    }
    ctx.putImageData(img, 0, 0);
    const texture = new THREE.CanvasTexture(canvas);
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(16, 16);
    texture.generateMipmaps = true;
    texture.anisotropy = (this.renderer && this.renderer.capabilities) ? this.renderer.capabilities.getMaxAnisotropy() : 8;
    this._waterNormalMap = texture;
    return texture;
  }

  getWaterBodies() {
    if (!this.track) return { lakes: [], river: [] };
    const b = this.track.bounds;
    const span = Math.max(b.w, b.h);
    const cx = b.cx;
    const cy = -b.cy;

    const lakes = [
      {
        cx: cx + span * 0.72,
        cy: cy + span * 0.55,
        rx: 380,
        ry: 290,
        waterZ: 8.5,
      },
      {
        cx: cx - span * 0.68,
        cy: cy - span * 0.60,
        rx: 440,
        ry: 320,
        waterZ: 11.0,
      },
    ];

    const river = [];
    const numPts = 60;
    const startX = cx - span * 1.6;
    const endX = cx + span * 1.6;
    for (let i = 0; i <= numPts; i++) {
      const u = i / numPts;
      const px = startX + (endX - startX) * u;
      const py = cy + span * 0.95 + Math.sin(u * Math.PI * 3.2 + 0.8) * 320.0 + Math.cos(u * Math.PI * 6.0) * 90.0;
      const waterZ = 5.5 + Math.sin(u * 3) * 2.5;
      river.push({ x: px, y: py, waterZ, width: 46.0 + Math.sin(u * 5) * 10 });
    }

    return { lakes, river };
  }

  getTerrainHeight(x, y) {
    if (!this.track) return 0;
    const t = this.track;
    const b = t.bounds;
    const cx = b.cx;
    const cy = -b.cy;

    // Convert 3D world (x, y) into 2D track coordinate system (x, -y)
    const trackX = x;
    const trackY = -y;

    const distToTrack = this.getMinDistToTrack(trackX, trackY);

    const trackHalf = (t.width || 84) * 0.5; // ~42m
    const carLength = 26.0;                  // 1 car length (~26m)
    // Strictly flat across track + at least 2 full car lengths outside track edges
    const flatRadius = trackHalf + carLength * 2.0 + 4.0; // ~100m from centerline (>= 2 car lengths away from track edges)

    if (distToTrack <= flatRadius) return 0; // Guaranteed 100% flat

    // 1. Regional Macro Topography (original gentle countryside - NO new or shifted hills)
    // Preserves the wide ~171m flat buffer and 380m gradual ease-in for high hills
    const macroFlatRadius = trackHalf + carLength * 4 + 25.0; // ~171m flat radius from centerline
    let macroElevation = 0;
    if (distToTrack > macroFlatRadius) {
      const blendDist = 380.0;
      const blendRatio = Math.min(1.0, (distToTrack - macroFlatRadius) / blendDist);
      const macroBlend = blendRatio * blendRatio * blendRatio * (blendRatio * (blendRatio * 6 - 15) + 10);

      // Original unrotated macro hills (exact original landscape)
      const h1 = Math.sin(x * 0.0010 + 0.5) * Math.cos(y * 0.0010 - 0.4) * 75.0;
      const h2 = Math.sin(x * 0.0022 - y * 0.0018 + 1.2) * 32.0;
      const h3 = Math.cos(x * 0.0045 + y * 0.0040) * 14.0;
      macroElevation = Math.max(0, h1 + h2 + h3 + 18.0) * macroBlend;
    }

    // 2. Irregular Micro Hills & Valleys (rolling 3.5m - 9.0m countryside knolls & shallow dale dips)
    // Domain warping continuously twists the coordinate space to eliminate any rectilinear or geometric repetition
    const hillBlendDist = 120.0;
    const hillRatio = Math.min(1.0, (distToTrack - flatRadius) / hillBlendDist);
    const hillBlend = hillRatio * hillRatio * (3.0 - 2.0 * hillRatio);

    const rx1 = x * 0.857 - y * 0.515;
    const ry1 = x * 0.515 + y * 0.857;
    const rx2 = x * 0.292 + y * 0.956;
    const ry2 = -x * 0.956 + y * 0.292;

    // Continuous non-linear turbulent coordinate warping for natural flowing landscape features
    const warpX = Math.sin(rx1 * 0.0028 + 1.7) * 75.0 + Math.cos(ry2 * 0.0048 - 0.8) * 45.0;
    const warpY = Math.cos(rx2 * 0.0031 - 1.1) * 75.0 + Math.sin(ry1 * 0.0044 + 2.3) * 45.0;
    const wx = x + warpX;
    const wy = y + warpY;

    // Organic micro hills & valleys (rolling mounds and shallow valleys, wavelength ~300m - 700m)
    const hv1 = Math.sin(wx * 0.0024 + wy * 0.0019 + 0.8) * 4.8;
    const hv2 = Math.sin(wx * -0.0041 + wy * 0.0053 + 2.4) * 3.2;
    const hv3 = Math.cos(wx * 0.0068 - wy * 0.0059 + 1.6) * 1.8;
    const microHillsValleys = (hv1 + hv2 + hv3) * hillBlend;

    // 3. Pronounced Organic Micro Bumps (tactile 0.6m - 2.8m surface ripples and turf knolls)
    const bumpBlendDist = 65.0;
    const bumpRatio = Math.min(1.0, (distToTrack - flatRadius) / bumpBlendDist);
    const bumpBlend = bumpRatio * bumpRatio * (3.0 - 2.0 * bumpRatio);

    const mb1 = Math.sin(wx * 0.0078 + wy * 0.0062 + 1.3) * 1.60;
    const mb2 = Math.sin(wx * -0.0135 + wy * 0.0158 + 2.1) * 1.05;
    const mb3 = Math.sin(wx * 0.0242 - wy * 0.0215 + 0.6) * 0.65;
    const mb4 = Math.sin(wx * 0.0384 + wy * 0.0351 + 3.2) * 0.35;

    const microBumps = (mb1 + mb2 + mb3 + mb4) * bumpBlend;

    let elevation = macroElevation + microHillsValleys + microBumps;

    // Horizon mountain ridges
    const distFromCenter = Math.hypot(x - cx, y - cy);
    const maxTrackSpan = Math.max(b.w, b.h) * 0.85;
    if (distFromCenter > maxTrackSpan) {
      const mRatio = Math.min(1.0, (distFromCenter - maxTrackSpan) / 2800.0);
      const mBlend = mRatio * mRatio * (3 - 2 * mRatio);
      const mRidge = (Math.sin(x * 0.00050 + 1.8) * Math.cos(y * 0.00050 - 0.9) * 0.5 + 0.5) * 650.0
                   + Math.sin(x * 0.0012 - 0.6) * 180.0;
      elevation += Math.max(0, mRidge) * mBlend;
    }

    // Carve lake basins smoothly into valley floor
    const { lakes, river } = this.getWaterBodies();
    for (const lake of lakes) {
      const dx = (x - lake.cx) / lake.rx;
      const dy = (y - lake.cy) / lake.ry;
      const lakeDist = Math.hypot(dx, dy);
      if (lakeDist < 1.35) {
        const dRatio = Math.max(0, 1.0 - lakeDist / 1.35);
        const basinDepth = 14.0 * dRatio * dRatio;
        elevation = Math.max(0, elevation - basinDepth * 1.5);
      }
    }

    // Carve riverbed trench
    for (let i = 0; i < river.length; i += 2) {
      const rp = river[i];
      const rDist = Math.hypot(x - rp.x, y - rp.y);
      const rRadius = rp.width * 1.6;
      if (rDist < rRadius) {
        const rRatio = Math.max(0, 1.0 - rDist / rRadius);
        const trench = 6.5 * rRatio * rRatio;
        elevation = Math.max(0, elevation - trench * 1.4);
      }
    }

    return Math.max(0, elevation);
  }

  setupTerrain() {
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      if (this.terrainMesh.geometry) this.terrainMesh.geometry.dispose();
      if (this.terrainMesh.material) this.terrainMesh.material.dispose();
      this.terrainMesh = null;
    }

    const w = 24000;
    const segs = 280;
    const geo = new THREE.PlaneGeometry(w, w, segs, segs);
    const pos = geo.attributes.position.array;
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);

    for (let i = 0; i < count; i++) {
      const vx = pos[i * 3];
      const vy = pos[i * 3 + 1];
      pos[i * 3 + 2] = this.getTerrainHeight(vx, vy);
    }

    geo.computeVertexNormals();
    const normals = geo.attributes.normal.array;

    const { lakes } = this.getWaterBodies();

    for (let i = 0; i < count; i++) {
      const vx = pos[i * 3];
      const vy = pos[i * 3 + 1];
      const h = pos[i * 3 + 2];
      const nz = normals[i * 3 + 2];

      let nearShore = false;
      for (const l of lakes) {
        const dx = (vx - l.cx) / l.rx;
        const dy = (vy - l.cy) / l.ry;
        const d = Math.hypot(dx, dy);
        if (d >= 0.90 && d <= 1.25 && Math.abs(h - l.waterZ) < 4.5) {
          nearShore = true;
          break;
        }
      }

      // Multi-octave continuous 2D procedural noise with non-orthogonal rotated frames
      // Rotated by 31 deg, 73 deg, 119 deg to eliminate ANY rectilinear or geometric alignment
      const rx1 = vx * 0.857 - vy * 0.515;
      const ry1 = vx * 0.515 + vy * 0.857;
      const rx2 = vx * 0.292 + vy * 0.956;
      const ry2 = -vx * 0.956 + vy * 0.292;
      const rx3 = vx * -0.485 + vy * 0.875;
      const ry3 = -vx * 0.875 - vy * 0.485;
      const rx4 = vx * 0.731 + vy * 0.682;
      const ry4 = -vx * 0.682 + vy * 0.731;

      // Multi-frequency continuous organic FBM noise (Golden ratio & irrational frequency multipliers)
      const b1 = Math.sin(rx1 * 0.00047 + 0.7) * Math.cos(ry1 * 0.00053 - 0.4);
      const b2 = Math.sin(rx2 * 0.00118 + 1.9) * Math.cos(ry2 * 0.00109 + 0.6);
      const b3 = Math.sin(rx3 * 0.00283 - ry3 * 0.00247 + 2.4) * 0.6 + Math.cos(rx1 * 0.00312 + ry1 * 0.00278) * 0.4;
      const b4 = Math.sin(rx4 * 0.00715 + ry4 * 0.00642 + 1.1) * 0.5 + Math.cos(rx2 * 0.00831 - ry2 * 0.00754) * 0.5;
      const b5 = Math.sin(rx1 * 0.0183 - ry1 * 0.0167 + 0.8) * 0.5 + Math.cos(rx3 * 0.0215 + ry3 * 0.0198) * 0.5;
      const b6 = Math.sin(rx2 * 0.0452 + ry2 * 0.0495) * 0.5 + Math.cos(rx4 * 0.0561 - ry4 * 0.0484) * 0.5;
      const b7 = Math.sin(rx3 * 0.118 - ry3 * 0.104 + 1.4) * 0.5 + Math.cos(rx1 * 0.135 + ry4 * 0.122) * 0.5;

      const macroBiome = b1 * 0.55 + b2 * 0.45; // Broad regional variation (-1 to +1)
      const mesoPatch = b3 * 0.60 + b4 * 0.40;   // Medium continuous meadow/loam patches (-1 to +1)
      // High-frequency multi-frequency random noise and chromatic dappling
      const microNoise1 = b5 * 0.12 + b6 * 0.08 + b7 * 0.05;
      const microNoise2 = Math.sin(rx4 * 0.082 - ry1 * 0.076 + 2.1) * 0.10 + Math.cos(rx2 * 0.145 + ry3 * 0.138) * 0.06;
      const microJitter = (Math.sin(rx1 * 0.28 + ry2 * 0.24) * Math.cos(rx3 * 0.31 - ry4 * 0.27)) * 0.07;

      // Independent multi-scale random spatial noise fields for separate Saturation and Luminance modulation
      const sn1 = Math.sin(rx1 * 0.0035 + 1.7) * Math.cos(ry3 * 0.0041 - 0.8);
      const sn2 = Math.sin(rx2 * 0.0125 - ry1 * 0.0112 + 2.3) * 0.6 + Math.cos(rx4 * 0.0154 + ry2 * 0.0138) * 0.4;
      const sn3 = Math.sin(rx3 * 0.048 - ry4 * 0.042) * 0.5 + Math.cos(rx1 * 0.062 + ry2 * 0.055) * 0.5;
      const satNoise = sn1 * 0.55 + sn2 * 0.30 + sn3 * 0.15; // [-1, 1]

      const ln1 = Math.sin(rx3 * 0.0029 - 0.9) * Math.cos(ry2 * 0.0033 + 1.4);
      const ln2 = Math.sin(rx4 * 0.0098 + ry3 * 0.0087 - 1.6) * 0.6 + Math.cos(rx1 * 0.0142 - ry4 * 0.0128) * 0.4;
      const ln3 = Math.sin(rx2 * 0.041 + ry1 * 0.037 + 0.5) * 0.5 + Math.cos(rx3 * 0.057 - ry2 * 0.049) * 0.5;
      const lumNoise = ln1 * 0.55 + ln2 * 0.30 + ln3 * 0.15; // [-1, 1]

      // Irregular multi-scale continuous noise specifically modulating green darkness and saturation
      const gn1 = Math.sin(rx1 * 0.0019 + 2.1) * Math.cos(ry2 * 0.0016 - 1.1);
      const gn2 = Math.sin(rx3 * 0.0054 - ry1 * 0.0047 + 0.7) * 0.6 + Math.cos(rx2 * 0.0067 + ry4 * 0.0059) * 0.4;
      const gn3 = Math.sin(rx4 * 0.017 + ry3 * 0.015) * 0.5 + Math.cos(rx1 * 0.021 - ry2 * 0.018) * 0.5;
      const greenVariance = gn1 * 0.55 + gn2 * 0.30 + gn3 * 0.15; // [-1, 1], irregular non-uniform spatial distribution

      // Organic wildflower bloom fields
      const bloomField1 = Math.sin(rx3 * 0.0042 + 1.2) * Math.cos(ry4 * 0.0038 - 0.9);
      const bloomField2 = Math.sin(rx2 * 0.0075 - 0.8) * Math.cos(rx1 * 0.0068 + 1.5);

      let r, g, b;
      if (nearShore) {
        // Wet riverstone sand & gravel shore
        r = 0.48 + mesoPatch * 0.08 + microNoise1;
        g = 0.42 + mesoPatch * 0.06 + microNoise2;
        b = 0.32 + mesoPatch * 0.05 + microJitter;
      } else if (nz < 0.68) {
        // Steep craggy granite & slate cliff face (faceted mineral rock)
        const rockTone = 0.34 + (1.0 - nz) * 0.22 + macroBiome * 0.06 + microNoise1 * 0.8;
        r = rockTone * 1.05;
        g = rockTone * 1.00;
        b = rockTone * 1.07;
      } else if (nz < 0.84) {
        // Transitional rocky hillsides, scree, and upland slopes
        if (macroBiome > 0.05) {
          // Mossy rock slope (darker, desaturated olive-moss)
          r = 0.18 + macroBiome * 0.04 + mesoPatch * 0.04 + microNoise1;
          g = 0.24 + macroBiome * 0.04 + mesoPatch * 0.05 + microNoise2;
          b = 0.15 + mesoPatch * 0.03;
        } else {
          // Earthy scree & clay slope (warm stone & terracotta clay)
          r = 0.44 - macroBiome * 0.05 + mesoPatch * 0.08 + microNoise1;
          g = 0.33 - macroBiome * 0.04 + mesoPatch * 0.06 + microNoise2;
          b = 0.23 - macroBiome * 0.03 + mesoPatch * 0.05;
        }
      } else if (h > 240.0) {
        // High mountain frost & snow-dusted ridges
        const sNorm = Math.min(1.0, (h - 240.0) / 100.0);
        r = 0.54 + sNorm * 0.36 + macroBiome * 0.03 + microNoise1 * 0.3;
        g = 0.57 + sNorm * 0.34 + macroBiome * 0.03 + microNoise1 * 0.3;
        b = 0.62 + sNorm * 0.32 + macroBiome * 0.03 + microNoise1 * 0.3;
      } else if (h > 120.0) {
        // Alpine moorland / steppe (weathered heather & dusky moss steppe)
        const aNorm = Math.min(1.0, (h - 120.0) / 120.0);
        r = 0.24 + aNorm * 0.08 + mesoPatch * 0.06 + microNoise1;
        g = 0.27 + aNorm * 0.06 + mesoPatch * 0.05 + microNoise2;
        b = 0.19 + aNorm * 0.07 + mesoPatch * 0.05;
      } else {
        // Lowland & Rolling Pasture: Organic landscape with irregularly darker, less saturated greens
        const hLow = Math.min(1.0, h / 120.0);

        // Knoll sun-facing highlight
        const knollSun = Math.max(0, Math.sin(rx2 * 0.022 + 1.2) * Math.cos(ry1 * 0.019));

        if (mesoPatch > 0.18) {
          // Biome: Warm Earthy Loam, Terracotta Clay & Exposed Silt
          r = 0.48 + hLow * 0.04 + mesoPatch * 0.12 + microNoise1;
          g = 0.30 + hLow * 0.03 + mesoPatch * 0.06 + microNoise2 * 0.6;
          b = 0.18 + hLow * 0.02 + mesoPatch * 0.04;
        } else if (macroBiome > 0.18) {
          // Biome: Deep Moss, Conifer & Forest Swales (irregularly darker and muted)
          const gLvl = 0.20 + (greenVariance + 1.0) * 0.04; // 0.20 - 0.28 (dark forest greens)
          const rLvl = 0.13 + (greenVariance + 1.0) * 0.02;
          r = rLvl + hLow * 0.03 + mesoPatch * 0.04 + microNoise1 * 0.5;
          g = gLvl + hLow * 0.03 + mesoPatch * 0.05 + microNoise2;
          b = 0.12 + hLow * 0.02 + mesoPatch * 0.03;
        } else if (macroBiome < -0.18) {
          // Biome: Sun-Drenched Golden Prairie & Amber Fescue Grass
          r = 0.48 + hLow * 0.05 + mesoPatch * 0.07 + microNoise1 + knollSun * 0.06;
          g = 0.42 + hLow * 0.04 + mesoPatch * 0.06 + microNoise2 + knollSun * 0.04;
          b = 0.19 + hLow * 0.03 + mesoPatch * 0.03;
        } else if (mesoPatch < -0.16) {
          // Biome: Highland Moorland with Heather Lilac & Slate Purple Tones
          r = 0.34 + hLow * 0.03 + mesoPatch * 0.05 + microNoise1;
          g = 0.29 + hLow * 0.03 + mesoPatch * 0.04 + microNoise2 * 0.7;
          b = 0.42 + hLow * 0.04 + mesoPatch * 0.06 + microJitter;
        } else {
          // Biome: Grounded Pasture Meadow (irregularly darker, earthy, less saturated)
          const gLvl = 0.22 + (greenVariance + 1.0) * 0.045; // 0.22 - 0.31 (much darker than earlier 0.42)
          const rLvl = 0.16 + (greenVariance + 1.0) * 0.025;
          r = rLvl + hLow * 0.03 + mesoPatch * 0.05 + microNoise1 + knollSun * 0.03;
          g = gLvl + hLow * 0.03 + mesoPatch * 0.05 + microNoise2 + knollSun * 0.03;
          b = 0.13 + hLow * 0.02 + mesoPatch * 0.03;
        }

        // Distinct organic wildflower bloom flecks (gentle natural hues)
        if (bloomField1 > 0.58 && h < 75) {
          // Golden Buttercups and Yellow Marigolds
          const s = (bloomField1 - 0.58) / 0.42;
          r += 0.13 * s;
          g += 0.09 * s;
          b -= 0.03 * s;
        } else if (bloomField2 > 0.64 && h > 20 && h < 95) {
          // Heather & Wild Clover Blossom (Lilac/Rose)
          const s = (bloomField2 - 0.64) / 0.36;
          r += 0.11 * s;
          g += 0.03 * s;
          b += 0.11 * s;
        }
      }

      // 1. Calculate perceived luminance (Rec. 709)
      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;

      // 2. Reduce saturation: specifically make greens darker and less saturated, applied IRREGULARLY across the world
      let satFactor = 0.65;
      if (g > r && g > b) {
        // Green surface: apply irregular non-uniform desaturation
        // Areas with lower greenVariance drop down to ~0.38 - 0.44 (deep desaturated moss/peat)
        // Areas with higher greenVariance sit around ~0.52 - 0.58
        satFactor = 0.48 + greenVariance * 0.12;
      }
      if (satNoise < -0.10) {
        // Dedicated desaturated coloration spots (faded, dusty, dry earth patches)
        const t = Math.min(1.0, (-0.10 - satNoise) / 0.65);
        satFactor -= t * 0.18;
      }
      satFactor = Math.max(0.28, Math.min(0.78, satFactor));

      r = lum + (r - lum) * satFactor;
      g = lum + (g - lum) * satFactor;
      b = lum + (b - lum) * satFactor;

      // 3. Reduce luminance separately: targeted low-luminance spots
      let lumFactor = 1.0; // Baseline retains natural brightness
      if (lumNoise < -0.15) {
        // Subtle natural earth tone variation (never harsh dark spots)
        const t = Math.min(1.0, (-0.15 - lumNoise) / 0.65);
        lumFactor = 1.0 - t * 0.16;
      } else if (lumNoise > 0.40) {
        // Sunlit clearing/ridge highlight
        const t = Math.min(1.0, (lumNoise - 0.40) / 0.60);
        lumFactor = 1.0 + t * 0.15;
      }

      r *= lumFactor;
      g *= lumFactor;
      b *= lumFactor;

      colors[i * 3] = Math.max(0.04, Math.min(0.98, r));
      colors[i * 3 + 1] = Math.max(0.04, Math.min(0.98, g));
      colors[i * 3 + 2] = Math.max(0.04, Math.min(0.98, b));
    }

    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));

    const { diffuseMap, normalMap, roughnessMap } = this.createTerrainDetailMaps();

    const mat = new THREE.MeshPhongMaterial({
      map: diffuseMap,
      vertexColors: true,
      specular: 0x000000, // Strictly non-reflective, black specular = zero shiny light reflection
      shininess: 0,       // No specular glossiness or glare
      reflectivity: 0,    // No environment reflections
      normalMap: normalMap,
      normalScale: new THREE.Vector2(0.85, 0.85),
      flatShading: false,
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.receiveShadow = true;
    this.terrainMesh.castShadow = false;
    this.scene.add(this.terrainMesh);
  }

  setupWater() {
    if (this.waterGroup) {
      this.scene.remove(this.waterGroup);
    }
    this.waterGroup = new THREE.Group();

    if (!this.track) return;
    const { lakes, river } = this.getWaterBodies();

    const waterMat = new THREE.MeshStandardMaterial({
      color: 0x0a5870,
      roughness: 0.06,
      metalness: 0.85,
      transparent: true,
      opacity: 0.88,
      normalMap: this.createWaterNormalMap(),
      normalScale: new THREE.Vector2(0.4, 0.4),
      side: THREE.DoubleSide,
    });

    const shoreMat = new THREE.MeshStandardMaterial({
      color: 0x988d72,
      roughness: 0.94,
      metalness: 0.05,
      side: THREE.DoubleSide,
    });

    // 1. Pristine Alpine & Valley Lakes
    for (const lake of lakes) {
      const lakeGeo = new THREE.CircleGeometry(lake.rx, 64);
      lakeGeo.scale(1.0, lake.ry / lake.rx, 1.0);
      const lakeMesh = new THREE.Mesh(lakeGeo, waterMat);
      lakeMesh.position.set(lake.cx, lake.cy, lake.waterZ);
      lakeMesh.receiveShadow = true;
      this.waterGroup.add(lakeMesh);

      // Sandy gravel shoreline ring
      const shoreGeo = new THREE.RingGeometry(lake.rx * 0.96, lake.rx * 1.14, 64);
      shoreGeo.scale(1.0, lake.ry / lake.rx, 1.0);
      const shoreMesh = new THREE.Mesh(shoreGeo, shoreMat);
      shoreMesh.position.set(lake.cx, lake.cy, lake.waterZ - 0.12);
      shoreMesh.receiveShadow = true;
      this.waterGroup.add(shoreMesh);
    }

    // 2. Winding Valley River
    if (river.length > 2) {
      const riverPts = river.map((p) => new THREE.Vector3(p.x, p.y, p.waterZ));
      const riverCurve = new THREE.CatmullRomCurve3(riverPts);
      const riverCurvePts = riverCurve.getPoints(120);

      const riverGeo = new THREE.BufferGeometry();
      const rPos = [];
      const rUvs = [];
      const rIndices = [];

      for (let i = 0; i < riverCurvePts.length; i++) {
        const p = riverCurvePts[i];
        const nextP = riverCurvePts[Math.min(riverCurvePts.length - 1, i + 1)];
        const prevP = riverCurvePts[Math.max(0, i - 1)];
        const dir = new THREE.Vector3().subVectors(nextP, prevP).normalize();
        const normal = new THREE.Vector3(-dir.y, dir.x, 0).normalize();
        const rWidth = 48.0;

        const pLeft = p.clone().addScaledVector(normal, rWidth * 0.5);
        const pRight = p.clone().addScaledVector(normal, -rWidth * 0.5);

        rPos.push(pLeft.x, pLeft.y, pLeft.z);
        rPos.push(pRight.x, pRight.y, pRight.z);

        const v = i / (riverCurvePts.length - 1);
        rUvs.push(0, v * 16);
        rUvs.push(1, v * 16);

        if (i < riverCurvePts.length - 1) {
          const base = i * 2;
          rIndices.push(base, base + 1, base + 2);
          rIndices.push(base + 1, base + 3, base + 2);
        }
      }

      riverGeo.setAttribute('position', new THREE.Float32BufferAttribute(rPos, 3));
      riverGeo.setAttribute('uv', new THREE.Float32BufferAttribute(rUvs, 2));
      riverGeo.setIndex(rIndices);
      riverGeo.computeVertexNormals();

      const riverMesh = new THREE.Mesh(riverGeo, waterMat);
      riverMesh.receiveShadow = true;
      this.waterGroup.add(riverMesh);
    }

    this.scene.add(this.waterGroup);
  }

  setupTrack() {
    const t = this.track;
    const N = t.N;

    const asphalt = this.createAsphaltTextures();

    // Metric UV mapping matching wide asphalt tile size (~24m x 24m)
    // 24m tile size prevents high-frequency wallpaper tiling across the 84m wide track (~3.5 tiles wide)
    const targetTileSize = 24.0;
    const totalTiles = Math.max(1, Math.round(t.length / targetTileSize));
    const effTileSize = t.length / totalTiles;
    const uMax = t.width / effTileSize;

    // Track surface mesh flush at ground level (Z = 0.05)
    // N + 1 vertex rings: ring N shares exact 3D coordinates with ring 0
    // while v reaches totalTiles, guaranteeing seamless loop closure without texture reversal.
    const vertices = [];
    const indices = [];
    const uvs = [];

    for (let i = 0; i <= N; i++) {
      const idx = i % N;
      const vDist = (i / N) * totalTiles;

      // Outer point (u = 0)
      vertices.push(t.ox[idx], -t.oy[idx], 0.05);
      uvs.push(0, vDist);

      // Inner point (u = uMax)
      vertices.push(t.ix[idx], -t.iy[idx], 0.05);
      uvs.push(uMax, vDist);
    }

    for (let i = 0; i < N; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;

      indices.push(v0, v1, v2);
      indices.push(v1, v3, v2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: asphalt.diffuseMap,
      normalMap: asphalt.normalMap,
      normalScale: new THREE.Vector2(0.60, 0.60),
      roughness: 0.88,
      metalness: 0.08,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.trackMesh = new THREE.Mesh(geo, mat);
    this.trackMesh.castShadow = false;
    this.trackMesh.receiveShadow = true;
    this.trackMesh.renderOrder = 1;
    this.scene.add(this.trackMesh);

    // Decorative track lines & kerbs
    this.decorGroup = new THREE.Group();

    // Outer & Inner Solid White Boundary Line Mesh Ribbons (2.4m wide, elevated on top of asphalt)
    const lineWidth = 2.4;
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.05,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      depthTest: true,
    });

    const outerBorderVerts = [];
    const outerBorderIndices = [];
    const innerBorderVerts = [];
    const innerBorderIndices = [];

    for (let i = 0; i < N; i++) {
      const nxt = (i + 1) % N;

      // 1. Outer track edge normal pointing inwards towards centerline
      const odx = t.cx[i] - t.ox[i];
      const ody = -t.cy[i] - (-t.oy[i]);
      const oDist = Math.hypot(odx, ody) || 1;
      const onx = odx / oDist;
      const ony = ody / oDist;

      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = nxt * 2;
      const v3 = nxt * 2 + 1;

      outerBorderVerts.push(
        t.ox[i], -t.oy[i], 0.12,
        t.ox[i] + onx * lineWidth, -t.oy[i] + ony * lineWidth, 0.12
      );
      outerBorderIndices.push(v0, v1, v2, v1, v3, v2);

      // 2. Inner track edge normal pointing outwards towards centerline
      const idx = t.cx[i] - t.ix[i];
      const idy = -t.cy[i] - (-t.iy[i]);
      const iDist = Math.hypot(idx, idy) || 1;
      const inx = idx / iDist;
      const iny = idy / iDist;

      innerBorderVerts.push(
        t.ix[i], -t.iy[i], 0.12,
        t.ix[i] + inx * lineWidth, -t.iy[i] + iny * lineWidth, 0.12
      );
      innerBorderIndices.push(v0, v1, v2, v1, v3, v2);
    }

    const outerBorderGeo = new THREE.BufferGeometry();
    outerBorderGeo.setAttribute('position', new THREE.Float32BufferAttribute(outerBorderVerts, 3));
    outerBorderGeo.setIndex(outerBorderIndices);
    outerBorderGeo.computeVertexNormals();
    const outerBorderMesh = new THREE.Mesh(outerBorderGeo, borderMat);
    outerBorderMesh.renderOrder = 10;
    this.decorGroup.add(outerBorderMesh);

    const innerBorderGeo = new THREE.BufferGeometry();
    innerBorderGeo.setAttribute('position', new THREE.Float32BufferAttribute(innerBorderVerts, 3));
    innerBorderGeo.setIndex(innerBorderIndices);
    innerBorderGeo.computeVertexNormals();
    const innerBorderMesh = new THREE.Mesh(innerBorderGeo, borderMat);
    innerBorderMesh.renderOrder = 10;
    this.decorGroup.add(innerBorderMesh);

    // 3. Centerline Solid Dashed Markings (Bold dashed quads on top of asphalt)
    const centerDashVerts = [];
    const centerDashIndices = [];
    const dashHalfWidth = 0.9;
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.05,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      depthTest: true,
    });

    let dashIdx = 0;
    for (let i = 0; i < N; i += 4) {
      const iEnd = (i + 2) % N;

      const dx1 = t.ox[i] - t.ix[i];
      const dy1 = -t.oy[i] - (-t.iy[i]);
      const len1 = Math.hypot(dx1, dy1) || 1;
      const nx1 = dx1 / len1;
      const ny1 = dy1 / len1;

      const dx2 = t.ox[iEnd] - t.ix[iEnd];
      const dy2 = -t.oy[iEnd] - (-t.iy[iEnd]);
      const len2 = Math.hypot(dx2, dy2) || 1;
      const nx2 = dx2 / len2;
      const ny2 = dy2 / len2;

      const v0 = dashIdx * 4;
      const v1 = dashIdx * 4 + 1;
      const v2 = dashIdx * 4 + 2;
      const v3 = dashIdx * 4 + 3;

      centerDashVerts.push(
        t.cx[i] - nx1 * dashHalfWidth, -t.cy[i] - ny1 * dashHalfWidth, 0.11,
        t.cx[i] + nx1 * dashHalfWidth, -t.cy[i] + ny1 * dashHalfWidth, 0.11,
        t.cx[iEnd] - nx2 * dashHalfWidth, -t.cy[iEnd] - ny2 * dashHalfWidth, 0.11,
        t.cx[iEnd] + nx2 * dashHalfWidth, -t.cy[iEnd] + ny2 * dashHalfWidth, 0.11
      );
      centerDashIndices.push(v0, v1, v2, v1, v3, v2);
      dashIdx++;
    }

    const centerDashGeo = new THREE.BufferGeometry();
    centerDashGeo.setAttribute('position', new THREE.Float32BufferAttribute(centerDashVerts, 3));
    centerDashGeo.setIndex(centerDashIndices);
    centerDashGeo.computeVertexNormals();
    const centerDashMesh = new THREE.Mesh(centerDashGeo, centerMat);
    centerDashMesh.renderOrder = 8;
    this.decorGroup.add(centerDashMesh);

    // Red & White 3D Apex Kerbs (FIA-standard verge-side rumble strips)
    const kerbRedGeo = new THREE.BufferGeometry();
    const kerbWhiteGeo = new THREE.BufferGeometry();
    const redVerts = [];
    const whiteVerts = [];
    const maxKerbWidth = Math.max(4.5, (t.width || 80) * 0.075); // Standard ~7.5% track width

    // 1. Identify corner/apex zones along the track loop
    const rawKerb = new Array(N).fill(false);
    for (let k = 0; k < N; k++) {
      rawKerb[k] = Math.abs(t.curvature[k]) >= 1 / 200;
    }

    // Dilate corner zones by 2 samples on each side for smooth corner coverage
    const isKerb = new Array(N).fill(false);
    for (let k = 0; k < N; k++) {
      if (rawKerb[k]) {
        for (let d = -2; d <= 2; d++) {
          isKerb[(k + d + N) % N] = true;
        }
      }
    }

    // Precompute outward unit normals for all samples
    const outNormalsX = { inner: new Float32Array(N), outer: new Float32Array(N) };
    const outNormalsY = { inner: new Float32Array(N), outer: new Float32Array(N) };
    for (let k = 0; k < N; k++) {
      // Inner edge normal pointing away from track centerline
      const idx = t.ix[k] - t.cx[k];
      const idy = -t.iy[k] - (-t.cy[k]);
      const ilen = Math.hypot(idx, idy) || 1;
      outNormalsX.inner[k] = idx / ilen;
      outNormalsY.inner[k] = idy / ilen;

      // Outer edge normal pointing away from track centerline
      const odx = t.ox[k] - t.cx[k];
      const ody = -t.oy[k] - (-t.cy[k]);
      const olen = Math.hypot(odx, ody) || 1;
      outNormalsX.outer[k] = odx / olen;
      outNormalsY.outer[k] = ody / olen;
    }

    // Find all contiguous kerb runs
    const visited = new Uint8Array(N);
    const runs = [];
    for (let k = 0; k < N; k++) {
      const prev = (k - 1 + N) % N;
      if (isKerb[k] && !isKerb[prev] && !visited[k]) {
        const runIndices = [];
        let curr = k;
        while (isKerb[curr] && !visited[curr]) {
          visited[curr] = 1;
          runIndices.push(curr);
          curr = (curr + 1) % N;
        }
        if (runIndices.length >= 3) {
          runs.push(runIndices);
        }
      }
    }

    // Helper to push a quad to target vertex array
    const pushQuad = (target, p0x, p0y, p0z, p1x, p1y, p1z, p2x, p2y, p2z, p3x, p3y, p3z) => {
      target.push(p0x, p0y, p0z, p1x, p1y, p1z, p2x, p2y, p2z);
      target.push(p0x, p0y, p0z, p2x, p2y, p2z, p3x, p3y, p3z);
    };

    const SUBDIV = 8; // Smoothness of rounded bullnose end caps

    for (const run of runs) {
      const L = run.length;
      for (const side of ['inner', 'outer']) {
        const xs = side === 'inner' ? t.ix : t.ox;
        const ys = side === 'inner' ? t.iy : t.oy;
        const nxArr = side === 'inner' ? outNormalsX.inner : outNormalsX.outer;
        const nyArr = side === 'inner' ? outNormalsY.inner : outNormalsY.outer;

        // A. Rounded Entry Cap (Segment 0 -> 1)
        {
          const k0 = run[0];
          const k1 = run[1];
          const target = (k0 % 2 === 0) ? redVerts : whiteVerts;

          for (let m = 0; m < SUBDIV; m++) {
            const u0 = m / SUBDIV;
            const u1 = (m + 1) / SUBDIV;

            // Circular quadrant profile: w(u) = maxW * sqrt(2u - u^2)
            const w0 = maxKerbWidth * Math.sqrt(Math.max(0, 2 * u0 - u0 * u0));
            const w1 = maxKerbWidth * Math.sqrt(Math.max(0, 2 * u1 - u1 * u1));

            const zTrk = 0.08;
            const zVrg0 = 0.08 + 0.08 * (w0 / maxKerbWidth);
            const zVrg1 = 0.08 + 0.08 * (w1 / maxKerbWidth);

            const tx0 = (1 - u0) * xs[k0] + u0 * xs[k1];
            const ty0 = (1 - u0) * (-ys[k0]) + u0 * (-ys[k1]);
            const tx1 = (1 - u1) * xs[k0] + u1 * xs[k1];
            const ty1 = (1 - u1) * (-ys[k0]) + u1 * (-ys[k1]);

            const nx0 = (1 - u0) * nxArr[k0] + u0 * nxArr[k1];
            const ny0 = (1 - u0) * nyArr[k0] + u0 * nyArr[k1];
            const len0 = Math.hypot(nx0, ny0) || 1;
            const unx0 = nx0 / len0;
            const uny0 = ny0 / len0;

            const nx1 = (1 - u1) * nxArr[k0] + u1 * nxArr[k1];
            const ny1 = (1 - u1) * nyArr[k0] + u1 * nyArr[k1];
            const len1 = Math.hypot(nx1, ny1) || 1;
            const unx1 = nx1 / len1;
            const uny1 = ny1 / len1;

            const vx0 = tx0 + unx0 * w0;
            const vy0 = ty0 + uny0 * w0;
            const vx1 = tx1 + unx1 * w1;
            const vy1 = ty1 + uny1 * w1;

            pushQuad(target, tx0, ty0, zTrk, vx0, vy0, zVrg0, vx1, vy1, zVrg1, tx1, ty1, zTrk);
          }
        }

        // B. Uniform Full-Width Middle Body (Segments 1 -> L - 2)
        for (let s = 1; s < L - 2; s++) {
          const k = run[s];
          const j = run[s + 1];
          const target = (k % 2 === 0) ? redVerts : whiteVerts;

          const zTrk = 0.08;
          const zVrg = 0.16;

          const tx0 = xs[k];
          const ty0 = -ys[k];
          const tx1 = xs[j];
          const ty1 = -ys[j];

          const vx0 = tx0 + nxArr[k] * maxKerbWidth;
          const vy0 = ty0 + nyArr[k] * maxKerbWidth;
          const vx1 = tx1 + nxArr[j] * maxKerbWidth;
          const vy1 = ty1 + nyArr[j] * maxKerbWidth;

          pushQuad(target, tx0, ty0, zTrk, vx0, vy0, zVrg, vx1, vy1, zVrg, tx1, ty1, zTrk);
        }

        // C. Rounded Exit Cap (Segment L - 2 -> L - 1)
        {
          const k0 = run[L - 2];
          const k1 = run[L - 1];
          const target = (k0 % 2 === 0) ? redVerts : whiteVerts;

          for (let m = 0; m < SUBDIV; m++) {
            const u0 = m / SUBDIV;
            const u1 = (m + 1) / SUBDIV;

            // Circular quadrant profile: w(u) = maxW * sqrt(1 - u^2)
            const w0 = maxKerbWidth * Math.sqrt(Math.max(0, 1 - u0 * u0));
            const w1 = maxKerbWidth * Math.sqrt(Math.max(0, 1 - u1 * u1));

            const zTrk = 0.08;
            const zVrg0 = 0.08 + 0.08 * (w0 / maxKerbWidth);
            const zVrg1 = 0.08 + 0.08 * (w1 / maxKerbWidth);

            const tx0 = (1 - u0) * xs[k0] + u0 * xs[k1];
            const ty0 = (1 - u0) * (-ys[k0]) + u0 * (-ys[k1]);
            const tx1 = (1 - u1) * xs[k0] + u1 * xs[k1];
            const ty1 = (1 - u1) * (-ys[k0]) + u1 * (-ys[k1]);

            const nx0 = (1 - u0) * nxArr[k0] + u0 * nxArr[k1];
            const ny0 = (1 - u0) * nyArr[k0] + u0 * nyArr[k1];
            const len0 = Math.hypot(nx0, ny0) || 1;
            const unx0 = nx0 / len0;
            const uny0 = ny0 / len0;

            const nx1 = (1 - u1) * nxArr[k0] + u1 * nxArr[k1];
            const ny1 = (1 - u1) * nyArr[k0] + u1 * nyArr[k1];
            const len1 = Math.hypot(nx1, ny1) || 1;
            const unx1 = nx1 / len1;
            const uny1 = ny1 / len1;

            const vx0 = tx0 + unx0 * w0;
            const vy0 = ty0 + uny0 * w0;
            const vx1 = tx1 + unx1 * w1;
            const vy1 = ty1 + uny1 * w1;

            pushQuad(target, tx0, ty0, zTrk, vx0, vy0, zVrg0, vx1, vy1, zVrg1, tx1, ty1, zTrk);
          }
        }
      }
    }

    const kerbRedMat = new THREE.MeshStandardMaterial({
      color: C.kerbRed,
      roughness: 0.55,
      metalness: 0.1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      depthTest: true,
    });
    const kerbWhiteMat = new THREE.MeshStandardMaterial({
      color: C.kerbWhite,
      roughness: 0.55,
      metalness: 0.1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      depthTest: true,
    });

    if (redVerts.length) {
      kerbRedGeo.setAttribute('position', new THREE.Float32BufferAttribute(redVerts, 3));
      kerbRedGeo.computeVertexNormals();
      const redKerbMesh = new THREE.Mesh(kerbRedGeo, kerbRedMat);
      redKerbMesh.renderOrder = 12;
      this.decorGroup.add(redKerbMesh);
    }
    if (whiteVerts.length) {
      kerbWhiteGeo.setAttribute('position', new THREE.Float32BufferAttribute(whiteVerts, 3));
      kerbWhiteGeo.computeVertexNormals();
      const whiteKerbMesh = new THREE.Mesh(kerbWhiteGeo, kerbWhiteMat);
      whiteKerbMesh.renderOrder = 12;
      this.decorGroup.add(whiteKerbMesh);
    }

    // Checkered Start / Finish Line & Overhead Racing Gantry Arch
    this.setupFinishLine();

    this.scene.add(this.decorGroup);
  }

  setupFinishLine() {
    const t = this.track;
    const ix = t.ix[0];
    const iy = -t.iy[0];
    const ox = t.ox[0];
    const oy = -t.oy[0];
    const tx = t.tx[0];
    const ty = -t.ty[0];

    const dx = ox - ix;
    const dy = oy - iy;
    const trackWidth = Math.hypot(dx, dy) || 1;
    const nx = dx / trackWidth;
    const ny = dy / trackWidth;

    // 1. High-Impact Checkered Finish Line Band DIRECTLY ON THE TARMAC SURFACE
    const tarmacTex = this.createTarmacCheckeredTexture();
    const cols = 16;
    const rows = 4;
    const sqSize = trackWidth / cols;
    const bandLength = sqSize * rows; // Perfectly square checker tiles
    const bandWidth = trackWidth + 1.2; // Flush across entire road surface

    const bandGeo = new THREE.PlaneGeometry(bandWidth, bandLength);
    const bandMat = new THREE.MeshStandardMaterial({
      map: tarmacTex,
      roughness: 0.65,
      metalness: 0.1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
      depthTest: true,
    });
    const tarmacBand = new THREE.Mesh(bandGeo, bandMat);
    tarmacBand.renderOrder = 14;

    // Position flush on top of the tarmac surface
    tarmacBand.position.set((ix + ox) / 2, (iy + oy) / 2, 0.12);

    // Orient: Plane width aligns along road width (dx, dy), length aligns along track tangent (tx, ty)
    const roadAngle = Math.atan2(dy, dx);
    tarmacBand.rotation.z = roadAngle;
    this.decorGroup.add(tarmacBand);

    // 2. Thick White Start Bar across tarmac in front of starting grid
    const barGeo = new THREE.PlaneGeometry(trackWidth + 1.2, 2.2);
    const barMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
      depthTest: true,
    });
    const startBar = new THREE.Mesh(barGeo, barMat);
    startBar.renderOrder = 16;
    startBar.position.set(
      (ix + ox) / 2 - tx * (bandLength + 4.0),
      (iy + oy) / 2 - ty * (bandLength + 4.0),
      0.13
    );
    startBar.rotation.z = roadAngle;
    this.decorGroup.add(startBar);

    // 3. Heavy-Duty Motorsport Pipe Scaffold Arch & Overhead Box Truss
    const gantryGroup = new THREE.Group();
    const archBeamZ = 15.5; // High clearance under the main arch beam
    const plateHeight = 6.2;
    const plateDepth = 1.8;

    // Scoreboard is mounted OVER the arch crossbeam
    const scoreboardZ = archBeamZ + 1.2 + (plateHeight * 0.5) + 0.4;
    const totalColHeight = scoreboardZ + plateHeight * 0.5 + 1.2;
    const pillarClearance = 8.5; // Margin outside road edge

    const innerCenter = new THREE.Vector3(ix - nx * pillarClearance, iy - ny * pillarClearance, 0);
    const outerCenter = new THREE.Vector3(ox + nx * pillarClearance, oy + ny * pillarClearance, 0);
    const spanDist = innerCenter.distanceTo(outerCenter);
    const plateWidth = Math.min(38.0, spanDist * 0.72);

    const latDir = new THREE.Vector3().subVectors(outerCenter, innerCenter);
    latDir.z = 0;
    latDir.normalize();
    const longDir = new THREE.Vector3(tx, ty, 0).normalize();
    const beamAngle = Math.atan2(latDir.y, latDir.x);

    // Premium Galvanized Steel & Aluminum Pipe Scaffold Materials
    const scaffoldMat = new THREE.MeshStandardMaterial({
      color: 0xc8d1dc, // Galvanized tubular steel pipe
      metalness: 0.88,
      roughness: 0.24,
    });
    const chordMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0, // Structural aluminum heavy main chords
      metalness: 0.82,
      roughness: 0.20,
    });
    const couplerMat = new THREE.MeshStandardMaterial({
      color: 0x475569, // Forged steel scaffolding coupler clamps
      metalness: 0.70,
      roughness: 0.40,
    });
    const safetyMat = new THREE.MeshStandardMaterial({
      color: 0xe11d48, // FIA motorsport crimson high-vis clamp rings
      metalness: 0.35,
      roughness: 0.30,
    });
    const podHousingMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.60,
      roughness: 0.30,
    });

    // Helper to add a 3D tubular pipe connecting two 3D vector points
    const addPipe = (p1, p2, radius = 0.16, mat = scaffoldMat) => {
      const v = new THREE.Vector3().subVectors(p2, p1);
      const len = v.length();
      if (len < 0.05) return null;
      const geo = new THREE.CylinderGeometry(radius, radius, len, 8);
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.addVectors(p1, p2).multiplyScalar(0.5);
      mesh.lookAt(p2);
      mesh.castShadow = true;
      gantryGroup.add(mesh);
      return mesh;
    };

    // Helper to add coupler clamp collar at node junctions
    const addCoupler = (pos, r = 0.28, mat = couplerMat) => {
      const geo = new THREE.CylinderGeometry(r, r, 0.32, 8);
      geo.rotateX(Math.PI / 2);
      const mesh = new THREE.Mesh(geo, mat);
      mesh.position.copy(pos);
      gantryGroup.add(mesh);
      return mesh;
    };

    // Helper to add heavy base-jack footplates on ground
    const addBaseJack = (pos) => {
      const plateGeo = new THREE.BoxGeometry(0.85, 0.85, 0.14);
      const plate = new THREE.Mesh(plateGeo, couplerMat);
      plate.position.set(pos.x, pos.y, 0.07);
      gantryGroup.add(plate);

      const collarGeo = new THREE.CylinderGeometry(0.28, 0.32, 0.45, 8);
      collarGeo.rotateX(Math.PI / 2);
      const collar = new THREE.Mesh(collarGeo, safetyMat);
      collar.position.set(pos.x, pos.y, 0.35);
      gantryGroup.add(collar);
    };

    // -------------------------------------------------------------
    // 1. Two Quad-Tube Scaffold Pillar Towers (Inner & Outer)
    // -------------------------------------------------------------
    const towerW = 2.4; // width across track
    const towerD = 2.8; // depth along track
    const towerH = totalColHeight;
    const towerLevels = [0.8, 3.2, 5.6, 8.0, 10.4, 12.8, 15.2, 17.6, 20.0, towerH];

    const buildScaffoldTower = (towerCenter, isOuter = false) => {
      // 4 Corner Verticals (Standards)
      const offsets = [
        { dx: -towerW * 0.5, dy: -towerD * 0.5 },
        { dx:  towerW * 0.5, dy: -towerD * 0.5 },
        { dx:  towerW * 0.5, dy:  towerD * 0.5 },
        { dx: -towerW * 0.5, dy:  towerD * 0.5 },
      ];

      const corners = offsets.map(o => {
        const pt = towerCenter.clone();
        pt.addScaledVector(latDir, o.dx);
        pt.addScaledVector(longDir, o.dy);
        return pt;
      });

      // Standards (Vertical Pipes) & Base Jacks
      for (const c of corners) {
        addBaseJack(c);
        const pBottom = c.clone();
        pBottom.z = 0.1;
        const pTop = c.clone();
        pTop.z = towerH;
        addPipe(pBottom, pTop, 0.22, chordMat);
      }

      // Horizontal Ledger/Transom Rungs & Couplers at each elevation level
      for (const z of towerLevels) {
        const ring = corners.map(c => {
          const pt = c.clone();
          pt.z = z;
          addCoupler(pt, 0.30, z % 4.8 < 1.0 ? safetyMat : couplerMat);
          return pt;
        });

        for (let j = 0; j < 4; j++) {
          const next = (j + 1) % 4;
          addPipe(ring[j], ring[next], 0.15, scaffoldMat);
        }
      }

      // Diagonal X-Bracing on Tower Faces
      for (let i = 0; i < towerLevels.length - 1; i++) {
        const z1 = towerLevels[i];
        const z2 = towerLevels[i + 1];

        // Diagonal on Front Face (facing incoming cars)
        const f0_b = corners[0].clone(); f0_b.z = z1;
        const f1_t = corners[1].clone(); f1_t.z = z2;
        const f0_t = corners[0].clone(); f0_t.z = z2;
        const f1_b = corners[1].clone(); f1_b.z = z1;
        addPipe(f0_b, f1_t, 0.13, scaffoldMat);
        addPipe(f0_t, f1_b, 0.13, scaffoldMat);

        // Diagonal on Back Face
        const b3_b = corners[3].clone(); b3_b.z = z1;
        const b2_t = corners[2].clone(); b2_t.z = z2;
        const b3_t = corners[3].clone(); b3_t.z = z2;
        const b2_b = corners[2].clone(); b2_b.z = z1;
        addPipe(b3_b, b2_t, 0.13, scaffoldMat);
        addPipe(b3_t, b2_b, 0.13, scaffoldMat);

        // Outside face bracing
        const outIdxA = isOuter ? 1 : 0;
        const outIdxB = isOuter ? 2 : 3;
        const oA_b = corners[outIdxA].clone(); oA_b.z = z1;
        const oB_t = corners[outIdxB].clone(); oB_t.z = z2;
        const oA_t = corners[outIdxA].clone(); oA_t.z = z2;
        const oB_b = corners[outIdxB].clone(); oB_b.z = z1;
        addPipe(oA_b, oB_t, 0.13, scaffoldMat);
        addPipe(oA_t, oB_b, 0.13, scaffoldMat);
      }

      // Outer maintenance pipe ladder
      if (isOuter) {
        const ladSideA = corners[1].clone().addScaledVector(latDir, 0.45);
        const ladSideB = corners[2].clone().addScaledVector(latDir, 0.45);
        const lAb = ladSideA.clone(); lAb.z = 0.2;
        const lAt = ladSideA.clone(); lAt.z = towerH;
        const lBb = ladSideB.clone(); lBb.z = 0.2;
        const lBt = ladSideB.clone(); lBt.z = towerH;
        addPipe(lAb, lAt, 0.10, chordMat);
        addPipe(lBb, lBt, 0.10, chordMat);
        for (let lz = 1.0; lz < towerH - 0.5; lz += 0.75) {
          const r1 = ladSideA.clone(); r1.z = lz;
          const r2 = ladSideB.clone(); r2.z = lz;
          addPipe(r1, r2, 0.08, scaffoldMat);
        }
      }
    };

    buildScaffoldTower(innerCenter, false);
    buildScaffoldTower(outerCenter, true);

    // -------------------------------------------------------------
    // 2. Overhead Modular Pipe Scaffold Box Truss (Cross-Track Span)
    // -------------------------------------------------------------
    const trussH = 2.4; // 2.4m vertical height of box truss
    const trussD = 2.2; // 2.2m depth along track
    const trussZBottom = archBeamZ - trussH * 0.5;
    const trussZTop = archBeamZ + trussH * 0.5;

    // 4 Long Continuous Chords across the full track width
    const chordOffsets = [
      { dy: -trussD * 0.5, z: trussZBottom }, // Bottom-Front
      { dy:  trussD * 0.5, z: trussZBottom }, // Bottom-Back
      { dy: -trussD * 0.5, z: trussZTop },    // Top-Front
      { dy:  trussD * 0.5, z: trussZTop },    // Top-Back
    ];

    for (const co of chordOffsets) {
      const pStart = innerCenter.clone().addScaledVector(longDir, co.dy);
      pStart.z = co.z;
      const pEnd = outerCenter.clone().addScaledVector(longDir, co.dy);
      pEnd.z = co.z;
      addPipe(pStart, pEnd, 0.22, chordMat);
    }

    // Modular Cross-Bays across the track span
    const baySpacing = 3.2; // Every ~3.2m along the span
    const numBays = Math.max(8, Math.floor(spanDist / baySpacing));

    for (let b = 0; b <= numBays; b++) {
      const frac = b / numBays;
      const bayCenter = new THREE.Vector3().lerpVectors(innerCenter, outerCenter, frac);

      const pBF = bayCenter.clone().addScaledVector(longDir, -trussD * 0.5); pBF.z = trussZBottom;
      const pBB = bayCenter.clone().addScaledVector(longDir,  trussD * 0.5); pBB.z = trussZBottom;
      const pTF = bayCenter.clone().addScaledVector(longDir, -trussD * 0.5); pTF.z = trussZTop;
      const pTB = bayCenter.clone().addScaledVector(longDir,  trussD * 0.5); pTB.z = trussZTop;

      // Vertical & transverse ring struts at bay divider
      addPipe(pBF, pTF, 0.15, scaffoldMat);
      addPipe(pBB, pTB, 0.15, scaffoldMat);
      addPipe(pBF, pBB, 0.15, scaffoldMat);
      addPipe(pTF, pTB, 0.15, scaffoldMat);

      addCoupler(pBF, 0.28, couplerMat);
      addCoupler(pBB, 0.28, couplerMat);
      addCoupler(pTF, 0.28, couplerMat);
      addCoupler(pTB, 0.28, couplerMat);

      // Diagonal X-Braces in each bay
      if (b < numBays) {
        const nextFrac = (b + 1) / numBays;
        const nextCenter = new THREE.Vector3().lerpVectors(innerCenter, outerCenter, nextFrac);

        const npBF = nextCenter.clone().addScaledVector(longDir, -trussD * 0.5); npBF.z = trussZBottom;
        const npBB = nextCenter.clone().addScaledVector(longDir,  trussD * 0.5); npBB.z = trussZBottom;
        const npTF = nextCenter.clone().addScaledVector(longDir, -trussD * 0.5); npTF.z = trussZTop;
        const npTB = nextCenter.clone().addScaledVector(longDir,  trussD * 0.5); npTB.z = trussZTop;

        // Front Face X-Brace (facing oncoming cars)
        addPipe(pBF, npTF, 0.13, scaffoldMat);
        addPipe(pTF, npBF, 0.13, scaffoldMat);

        // Back Face X-Brace
        addPipe(pBB, npTB, 0.13, scaffoldMat);
        addPipe(pTB, npBB, 0.13, scaffoldMat);

        // Bottom Face X-Brace (visible when driving directly under gantry)
        addPipe(pBF, npBB, 0.13, scaffoldMat);
        addPipe(pBB, npBF, 0.13, scaffoldMat);

        // Top Face X-Brace
        addPipe(pTF, npTB, 0.13, scaffoldMat);
        addPipe(pTB, npTF, 0.13, scaffoldMat);
      }
    }

    // -------------------------------------------------------------
    // 3. Digital Overhead Scoreboard Housing (Mounted ATOP Scaffold Truss)
    // -------------------------------------------------------------
    const gantryCenter = new THREE.Vector3().addVectors(innerCenter, outerCenter).multiplyScalar(0.5);
    const scoreboardCenter = gantryCenter.clone();
    scoreboardCenter.z = scoreboardZ;

    const plateHousingGeo = new THREE.BoxGeometry(plateWidth, plateDepth, plateHeight);
    const plateHousingMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b, // Deep anodized slate/titanium casing
      metalness: 0.45,
      roughness: 0.38,
    });
    const plateHousing = new THREE.Mesh(plateHousingGeo, plateHousingMat);
    plateHousing.position.copy(scoreboardCenter);
    plateHousing.rotation.z = beamAngle;
    plateHousing.castShadow = true;
    gantryGroup.add(plateHousing);

    // Heavy-duty Steel Mounting Pylons clamping Scoreboard down to Scaffold Truss
    const strutH = (scoreboardZ - plateHeight * 0.5) - trussZTop;
    for (const sx of [-plateWidth * 0.38, -plateWidth * 0.14, plateWidth * 0.14, plateWidth * 0.38]) {
      for (const sy of [-plateDepth * 0.35, plateDepth * 0.35]) {
        const sBottom = scoreboardCenter.clone();
        sBottom.addScaledVector(latDir, sx);
        sBottom.addScaledVector(longDir, sy);
        sBottom.z = trussZTop;

        const sTop = scoreboardCenter.clone();
        sTop.addScaledVector(latDir, sx);
        sTop.addScaledVector(longDir, sy);
        sTop.z = scoreboardZ - plateHeight * 0.5;

        addPipe(sBottom, sTop, 0.18, chordMat);
        addCoupler(sBottom, 0.28, couplerMat);
      }
    }

    // Glowing Cyan Racing Neon Trim Framing Border around the Scoreboard
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      metalness: 0.3,
      roughness: 0.2,
    });
    const topTrimGeo = new THREE.BoxGeometry(plateWidth + 0.6, plateDepth + 0.2, 0.35);
    const topTrim = new THREE.Mesh(topTrimGeo, trimMat);
    topTrim.position.set(0, 0, plateHeight * 0.5 + 0.18);
    plateHousing.add(topTrim);
    const btmTrim = new THREE.Mesh(topTrimGeo, trimMat);
    btmTrim.position.set(0, 0, -plateHeight * 0.5 - 0.18);
    plateHousing.add(btmTrim);

    // 5 F1 Starting Light Pods mounted under the arch crossbeam facing incoming cars
    // 5 F1 Starting Light Pods mounted on Cantilever Scaffolding Booms OUT IN FRONT of the truss
    // Suspended below and forward towards oncoming cars so no truss pipes or chords ever block line-of-sight!
    this.gantryLedMats = [];
    this.gantryLeds = [];
    this._lastStartLightStep = -1;
    const podClearZ = trussZBottom - 1.4; // 1.4m below the lowest truss pipe
    const podForwardOffset = -trussD * 0.5 - 1.6; // 1.6m out in front towards oncoming traffic

    for (let i = -2; i <= 2; i++) {
      const housingGeo = new THREE.BoxGeometry(2.2, 1.4, 2.2);
      const housing = new THREE.Mesh(housingGeo, podHousingMat);
      const latOffset = new THREE.Vector3().copy(latDir).multiplyScalar(i * 5.8);

      // Position pod forward and down, completely outside and clear of all truss pipes
      const podPos = gantryCenter.clone()
        .add(latOffset)
        .addScaledVector(longDir, podForwardOffset);
      podPos.z = podClearZ;

      housing.position.copy(podPos);
      housing.rotation.z = beamAngle;
      gantryGroup.add(housing);

      // Cantilevered pipe scaffold boom extending from bottom-front truss chord out to the pod
      const chordAnchor = gantryCenter.clone()
        .add(latOffset)
        .addScaledVector(longDir, -trussD * 0.5);
      chordAnchor.z = trussZBottom;

      addPipe(chordAnchor, podPos, 0.13, chordMat);
      addCoupler(chordAnchor, 0.26, safetyMat);
      addCoupler(podPos, 0.24, couplerMat);

      // Secondary vertical support strut from top-front chord for extra industrial realism
      const upperChordAnchor = chordAnchor.clone();
      upperChordAnchor.z = trussZTop;
      addPipe(upperChordAnchor, podPos, 0.10, scaffoldMat);

      // Large High-Intensity LED bulb facing directly incoming cars
      const ledGeo = new THREE.SphereGeometry(0.85, 16, 16);
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 3.5,
        roughness: 0.1,
      });
      const led = new THREE.Mesh(ledGeo, ledMat);
      // Place LED on the front face pointing directly towards approaching cars
      led.position.addVectors(housing.position, new THREE.Vector3(-tx * 0.95, -ty * 0.95, 0));
      gantryGroup.add(led);
      this.gantryLedMats.push(ledMat);
      this.gantryLeds.push(led);
    }

    // Dynamic Ultra-Sharp Canvas Texture for Overhead Scoreboard (1024 x 320)
    const canvas = document.createElement('canvas');
    canvas.width = 1024;
    canvas.height = 320;
    this.lapPlateCanvas = canvas;
    this.lapPlateCtx = canvas.getContext('2d');
    this.lapPlateTexture = new THREE.CanvasTexture(canvas);
    this.lapPlateTexture.anisotropy = Math.min(16, this.renderer?.capabilities?.getMaxAnisotropy?.() || 8);
    this.lapPlateTexture.minFilter = THREE.LinearFilter;
    this.lapPlateTexture.magFilter = THREE.LinearFilter;

    const displayMat = new THREE.MeshStandardMaterial({
      map: this.lapPlateTexture,
      emissive: 0xffffff,
      emissiveMap: this.lapPlateTexture,
      emissiveIntensity: 1.4,
      roughness: 0.15,
      metalness: 0.05,
    });

    // Front Display (Facing incoming cars upstream)
    const frontDisplayGeo = new THREE.PlaneGeometry(plateWidth - 0.6, plateHeight - 0.6);
    frontDisplayGeo.rotateX(Math.PI / 2);
    frontDisplayGeo.rotateZ(Math.PI);
    const frontDisplay = new THREE.Mesh(frontDisplayGeo, displayMat);
    frontDisplay.position.copy(scoreboardCenter);
    frontDisplay.position.add(new THREE.Vector3(-tx * (plateDepth * 0.5 + 0.06), -ty * (plateDepth * 0.5 + 0.06), 0));
    frontDisplay.rotation.z = beamAngle;
    gantryGroup.add(frontDisplay);

    // Back Display (Facing cars downstream)
    const backDisplayGeo = new THREE.PlaneGeometry(plateWidth - 0.6, plateHeight - 0.6);
    backDisplayGeo.rotateX(Math.PI / 2);
    const backDisplay = new THREE.Mesh(backDisplayGeo, displayMat);
    backDisplay.position.copy(scoreboardCenter);
    backDisplay.position.add(new THREE.Vector3(tx * (plateDepth * 0.5 + 0.06), ty * (plateDepth * 0.5 + 0.06), 0));
    backDisplay.rotation.z = beamAngle;
    gantryGroup.add(backDisplay);

    this._lastLapPlateKey = '';
    this.updateLapPlateTexture('4 LAPS TO GO', 'LAP 1 OF 5 · LEADER P1', '#38bdf8', false);

    this.decorGroup.add(gantryGroup);
  }

  updateGantryLights(sim) {
    if (!this.gantryLedMats || this.gantryLedMats.length === 0) return;

    const startDelay = CONFIG.generation?.startDelay || 2.0;
    const t = sim ? sim.time : startDelay;

    if (t < startDelay) {
      // Red lights countdown phase (0s to 2.0s)
      let activeRedCount = 0;
      for (let i = 0; i < 5; i++) {
        const lightTrigger = 0.3 + i * 0.3; // 0.3s, 0.6s, 0.9s, 1.2s, 1.5s
        const mat = this.gantryLedMats[i];
        if (!mat) continue;
        if (t >= lightTrigger) {
          activeRedCount++;
          mat.color.setHex(0xef4444);
          mat.emissive.setHex(0xef4444);
          mat.emissiveIntensity = 3.8;
        } else {
          mat.color.setHex(0x221111);
          mat.emissive.setHex(0x000000);
          mat.emissiveIntensity = 0.0;
        }
      }
      if (activeRedCount > this._lastStartLightStep && activeRedCount > 0) {
        this._lastStartLightStep = activeRedCount;
        audio.playStartBeep(false);
      }
    } else if (t >= startDelay && t < startDelay + 4.0) {
      // GREEN LIGHTS! CARS LAUNCH AND RACE!
      if (this._lastStartLightStep !== 99) {
        this._lastStartLightStep = 99;
        audio.playStartBeep(true);
      }
      for (let i = 0; i < 5; i++) {
        const mat = this.gantryLedMats[i];
        if (mat) {
          mat.color.setHex(0x22c55e);
          mat.emissive.setHex(0x22c55e);
          mat.emissiveIntensity = 5.0;
        }
      }
    } else {
      // Post-start ambient running green
      if (this._lastStartLightStep !== 100) {
        this._lastStartLightStep = 100;
      }
      for (let i = 0; i < 5; i++) {
        const mat = this.gantryLedMats[i];
        if (mat) {
          mat.color.setHex(0x14532d);
          mat.emissive.setHex(0x16a34a);
          mat.emissiveIntensity = 0.7;
        }
      }
    }
  }

  updateLapPlateTexture(mainText, subText, accentColor = '#38bdf8', isFinal = false) {
    if (!this.lapPlateCtx) return;
    const ctx = this.lapPlateCtx;
    const w = 1024;
    const h = 320;

    ctx.clearRect(0, 0, w, h);

    // Deep high-contrast dark chassis background
    ctx.fillStyle = '#040711';
    ctx.fillRect(0, 0, w, h);

    // Subtle carbon grid scanline pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let y = 0; y < h; y += 8) {
      ctx.fillRect(0, y, w, 4);
    }

    // Outer neon glow border
    ctx.lineWidth = 10;
    ctx.strokeStyle = accentColor;
    ctx.strokeRect(5, 5, w - 10, h - 10);

    // Inner bevel border
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
    ctx.strokeRect(16, 16, w - 32, h - 32);

    if (isFinal) {
      // Checkered pattern side accents for Final Lap / Chequered Flag
      const chSize = 24;
      const chRows = Math.floor((h - 32) / chSize);
      for (let r = 0; r < chRows; r++) {
        for (let c = 0; c < 4; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#090d16';
          ctx.fillRect(20 + c * chSize, 20 + r * chSize, chSize, chSize);
          ctx.fillRect(w - 20 - (c + 1) * chSize, 20 + r * chSize, chSize, chSize);
        }
      }
    }

    // Top Header Tag (e.g. "LAP 2 OF 5 · LEADER P1" or "RACE FINISHED")
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 36px "Outfit", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = accentColor;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 10;
    ctx.fillText(subText.toUpperCase(), w / 2, 32);
    ctx.shadowBlur = 0;

    // Glowing Divider Line
    ctx.strokeStyle = accentColor;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(w * 0.16, 88);
    ctx.lineTo(w * 0.84, 88);
    ctx.stroke();

    // Main Digital Text (e.g. "3 LAPS TO GO", "FINAL LAP", "CHEQUERED FLAG")
    ctx.textBaseline = 'middle';
    ctx.font = '900 112px "JetBrains Mono", "Outfit", Impact, system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 24;
    ctx.fillText(mainText, w / 2, 196);
    ctx.shadowBlur = 0;

    if (this.lapPlateTexture) {
      this.lapPlateTexture.needsUpdate = true;
    }
  }

  updateLapPlate(sim, leader) {
    if (!this.lapPlateCtx) return;

    const startDelay = CONFIG.generation?.startDelay || 2.0;
    const simTime = sim ? sim.time : startDelay;
    const maxLaps = CONFIG.generation?.maxLaps || 5;

    // Identify current leader / player in P1
    const currentLeader = (sim?.player && (sim.player.alive || sim.player.finished)) ? sim.player : (sim?.leader || leader);
    const lapsDone = currentLeader ? (currentLeader.laps || 0) : 0;
    const isFinished = Boolean(
      (currentLeader && (currentLeader.finished || currentLeader.laps >= maxLaps)) ||
      (sim?.cars && sim.cars.some((c) => c.finished || c.laps >= maxLaps)) ||
      (sim?.player && (sim.player.finished || sim.player.laps >= maxLaps))
    );

    // Current lap being driven (1-indexed: 1, 2, ..., maxLaps)
    const currentLap = Math.min(lapsDone + 1, maxLaps);
    // Number of laps remaining to complete in the race (e.g. 5 on Lap 1, 1 on Final Lap, 0 at Finish)
    const lapsRemaining = Math.max(0, maxLaps - lapsDone);

    let mainText = `${lapsRemaining} LAPS TO GO`;
    let subText = `LAP ${currentLap} OF ${maxLaps} · LEADER P1`;
    let color = '#38bdf8'; // Electric Cyan
    let isFinal = false;

    if (simTime < startDelay) {
      mainText = 'START COUNTDOWN';
      subText = 'WATCH 5 RED LIGHTS · HOLD GRID';
      color = '#ef4444'; // Red
      isFinal = false;
    } else if (simTime < startDelay + 2.8) {
      mainText = 'GO GO GO!';
      subText = 'GREEN LIGHTS · RACE ON';
      color = '#22c55e'; // Bright Green
      isFinal = true;
    } else if (isFinished || lapsDone >= maxLaps || (sim.checkeredFlagTimer !== null && sim.checkeredFlagTimer > 0)) {
      mainText = 'CHEQUERED FLAG';
      const rem = (sim.checkeredFlagTimer !== null && sim.checkeredFlagTimer > 0)
        ? `${Math.ceil(sim.checkeredFlagTimer)}s FINISH WINDOW`
        : 'RACE WINNER';
      subText = `FINISH · ${rem}`;
      color = '#fbbf24'; // Radiant Gold
      isFinal = true;
    } else if (lapsRemaining === 1) {
      // 1 lap to go IS the Final Lap (driving lap 5 of 5)
      mainText = 'FINAL LAP';
      subText = `LAP ${maxLaps} OF ${maxLaps} · 1 LAP TO GO`;
      color = '#fbbf24'; // Radiant Gold
      isFinal = true;
    } else if (lapsRemaining === 2) {
      // 2 laps to go (driving lap 4 of 5)
      mainText = '2 LAPS TO GO';
      subText = `LAP ${currentLap} OF ${maxLaps} · NEXT IS FINAL LAP`;
      color = '#f472b6'; // Hot Pink / Magenta
    } else if (lapsRemaining === 3) {
      mainText = '3 LAPS TO GO';
      subText = `LAP ${currentLap} OF ${maxLaps} · RACE LEADER`;
      color = '#38bdf8'; // Electric Cyan
    } else if (lapsRemaining === 4) {
      mainText = '4 LAPS TO GO';
      subText = `LAP ${currentLap} OF ${maxLaps} · LEADER P1`;
      color = '#38bdf8'; // Electric Cyan
    } else {
      mainText = 'RACE ON';
      subText = `LAP 1 OF ${maxLaps} · GREEN FLAG`;
      color = '#38bdf8'; // Electric Cyan
    }

    const stateKey = `${mainText}|${subText}|${color}|${isFinal}`;
    if (stateKey !== this._lastLapPlateKey) {
      this._lastLapPlateKey = stateKey;
      this.updateLapPlateTexture(mainText, subText, color, isFinal);
    }
  }

  createTarmacCheckeredTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');

    // 4 rows of 16 high-contrast checkered squares
    const cols = 16;
    const rows = 4;
    const w = 512 / cols;
    const h = 128 / rows;

    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#111827';
        ctx.fillRect(c * w, r * h, w, h);
      }
    }

    // High-visibility boundary pin-stripes
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, 512, 4);
    ctx.fillRect(0, 124, 512, 4);

    const tex = new THREE.CanvasTexture(canvas);
    tex.anisotropy = Math.min(16, this.renderer?.capabilities?.getMaxAnisotropy?.() || 8);
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = true;
    return tex;
  }

  createRaceNumberTexture(num, isLeader = false, isPlayer = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);

    const numStr = String(num);
    const fontSize = numStr.length >= 3 ? 200 : numStr.length === 2 ? 260 : 310;

    // 1. Classic Motorsport White Roundel Disc - 80% Translucent (20% Opacity)
    ctx.beginPath();
    ctx.arc(256, 256, 230, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.20)';
    ctx.fill();

    // 2. Bold Black Outer Border
    ctx.lineWidth = 26;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // 3. Crisp Bold Black Number
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${fontSize}px "Outfit", "JetBrains Mono", Impact, "Arial Black", sans-serif`;
    ctx.fillStyle = '#000000';
    ctx.fillText(numStr, 256, 260);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  createCarContactShadowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 256);

    // 1. Soft overall underbody ambient shadow
    const grad = ctx.createRadialGradient(256, 128, 15, 256, 128, 220);
    grad.addColorStop(0, 'rgba(0, 0, 0, 0.88)');
    grad.addColorStop(0.50, 'rgba(0, 0, 0, 0.58)');
    grad.addColorStop(0.82, 'rgba(0, 0, 0, 0.20)');
    grad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.ellipse(256, 128, 235, 115, 0, 0, Math.PI * 2);
    ctx.fill();

    // 2. Heavy dark contact occlusion footprint directly beneath the 4 tire contact patches
    // Plane: 35.1 x 18.85. Front wheels: X = 392.5, Y = 46.8 & 209.2. Rear wheels: X = 123.2, Y = 46.8 & 209.2
    const tirePatches = [
      { x: 393, y: 47, rx: 32, ry: 20 },
      { x: 393, y: 209, rx: 32, ry: 20 },
      { x: 123, y: 47, rx: 36, ry: 24 },
      { x: 123, y: 209, rx: 36, ry: 24 },
    ];

    for (const tp of tirePatches) {
      const tGrad = ctx.createRadialGradient(tp.x, tp.y, 4, tp.x, tp.y, tp.rx);
      tGrad.addColorStop(0, 'rgba(0, 0, 0, 1.0)');
      tGrad.addColorStop(0.55, 'rgba(0, 0, 0, 0.85)');
      tGrad.addColorStop(0.85, 'rgba(0, 0, 0, 0.35)');
      tGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
      ctx.fillStyle = tGrad;
      ctx.beginPath();
      ctx.ellipse(tp.x, tp.y, tp.rx, tp.ry, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // 3. Central floor & diffuser dense core ambient occlusion
    const coreGrad = ctx.createRadialGradient(240, 128, 12, 240, 128, 120);
    coreGrad.addColorStop(0, 'rgba(0, 0, 0, 0.95)');
    coreGrad.addColorStop(0.65, 'rgba(0, 0, 0, 0.60)');
    coreGrad.addColorStop(1, 'rgba(0, 0, 0, 0)');
    ctx.fillStyle = coreGrad;
    ctx.beginPath();
    ctx.ellipse(240, 128, 160, 60, 0, 0, Math.PI * 2);
    ctx.fill();

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  createCarMesh(color, isPlayer = false, carIdx = 0, carNumber = 1) {
    const group = new THREE.Group();
    const L = CONFIG.car.length; // 26
    const W = CONFIG.car.width;  // 13

    // 0. UNDERBODY AMBIENT OCCLUSION CONTACT SHADOW (Locks tires solidly to tarmac)
    if (!this.contactShadowTexture) {
      this.contactShadowTexture = this.createCarContactShadowTexture();
      this.contactShadowMat = new THREE.MeshBasicMaterial({
        map: this.contactShadowTexture,
        transparent: true,
        opacity: 0.96,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -1.5,
        polygonOffsetUnits: -1.5,
      });
    }
    const shadowGeo = new THREE.PlaneGeometry(L * 1.35, W * 1.45);
    const contactShadow = new THREE.Mesh(shadowGeo, this.contactShadowMat);
    contactShadow.position.set(0, 0, 0.015);
    contactShadow.renderOrder = 2;
    group.add(contactShadow);

    // Primary, Secondary, Accent, & Quad color palette (1 to 4 colors per team)
    const teamIdx = isPlayer ? 1 : (carIdx % TEAM_PALETTE.length);
    const team = TEAM_PALETTE[teamIdx];
    const carColor = isPlayer ? 0x00e626 : (color || team.hex);
    const secColor = isPlayer ? 0xfacc15 : (team.secHex || carColor);
    const accColor = isPlayer ? 0xffffff : (team.accHex || carColor);
    const quadColor = isPlayer ? 0x00e626 : (team.quadHex || team.secHex || carColor);

    // Materials
    const bodyMat = new THREE.MeshStandardMaterial({
      color: carColor,
      roughness: 0.25,
      metalness: 0.25,
      emissive: carColor,
      emissiveIntensity: 0.12,
    });
    const secMat = new THREE.MeshStandardMaterial({
      color: secColor,
      roughness: 0.25,
      metalness: 0.25,
      emissive: secColor,
      emissiveIntensity: 0.12,
    });
    const accMat = new THREE.MeshStandardMaterial({
      color: accColor,
      roughness: 0.25,
      metalness: 0.25,
      emissive: accColor,
      emissiveIntensity: 0.10,
    });
    const quadMat = new THREE.MeshStandardMaterial({
      color: quadColor,
      roughness: 0.25,
      metalness: 0.25,
      emissive: quadColor,
      emissiveIntensity: 0.12,
    });
    const carbonMat = new THREE.MeshStandardMaterial({
      color: 0x141820,
      roughness: 0.65,
      metalness: 0.5,
    });
    const cockpitMat = new THREE.MeshStandardMaterial({
      color: 0x090c10,
      roughness: 0.9,
      metalness: 0.1,
    });
    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.85,
      roughness: 0.25,
    });
    const helmetMat = new THREE.MeshStandardMaterial({
      color: secColor,
      metalness: 0.6,
      roughness: 0.2,
    });
    const visorMat = new THREE.MeshStandardMaterial({
      color: 0x050505,
      metalness: 0.95,
      roughness: 0.05,
    });
    const tireMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.88,
    });
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xd4af37,
      metalness: 0.92,
      roughness: 0.18,
    });
    const rimStripeMat = new THREE.MeshBasicMaterial({
      color: secColor,
    });
    const rainLightMat = new THREE.MeshBasicMaterial({
      color: 0xff1e1e,
    });

    // 1. UNDERBODY FLOOR & DIFFUSER TRAY
    const floorGeo = new THREE.BoxGeometry(L * 0.72, W * 0.78, 0.25);
    const floor = new THREE.Mesh(floorGeo, carbonMat);
    floor.position.set(-L * 0.04, 0, 0.6);
    floor.castShadow = true;
    group.add(floor);

    // Upswept Rear Diffuser
    const diffGeo = new THREE.BoxGeometry(L * 0.18, W * 0.60, 0.6);
    const diff = new THREE.Mesh(diffGeo, carbonMat);
    diff.position.set(-L * 0.44, 0, 0.9);
    diff.rotation.y = 0.22;
    group.add(diff);

    // Diffuser vertical strakes
    for (const dy of [-2.4, -0.8, 0.8, 2.4]) {
      const strakeGeo = new THREE.BoxGeometry(3.2, 0.18, 0.8);
      const strake = new THREE.Mesh(strakeGeo, carbonMat);
      strake.position.set(-L * 0.44, dy, 0.9);
      group.add(strake);
    }

    // 2. CENTRAL MONOCOQUE & COCKPIT TUB
    const tubGeo = new THREE.BoxGeometry(L * 0.32, 4.4, 1.8);
    const tub = new THREE.Mesh(tubGeo, bodyMat);
    tub.position.set(-L * 0.02, 0, 1.6);
    tub.castShadow = true;
    group.add(tub);

    // Cockpit opening cavity
    const cockpitGeo = new THREE.BoxGeometry(4.8, 2.8, 0.8);
    const cockpit = new THREE.Mesh(cockpitGeo, cockpitMat);
    cockpit.position.set(0.2, 0, 2.3);
    group.add(cockpit);

    // Headrest / Safety Bolsters behind driver
    const headrestGeo = new THREE.BoxGeometry(2.4, 2.8, 1.0);
    const headrest = new THREE.Mesh(headrestGeo, carbonMat);
    headrest.position.set(-2.4, 0, 2.35);
    group.add(headrest);

    // 3. TAPERED NOSE CONE & FRONT CHASSIS
    // Rear nose section (blends from tub to nose)
    const midNoseGeo = new THREE.BoxGeometry(L * 0.24, 3.2, 1.5);
    const midNose = new THREE.Mesh(midNoseGeo, bodyMat);
    midNose.position.set(L * 0.22, 0, 1.5);
    midNose.rotation.y = -0.04;
    midNose.castShadow = true;
    group.add(midNose);

    // Front nose cone (tapers down to front wing)
    const noseTipGeo = new THREE.BoxGeometry(L * 0.26, 2.0, 1.1);
    const noseTip = new THREE.Mesh(noseTipGeo, secMat);
    noseTip.position.set(L * 0.39, 0, 1.15);
    noseTip.rotation.y = -0.08;
    noseTip.castShadow = true;
    group.add(noseTip);

    // Dual racing livery nose stripes
    const stripeGeo = new THREE.BoxGeometry(L * 0.42, 0.45, 0.1);
    const s1 = new THREE.Mesh(stripeGeo, secMat);
    s1.position.set(L * 0.24, -0.9, 2.22);
    const s2 = new THREE.Mesh(stripeGeo, secMat);
    s2.position.set(L * 0.24, 0.9, 2.22);
    group.add(s1);
    group.add(s2);

    // 4. FRONT WING ASSEMBLY
    // Front wing main plane (wide ground-effect sweep)
    const fwMainGeo = new THREE.BoxGeometry(3.0, W * 0.98, 0.35);
    const fwMain = new THREE.Mesh(fwMainGeo, carbonMat);
    fwMain.position.set(L * 0.48, 0, 0.65);
    fwMain.castShadow = true;
    group.add(fwMain);

    // Front wing upper flap cascade
    const fwFlapGeo = new THREE.BoxGeometry(1.8, W * 0.94, 0.28);
    const fwFlap = new THREE.Mesh(fwFlapGeo, secMat);
    fwFlap.position.set(L * 0.46, 0, 0.92);
    group.add(fwFlap);

    // Front wing endplates (Left & Right)
    const fwPlateGeo = new THREE.BoxGeometry(4.2, 0.25, 1.6);
    const fwPlateL = new THREE.Mesh(fwPlateGeo, secMat);
    fwPlateL.position.set(L * 0.47, -W * 0.49, 1.25);
    const fwPlateR = new THREE.Mesh(fwPlateGeo, secMat);
    fwPlateR.position.set(L * 0.47, W * 0.49, 1.25);
    group.add(fwPlateL);
    group.add(fwPlateR);

    // 5. SCULPTED SIDEPODS & UNDERCUT INTAKES
    // Left & Right Sidepods (Quad / Body Livery)
    const podGeo = new THREE.BoxGeometry(L * 0.36, 2.7, 1.6);
    const leftPod = new THREE.Mesh(podGeo, quadMat);
    leftPod.position.set(-L * 0.05, -3.9, 1.5);
    leftPod.castShadow = true;
    const rightPod = new THREE.Mesh(podGeo, quadMat);
    rightPod.position.set(-L * 0.05, 3.9, 1.5);
    rightPod.castShadow = true;
    group.add(leftPod);
    group.add(rightPod);

    // Sidepod black radiator inlet mouths
    const podInletGeo = new THREE.BoxGeometry(0.5, 2.3, 1.2);
    const leftInlet = new THREE.Mesh(podInletGeo, cockpitMat);
    leftInlet.position.set(L * 0.125, -3.9, 1.55);
    const rightInlet = new THREE.Mesh(podInletGeo, cockpitMat);
    rightInlet.position.set(L * 0.125, 3.9, 1.55);
    group.add(leftInlet);
    group.add(rightInlet);

    // 6. ENGINE COVER, AIRBOX & SHARK FIN
    const engineCoverGeo = new THREE.BoxGeometry(L * 0.30, 3.6, 1.8);
    const engineCover = new THREE.Mesh(engineCoverGeo, bodyMat);
    engineCover.position.set(-L * 0.21, 0, 1.8);
    engineCover.castShadow = true;
    group.add(engineCover);

    // Airbox / Snorkel intake above cockpit
    const airboxGeo = new THREE.BoxGeometry(2.6, 1.8, 1.5);
    const airbox = new THREE.Mesh(airboxGeo, accMat);
    airbox.position.set(-2.6, 0, 3.1);
    group.add(airbox);

    const airboxHoleGeo = new THREE.BoxGeometry(0.4, 1.2, 0.9);
    const airboxHole = new THREE.Mesh(airboxHoleGeo, cockpitMat);
    airboxHole.position.set(-1.35, 0, 3.1);
    group.add(airboxHole);

    // Longitudinal Shark Fin Aero Spine (Accent Tone)
    const finGeo = new THREE.BoxGeometry(L * 0.28, 0.22, 2.2);
    const fin = new THREE.Mesh(finGeo, accMat);
    fin.position.set(-L * 0.25, 0, 3.2);
    group.add(fin);

    // 7. DRIVER & TITANIUM HALO SAFETY SYSTEM
    // Driver Helmet
    const helmetGeo = new THREE.SphereGeometry(0.85, 14, 14);
    const helmet = new THREE.Mesh(helmetGeo, helmetMat);
    helmet.position.set(-0.5, 0, 2.6);
    group.add(helmet);

    // Tinted Visor
    const visorGeo = new THREE.BoxGeometry(0.5, 1.0, 0.35);
    const visor = new THREE.Mesh(visorGeo, visorMat);
    visor.position.set(-0.2, 0, 2.7);
    group.add(visor);

    // Halo Titanium Safety Loop (Horizontal U-arch wrapping over cockpit)
    const haloHoopGeo = new THREE.TorusGeometry(1.3, 0.16, 8, 16, Math.PI);
    const haloHoop = new THREE.Mesh(haloHoopGeo, titaniumMat);
    haloHoop.rotation.set(0, 0, -Math.PI / 2);
    haloHoop.position.set(-0.3, 0, 3.1);
    group.add(haloHoop);

    // Halo Center Front Pylon
    const haloPylonGeo = new THREE.CylinderGeometry(0.16, 0.16, 1.1, 8);
    const haloPylon = new THREE.Mesh(haloPylonGeo, titaniumMat);
    haloPylon.rotation.set(0, 0.3, 0);
    haloPylon.position.set(0.9, 0, 2.6);
    group.add(haloPylon);

    // 8. REAR WING ASSEMBLY
    // Main rear wing plane
    const rwMainGeo = new THREE.BoxGeometry(2.2, W * 0.72, 0.35);
    const rwMain = new THREE.Mesh(rwMainGeo, carbonMat);
    rwMain.position.set(-L * 0.46, 0, 4.3);
    rwMain.castShadow = true;
    group.add(rwMain);

    // DRS Upper Wing Flap (Accent Tone)
    const rwDrsGeo = new THREE.BoxGeometry(1.5, W * 0.72, 0.26);
    const rwDrs = new THREE.Mesh(rwDrsGeo, accMat);
    rwDrs.position.set(-L * 0.45, 0, 4.75);
    group.add(rwDrs);

    // Rear Wing Endplates (Left & Right - Accent Tone)
    const rwPlateGeo = new THREE.BoxGeometry(3.6, 0.25, 3.0);
    const rwPlateL = new THREE.Mesh(rwPlateGeo, accMat);
    rwPlateL.position.set(-L * 0.45, -W * 0.36, 3.6);
    const rwPlateR = new THREE.Mesh(rwPlateGeo, accMat);
    rwPlateR.position.set(-L * 0.45, W * 0.36, 3.6);
    group.add(rwPlateL);
    group.add(rwPlateR);

    // Twin Rear Wing Center Pylons
    const pylonGeo = new THREE.BoxGeometry(0.35, 0.35, 2.8);
    const pylonL = new THREE.Mesh(pylonGeo, carbonMat);
    pylonL.position.set(-L * 0.42, -0.7, 3.0);
    const pylonR = new THREE.Mesh(pylonGeo, carbonMat);
    pylonR.position.set(-L * 0.42, 0.7, 3.0);
    group.add(pylonL);
    group.add(pylonR);

    // 9. REAR EXHAUST & FIA LED RAIN LIGHT
    const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x64748b, metalness: 0.95, roughness: 0.2 });
    const exGeo = new THREE.CylinderGeometry(0.5, 0.5, 1.4, 8);
    exGeo.rotateZ(Math.PI / 2);
    const exhaust = new THREE.Mesh(exGeo, exhaustMat);
    exhaust.position.set(-L * 0.46, 0, 2.0);
    group.add(exhaust);

    const rainLightGeo = new THREE.BoxGeometry(0.4, 1.2, 0.8);
    const rainLight = new THREE.Mesh(rainLightGeo, rainLightMat);
    rainLight.position.set(-L * 0.48, 0, 1.2);
    group.add(rainLight);

    // 10. CARBON SUSPENSION WISHBONES (Connecting Chassis to Wheels)
    const wbGeoFront = new THREE.BoxGeometry(0.3, 3.6, 0.25);
    const wbGeoRear = new THREE.BoxGeometry(0.3, 3.6, 0.25);

    // Front Left & Right Wishbones
    const wbFL = new THREE.Mesh(wbGeoFront, carbonMat);
    wbFL.position.set(L * 0.36, -4.1, 1.8);
    const wbFR = new THREE.Mesh(wbGeoFront, carbonMat);
    wbFR.position.set(L * 0.36, 4.1, 1.8);
    group.add(wbFL);
    group.add(wbFR);

    // Rear Left & Right Wishbones
    const wbRL = new THREE.Mesh(wbGeoRear, carbonMat);
    wbRL.position.set(-L * 0.35, -4.1, 1.8);
    const wbRR = new THREE.Mesh(wbGeoRear, carbonMat);
    wbRR.position.set(-L * 0.35, 4.1, 1.8);
    group.add(wbRL);
    group.add(wbRR);

    // 11. EXPOSED F1 SLICK RACING TIRES & CENTER-LOCK RIMS
    // Front tires: width 2.2, Rear tires: width 2.6 (Upright rolling wheels, axle along Y)
    const fTireGeo = new THREE.CylinderGeometry(2.4, 2.4, 2.2, 16);
    const rTireGeo = new THREE.CylinderGeometry(2.4, 2.4, 2.6, 16);
    const fRimGeo = new THREE.CylinderGeometry(1.5, 1.5, 2.26, 12);
    const rRimGeo = new THREE.CylinderGeometry(1.5, 1.5, 2.66, 12);
    const ringGeo = new THREE.TorusGeometry(1.5, 0.12, 6, 16);

    const wheels = [
      { x: L * 0.36, y: -W * 0.46, z: 2.38, isRear: false, outY: -1.12 },
      { x: L * 0.36, y: W * 0.46, z: 2.38, isRear: false, outY: 1.12 },
      { x: -L * 0.35, y: -W * 0.46, z: 2.38, isRear: true, outY: -1.32 },
      { x: -L * 0.35, y: W * 0.46, z: 2.38, isRear: true, outY: 1.32 },
    ];

    for (const w of wheels) {
      // Upright tire (default Cylinder orientation has height along Y)
      const tire = new THREE.Mesh(w.isRear ? rTireGeo : fTireGeo, tireMat);
      tire.position.set(w.x, w.y, w.z);
      tire.castShadow = true;
      group.add(tire);

      // Upright rim
      const rim = new THREE.Mesh(w.isRear ? rRimGeo : fRimGeo, rimMat);
      rim.position.set(w.x, w.y, w.z);
      group.add(rim);

      // Outer rim accent ring (rotated to X-Z plane)
      const ring = new THREE.Mesh(ringGeo, rimStripeMat);
      ring.rotation.x = Math.PI / 2;
      ring.position.set(w.x, w.y + w.outY, w.z);
      group.add(ring);
    }

    // 12. HOOD / NOSE RACE NUMBER BADGE
    const numTex = this.createRaceNumberTexture(carNumber, false, isPlayer);
    const numMat = new THREE.MeshBasicMaterial({
      map: numTex,
      transparent: true,
      polygonOffset: true,
      polygonOffsetFactor: -1,
    });
    const hoodPlateGeo = new THREE.PlaneGeometry(3.6, 2.4);
    const hoodNum = new THREE.Mesh(hoodPlateGeo, numMat);
    hoodNum.position.set(L * 0.20, 0, 2.26);
    hoodNum.rotation.z = -Math.PI / 2;
    group.add(hoodNum);

    group.traverse((child) => {
      if (child.isMesh) {
        if (child === contactShadow || child === hoodNum) {
          child.castShadow = false;
          child.receiveShadow = false;
        } else {
          child.castShadow = true;
          child.receiveShadow = true;
        }
      }
    });

    return group;
  }

  initPositionTextures() {
    if (this.posTextures) return;
    this.posTextures = {};
    for (let pos = 1; pos <= 80; pos++) {
      this.posTextures[pos] = this.createPositionTexture(pos);
    }
    this.eliminatedTexture = this.createEliminatedTexture();
  }

  createEliminatedTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 72;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 72);

    // Glowing Pill Background
    ctx.fillStyle = 'rgba(220, 38, 38, 0.95)'; // Vivid Crimson Red
    ctx.strokeStyle = '#fca5a5'; // Bright Highlight
    ctx.lineWidth = 5;

    ctx.beginPath();
    ctx.roundRect(6, 6, 244, 60, 30);
    ctx.fill();
    ctx.stroke();

    // Inner subtle border
    ctx.beginPath();
    ctx.roundRect(10, 10, 236, 52, 26);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.lineWidth = 1.8;
    ctx.stroke();

    // Text: ELIMINATED
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '900 32px "Outfit", "JetBrains Mono", Impact, "Arial Black", sans-serif';
    ctx.fillStyle = '#ffffff';

    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

    ctx.fillText('ELIMINATED', 128, 38);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  createPositionTexture(pos) {
    const canvas = document.createElement('canvas');
    canvas.width = 128;
    canvas.height = 128;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 128, 128);

    let badgeBg = 'rgba(8, 14, 26, 0.42)'; // Translucent frosted glass
    let borderColor = 'rgba(56, 189, 248, 0.90)';
    let textColor = '#ffffff';

    if (pos === 1) {
      badgeBg = 'rgba(45, 30, 5, 0.48)';
      borderColor = '#fbbf24'; // Vivid Gold
      textColor = '#fef08a';
    } else if (pos === 2) {
      badgeBg = 'rgba(25, 30, 42, 0.44)';
      borderColor = '#e2e8f0'; // Clean Silver
      textColor = '#ffffff';
    } else if (pos === 3) {
      badgeBg = 'rgba(45, 22, 6, 0.48)';
      borderColor = '#fb923c'; // Vivid Bronze
      textColor = '#ffedd5';
    }

    // High quality translucent glass circular badge (compact, sleek size)
    ctx.beginPath();
    ctx.arc(64, 64, 42, 0, Math.PI * 2);
    ctx.fillStyle = badgeBg;
    ctx.fill();
    ctx.lineWidth = 4.5;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // Subtle inner accent ring
    ctx.beginPath();
    ctx.arc(64, 64, 36, 0, Math.PI * 2);
    ctx.lineWidth = 1.4;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.stroke();

    // Text: position number with clean, refined typography (smaller, proportional font)
    const posStr = `${pos}`;
    const fontSize = posStr.length === 1 ? 40 : posStr.length === 2 ? 32 : 24;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${fontSize}px "Outfit", "JetBrains Mono", Impact, "Arial Black", sans-serif`;

    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 1.5;

    ctx.fillStyle = textColor;
    ctx.fillText(posStr, 64, 65);

    const tex = new THREE.CanvasTexture(canvas);
    tex.minFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    return tex;
  }

  createBadgeSprite() {
    this.initPositionTextures();
    const mat = new THREE.SpriteMaterial({
      map: this.posTextures[1],
      depthTest: true,
      depthWrite: false,
      transparent: true,
      opacity: 0.82,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 999;
    sprite.scale.set(2.3, 2.3, 1); // Reduced size: compact, unobtrusive floating standing badge
    sprite.position.set(0, 0, 4.4); // Floats closer to the car roof
    sprite.visible = false;
    return sprite;
  }

  setupCars() {
    this.initPositionTextures();

    this.playerCar = this.createCarMesh(C.player, true, 0, 7);
    const playerBadge = this.createBadgeSprite();
    this.playerCar.userData.badgeSprite = playerBadge;
    this.playerCar.add(playerBadge);
    this.playerCar.visible = false;
    this.scene.add(this.playerCar);

    // Fleet car pool: each car retains its persistent team livery (no forced yellow morphing)
    this.carPool = [];
    const pop = CONFIG.ga.population;
    for (let i = 0; i < pop; i++) {
      const carNumber = i + 1;
      const carMesh = this.createCarMesh(null, false, i, carNumber);
      const badge = this.createBadgeSprite();
      carMesh.userData.badgeSprite = badge;
      carMesh.add(badge);
      this.carPool.push(carMesh);
      this.scene.add(carMesh);
    }

    // Load and apply the 2022 F1 3D car model with full details
    this.loadF1Model();
  }

  loadF1Model() {
    const loader = new GLTFLoader();
    loader.load(
      './full_f1_2022/scene.gltf',
      (gltf) => {
        this.f1Template = gltf.scene;
        gltf.scene.traverse((child) => {
          if (child.isMesh && child.material && child.material.map && !this.f1Texture) {
            this.f1Texture = child.material.map;
          }
        });
        this.initF1DecalGeometries(gltf.scene);
        this.applyF1ModelToFleet(gltf.scene);
      },
      undefined,
      (err) => {
        console.warn('Could not load full 2022 F1 3D model, using procedural race car mesh:', err);
      }
    );
  }

  initF1DecalGeometries(template) {
    this.f1DecalGeometries = {};
    let bodyMesh = null;
    template.traverse((c) => {
      if (c.isMesh && c.name === 'Object_6') bodyMesh = c;
    });
    if (!bodyMesh) return;

    const m = bodyMesh.clone();
    const s = 6.0;
    m.scale.set(s, s, s);
    m.rotation.set(Math.PI / 2, 0, 0);
    m.position.set(0, 0, 0);
    m.updateMatrixWorld(true);

    Object.keys(F1_DECAL_CONFIG).forEach((key) => {
      const d = F1_DECAL_CONFIG[key];
      try {
        const pos = new THREE.Vector3(d.posX, d.posY, d.posZ);
        const euler = new THREE.Euler(
          THREE.MathUtils.degToRad(d.rotX),
          THREE.MathUtils.degToRad(d.rotY),
          THREE.MathUtils.degToRad(d.rotZ),
          'ZYX'
        );
        const size = new THREE.Vector3(d.scaleX, d.scaleY, 3.8);
        const geo = new DecalGeometry(m, pos, euler, size);
        if (geo.attributes.position && geo.attributes.position.count > 0) {
          this.f1DecalGeometries[key] = geo;
        }
      } catch (err) {
        console.warn('Decal generation failed for', key, err);
      }
    });
  }

  applyF1ModelToFleet(template) {
    if (!template) return;

    this.swapCarMesh(this.playerCar, template, C.player, true, 0, 7);

    for (let i = 0; i < this.carPool.length; i++) {
      const carNumber = i + 1;
      this.swapCarMesh(this.carPool[i], template, null, false, i, carNumber);
    }
  }

  swapCarMesh(group, template, color, isPlayer, carIdx, carNumber) {
    while (group.children.length > 0) {
      group.remove(group.children[0]);
    }
    const f1 = this.createF1CarMesh(template, color, isPlayer, carIdx, carNumber);
    group.add(f1);

    const badge = this.createBadgeSprite();
    group.userData.badgeSprite = badge;
    group.add(badge);
  }

  createF1CarMesh(template, color, isPlayer = false, carIdx = 0, carNumber = 1) {
    const teamIdx = isPlayer ? 1 : (carIdx % TEAM_PALETTE.length);
    const tm = isPlayer
      ? { hex: 0x00e626, secHex: 0xfacc15, accHex: 0xffffff, quadHex: 0x00e626 }
      : TEAM_PALETTE[teamIdx];

    const group = new THREE.Group();
    const carSubGroup = new THREE.Group();
    const model = template.clone(true);

    // Scale and orient the 2022 F1 ground-effect car
    const s = 6.0;
    model.scale.set(s, s, s);
    // Orient: Match Studio orientation
    model.rotation.set(Math.PI / 2, 0, 0);
    model.position.set(0, 0, 0);

    const cPri = new THREE.Color(tm.hex);
    const cSec = new THREE.Color(tm.secHex);
    const cAcc = new THREE.Color(tm.accHex);
    const cQuad = new THREE.Color(tm.quadHex || tm.secHex);
    const numTex = this.createRaceNumberTexture(carNumber, false, isPlayer);

    model.traverse((child) => {
      // Exclude studio background floor plane and environment sphere
      if (
        child.name &&
        (child.name.includes('Plane') ||
          child.name.includes('Sphere') ||
          child.name.includes('Object_12') ||
          child.name.includes('Object_4'))
      ) {
        child.visible = false;
        return;
      }

      if (child.isMesh) {
        child.castShadow = true;
        child.receiveShadow = true;

        const isFrontWheelsMesh = child.name === 'Object_8';
        const isRearWheelsMesh = child.name === 'Object_10';

        const origMap = child.material?.map || this.f1Texture;
        const origRoughness = child.material?.roughness ?? 0.5;
        const origMetalness = child.material?.metalness ?? 0.0;

        const geo = child.geometry.clone();
        child.geometry = geo;

        const posAttr = geo.attributes.position;
        const count = posAttr.count;
        const liveryColorArr = new Float32Array(count * 3);
        const isBodyArr = new Float32Array(count);
        const isTireArr = new Float32Array(count);

        for (let i = 0; i < count; i++) {
          const x = posAttr.getX(i);
          const y = posAttr.getY(i);
          const z = posAttr.getZ(i);
          const absZ = Math.abs(z);

          // 1. WHEELS / TYRES: Object_8 is 100% Front Wheels; Object_10 is 100% Rear Wheels
          if (isFrontWheelsMesh || isRearWheelsMesh) {
            isTireArr[i] = 1.0;
            isBodyArr[i] = 0.0;
            liveryColorArr[i * 3] = 1.0;
            liveryColorArr[i * 3 + 1] = 1.0;
            liveryColorArr[i * 3 + 2] = 1.0;
          } else {
            // Main Bodywork Mesh (Object_6):
            isTireArr[i] = 0.0;

            // True underfloor skidblock & rear diffuser -> Matte dark carbon fiber
            const isUnderfloor = (y < 0.105) || (x < -1.1 && y < 0.16 && absZ < 0.40);
            // Front & rear wheel wake deflectors / mud guards -> Matte dark carbon fiber (NOT body color)
            const isWheelDeflector = (Math.abs(x - 1.58) < 0.55 && absZ > 0.42 && y >= 0.09 && y <= 0.85);

            if (isUnderfloor || isWheelDeflector) {
              isBodyArr[i] = 0.0;
              liveryColorArr[i * 3] = 0.08;
              liveryColorArr[i * 3 + 1] = 0.08;
              liveryColorArr[i * 3 + 2] = 0.09;
            } else {
              isBodyArr[i] = 1.0;
              let c;

              if (x > 1.75) {
                // Nose Tip & Front Wing -> Secondary Color (cSec)
                c = cSec;
              } else if (
                (x < -0.15 && x > -1.25 && y > 0.56 && absZ < 0.12) ||
                (x >= -0.25 && x <= 0.35 && y > 0.54 && absZ < 0.24)
              ) {
                // Halo Safety Ring & Shark Fin Aero Spine -> Accent Color (cAcc)
                c = cAcc;
              } else if (absZ >= 0.22 && absZ <= 0.58 && x >= -0.45 && x <= 0.75 && y >= 0.13 && y <= 0.50) {
                // Sculpted Sidepod Radiator Inlets & Flanks -> Quad Color (cQuad)
                c = cQuad;
              } else if (absZ > 0.50 && Math.abs(x - (-1.48)) < 0.50 && y >= 0.12 && y <= 0.45) {
                // Rear brake duct winglets / deflectors -> Accent Color (cAcc)
                c = cAcc;
              } else {
                // Main Chassis Monocoque, Cockpit Flanks & Engine Cover -> Primary Color (cPri)
                c = cPri;
              }

              liveryColorArr[i * 3] = c.r;
              liveryColorArr[i * 3 + 1] = c.g;
              liveryColorArr[i * 3 + 2] = c.b;
            }
          }
        }

        geo.setAttribute('liveryColor', new THREE.BufferAttribute(liveryColorArr, 3));
        geo.setAttribute('isBody', new THREE.BufferAttribute(isBodyArr, 1));
        geo.setAttribute('isTire', new THREE.BufferAttribute(isTireArr, 1));

        const mat = new THREE.MeshStandardMaterial({
          map: origMap,
          roughness: origRoughness,
          metalness: origMetalness,
        });

        mat.customProgramCacheKey = () => `f1_body_car_${isPlayer ? 'player' : carIdx}_${carNumber}`;

        mat.onBeforeCompile = (shader) => {
          shader.uniforms.decalTex = { value: numTex };
          shader.vertexShader = shader.vertexShader.replace(
            '#include <common>',
            `#include <common>
            attribute vec3 liveryColor;
            attribute float isBody;
            attribute float isTire;
            varying vec3 vLiveryColor;
            varying float vIsBody;
            varying float vIsTire;
            varying vec3 vModelPos;`
          );
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vLiveryColor = liveryColor;
            vIsBody = isBody;
            vIsTire = isTire;
            vModelPos = position;`
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
            uniform sampler2D decalTex;
            varying vec3 vLiveryColor;
            varying float vIsBody;
            varying float vIsTire;
            varying vec3 vModelPos;`
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
              vec4 texColor = texture2D( map, vMapUv );
              if (vIsBody > 0.5) {
                diffuseColor.rgb = vLiveryColor;
              } else if (vIsTire > 0.5) {
                // Real Pirelli tire rubber and wheel rim
                // Neutralize any red paint bleed from original texture to dark tire charcoal
                if (texColor.r > 0.45 && texColor.r > (texColor.g + texColor.b) * 1.2) {
                  diffuseColor.rgb = vec3(0.12, 0.12, 0.13);
                } else {
                  diffuseColor = texColor;
                }
              } else {
                // Underbody aerodynamic floor, plank & diffuser -> sleek dark carbon fiber
                diffuseColor.rgb = vec3(0.08, 0.08, 0.09);
              }
            #else
              if (vIsBody > 0.5) {
                diffuseColor.rgb = vLiveryColor;
              } else {
                diffuseColor.rgb = vec3(0.08, 0.08, 0.09);
              }
            #endif`
          );
        };

        child.material = mat;
      }
    });

    carSubGroup.add(model);

    // Apply calibrated 3D wrapped number decals (Front, Top, Rear, Left, Right)
    if (this.f1DecalGeometries) {
      const decalMat = new THREE.MeshBasicMaterial({
        map: numTex,
        transparent: true,
        side: THREE.DoubleSide,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });

      Object.keys(F1_DECAL_CONFIG).forEach((k) => {
        const geo = this.f1DecalGeometries[k];
        if (geo) {
          const decalMesh = new THREE.Mesh(geo, decalMat);
          decalMesh.renderOrder = 999;
          carSubGroup.add(decalMesh);
        }
      });
    }

    // Yaw 180° so the car's nose points forward along velocity vector +X
    carSubGroup.rotation.z = Math.PI;
    group.add(carSubGroup);
    return group;
  }

  setupRays() {
    this.rayGroup = new THREE.Group();
    this.rayGroup.renderOrder = 999;
    const rayMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      linewidth: 2,
      transparent: true,
      opacity: 0.9,
      depthTest: true,
      depthWrite: false,
    });
    const hitGeo = new THREE.SphereGeometry(2.4, 10, 10);
    const hitMat = new THREE.MeshBasicMaterial({
      color: 0x22d3ee,
      depthTest: true,
      depthWrite: false,
    });

    this.rayLines = [];
    this.rayHits = [];

    for (let r = 0; r < RAY_ANGLES.length; r++) {
      const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
      const colors = new Float32Array([0.1, 0.9, 0.3, 1.0, 0.2, 0.2]); // initial green to red
      geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
      
      const line = new THREE.Line(geo, rayMat);
      line.frustumCulled = false; // Essential: buffer positions mutate dynamically, preventing erroneous bounding-sphere culling
      line.renderOrder = 999;
      this.rayLines.push(line);
      this.rayGroup.add(line);

      const hit = new THREE.Mesh(hitGeo, hitMat.clone());
      hit.frustumCulled = false;
      hit.renderOrder = 1000;
      this.rayHits.push(hit);
      this.rayGroup.add(hit);
    }

    this.scene.add(this.rayGroup);
  }

  setupTrees() {
    this.treeGroup = new THREE.Group();
    const t = this.track;
    const b = t.bounds;

    // Deterministic PRNG based on track geometry
    let s = (Math.round(b.minX + b.minY + b.w * 13 + b.h * 17) & 0x7fffffff) || 48271;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    // Expand area to populate all surrounding hills and rolling countryside
    const pad = Math.max(1200, Math.max(b.w, b.h) * 0.75);
    const minX = b.minX - pad;
    const maxX = b.maxX + pad;
    const minY = b.minY - pad;
    const maxY = b.maxY + pad;

    // 1. Organic cluster centers (groves) across the surrounding terrain
    const numClusters = 28 + Math.floor(rand() * 12);
    const clusterCenters = [];
    for (let c = 0; c < numClusters; c++) {
      // Each grove has a dominant tree species archetype (0: Pine, 1: Oak, 2: Cypress, 3: Birch)
      const groveType = Math.floor(rand() * 4);
      clusterCenters.push({
        cx: minX + rand() * (maxX - minX),
        cy: minY + rand() * (maxY - minY),
        radius: 60 + rand() * 140,
        count: 6 + Math.floor(rand() * 10),
        groveType,
      });
    }

    // 2. Candidate tree positions
    const candidates = [];
    for (const cl of clusterCenters) {
      for (let i = 0; i < cl.count; i++) {
        const angle = rand() * Math.PI * 2;
        const dist = Math.sqrt(rand()) * cl.radius;
        // 80% grove dominant species, 20% natural mix
        const species = rand() < 0.8 ? cl.groveType : Math.floor(rand() * 4);
        candidates.push({
          x: cl.cx + Math.cos(angle) * dist,
          y: cl.cy + Math.sin(angle) * dist,
          species,
        });
      }
    }

    // Standalone trees for sparse natural meadow scattering on hill slopes
    const standalone = 80 + Math.floor(rand() * 40);
    for (let i = 0; i < standalone; i++) {
      candidates.push({
        x: minX + rand() * (maxX - minX),
        y: minY + rand() * (maxY - minY),
        species: Math.floor(rand() * 4),
      });
    }

    const placedPines = [];
    const placedOaks = [];
    const placedCedars = [];
    const placedBirches = [];

    const allPlaced = [];
    for (const cand of candidates) {
      const { x, y, species } = cand;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;

      // In Three.js world space, the point is at (x, -y).
      const groundZ = this.getTerrainHeight(x, -y);

      // Trees should ONLY grow where the terrain starts (above ground zero, Z > 0.2m)
      if (groundZ <= 0.2) continue;

      // Exclude water bodies (lakes & riverbed)
      const { lakes: wLakes, river: wRiver } = this.getWaterBodies();
      let inWater = false;
      for (const l of wLakes) {
        const dx = (x - l.cx) / l.rx;
        const dy = (-y - l.cy) / l.ry;
        if (Math.hypot(dx, dy) < 1.08) {
          inWater = true;
          break;
        }
      }
      if (!inWater) {
        for (let i = 0; i < wRiver.length; i += 2) {
          const rp = wRiver[i];
          if (Math.hypot(x - rp.x, -y - rp.y) < rp.width * 0.75) {
            inWater = true;
            break;
          }
        }
      }
      if (inWater) continue;

      let tooClose = false;
      for (const ex of allPlaced) {
        const d2 = (x - ex.x) ** 2 + (y - ex.y) ** 2;
        if (d2 < (ex.r * 0.75 + 11) ** 2) {
          tooClose = true;
          break;
        }
      }
      if (!tooClose) {
        const roll = rand();
        let r;
        if (roll < 0.25) r = 8 + rand() * 5;
        else if (roll < 0.75) r = 14 + rand() * 8;
        else r = 22 + rand() * 10;

        const yaw = rand() * Math.PI * 2;
        const leanX = (rand() - 0.5) * 0.08;
        const leanY = (rand() - 0.5) * 0.08;
        const heightMult = 0.85 + rand() * 0.35;

        let hue, sat, lit;
        if (species === 0) {
          // Pine: Deep Nordic forest / Alpine emerald needle tones
          hue = 0.36 + (rand() - 0.5) * 0.06;
          sat = 0.58 + rand() * 0.18;
          lit = 0.17 + rand() * 0.08;
          const treeData = { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit, groundZ };
          placedPines.push(treeData);
          allPlaced.push(treeData);
        } else if (species === 1) {
          // Broadleaf Oak: Lush leafy summer canopy
          hue = 0.28 + (rand() - 0.5) * 0.08;
          sat = 0.52 + rand() * 0.18;
          lit = 0.22 + rand() * 0.10;
          const treeData = { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit, groundZ };
          placedOaks.push(treeData);
          allPlaced.push(treeData);
        } else if (species === 2) {
          // Majestic Tiered Cedar (Cedrus Libani): Deep blue-green / alpine cedar evergreen
          hue = 0.38 + (rand() - 0.5) * 0.05;
          sat = 0.44 + rand() * 0.15;
          lit = 0.18 + rand() * 0.06;
          const treeData = { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit, groundZ };
          placedCedars.push(treeData);
          allPlaced.push(treeData);
        } else {
          // Birch / Blossom: Golden amber & autumn ochre leaves
          hue = 0.09 + rand() * 0.08;
          sat = 0.72 + rand() * 0.18;
          lit = 0.36 + rand() * 0.12;
          const treeData = { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit, groundZ };
          placedBirches.push(treeData);
          allPlaced.push(treeData);
        }
      }
    }

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x4e3827, roughness: 0.88, metalness: 0.05, flatShading: true });
    const paleWoodMat = new THREE.MeshStandardMaterial({ color: 0xded9cb, roughness: 0.82, metalness: 0.05, flatShading: true });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.82, metalness: 0.04, flatShading: true });

    // Procedural Helper: Faceted Conifer Tier Cone (Nested solid low-poly evergreen tier)
    const createConiferConeGeo = (radius, height, segments = 7) => {
      const geo = new THREE.ConeGeometry(radius, height, segments, 1, false);
      geo.rotateX(Math.PI / 2);
      geo.translate(0, 0, height / 2);
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const u = Math.max(0, Math.min(1, v.z / height)); // 0 bottom, 1 top
        const angle = Math.atan2(v.y, v.x);
        const scallop = 1.0 + Math.sin(angle * 3 + u * 4) * 0.04 * (1.0 - u);
        v.x *= scallop;
        v.y *= scallop;
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      return geo;
    };

    // Procedural Helper: Volumetric Low-Poly Leafy Canopy Dome / Cloud Cluster (Icosahedron Detail 1)
    const createCanopyClusterGeo = (radius, detail = 1, squishZ = 0.85, noiseAmp = 0.10) => {
      const geo = new THREE.IcosahedronGeometry(radius, detail);
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const angle = Math.atan2(v.y, v.x);
        const phi = Math.acos(Math.max(-1, Math.min(1, v.z / radius)));
        const noise = 1.0 + (Math.sin(v.x * 2.5 + 1.0) * Math.cos(v.y * 2.5) * 0.07 + Math.sin(phi * 3.5 + angle * 2.0) * 0.05) * (noiseAmp / 0.10);
        v.multiplyScalar(noise);
        v.z *= squishZ;
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      return geo;
    };

    // Procedural Helper: Volumetric Umbrella Canopy Dome (Lush Mediterranean Stone Pine / Cedar Crown)
    const createUmbrellaCanopyGeo = (radius, height, segments = 8) => {
      const geo = new THREE.CylinderGeometry(radius * 0.22, radius, height, segments, 3, false);
      geo.rotateX(Math.PI / 2);
      geo.translate(0, 0, height / 2);
      const pos = geo.attributes.position;
      const v = new THREE.Vector3();
      for (let i = 0; i < pos.count; i++) {
        v.fromBufferAttribute(pos, i);
        const u = Math.max(0, Math.min(1, v.z / height)); // 0 bottom, 1 top
        const angle = Math.atan2(v.y, v.x);
        const organic = 1.0 + Math.sin(angle * 5) * 0.06 + Math.cos(angle * 3) * 0.04;
        v.x *= organic;
        v.y *= organic * 0.95;
        // Undercut underside slightly for low-poly depth
        if (u < 0.25) {
          v.z -= (1.0 - u / 0.25) * height * 0.14;
        }
        pos.setXYZ(i, v.x, v.y, v.z);
      }
      geo.computeVertexNormals();
      return geo;
    };

    // === SPECIES 0: ALPINE PINE / SPRUCE (4-Tier Nested Low-Poly Conifer) ===
    if (placedPines.length > 0) {
      const count = placedPines.length;
      const trunkGeo = new THREE.CylinderGeometry(0.35, 0.90, 1.0, 7);
      trunkGeo.rotateX(Math.PI / 2);
      const pineTrunkInst = new THREE.InstancedMesh(trunkGeo, darkWoodMat, count);

      const coneGeo = createConiferConeGeo(1.0, 1.0, 7);
      const tier1Inst = new THREE.InstancedMesh(coneGeo, leafMat, count);
      const tier2Inst = new THREE.InstancedMesh(coneGeo, leafMat, count);
      const tier3Inst = new THREE.InstancedMesh(coneGeo, leafMat, count);
      const tier4Inst = new THREE.InstancedMesh(coneGeo, leafMat, count);

      for (let i = 0; i < count; i++) {
        const { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit, groundZ } = placedPines[i];
        const trunkH = (r * 0.85 + 4.5) * heightMult;
        const trunkR = Math.max(1.0, r * 0.12);

        // Trunk
        dummy.position.set(x, -y, groundZ + trunkH / 2);
        dummy.scale.set(trunkR, trunkR, trunkH);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        pineTrunkInst.setMatrixAt(i, dummy.matrix);

        // Tier 1 (Base wide conifer skirt)
        const t1H = r * 0.75 * heightMult;
        const t1R = r * 1.05;
        const t1Z = trunkH * 0.32;
        dummy.position.set(x, -y, groundZ + t1Z);
        dummy.scale.set(t1R, t1R, t1H);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        tier1Inst.setMatrixAt(i, dummy.matrix);

        // Tier 2 (Mid-low cone tier)
        const t2H = r * 0.68 * heightMult;
        const t2R = r * 0.82;
        const t2Z = t1Z + t1H * 0.52;
        dummy.position.set(x, -y, groundZ + t2Z);
        dummy.scale.set(t2R, t2R, t2H);
        dummy.rotation.set(leanX, leanY, yaw + 0.8);
        dummy.updateMatrix();
        tier2Inst.setMatrixAt(i, dummy.matrix);

        // Tier 3 (Mid-high cone tier)
        const t3H = r * 0.60 * heightMult;
        const t3R = r * 0.60;
        const t3Z = t2Z + t2H * 0.52;
        dummy.position.set(x, -y, groundZ + t3Z);
        dummy.scale.set(t3R, t3R, t3H);
        dummy.rotation.set(leanX, leanY, yaw + 1.6);
        dummy.updateMatrix();
        tier3Inst.setMatrixAt(i, dummy.matrix);

        // Tier 4 (Top needle spire)
        const t4H = r * 0.54 * heightMult;
        const t4R = r * 0.38;
        const t4Z = t3Z + t3H * 0.52;
        dummy.position.set(x, -y, groundZ + t4Z);
        dummy.scale.set(t4R, t4R, t4H);
        dummy.rotation.set(leanX, leanY, yaw + 2.4);
        dummy.updateMatrix();
        tier4Inst.setMatrixAt(i, dummy.matrix);

        color.setHSL(hue, sat, lit);
        tier1Inst.setColorAt(i, color);
        color.setHSL(hue, sat, Math.min(0.9, lit * 1.08));
        tier2Inst.setColorAt(i, color);
        color.setHSL(hue, sat, Math.min(0.9, lit * 1.18));
        tier3Inst.setColorAt(i, color);
        color.setHSL(hue, sat, Math.min(0.9, lit * 1.30));
        tier4Inst.setColorAt(i, color);
      }

      pineTrunkInst.instanceMatrix.needsUpdate = true;
      tier1Inst.instanceMatrix.needsUpdate = true;
      tier2Inst.instanceMatrix.needsUpdate = true;
      tier3Inst.instanceMatrix.needsUpdate = true;
      tier4Inst.instanceMatrix.needsUpdate = true;
      if (tier1Inst.instanceColor) tier1Inst.instanceColor.needsUpdate = true;
      if (tier2Inst.instanceColor) tier2Inst.instanceColor.needsUpdate = true;
      if (tier3Inst.instanceColor) tier3Inst.instanceColor.needsUpdate = true;
      if (tier4Inst.instanceColor) tier4Inst.instanceColor.needsUpdate = true;
      pineTrunkInst.castShadow = true; pineTrunkInst.receiveShadow = true;
      tier1Inst.castShadow = true; tier1Inst.receiveShadow = true;
      tier2Inst.castShadow = true; tier2Inst.receiveShadow = true;
      tier3Inst.castShadow = true; tier3Inst.receiveShadow = true;
      tier4Inst.castShadow = true; tier4Inst.receiveShadow = true;

      this.treeGroup.add(pineTrunkInst, tier1Inst, tier2Inst, tier3Inst, tier4Inst);
    }

    // === SPECIES 1: BROADLEAF OAK (Multi-Bough Organic Leafy Crown) ===
    if (placedOaks.length > 0) {
      const count = placedOaks.length;
      const trunkGeo = new THREE.CylinderGeometry(0.65, 1.45, 1.0, 8);
      trunkGeo.rotateX(Math.PI / 2);
      const oakTrunkInst = new THREE.InstancedMesh(trunkGeo, darkWoodMat, count);

      const crownGeo = createCanopyClusterGeo(1.0, 1, 0.85);
      const oakMainInst = new THREE.InstancedMesh(crownGeo, leafMat, count);
      const oakLeftInst = new THREE.InstancedMesh(crownGeo, leafMat, count);
      const oakRightInst = new THREE.InstancedMesh(crownGeo, leafMat, count);
      const oakTopInst = new THREE.InstancedMesh(crownGeo, leafMat, count);

      for (let i = 0; i < count; i++) {
        const { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit, groundZ } = placedOaks[i];
        const trunkH = (r * 0.70 + 4.0) * heightMult;
        const trunkR = Math.max(1.3, r * 0.16);

        // Trunk
        dummy.position.set(x, -y, groundZ + trunkH / 2);
        dummy.scale.set(trunkR, trunkR, trunkH);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        oakTrunkInst.setMatrixAt(i, dummy.matrix);

        // Center Dominant Canopy Dome
        const crownR = r * 0.95;
        const crownZ = trunkH * 0.86 + crownR * 0.45;
        dummy.position.set(x, -y, groundZ + crownZ);
        dummy.scale.set(crownR, crownR * 0.96, crownR * 0.88);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        oakMainInst.setMatrixAt(i, dummy.matrix);

        // Asymmetric Left Bough
        const cLeftR = r * 0.72;
        const offX1 = Math.cos(yaw) * (r * 0.44);
        const offY1 = Math.sin(yaw) * (r * 0.44);
        dummy.position.set(x + offX1, -y - offY1, groundZ + crownZ - crownR * 0.10);
        dummy.scale.set(cLeftR, cLeftR * 0.92, cLeftR * 0.82);
        dummy.rotation.set(leanX, leanY, yaw + 1.2);
        dummy.updateMatrix();
        oakLeftInst.setMatrixAt(i, dummy.matrix);

        // Asymmetric Right Bough
        const cRightR = r * 0.68;
        const offX2 = Math.cos(yaw + 2.3) * (r * 0.42);
        const offY2 = Math.sin(yaw + 2.3) * (r * 0.42);
        dummy.position.set(x + offX2, -y - offY2, groundZ + crownZ - crownR * 0.06);
        dummy.scale.set(cRightR, cRightR * 0.94, cRightR * 0.84);
        dummy.rotation.set(leanX, leanY, yaw - 1.4);
        dummy.updateMatrix();
        oakRightInst.setMatrixAt(i, dummy.matrix);

        // Upper Sunlit Crown Crest
        const cTopR = r * 0.58;
        const offX3 = Math.cos(yaw + 1.0) * (r * 0.16);
        const offY3 = Math.sin(yaw + 1.0) * (r * 0.16);
        dummy.position.set(x + offX3, -y - offY3, groundZ + crownZ + crownR * 0.38);
        dummy.scale.set(cTopR, cTopR, cTopR * 0.80);
        dummy.rotation.set(leanX, leanY, yaw + 2.5);
        dummy.updateMatrix();
        oakTopInst.setMatrixAt(i, dummy.matrix);

        color.setHSL(hue, sat, lit);
        oakMainInst.setColorAt(i, color);
        color.setHSL(hue + 0.02, sat, Math.min(0.9, lit * 0.94));
        oakLeftInst.setColorAt(i, color);
        color.setHSL(hue - 0.02, sat, Math.min(0.9, lit * 1.10));
        oakRightInst.setColorAt(i, color);
        color.setHSL(hue, sat, Math.min(0.9, lit * 1.25));
        oakTopInst.setColorAt(i, color);
      }

      oakTrunkInst.instanceMatrix.needsUpdate = true;
      oakMainInst.instanceMatrix.needsUpdate = true;
      oakLeftInst.instanceMatrix.needsUpdate = true;
      oakRightInst.instanceMatrix.needsUpdate = true;
      oakTopInst.instanceMatrix.needsUpdate = true;
      if (oakMainInst.instanceColor) oakMainInst.instanceColor.needsUpdate = true;
      if (oakLeftInst.instanceColor) oakLeftInst.instanceColor.needsUpdate = true;
      if (oakRightInst.instanceColor) oakRightInst.instanceColor.needsUpdate = true;
      if (oakTopInst.instanceColor) oakTopInst.instanceColor.needsUpdate = true;
      oakTrunkInst.castShadow = true; oakTrunkInst.receiveShadow = true;
      oakMainInst.castShadow = true; oakMainInst.receiveShadow = true;
      oakLeftInst.castShadow = true; oakLeftInst.receiveShadow = true;
      oakRightInst.castShadow = true; oakRightInst.receiveShadow = true;
      oakTopInst.castShadow = true; oakTopInst.receiveShadow = true;

      this.treeGroup.add(oakTrunkInst, oakMainInst, oakLeftInst, oakRightInst, oakTopInst);
    }

    // === SPECIES 2: MEDITERRANEAN CEDAR / STONE PINE (Volumetric Umbrella Parasol Canopy) ===
    if (placedCedars.length > 0) {
      const count = placedCedars.length;
      const trunkGeo = new THREE.CylinderGeometry(0.55, 1.35, 1.0, 8);
      trunkGeo.rotateX(Math.PI / 2);
      const cedarTrunkInst = new THREE.InstancedMesh(trunkGeo, darkWoodMat, count);

      const umbrellaGeo = createUmbrellaCanopyGeo(1.0, 1.0, 8);
      const tier1Inst = new THREE.InstancedMesh(umbrellaGeo, leafMat, count);
      const tier2Inst = new THREE.InstancedMesh(umbrellaGeo, leafMat, count);
      const tier3Inst = new THREE.InstancedMesh(umbrellaGeo, leafMat, count);

      for (let i = 0; i < count; i++) {
        const { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit, groundZ } = placedCedars[i];
        const trunkH = (r * 0.80 + 4.2) * heightMult;
        const trunkR = Math.max(1.2, r * 0.15);

        // Sturdy Cedar Trunk
        dummy.position.set(x, -y, groundZ + trunkH / 2);
        dummy.scale.set(trunkR, trunkR, trunkH);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        cedarTrunkInst.setMatrixAt(i, dummy.matrix);

        // Main Expansive Umbrella Canopy Dome
        const mainR = r * 1.25;
        const mainH = r * 0.65 * heightMult;
        const mainZ = trunkH * 0.78;
        dummy.position.set(x, -y, groundZ + mainZ);
        dummy.scale.set(mainR, mainR * 0.94, mainH);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        tier1Inst.setMatrixAt(i, dummy.matrix);

        // Nested Sub-bough 1 (Lush low-left canopy pad)
        const sub1R = r * 0.78;
        const sub1H = r * 0.50 * heightMult;
        const offX1 = Math.cos(yaw + 0.9) * (r * 0.40);
        const offY1 = Math.sin(yaw + 0.9) * (r * 0.40);
        dummy.position.set(x + offX1, -y - offY1, groundZ + mainZ - mainH * 0.15);
        dummy.scale.set(sub1R, sub1R * 0.92, sub1H);
        dummy.rotation.set(leanX, leanY, yaw + 1.2);
        dummy.updateMatrix();
        tier2Inst.setMatrixAt(i, dummy.matrix);

        // Top Apex Crest Dome (Crown top cap)
        const topR = r * 0.72;
        const topH = r * 0.48 * heightMult;
        const offX2 = Math.cos(yaw - 1.2) * (r * 0.22);
        const offY2 = Math.sin(yaw - 1.2) * (r * 0.22);
        dummy.position.set(x + offX2, -y - offY2, groundZ + mainZ + mainH * 0.36);
        dummy.scale.set(topR, topR * 0.92, topH);
        dummy.rotation.set(leanX, leanY, yaw + 2.3);
        dummy.updateMatrix();
        tier3Inst.setMatrixAt(i, dummy.matrix);

        color.setHSL(hue, sat, lit);
        tier1Inst.setColorAt(i, color);
        color.setHSL(hue + 0.01, sat, Math.min(0.9, lit * 1.10));
        tier2Inst.setColorAt(i, color);
        color.setHSL(hue - 0.01, sat, Math.min(0.9, lit * 1.25));
        tier3Inst.setColorAt(i, color);
      }

      cedarTrunkInst.instanceMatrix.needsUpdate = true;
      tier1Inst.instanceMatrix.needsUpdate = true;
      tier2Inst.instanceMatrix.needsUpdate = true;
      tier3Inst.instanceMatrix.needsUpdate = true;
      if (tier1Inst.instanceColor) tier1Inst.instanceColor.needsUpdate = true;
      if (tier2Inst.instanceColor) tier2Inst.instanceColor.needsUpdate = true;
      if (tier3Inst.instanceColor) tier3Inst.instanceColor.needsUpdate = true;
      cedarTrunkInst.castShadow = true; cedarTrunkInst.receiveShadow = true;
      tier1Inst.castShadow = true; tier1Inst.receiveShadow = true;
      tier2Inst.castShadow = true; tier2Inst.receiveShadow = true;
      tier3Inst.castShadow = true; tier3Inst.receiveShadow = true;

      this.treeGroup.add(cedarTrunkInst, tier1Inst, tier2Inst, tier3Inst);
    }

    // === SPECIES 3: GOLDEN AUTUMN BIRCH (Pale Trunk + Layered Amber Crown) ===
    if (placedBirches.length > 0) {
      const count = placedBirches.length;
      const trunkGeo = new THREE.CylinderGeometry(0.35, 0.75, 1.0, 7);
      trunkGeo.rotateX(Math.PI / 2);
      const birchTrunkInst = new THREE.InstancedMesh(trunkGeo, paleWoodMat, count);

      const crownGeo = createCanopyClusterGeo(1.0, 1, 0.88);
      const birchCrown1Inst = new THREE.InstancedMesh(crownGeo, leafMat, count);
      const birchCrown2Inst = new THREE.InstancedMesh(crownGeo, leafMat, count);
      const birchCrown3Inst = new THREE.InstancedMesh(crownGeo, leafMat, count);

      for (let i = 0; i < count; i++) {
        const { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit, groundZ } = placedBirches[i];
        const trunkH = (r * 0.95 + 4.5) * heightMult;
        const trunkR = Math.max(0.95, r * 0.12);

        // Trunk
        dummy.position.set(x, -y, groundZ + trunkH / 2);
        dummy.scale.set(trunkR, trunkR, trunkH);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        birchTrunkInst.setMatrixAt(i, dummy.matrix);

        // Lower Fluffy Amber Crown
        const c1R = r * 0.82;
        const c1Z = trunkH * 0.68 + c1R * 0.45;
        dummy.position.set(x, -y, groundZ + c1Z);
        dummy.scale.set(c1R, c1R * 0.92, c1R * 0.86);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        birchCrown1Inst.setMatrixAt(i, dummy.matrix);

        // Mid Golden Crown
        const c2R = r * 0.66;
        const c2Z = c1Z + c1R * 0.48;
        dummy.position.set(x, -y, groundZ + c2Z);
        dummy.scale.set(c2R, c2R * 0.95, c2R * 0.88);
        dummy.rotation.set(leanX, leanY, yaw + 0.9);
        dummy.updateMatrix();
        birchCrown2Inst.setMatrixAt(i, dummy.matrix);

        // Top Sunlit Crown
        const c3R = r * 0.48;
        const c3Z = c2Z + c2R * 0.48;
        dummy.position.set(x, -y, groundZ + c3Z);
        dummy.scale.set(c3R, c3R * 0.95, c3R * 0.88);
        dummy.rotation.set(leanX, leanY, yaw + 1.8);
        dummy.updateMatrix();
        birchCrown3Inst.setMatrixAt(i, dummy.matrix);

        color.setHSL(hue, sat, lit);
        birchCrown1Inst.setColorAt(i, color);
        color.setHSL(hue + 0.02, sat, Math.min(0.9, lit * 1.12));
        birchCrown2Inst.setColorAt(i, color);
        color.setHSL(hue - 0.01, sat, Math.min(0.9, lit * 1.25));
        birchCrown3Inst.setColorAt(i, color);
      }

      birchTrunkInst.instanceMatrix.needsUpdate = true;
      birchCrown1Inst.instanceMatrix.needsUpdate = true;
      birchCrown2Inst.instanceMatrix.needsUpdate = true;
      birchCrown3Inst.instanceMatrix.needsUpdate = true;
      if (birchCrown1Inst.instanceColor) birchCrown1Inst.instanceColor.needsUpdate = true;
      if (birchCrown2Inst.instanceColor) birchCrown2Inst.instanceColor.needsUpdate = true;
      if (birchCrown3Inst.instanceColor) birchCrown3Inst.instanceColor.needsUpdate = true;
      birchTrunkInst.castShadow = true; birchTrunkInst.receiveShadow = true;
      birchCrown1Inst.castShadow = true; birchCrown1Inst.receiveShadow = true;
      birchCrown2Inst.castShadow = true; birchCrown2Inst.receiveShadow = true;
      birchCrown3Inst.castShadow = true; birchCrown3Inst.receiveShadow = true;

      this.treeGroup.add(birchTrunkInst, birchCrown1Inst, birchCrown2Inst, birchCrown3Inst);
    }

    this.scene.add(this.treeGroup);
  }

  setupRocks() {
    if (this.rockGroup) {
      this.scene.remove(this.rockGroup);
      this.rockGroup.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry) child.geometry.dispose();
          if (Array.isArray(child.material)) {
            child.material.forEach((m) => m.dispose());
          } else if (child.material) {
            child.material.dispose();
          }
        }
      });
    }

    this.rockGroup = new THREE.Group();
    const t = this.track;
    const b = t.bounds;
    const cxArr = t.cx || [];
    const cyArr = t.cy || [];
    const txArr = t.tx || [];
    const tyArr = t.ty || [];
    const numTrackPts = cxArr.length;
    const roadHalf = (t.width || 84) * 0.5;

    // Deterministic PRNG seeded with track bounds
    let s = (Math.round(b.minX * 7 + b.minY * 11 + b.w * 31 + b.h * 47) & 0x7fffffff) || 849201;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const pad = Math.max(900, Math.max(b.w, b.h) * 0.65);
    const minX = b.minX - pad;
    const maxX = b.maxX + pad;
    const minY = b.minY - pad;
    const maxY = b.maxY + pad;

    const candidates = [];

    // 1. Distant Hillside & Mountain Crag Outcrops (Tasteful, scenic rock clusters on distant rolling hills)
    const numClusters = 7;
    for (let c = 0; c < numClusters; c++) {
      const cX = minX + rand() * (maxX - minX);
      const cY = minY + rand() * (maxY - minY);
      const rockType = Math.floor(rand() * 3);
      const count = 3 + Math.floor(rand() * 3); // 3 to 5 rocks per cluster
      for (let k = 0; k < count; k++) {
        const angle = rand() * Math.PI * 2;
        const dist = Math.sqrt(rand()) * (25 + rand() * 45);
        candidates.push({
          x: cX + Math.cos(angle) * dist,
          y: cY + Math.sin(angle) * dist,
          rockType,
        });
      }
    }

    // 2. Distant Horizon Mountain Megaliths
    for (let i = 0; i < 12; i++) {
      candidates.push({
        x: minX + rand() * (maxX - minX),
        y: minY + rand() * (maxY - minY),
        rockType: Math.floor(rand() * 3),
      });
    }

    const placedType0 = [];
    const placedType1 = [];
    const placedType2 = [];

    const { lakes: wLakes, river: wRiver } = this.getWaterBodies();
    // Enforce large safety clearance: NO rocks within 140m of track centerline or flat runoff
    const minSafeTrackClearance = roadHalf + 95.0;

    for (const cand of candidates) {
      const { x, y, rockType } = cand;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;

      // Ensure large clearance from track asphalt centerline
      let minDistToTrack = Infinity;
      if (numTrackPts > 0) {
        for (let i = 0; i < numTrackPts; i += 2) {
          const d = Math.hypot(x - cxArr[i], y - cyArr[i]);
          if (d < minDistToTrack) minDistToTrack = d;
        }
      }
      if (minDistToTrack < minSafeTrackClearance) continue; // Completely remove rocks near track / runoff

      // In Three.js world space, the point is at (x, -y)
      const groundZ = this.getTerrainHeight(x, -y);
      if (groundZ <= 0.8) continue; // Rocks only sit naturally up on elevated hills and mountains

      // Exclude water bodies
      let inWater = false;
      for (const l of wLakes) {
        const dx = (x - l.cx) / l.rx;
        const dy = (-y - l.cy) / l.ry;
        if (Math.hypot(dx, dy) < 1.05) {
          inWater = true;
          break;
        }
      }
      if (!inWater) {
        for (let i = 0; i < wRiver.length; i += 2) {
          const rp = wRiver[i];
          if (Math.hypot(x - rp.x, -y - rp.y) < rp.width * 0.70) {
            inWater = true;
            break;
          }
        }
      }
      if (inWater) continue;

      // Boulder scale distribution:
      // 50% Medium boulders (2.4m - 4.5m)
      // 35% Large rock formations (4.8m - 9.0m)
      // 15% Giant landmark monoliths & crags (10.0m - 22.0m)
      const roll = rand();
      let baseR;
      if (roll < 0.50) {
        baseR = 2.4 + rand() * 2.1;
      } else if (roll < 0.85) {
        baseR = 4.8 + rand() * 4.2;
      } else {
        baseR = 10.0 + rand() * 12.0;
      }

      const rockData = {
        x,
        y,
        r: baseR,
        scaleX: baseR * (0.75 + rand() * 0.50),
        scaleY: baseR * (0.75 + rand() * 0.50),
        scaleZ: baseR * (0.55 + rand() * 0.55),
        rotX: rand() * Math.PI * 2,
        rotY: rand() * Math.PI * 2,
        rotZ: rand() * Math.PI * 2,
        groundZ,
        tint: 0.90 + rand() * 0.20,
      };

      if (rockType === 0) placedType0.push(rockData);
      else if (rockType === 1) placedType1.push(rockData);
      else placedType2.push(rockData);
    }

    const rockGroups = [
      {
        list: placedType0,
        mat: new THREE.MeshStandardMaterial({
          color: 0x545860, // Slate / Granite Crag
          roughness: 0.90,
          metalness: 0.08,
          flatShading: true,
        }),
      },
      {
        list: placedType1,
        mat: new THREE.MeshStandardMaterial({
          color: 0x6e6659, // Weathered Sandstone / Limestone
          roughness: 0.94,
          metalness: 0.04,
          flatShading: true,
        }),
      },
      {
        list: placedType2,
        mat: new THREE.MeshStandardMaterial({
          color: 0x3a4034, // Mossy Basalt / Dark Shale
          roughness: 0.88,
          metalness: 0.05,
          flatShading: true,
        }),
      },
    ];

    const dummy = new THREE.Object3D();
    const instColor = new THREE.Color();

    for (const rg of rockGroups) {
      if (rg.list.length === 0) continue;
      const count = rg.list.length;

      // Base geometry: Dodecahedron with perturbed vertices for craggy faceted boulders
      const geo = new THREE.DodecahedronGeometry(1.0, 1);
      const vPos = geo.attributes.position.array;
      for (let i = 0; i < vPos.length; i += 3) {
        const px = vPos[i];
        const py = vPos[i + 1];
        const pz = vPos[i + 2];
        const disp = 1.0 + (Math.sin(px * 3.5 + py * 2.8) * 0.22 + Math.cos(py * 3.2 - pz * 2.9) * 0.16);
        vPos[i] = px * disp;
        vPos[i + 1] = py * disp;
        vPos[i + 2] = pz * (disp * 0.92);
      }
      geo.computeVertexNormals();

      const instMesh = new THREE.InstancedMesh(geo, rg.mat, count);

      for (let i = 0; i < count; i++) {
        const item = rg.list[i];
        // Embed the boulder partially into the ground for natural slope resting
        dummy.position.set(item.x, -item.y, item.groundZ + item.scaleZ * 0.22);
        dummy.rotation.set(item.rotX, item.rotY, item.rotZ);
        dummy.scale.set(item.scaleX, item.scaleY, item.scaleZ);
        dummy.updateMatrix();
        instMesh.setMatrixAt(i, dummy.matrix);

        instColor.copy(rg.mat.color).multiplyScalar(item.tint);
        instMesh.setColorAt(i, instColor);
      }

      instMesh.instanceMatrix.needsUpdate = true;
      if (instMesh.instanceColor) instMesh.instanceColor.needsUpdate = true;
      instMesh.castShadow = true;
      instMesh.receiveShadow = true;

      this.rockGroup.add(instMesh);
    }

    this.scene.add(this.rockGroup);
  }

  setupTireBarriers(sim = null) {
    if (this.tireGroup) {
      this.scene.remove(this.tireGroup);
      if (this.tireMesh) {
        this.tireMesh.geometry.dispose();
        if (Array.isArray(this.tireMesh.material)) {
          this.tireMesh.material.forEach((m) => m.dispose());
        } else {
          this.tireMesh.material.dispose();
        }
      }
    }

    this.tireGroup = new THREE.Group();
    this.tireDummy = new THREE.Object3D();
    this.tireColor = new THREE.Color();

    // FIA Standard safety protection tyre (Extruded ring with distinct hollow center & rounded rubber tread)
    const outerRadius = 2.10;
    const innerRadius = 0.98;
    const tyreHeight = 1.32;

    // Fast, lightweight hollow tire geometry (40 vertices instead of 1,728)
    const segments = 10;
    const halfH = tyreHeight * 0.5;
    const vertices = [];
    const indices = [];

    for (let ring = 0; ring < 4; ring++) {
      const isInner = ring >= 2;
      const isTop = ring === 0 || ring === 2;
      const r = isInner ? innerRadius : outerRadius;
      const z = isTop ? halfH : -halfH;

      for (let i = 0; i < segments; i++) {
        const angle = (i / segments) * Math.PI * 2;
        vertices.push(Math.cos(angle) * r, Math.sin(angle) * r, z);
      }
    }

    const idx = (ring, i) => ring * segments + (i % segments);

    for (let i = 0; i < segments; i++) {
      const nxt = (i + 1) % segments;

      // 1. Outer Tread Wall (Ring 0 -> Ring 1)
      indices.push(idx(0, i), idx(1, i), idx(0, nxt));
      indices.push(idx(0, nxt), idx(1, i), idx(1, nxt));

      // 2. Inner Void Wall (Ring 3 -> Ring 2)
      indices.push(idx(2, i), idx(2, nxt), idx(3, i));
      indices.push(idx(2, nxt), idx(3, nxt), idx(3, i));

      // 3. Top Annulus Ring (Ring 2 -> Ring 0)
      indices.push(idx(0, i), idx(0, nxt), idx(2, i));
      indices.push(idx(0, nxt), idx(2, nxt), idx(2, i));

      // 4. Bottom Annulus Ring (Ring 1 -> Ring 3)
      indices.push(idx(1, i), idx(3, i), idx(1, nxt));
      indices.push(idx(1, nxt), idx(3, i), idx(3, nxt));
    }

    const tireGeo = new THREE.BufferGeometry();
    tireGeo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    tireGeo.setIndex(indices);
    tireGeo.computeVertexNormals();

    const tireMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.86,
      metalness: 0.08,
      side: THREE.DoubleSide,
    });

    const tires = sim?.tireBarriers?.tires || (this.track ? this.generateTiresForTrack(this.track) : []);
    this.tireCount = tires.length;

    if (this.tireCount > 0) {
      this.tireMesh = new THREE.InstancedMesh(tireGeo, tireMat, this.tireCount);
      this.tireMesh.castShadow = false; // Disable heavy shadow-map pass for 3,862 instances
      this.tireMesh.receiveShadow = true;

      for (let i = 0; i < this.tireCount; i++) {
        const t = tires[i];
        this.tireDummy.position.set(t.x, -t.y, t.z);
        this.tireDummy.rotation.set(t.pitch || 0, t.roll || 0, -(t.yaw || 0));
        this.tireDummy.scale.set(1, 1, 1);
        this.tireDummy.updateMatrix();
        this.tireMesh.setMatrixAt(i, this.tireDummy.matrix);

        this.tireColor.setRGB(t.color.r, t.color.g, t.color.b);
        this.tireMesh.setColorAt(i, this.tireColor);
      }

      this.tireMesh.instanceMatrix.needsUpdate = true;
      if (this.tireMesh.instanceColor) this.tireMesh.instanceColor.needsUpdate = true;
      this.tireGroup.add(this.tireMesh);
    }

    this.scene.add(this.tireGroup);
  }

  generateTiresForTrack(track) {
    if (!track) return [];
    const system = new TireBarrierSystem(track);
    return system.tires;
  }

  updateTireBarriers(sim) {
    if (!sim?.tireBarriers?.tires || !this.tireMesh) return;
    const tires = sim.tireBarriers.tires;
    if (tires.length !== this.tireCount) {
      this.setupTireBarriers(sim);
      return;
    }

    let updated = false;
    for (let i = 0; i < tires.length; i++) {
      const t = tires[i];
      if (!t.sleeping || t.needsRenderUpdate) {
        this.tireDummy.position.set(t.x, -t.y, t.z);
        this.tireDummy.rotation.set(t.pitch || 0, t.roll || 0, -(t.yaw || 0));
        const s = t.scale !== undefined ? t.scale : 1;
        this.tireDummy.scale.set(s, s, s);
        this.tireDummy.updateMatrix();
        this.tireMesh.setMatrixAt(i, this.tireDummy.matrix);
        t.needsRenderUpdate = false;
        updated = true;
      }
    }

    if (updated) {
      this.tireMesh.instanceMatrix.needsUpdate = true;
    }
  }

  setTrack(track) {
    this.track = track;
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      this.terrainMesh.geometry.dispose();
      this.terrainMesh.material.dispose();
    }
    if (this.waterGroup) {
      this.scene.remove(this.waterGroup);
    }
    if (this.trackMesh) {
      this.scene.remove(this.trackMesh);
      this.trackMesh.geometry.dispose();
      this.trackMesh.material.dispose();
    }
    if (this.decorGroup) {
      this.scene.remove(this.decorGroup);
    }
    if (this.treeGroup) {
      this.scene.remove(this.treeGroup);
    }
    if (this.tireGroup) {
      this.scene.remove(this.tireGroup);
    }

    this.clearBursts();
    this.clearSkidmarks();
    this.clearTireSmoke();
    this.updateLightPosition();

    this.setupTerrain();
    this.setupWater();
    this.setupTrack();
    this.setupTrees();
    this.setupRocks();
    this.setupTireBarriers();
    this.resetCamera();
  }

  setupBursts() {
    this.maxBurstSparks = 400;
    this.burstSparks = [];
    this.burstPosArr = new Float32Array(this.maxBurstSparks * 3);
    this.burstColArr = new Float32Array(this.maxBurstSparks * 3);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.burstPosArr, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(this.burstColArr, 3));
    geo.setDrawRange(0, 0);

    const mat = new THREE.PointsMaterial({
      vertexColors: true,
      size: 6.5,
      transparent: true,
      opacity: 0.95,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });

    this.burstPointsMesh = new THREE.Points(geo, mat);
    this.burstPointsMesh.frustumCulled = false;
    this.burstPointsMesh.renderOrder = 500;
    this.scene.add(this.burstPointsMesh);
  }

  clearBursts() {
    this.burstSparks = [];
    if (this.burstPointsMesh) this.burstPointsMesh.geometry.setDrawRange(0, 0);
  }

  processDeathEvents(sim) {
    if (!sim.deathEvents || sim.deathEvents.length === 0) return;
    const events = sim.deathEvents;
    const count = Math.min(events.length, 12);
    for (let i = 0; i < count; i++) {
      this.addBurst(events[i]);
    }
    sim.deathEvents.length = 0;
  }

  addBurst(evt) {
    const { x, y, speed } = evt;
    const count = 12;
    const baseSpeed = Math.min(140, Math.max(40, (speed || 45) * 0.7));

    for (let i = 0; i < count; i++) {
      if (this.burstSparks.length >= this.maxBurstSparks) {
        this.burstSparks.shift(); // recycle oldest
      }
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = baseSpeed * (0.6 + Math.random() * 0.8);
      this.burstSparks.push({
        x: x,
        y: -y,
        z: 1.5,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        vz: 16 + Math.random() * 28,
        life: 1.0,
        decay: 1.8 + Math.random() * 0.8,
        r: 1.0,
        g: 0.45 + Math.random() * 0.4,
        b: 0.1,
      });
    }
  }

  updateBursts() {
    if (!this.burstSparks || this.burstSparks.length === 0) {
      if (this.burstPointsMesh) this.burstPointsMesh.geometry.setDrawRange(0, 0);
      return;
    }
    const dt = 1 / 60;
    let writeIdx = 0;

    for (let i = this.burstSparks.length - 1; i >= 0; i--) {
      const p = this.burstSparks[i];
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        this.burstSparks.splice(i, 1);
        continue;
      }

      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vz -= 75 * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;

      const idx = writeIdx * 3;
      this.burstPosArr[idx] = p.x;
      this.burstPosArr[idx + 1] = p.y;
      this.burstPosArr[idx + 2] = Math.max(0.2, p.z);

      this.burstColArr[idx] = p.r * p.life;
      this.burstColArr[idx + 1] = p.g * p.life;
      this.burstColArr[idx + 2] = p.b * p.life;
      writeIdx++;
    }

    this.burstPointsMesh.geometry.attributes.position.needsUpdate = true;
    this.burstPointsMesh.geometry.attributes.color.needsUpdate = true;
    this.burstPointsMesh.geometry.setDrawRange(0, writeIdx);
  }

  createSmokeTexture() {
    if (typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 256, 256);

    // Multi-lobed organic soft cloud vapor puffs (airy feathered wisps)
    const lobes = [
      { x: 128, y: 128, r: 110, a: 0.42 },
      { x: 104, y: 112, r: 84, a: 0.32 },
      { x: 154, y: 108, r: 80, a: 0.32 },
      { x: 108, y: 150, r: 76, a: 0.28 },
      { x: 148, y: 146, r: 86, a: 0.28 },
      { x: 128, y: 88, r: 68, a: 0.24 },
      { x: 84, y: 132, r: 64, a: 0.20 },
      { x: 172, y: 128, r: 64, a: 0.20 },
    ];

    for (const lobe of lobes) {
      const grad = ctx.createRadialGradient(lobe.x, lobe.y, 0, lobe.x, lobe.y, lobe.r);
      grad.addColorStop(0.0, `rgba(255, 255, 255, ${lobe.a})`);
      grad.addColorStop(0.35, `rgba(255, 255, 255, ${lobe.a * 0.70})`);
      grad.addColorStop(0.70, `rgba(255, 255, 255, ${lobe.a * 0.20})`);
      grad.addColorStop(1.0, 'rgba(255, 255, 255, 0.0)');

      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(lobe.x, lobe.y, lobe.r, 0, Math.PI * 2);
      ctx.fill();
    }

    const tex = new THREE.CanvasTexture(canvas);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  setupTireSmoke() {
    this.maxSmokeParticles = 1600;
    this.smokeParticles = [];
    this.smokePosArr = new Float32Array(this.maxSmokeParticles * 3);
    this.smokeSizeArr = new Float32Array(this.maxSmokeParticles);
    this.smokeAlphaArr = new Float32Array(this.maxSmokeParticles);
    this.smokeRotArr = new Float32Array(this.maxSmokeParticles);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.smokePosArr, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.smokeSizeArr, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.smokeAlphaArr, 1));
    geo.setAttribute('rotation', new THREE.BufferAttribute(this.smokeRotArr, 1));
    geo.setDrawRange(0, 0);

    const smokeTex = this.createSmokeTexture();

    const vertShader = `
      attribute float size;
      attribute float alpha;
      attribute float rotation;
      varying float vAlpha;
      varying float vRot;
      void main() {
        vAlpha = alpha;
        vRot = rotation;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        // Balanced perspective sprite scaling
        gl_PointSize = clamp(size * (1050.0 / -mvPosition.z), 2.0, 180.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragShader = `
      uniform sampler2D uSmokeTexture;
      varying float vAlpha;
      varying float vRot;
      void main() {
        vec2 p = gl_PointCoord - vec2(0.5);
        float cosR = cos(vRot);
        float sinR = sin(vRot);
        vec2 rotUv = vec2(
          p.x * cosR - p.y * sinR + 0.5,
          p.x * sinR + p.y * cosR + 0.5
        );
        
        vec4 texColor = texture2D(uSmokeTexture, rotUv);
        float alpha = texColor.a * vAlpha * 0.40;
        if (alpha < 0.005) discard;

        // Rich motorsport white-grey tire friction vapor
        vec3 smokeColor = vec3(0.93, 0.94, 0.96);
        gl_FragColor = vec4(smokeColor, alpha);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms: {
        uSmokeTexture: { value: smokeTex },
      },
      vertexShader: vertShader,
      fragmentShader: fragShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
    });

    this.smokeMesh = new THREE.Points(geo, mat);
    this.smokeMesh.frustumCulled = false;
    this.smokeMesh.renderOrder = 450;
    this.scene.add(this.smokeMesh);
  }

  clearTireSmoke() {
    this.smokeParticles = [];
    if (this.smokeMesh) this.smokeMesh.geometry.setDrawRange(0, 0);
  }

  addTireSmokePuff(x, y, z, carVx, carVy, intensity) {
    if (this.smokeParticles.length >= this.maxSmokeParticles) {
      this.smokeParticles.shift();
    }
    // Eject smoke puff directly at the tyre contact patch with backward drift and vertical billow
    this.smokeParticles.push({
      x: x + (Math.random() - 0.5) * 0.5,
      y: y + (Math.random() - 0.5) * 0.5,
      z: z + Math.random() * 0.20,
      vx: (carVx * 0.12) + (Math.random() - 0.5) * 2.2,
      vy: (carVy * 0.12) + (Math.random() - 0.5) * 2.2,
      vz: 2.2 + Math.random() * 2.6, // Billows upwards into the air
      size: 6.5 + Math.random() * 2.5, // Well-proportioned tyre vapor size
      growthRate: 12.0 + Math.random() * 5.0, // Billows out into continuous clouds
      rotation: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 2.2,
      alpha: Math.min(0.28, intensity * 0.28),
      life: 1.0,
      decay: 1.50 + Math.random() * 0.35,
    });
  }

  updateTireSmoke() {
    if (!this.smokeParticles || this.smokeParticles.length === 0) {
      if (this.smokeMesh) this.smokeMesh.geometry.setDrawRange(0, 0);
      return;
    }

    const dt = 1 / 60;
    let writeIdx = 0;

    for (let i = this.smokeParticles.length - 1; i >= 0; i--) {
      const p = this.smokeParticles[i];
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        this.smokeParticles.splice(i, 1);
        continue;
      }

      // Physics: drift, rise into the air, expand, rotate and drag deceleration
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= 0.94;
      p.vy *= 0.94;
      p.vz *= 0.96;
      p.size += p.growthRate * dt;
      p.rotation += p.vRot * dt;

      const idx = writeIdx * 3;
      this.smokePosArr[idx] = p.x;
      this.smokePosArr[idx + 1] = p.y;
      this.smokePosArr[idx + 2] = p.z;

      this.smokeSizeArr[writeIdx] = p.size;
      this.smokeAlphaArr[writeIdx] = p.alpha * Math.pow(p.life, 1.6);
      this.smokeRotArr[writeIdx] = p.rotation;

      writeIdx++;
    }

    const posAttr = this.smokeMesh.geometry.attributes.position;
    const sizeAttr = this.smokeMesh.geometry.attributes.size;
    const alphaAttr = this.smokeMesh.geometry.attributes.alpha;
    const rotAttr = this.smokeMesh.geometry.attributes.rotation;

    if (posAttr) posAttr.needsUpdate = true;
    if (sizeAttr) sizeAttr.needsUpdate = true;
    if (alphaAttr) alphaAttr.needsUpdate = true;
    if (rotAttr) rotAttr.needsUpdate = true;

    this.smokeMesh.geometry.setDrawRange(0, writeIdx);
  }

  setupSkidmarks() {
    this.maxSkidQuads = 80000;
    const maxVerts = this.maxSkidQuads * 4;
    const maxIndices = this.maxSkidQuads * 6;

    this.skidPosArr = new Float32Array(maxVerts * 3);
    this.skidAlphaArr = new Float32Array(maxVerts);
    this.skidUvArr = new Float32Array(maxVerts * 2);
    const indices = new Uint32Array(maxIndices);

    for (let i = 0; i < this.maxSkidQuads; i++) {
      const v0 = i * 4;
      const i0 = i * 6;
      indices[i0] = v0;
      indices[i0 + 1] = v0 + 1;
      indices[i0 + 2] = v0 + 2;
      indices[i0 + 3] = v0 + 2;
      indices[i0 + 4] = v0 + 1;
      indices[i0 + 5] = v0 + 3;

      // Pre-populate static UV coordinates for all quads
      this.skidUvArr[v0 * 2] = 0.0;
      this.skidUvArr[v0 * 2 + 1] = 0.0;
      this.skidUvArr[(v0 + 1) * 2] = 1.0;
      this.skidUvArr[(v0 + 1) * 2 + 1] = 0.0;
      this.skidUvArr[(v0 + 2) * 2] = 0.0;
      this.skidUvArr[(v0 + 2) * 2 + 1] = 1.0;
      this.skidUvArr[(v0 + 3) * 2] = 1.0;
      this.skidUvArr[(v0 + 3) * 2 + 1] = 1.0;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.skidPosArr, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.skidAlphaArr, 1));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.skidUvArr, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.setDrawRange(0, 0);

    const vertShader = `
      attribute float alpha;
      varying float vAlpha;
      varying vec2 vUv;
      void main() {
        vAlpha = alpha;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const fragShader = `
      varying float vAlpha;
      varying vec2 vUv;
      void main() {
        // Authentic motorsport dark graphite rubber compound
        vec3 rubber = vec3(0.042, 0.045, 0.055);
        // Soft lateral tire feathering with solid dark center contact patch
        float edge = smoothstep(0.0, 0.20, vUv.x) * smoothstep(1.0, 0.80, vUv.x);
        float lateral = 0.50 + 0.50 * edge;
        // Translucent, subtle rubber deposit that naturally builds up across laps
        float alpha = clamp(vAlpha * lateral, 0.0, 0.28);
        if (alpha < 0.005) discard;
        gl_FragColor = vec4(rubber, alpha);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      vertexShader: vertShader,
      fragmentShader: fragShader,
      transparent: true,
      depthWrite: false,
      depthTest: true,
      side: THREE.DoubleSide,
      blending: THREE.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -4.0,
      polygonOffsetUnits: -4.0,
    });

    this.skidMesh = new THREE.Mesh(geo, mat);
    this.skidMesh.frustumCulled = false;
    this.skidMesh.renderOrder = 350;
    this.scene.add(this.skidMesh);

    this.skidHead = 0;
    this.skidCount = 0;
    this.carPrevTires = new Map();
  }

  clearSkidmarks() {
    this.skidHead = 0;
    this.skidCount = 0;
    if (this.carPrevTires) this.carPrevTires.clear();
    if (this.skidMesh) this.skidMesh.geometry.setDrawRange(0, 0);
  }

  addSkidQuad(v0x, v0y, v1x, v1y, v2x, v2y, v3x, v3y, alpha0, alpha1) {
    const quadIdx = this.skidHead;
    const vOffset = quadIdx * 4;
    // Elevated safely above asphalt slab (0.05) and white lines (0.12) to stay clearly visible
    const z = 0.16;

    // v0 (prev outer edge)
    this.skidPosArr[vOffset * 3] = v0x;
    this.skidPosArr[vOffset * 3 + 1] = v0y;
    this.skidPosArr[vOffset * 3 + 2] = z;
    this.skidAlphaArr[vOffset] = alpha0;

    // v1 (prev inner edge)
    this.skidPosArr[(vOffset + 1) * 3] = v1x;
    this.skidPosArr[(vOffset + 1) * 3 + 1] = v1y;
    this.skidPosArr[(vOffset + 1) * 3 + 2] = z;
    this.skidAlphaArr[(vOffset + 1)] = alpha0;

    // v2 (current outer edge)
    this.skidPosArr[(vOffset + 2) * 3] = v2x;
    this.skidPosArr[(vOffset + 2) * 3 + 1] = v2y;
    this.skidPosArr[(vOffset + 2) * 3 + 2] = z;
    this.skidAlphaArr[(vOffset + 2)] = alpha1;

    // v3 (current inner edge)
    this.skidPosArr[(vOffset + 3) * 3] = v3x;
    this.skidPosArr[(vOffset + 3) * 3 + 1] = v3y;
    this.skidPosArr[(vOffset + 3) * 3 + 2] = z;
    this.skidAlphaArr[(vOffset + 3)] = alpha1;

    this.skidHead = (this.skidHead + 1) % this.maxSkidQuads;
    if (this.skidCount < this.maxSkidQuads) this.skidCount++;
    this._frameSkidQuadsAdded = (this._frameSkidQuadsAdded || 0) + 1;
  }

  updateSkidmarks(sim) {
    if (!sim || !sim.cars) return;
    const candidateCars = sim.player && sim.player.alive ? [sim.player, ...sim.cars] : sim.cars;
    let added = false;
    const SKID_THRESH = 0.045; // Clean grip driving leaves ZERO marks; only dynamic sliding triggers
    const startHead = this.skidHead;
    this._frameSkidQuadsAdded = 0;

    for (let i = 0; i < candidateCars.length; i++) {
      const car = candidateCars[i];
      if (!car || !car.alive || car.finished) {
        if (this.carPrevTires.has(car)) this.carPrevTires.delete(car);
        continue;
      }

      // Exact physical tire sliding models:
      // 1. Oversteer (Rear lateral breakaway / drift): slip angle exceeds standard grip limit (>2.4 deg) or high yaw rotation
      const slipMag = Math.abs(car.slipAngle || 0);
      const yawMag = Math.abs(car.yawRate || 0);
      const oversteerNorm = Math.max(
        slipMag > 0.042 ? Math.min(1.0, (slipMag - 0.042) / 0.10) : 0,
        yawMag > 0.30 ? Math.min(1.0, (yawMag - 0.30) / 1.0) : 0
      );
      const oversteerInt = oversteerNorm > 0 ? Math.pow(oversteerNorm, 1.2) : 0;

      // 2. Understeer (Front tire scrub / push): heavy steering input at speed where front tires saturate and push wide
      const steerMag = Math.abs(car.steer || 0);
      let understeerNorm = 0;
      if (steerMag > 0.36 && car.speed > 45 && !car.crashed) {
        const speedFactor = Math.min(1.0, (car.speed - 35) / 60);
        const steerFactor = (steerMag - 0.36) / 0.50;
        understeerNorm = Math.min(1.0, steerFactor * speedFactor);
      }
      const understeerInt = understeerNorm > 0 ? Math.pow(understeerNorm, 1.2) : 0;

      // 3. Brake Locks (Tire flatspotting under threshold braking): heavy deceleration lockup
      const isHardBraking = car.throttle < -0.32 && car.speed > 20;
      const brakeLockNorm = isHardBraking ? Math.min(1.0, (-car.throttle - 0.32) / 0.58) : 0;
      const brakeLockInt = brakeLockNorm > 0 ? Math.pow(brakeLockNorm, 1.2) : 0;

      // 4. Wheelspin / Power Slide (Launch burnout or hard acceleration overpowering rear grip)
      const isWheelspin = car.throttle > 0.52 && car.speed < 90 && !car.crashed;
      const wheelspinNorm = isWheelspin
        ? Math.min(1.0, ((car.throttle - 0.52) / 0.40) * (1.0 - car.speed / 105))
        : 0;
      const wheelspinInt = wheelspinNorm > 0 ? Math.pow(wheelspinNorm, 1.2) : 0;

      // 5. Crash / Off-track rotational slide
      const crashInt = (car.crashed && car.speed > 4) ? Math.min(1.0, car.speed / 45) : 0;

      // Rear tires mark on oversteer, wheelspin, hard brake locks, and crash slides
      const targetRearInt = Math.min(1.0, Math.max(oversteerInt, wheelspinInt, brakeLockInt * 0.85, crashInt));
      // Front tires mark on understeer push, hard brake locks, and crash slides
      const targetFrontInt = Math.min(1.0, Math.max(understeerInt, brakeLockInt, crashInt));

      let track = this.carPrevTires.get(car);
      if (!track) {
        track = {
          // Rear axle
          rlx: 0, rly: 0, rrx: 0, rry: 0,
          rl0x: 0, rl0y: 0, rl1x: 0, rl1y: 0,
          rr0x: 0, rr0y: 0, rr1x: 0, rr1y: 0,
          smoothRearInt: 0,
          prevRearAlpha: 0,
          rearActive: false,
          // Front axle
          flx: 0, fly: 0, frx: 0, fry: 0,
          fl0x: 0, fl0y: 0, fl1x: 0, fl1y: 0,
          fr0x: 0, fr0y: 0, fr1x: 0, fr1y: 0,
          smoothFrontInt: 0,
          prevFrontAlpha: 0,
          frontActive: false,
          initialized: false,
        };
        this.carPrevTires.set(car, track);
      }

      // Smooth attack/decay for gapless ribbons without frame jitter
      const prevRInt = track.smoothRearInt || 0;
      const rRate = targetRearInt > prevRInt ? 0.80 : 0.25;
      const curRearInt = prevRInt + (targetRearInt - prevRInt) * rRate;
      track.smoothRearInt = curRearInt;

      const prevFInt = track.smoothFrontInt || 0;
      const fRate = targetFrontInt > prevFInt ? 0.80 : 0.25;
      const curFrontInt = prevFInt + (targetFrontInt - prevFInt) * fRate;
      track.smoothFrontInt = curFrontInt;

      const cos = Math.cos(car.angle);
      const sin = Math.sin(car.angle);

      // Rear axle contact points (aligned with 3D F1 rear axle)
      const rlx = car.x - cos * 5.6 + sin * 4.6;
      const rly = -car.y + sin * 5.6 + cos * 4.6;
      const rrx = car.x - cos * 5.6 - sin * 4.6;
      const rry = -car.y + sin * 5.6 - cos * 4.6;

      // Front axle contact points (aligned with 3D F1 front steering wheels)
      const flx = car.x + cos * 8.6 + sin * 4.6;
      const fly = -car.y - sin * 8.6 + cos * 4.6;
      const frx = car.x + cos * 8.6 - sin * 4.6;
      const fry = -car.y - sin * 8.6 - cos * 4.6;

      const hw = 1.05; // ~2.1m contact width per tire
      const nx = sin * hw;
      const ny = cos * hw;

      const curRl0x = rlx - nx, curRl0y = rly - ny;
      const curRl1x = rlx + nx, curRl1y = rly + ny;
      const curRr0x = rrx - nx, curRr0y = rry - ny;
      const curRr1x = rrx + nx, curRr1y = rry + ny;

      const curFl0x = flx - nx, curFl0y = fly - ny;
      const curFl1x = flx + nx, curFl1y = fly + ny;
      const curFr0x = frx - nx, curFr0y = fry - ny;
      const curFr1x = frx + nx, curFr1y = fry + ny;

      // Translucent, subtle rubber alpha
      const isRearMarking = curRearInt > SKID_THRESH;
      const curRearAlpha = isRearMarking ? (0.05 + curRearInt * 0.20) : 0.0;

      const isFrontMarking = curFrontInt > SKID_THRESH;
      const curFrontAlpha = isFrontMarking ? (0.05 + curFrontInt * 0.20) : 0.0;

      if (track.initialized) {
        // --- 1. REAR TIRES (Oversteer, Wheelspin, Brake Locks, Crash) ---
        if (isRearMarking || track.rearActive) {
          const dLR = Math.hypot(rlx - track.rlx, rly - track.rly);
          if (dLR > 0.25 && dLR < 35) {
            const pRl0x = track.rearActive ? track.rl0x : (track.rlx - nx);
            const pRl0y = track.rearActive ? track.rl0y : (track.rly - ny);
            const pRl1x = track.rearActive ? track.rl1x : (track.rlx + nx);
            const pRl1y = track.rearActive ? track.rl1y : (track.rly + ny);

            const pRr0x = track.rearActive ? track.rr0x : (track.rrx - nx);
            const pRr0y = track.rearActive ? track.rr0y : (track.rry - ny);
            const pRr1x = track.rearActive ? track.rr1x : (track.rrx + nx);
            const pRr1y = track.rearActive ? track.rr1y : (track.rry + ny);

            const alpha0 = track.rearActive ? track.prevRearAlpha : (curRearAlpha * 0.35);
            const alpha1 = isRearMarking ? curRearAlpha : 0.0;

            this.addSkidQuad(pRl0x, pRl0y, pRl1x, pRl1y, curRl0x, curRl0y, curRl1x, curRl1y, alpha0, alpha1);
            this.addSkidQuad(pRr0x, pRr0y, pRr1x, pRr1y, curRr0x, curRr0y, curRr1x, curRr1y, alpha0, alpha1);

            // Volumetric continuous tire smoke puffs interpolated along the tyre trajectory
            if (curRearInt > 0.28) {
              const camDist = Math.hypot(car.x - this.camera.position.x, -car.y - this.camera.position.y);
              if (camDist < 600 || car === sim.player || car === this._focusCar || car === this._actionCarA) {
                const carVx = car.vx || 0;
                const carVy = -(car.vy || 0);
                const numPuffs = Math.max(1, Math.min(3, Math.ceil(dLR / 1.4)));
                for (let s = 1; s <= numPuffs; s++) {
                  const frac = s / numPuffs;
                  const pxL = track.rlx + (rlx - track.rlx) * frac;
                  const pyL = track.rly + (rly - track.rly) * frac;
                  const pxR = track.rrx + (rrx - track.rrx) * frac;
                  const pyR = track.rry + (rry - track.rry) * frac;
                  this.addTireSmokePuff(pxL, pyL, 0.40, carVx, carVy, curRearInt);
                  this.addTireSmokePuff(pxR, pyR, 0.40, carVx, carVy, curRearInt);
                }
              }
            }
            track.prevRearAlpha = isRearMarking ? curRearAlpha : 0.0;
            track.rearActive = isRearMarking;
            added = true;
          }
        } else {
          track.rearActive = false;
          track.prevRearAlpha = 0;
        }

        // --- 2. FRONT TIRES (Understeer, Brake Locks, Crash) ---
        if (isFrontMarking || track.frontActive) {
          const dLF = Math.hypot(flx - track.flx, fly - track.fly);
          if (dLF > 0.25 && dLF < 35) {
            const pFl0x = track.frontActive ? track.fl0x : (track.flx - nx);
            const pFl0y = track.frontActive ? track.fl0y : (track.fly - ny);
            const pFl1x = track.frontActive ? track.fl1x : (track.flx + nx);
            const pFl1y = track.frontActive ? track.fl1y : (track.fly + ny);

            const pFr0x = track.frontActive ? track.fr0x : (track.frx - nx);
            const pFr0y = track.frontActive ? track.fr0y : (track.fry - ny);
            const pFr1x = track.frontActive ? track.fr1x : (track.frx + nx);
            const pFr1y = track.frontActive ? track.fr1y : (track.fry + ny);

            const alpha0 = track.frontActive ? track.prevFrontAlpha : (curFrontAlpha * 0.35);
            const alpha1 = isFrontMarking ? curFrontAlpha : 0.0;

            this.addSkidQuad(pFl0x, pFl0y, pFl1x, pFl1y, curFl0x, curFl0y, curFl1x, curFl1y, alpha0, alpha1);
            this.addSkidQuad(pFr0x, pFr0y, pFr1x, pFr1y, curFr0x, curFr0y, curFr1x, curFr1y, alpha0, alpha1);

            // Volumetric continuous tire smoke puffs for front sliding / lockups
            if (curFrontInt > 0.28) {
              const camDist = Math.hypot(car.x - this.camera.position.x, -car.y - this.camera.position.y);
              if (camDist < 600 || car === sim.player || car === this._focusCar || car === this._actionCarA) {
                const carVx = car.vx || 0;
                const carVy = -(car.vy || 0);
                const numPuffs = Math.max(1, Math.min(3, Math.ceil(dLF / 1.4)));
                for (let s = 1; s <= numPuffs; s++) {
                  const frac = s / numPuffs;
                  const pxL = track.flx + (flx - track.flx) * frac;
                  const pyL = track.fly + (fly - track.fly) * frac;
                  const pxR = track.frx + (frx - track.frx) * frac;
                  const pyR = track.fry + (fry - track.fry) * frac;
                  this.addTireSmokePuff(pxL, pyL, 0.40, carVx, carVy, curFrontInt);
                  this.addTireSmokePuff(pxR, pyR, 0.40, carVx, carVy, curFrontInt);
                }
              }
            }
            track.prevFrontAlpha = isFrontMarking ? curFrontAlpha : 0.0;
            track.frontActive = isFrontMarking;
            added = true;
          }
        } else {
          track.frontActive = false;
          track.prevFrontAlpha = 0;
        }
      } else {
        track.rearActive = false;
        track.prevRearAlpha = 0;
        track.frontActive = false;
        track.prevFrontAlpha = 0;
      }

      // Maintain persistent tracking across frames
      track.rlx = rlx; track.rly = rly;
      track.rrx = rrx; track.rry = rry;
      track.rl0x = curRl0x; track.rl0y = curRl0y;
      track.rl1x = curRl1x; track.rl1y = curRl1y;
      track.rr0x = curRr0x; track.rr0y = curRr0y;
      track.rr1x = curRr1x; track.rr1y = curRr1y;

      track.flx = flx; track.fly = fly;
      track.frx = frx; track.fry = fry;
      track.fl0x = curFl0x; track.fl0y = curFl0y;
      track.fl1x = curFl1x; track.fl1y = curFl1y;
      track.fr0x = curFr0x; track.fr0y = curFr0y;
      track.fr1x = curFr1x; track.fr1y = curFr1y;
      track.initialized = true;
    }

    if (added && this.skidMesh) {
      const quadsAdded = this._frameSkidQuadsAdded || 0;
      const posAttr = this.skidMesh.geometry.attributes.position;
      const alphaAttr = this.skidMesh.geometry.attributes.alpha;
      if (quadsAdded > 0 && startHead + quadsAdded <= this.maxSkidQuads) {
        posAttr.updateRange = { offset: startHead * 4 * 3, count: quadsAdded * 4 * 3 };
        alphaAttr.updateRange = { offset: startHead * 4, count: quadsAdded * 4 };
      } else {
        posAttr.updateRange = { offset: 0, count: -1 };
        alphaAttr.updateRange = { offset: 0, count: -1 };
      }
      posAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
      this.skidMesh.geometry.setDrawRange(0, this.skidCount * 6);
    }
  }

  resetCamera(followMode = true) {
    this._chaseAngle = null;
    this._lastFocusCar = null;
    this._actionAngle = null;
    this._lastActionFocus = null;
    this._actionRearAngle = null;
    this._lastActionRearFocus = null;
    this._heliAngle = null;
    this._lastHeliFocus = null;
    this._autoPreset = 'heli';
    this._autoNextSwitch = performance.now() + 22000;
    this._lastGantryCutTime = null;
    this._lastGantryCutLap = null;
    this._gantryRollLap = null;
    this._gantryCrossedLineTime = null;
    this._lastActivePreset = null;
    this._camTransition = null;
    this._currentActionPair = null;
    const t = this.track;
    const startX = t.cx ? t.cx[0] : 0;
    const startY = t.cy ? -t.cy[0] : 0;
    const tx = t.tx ? t.tx[0] : 1;
    const ty = t.ty ? -t.ty[0] : 0;
    const nx = -ty;
    const ny = tx;

    if (followMode) {
      this.controls.target.set(startX, startY, 3.5);
      // Canonical broadcast follow perspective placed behind the start grid looking down straight
      const camX = startX - tx * 190 + nx * 75;
      const camY = startY - ty * 190 + ny * 75;
      const camZ = 95;
      this.camera.position.set(camX, camY, camZ);
      this.controls.update();
      return;
    }

    const b = this.track.bounds;
    const cx = b.cx;
    const cy = -b.cy;

    const pad = 40;
    const trackW = b.w + pad * 2;
    const trackH = b.h + pad * 2;

    const aspect = Math.max(0.2, (this.w || this.canvas.clientWidth || 800) / (this.h || this.canvas.clientHeight || 600));
    const fovV = (this.camera.fov * Math.PI) / 180;
    const fovH = 2 * Math.atan(Math.tan(fovV / 2) * aspect);

    const elevationAngle = (12 * Math.PI) / 180;
    const sinElev = Math.sin(elevationAngle);
    const cosElev = Math.cos(elevationAngle);

    const distW = (trackW / 2) / Math.tan(fovH / 2);
    const distH = ((trackH / 2) * sinElev) / Math.tan(fovV * 0.46) + (trackH / 2) * cosElev;
    const dist = Math.max(distW * 0.72, distH * 0.70, 380);

    this.controls.target.set(cx, cy, 1.5);
    this.camera.position.set(cx, cy - dist * cosElev, Math.max(22, dist * sinElev));
    this.controls.update();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.camera.aspect = this.w / this.h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(this.w, this.h, false);
  }

  findActionFocusPair(sim, rankedCars, focusCar, opts) {
    const isManual = Boolean(opts && opts.manual && sim && sim.player && (sim.player.alive || sim.player.finished));
    const player = isManual ? sim.player : null;

    const pool = [];
    if (sim && sim.cars) {
      for (let i = 0; i < sim.cars.length; i++) {
        const c = sim.cars[i];
        if (c && (c.alive || c.finished)) pool.push(c);
      }
    }
    if (player && !pool.includes(player)) pool.push(player);

    if (pool.length === 0) {
      return { carA: focusCar || null, carB: null };
    }
    if (isManual && player) {
      // In manual driving mode, the player's car is ALWAYS carA (primary focus)
      let closestOpponent = null;
      let closestDist = Infinity;
      for (let i = 0; i < pool.length; i++) {
        const c = pool[i];
        if (c !== player) {
          const d = Math.hypot(player.x - c.x, player.y - c.y);
          if (d < closestDist) {
            closestDist = d;
            closestOpponent = c;
          }
        }
      }
      const pair = { carA: player, carB: closestOpponent };
      this._currentActionPair = pair;
      return pair;
    }
    if (pool.length === 1) {
      return { carA: pool[0], carB: null };
    }

    const now = performance.now();
    const prevPair = this._currentActionPair;
    const prevA = prevPair?.carA;
    const prevAValid = prevA && (prevA.alive || prevA.finished) && !prevA.crashed;

    // STRICT 5-SECOND LOCK: Camera target/focus cannot change earlier than 5.0 seconds (5000ms)
    if (prevAValid && this._lastActionPairTime && (now - this._lastActionPairTime < 5000)) {
      // Keep tracking the same carA; if partner carB is dead/crashed/gone, find closest active opponent
      let partnerB = prevPair.carB;
      if (!partnerB || (!partnerB.alive && !partnerB.finished) || partnerB.crashed) {
        let closestD = Infinity;
        for (let i = 0; i < pool.length; i++) {
          const c = pool[i];
          if (c !== prevA && (c.alive || c.finished) && !c.crashed) {
            const d = Math.hypot(prevA.x - c.x, prevA.y - c.y);
            if (d < closestD) {
              closestD = d;
              partnerB = c;
            }
          }
        }
      }
      return { carA: prevA, carB: partnerB || null };
    }

    let bestScore = -1;
    let bestPair = null;

    for (let i = 0; i < pool.length; i++) {
      const c1 = pool[i];
      for (let j = i + 1; j < pool.length; j++) {
        const c2 = pool[j];

        const dist = Math.hypot(c1.x - c2.x, -c1.y - (-c2.y));
        if (dist > 95) continue;

        let score = 0;

        // 1. Proximity score: closer cars = vastly higher battle intensity
        if (dist < 32) {
          const closeness = (32 - dist) / 32;
          score += Math.pow(closeness, 1.3) * 85;
        } else {
          score += ((95 - dist) / 63) * 20;
        }

        // 2. Dynamic slip / sliding action
        const slip1 = Math.abs(c1.slipAngle || 0);
        const slip2 = Math.abs(c2.slipAngle || 0);
        if (slip1 > 0.045 || slip2 > 0.045) {
          score += Math.max(slip1, slip2) * 70;
        }

        // 3. Spinning / crash drama
        if (c1.crashed || c2.crashed) {
          score += 85;
        }
        const yaw1 = Math.abs(c1.yawRate || 0);
        const yaw2 = Math.abs(c2.yawRate || 0);
        if (yaw1 > 0.35 || yaw2 > 0.35) {
          score += Math.max(yaw1, yaw2) * 50;
        }

        // 4. Pack bonus: multiple cars in close proximity
        let packNeighbors = 0;
        for (let k = 0; k < pool.length; k++) {
          if (k !== i && k !== j) {
            const c3 = pool[k];
            if (Math.hypot(c1.x - c3.x, -c1.y - (-c3.y)) < 30) packNeighbors++;
          }
        }
        score += Math.min(3, packNeighbors) * 20;

        // 5. Mild rank bias
        const rank1 = this._carRankMap ? (this._carRankMap.get(c1) || 99) : 99;
        const rank2 = this._carRankMap ? (this._carRankMap.get(c2) || 99) : 99;
        const avgRank = (rank1 + rank2) * 0.5;
        score += Math.max(0, 14 - avgRank * 1.2);

        // 6. Manual driving player focus
        if (isManual && (c1 === player || c2 === player)) {
          score += 35;
        }

        // 7. Hysteresis / Stability bonus: keeps camera focused on active battle without flip-flopping
        if (this._currentActionPair &&
            ((this._currentActionPair.carA === c1 && this._currentActionPair.carB === c2) ||
             (this._currentActionPair.carA === c2 && this._currentActionPair.carB === c1))) {
          score += 45;
        }

        if (score > bestScore) {
          bestScore = score;
          bestPair = { carA: c1, carB: c2 };
        }
      }
    }

    if (!bestPair) {
      const leaderCar = rankedCars[0] || pool[0];
      const secondCar = pool.find((c) => c !== leaderCar) || null;
      bestPair = { carA: leaderCar, carB: secondCar };
    }

    if (bestPair.carB && this._carRankMap) {
      const rA = this._carRankMap.get(bestPair.carA) || 99;
      const rB = this._carRankMap.get(bestPair.carB) || 99;
      if (rB < rA) {
        const temp = bestPair.carA;
        bestPair.carA = bestPair.carB;
        bestPair.carB = temp;
      }
    }

    if (!this._lastActionPairTime || !this._currentActionPair || this._currentActionPair.carA !== bestPair.carA) {
      this._lastActionPairTime = now;
    }
    this._currentActionPair = bestPair;
    return bestPair;
  }

  render(sim, opts, leader) {
    const isNewStart = (sim && (this.lastGen !== sim.generation || (sim.time < 0.15 && (this.lastSimTime || 0) > 1.0)));
    if (isNewStart && sim) {
      this.lastGen = sim.generation;
      this._autoPreset = 'heli';
      this._lastPresetSwitchTime = performance.now();
      this._autoNextSwitch = performance.now() + 24000;
      this._lastActionPairTime = performance.now();
    }
    if (sim) this.lastSimTime = sim.time;
    this.updateGantryLights(sim);
    this.updateLapPlate(sim, leader);

    // 1. Compute Dynamic Race Positions (P.1, P.2, ...) for active fleet
    if (!this._rankedCars) this._rankedCars = [];
    this._rankedCars.length = 0;
    const rankedCars = this._rankedCars;

    if (sim && sim.cars) {
      for (let i = 0; i < sim.cars.length; i++) {
        const c = sim.cars[i];
        if (c && (c.alive || c.finished) && !c.crashed) {
          rankedCars.push(c);
        }
      }
    }
    if (sim && sim.player && (sim.player.alive || sim.player.finished) && !sim.player.crashed) {
      rankedCars.push(sim.player);
    }

    rankedCars.sort((a, b) => {
      // Finished cars permanently hold the top positions
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      if (a.finished && b.finished) {
        const tA = a.finishTime !== undefined && a.finishTime !== null ? a.finishTime : a.time;
        const tB = b.finishTime !== undefined && b.finishTime !== null ? b.finishTime : b.time;
        return tA - tB;
      }
      if (a.laps !== b.laps) return b.laps - a.laps;
      return b.totalIdx - a.totalIdx;
    });

    if (!this._carRankMap) this._carRankMap = new Map();
    this._carRankMap.clear();
    const carRankMap = this._carRankMap;
    for (let rank = 0; rank < rankedCars.length; rank++) {
      carRankMap.set(rankedCars[rank], rank + 1);
    }

    const focusCar = opts.manual && sim.player ? sim.player : leader;
    const hasFinisher = (sim.cars && sim.cars.some((c) => c.finished)) || (opts.manual && sim.player?.finished);
    let cameraPreset = opts.cameraPreset || 'auto';
    this.isAutoDirector = (opts.cameraPreset || 'auto') === 'auto';

    if (cameraPreset === 'auto') {
      const now = performance.now();
      if (!this._lastPresetSwitchTime) this._lastPresetSwitchTime = now;
      const canSwitchPreset = (now - this._lastPresetSwitchTime) >= 5000;
      const p1 = (opts.manual && sim.player && (sim.player.alive || sim.player.finished)) ? sim.player : (rankedCars[0] || leader || focusCar);

      // Check if P1 is approaching the Start/Finish line (2-3 seconds prior to crossing index 0)
      const t = this.track;
      let p1ApproachingGantry = false;

      // Don't trigger gantry during race start launch phase (when sim.time < 5.0s) so helicopter cam keeps priority
      const isStartPhase = Boolean(sim && sim.time !== undefined && sim.time < 5.0);

      if (p1 && t && t.N && t.spacing && (p1.alive || p1.finished) && !isStartPhase) {
        const p1Idx = ((p1.idx % t.N) + t.N) % t.N;
        // Distance remaining along track forward direction to index 0 (Start/Finish Line)
        const samplesToLine = (t.N - p1Idx) % t.N;
        const distToLine = samplesToLine * t.spacing;
        const p1Speed = p1.speed || 0;

        // Approaching line at speed (avoid stationary triggers at spawn or on cooldown)
        if (p1Speed > 15) {
          const timeToLine = distToLine / p1Speed; // seconds until crossing start/finish line
          // Trigger window: 2 to 3 seconds prior to crossing line (0.1s - 2.8s)
          if (timeToLine >= 0.1 && timeToLine <= 2.8) {
            p1ApproachingGantry = true;
          }
        }
      }

      // Check if this lap should trigger TV Gantry (avoid selecting on every lap end)
      // STRICT RULE: Cannot switch earlier than 5.0 seconds from last camera change!
      const p1Lap = p1 ? (p1.laps || 0) : 0;
      const maxLaps = CONFIG.generation?.maxLaps || 5;
      const isRaceFinish = p1 && (p1Lap >= maxLaps - 1 || p1.finished || hasFinisher);
      const lapDiff = typeof this._lastGantryCutLap === 'number' ? (p1Lap - this._lastGantryCutLap) : 99;
      const gantryCooldownPassed = !this._lastGantryCutTime || (now - this._lastGantryCutTime > 20000);

      // On race finish: high chance (85%) for dramatic checkered flag shot
      // On regular laps: only 30% chance AND requires at least 2 laps gap since last gantry cut
      if (p1ApproachingGantry && gantryCooldownPassed && this._autoPreset !== 'broadcast' && canSwitchPreset) {
        if (this._gantryRollLap !== p1Lap) {
          this._gantryRollLap = p1Lap;
          this._gantryRollPassed = isRaceFinish ? (Math.random() < 0.85) : (lapDiff >= 2 && Math.random() < 0.30);
        }

        if (this._gantryRollPassed) {
          this._autoPreset = 'broadcast';
          this._lastPresetSwitchTime = now;
          this._lastGantryCutTime = now;
          this._lastGantryCutLap = p1Lap;
          this._gantryEntryLap = p1Lap;
          this._gantryCrossedLineTime = null;
          this._autoNextSwitch = now + 10000; // Safety guard timeout
        }
      }

      // When TV Gantry camera is active: WAIT until P1 actually passes by the start line!
      if (this._autoPreset === 'broadcast') {
        const p1Lap = p1 ? (p1.laps || 0) : 0;
        const p1Idx = p1 && t && t.N ? (((p1.idx % t.N) + t.N) % t.N) : 0;
        const crossedLap = typeof this._gantryEntryLap === 'number' && p1Lap > this._gantryEntryLap;
        const pastStartLine = p1Idx >= 0 && p1Idx <= 45 && (now - (this._lastGantryCutTime || 0) > 600);
        const p1Finished = p1 ? p1.finished : false;

        // Detect the exact moment P1 crosses start/finish line
        if ((crossedLap || pastStartLine || p1Finished) && !this._gantryCrossedLineTime) {
          this._gantryCrossedLineTime = now;
        }

        // Wait until P1 has passed the line and ~1.2s has elapsed so we see the car flash under the gantry
        const postCrossElapsed = this._gantryCrossedLineTime && (now >= this._gantryCrossedLineTime + 1200);
        const safetyTimeout = now >= (this._lastGantryCutTime || 0) + 8000;
        const minHoldGantryPassed = (now - (this._lastGantryCutTime || 0)) >= 5000;

        if ((postCrossElapsed || safetyTimeout) && minHoldGantryPassed) {
          // Switch to pursuit/action camera
          const postGantryPool = [
            { preset: 'heli', weight: 40 },
            { preset: 'action_rear', weight: 35 },
            { preset: 'orbit', weight: 15 },
            { preset: 'chase', weight: 10 },
          ];
          let rnd = Math.random() * 100;
          let chosen = postGantryPool[0].preset;
          for (const item of postGantryPool) {
            if (rnd < item.weight) {
              chosen = item.preset;
              break;
            }
            rnd -= item.weight;
          }
          this._autoPreset = chosen;
          this._lastPresetSwitchTime = now;
          this._autoNextSwitch = now + 18000 + Math.random() * 6000;
          this._gantryCrossedLineTime = null;
          this._gantryEntryLap = null;
        }
      } else if (!this._autoPreset || !this._autoNextSwitch || now >= this._autoNextSwitch) {
        if (!canSwitchPreset) {
          // Strictly lock current camera preset: cannot change earlier than 5.0 seconds
        } else if (!this._autoPreset || isStartPhase) {
          this._autoPreset = 'heli';
          this._lastPresetSwitchTime = now;
          this._autoNextSwitch = now + 20000;
        } else {
          // General rotating pool (TV Gantry 'broadcast' is excluded so it ONLY triggers on 2-3s approach)
          const weightedPool = [
            { preset: 'heli', weight: 35 },        // Camera 6 (Helicopter) - Highly Prioritized
            { preset: 'orbit', weight: 25 },       // Camera 8 (Free Orbit) - Prioritized
            { preset: 'action_rear', weight: 25 }, // Camera 3 (Action Rear) - Prioritized
            { preset: 'chase', weight: 12 },       // Camera 1 (Chase Cam) - Standard
            { preset: 'action', weight: 12 },      // Camera 2 (Action Front) - Standard
            { preset: 'follow', weight: 12 },      // Camera 5 (Broadcast Follow) - Standard
            { preset: 'onboard', weight: 4 },      // Camera 4 (Onboard T-Cam) - Deprioritized
          ];

          const eligible = weightedPool.filter((item) => item.preset !== this._autoPreset);
          const totalWeight = eligible.reduce((sum, item) => sum + item.weight, 0);
          let rnd = Math.random() * totalWeight;
          let chosen = eligible[0]?.preset || 'heli';
          for (const item of eligible) {
            if (rnd < item.weight) {
              chosen = item.preset;
              break;
            }
            rnd -= item.weight;
          }
          this._autoPreset = chosen;
          this._lastPresetSwitchTime = now;

          // Dynamic shot duration per camera archetype (Relaxed TV broadcast pacing, minimum 5.0s strictly enforced)
          let duration;
          if (this._autoPreset === 'onboard') {
            duration = Math.max(5000, 7000 + Math.random() * 4000); // 7s - 11s (brief action teaser)
          } else if (this._autoPreset === 'orbit' || this._autoPreset === 'heli') {
            duration = Math.max(5000, 24000 + Math.random() * 10000); // 24s - 34s (sweeping panoramic)
          } else if (this._autoPreset === 'action_rear') {
            duration = Math.max(5000, 20000 + Math.random() * 8000); // 20s - 28s (intense battle)
          } else {
            duration = Math.max(5000, 18000 + Math.random() * 8000); // 18s - 26s (standard follow/action)
          }
          this._autoNextSwitch = now + duration;
        }
      }
      cameraPreset = this._autoPreset;
    }
    this.activeCameraPreset = cameraPreset;

    // Dynamic Action Tracker (Focus where the live battle and action is across the grid)
    const actionPair = this.findActionFocusPair(sim, rankedCars, focusCar, opts);
    const p1 = actionPair.carA || focusCar;
    const p2 = actionPair.carB;
    this.focusedCar = p1;

    const p1X = p1 ? p1.x : 0;
    const p1Y = p1 ? -p1.y : 0;
    const p1Angle = p1 ? p1.angle : 0;

    const p2Alive = p2 && (p2.alive || p2.finished);
    const p2X = p2Alive ? p2.x : (p1X - Math.cos(p1Angle) * 22.0);
    const p2Y = p2Alive ? -p2.y : (p1Y + Math.sin(p1Angle) * 22.0);

    const p1p2Dist = Math.hypot(p1X - p2X, p1Y - p2Y);
    // Effective span capped so huge gaps don't zoom out infinitely while maintaining comfortable framing
    const effectiveSpan = Math.min(105.0, Math.max(16.0, p1p2Dist));

    // Midpoint: weighted slightly towards P1 so P1 remains prominent while framing P2 cleanly
    const p1Bias = p1p2Dist > 70 ? Math.min(0.80, 0.54 + (p1p2Dist - 70) * 0.005) : 0.54;
    const midX = p1X * p1Bias + p2X * (1 - p1Bias);
    const midY = p1Y * p1Bias + p2Y * (1 - p1Bias);
    const battleElev = this.getTerrainHeight(midX, midY);

    // Smooth track corridor reference angle (never twitches on car steering or drifts)
    let refAngle = p1Angle;
    const t = this.track;
    if (t && t.tx && t.ty && t.N && p1 && p1.idx !== undefined) {
      const p1Idx = ((Math.floor(p1.idx) % t.N) + t.N) % t.N;
      if (typeof t.tx[p1Idx] === 'number' && typeof t.ty[p1Idx] === 'number') {
        refAngle = Math.atan2(-t.ty[p1Idx], t.tx[p1Idx]);
      }
    }

    // Destination camera pose & glide defaults computed by active preset
    let destCamX = this.camera.position.x;
    let destCamY = this.camera.position.y;
    let destCamZ = this.camera.position.z;
    let destTargetX = this.controls.target.x;
    let destTargetY = this.controls.target.y;
    let destTargetZ = this.controls.target.z;
    let targetFov = 42;
    let camGlide = 0.055;
    let targetGlide = 0.075;

    // 2. Camera View & Preset Positioning
    if (cameraPreset === 'orbit' || !opts.follow || !focusCar) {
      destTargetX = midX;
      destTargetY = midY;
      destTargetZ = 3.0 + battleElev;
      // High cinematic orbit perspective
      destCamX = midX + 115.0;
      destCamY = midY - 85.0;
      destCamZ = 48.0 + battleElev;
      targetFov = 42;
      camGlide = 0.05;
      targetGlide = 0.05;
    } else if (cameraPreset === 'action' && focusCar) {
      // ACTION FRONT CAM: Smooth reverse camera floating ahead, looking back at P1 and P2
      if (typeof this._actionAngle !== 'number' || this._lastActionFocus !== p1) {
        this._actionAngle = refAngle;
        this._actionTargetX = midX;
        this._actionTargetY = midY;
        this._lastActionFocus = p1;
      } else {
        let diffAngle = refAngle - this._actionAngle;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        // Ultra-smooth low-pass filter: does not jerk on individual steering wiggles
        this._actionAngle += diffAngle * 0.028;

        this._actionTargetX += (midX - this._actionTargetX) * 0.06;
        this._actionTargetY += (midY - this._actionTargetY) * 0.06;
      }

      const cosA = Math.cos(this._actionAngle);
      const sinA = Math.sin(this._actionAngle);
      const nx = -sinA;
      const ny = -cosA;

      // Distance ahead & altitude dynamically adapt so both P1 and chasing P2 stay safely in viewport
      const leadDist = 36.0 + Math.min(45.0, effectiveSpan * 0.48);
      destCamX = this._actionTargetX + cosA * leadDist + nx * 2.5;
      destCamY = this._actionTargetY - sinA * leadDist + ny * 2.5;
      destCamZ = 6.2 + Math.min(20.0, effectiveSpan * 0.24) + battleElev;

      // Look target is anchored on the battle midpoint: both cars are framed symmetrically
      destTargetX = midX;
      destTargetY = midY;
      destTargetZ = 1.8 + battleElev;

      // Adaptive wide FOV keeps both cars comfortably in frame
      targetFov = Math.max(46, Math.min(68, 46 + (effectiveSpan / 65) * 18));
      camGlide = 0.055;
      targetGlide = 0.075;
    } else if (cameraPreset === 'action_rear' && focusCar) {
      // ACTION REAR CAM: Smooth pursuit angle behind the battle, looking forward at P1 & P2
      if (typeof this._actionRearAngle !== 'number' || this._lastActionRearFocus !== p1) {
        this._actionRearAngle = refAngle;
        this._actionRearTargetX = midX;
        this._actionRearTargetY = midY;
        this._lastActionRearFocus = p1;
      } else {
        let diffAngle = refAngle - this._actionRearAngle;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        this._actionRearAngle += diffAngle * 0.028;

        this._actionRearTargetX += (midX - this._actionRearTargetX) * 0.06;
        this._actionRearTargetY += (midY - this._actionRearTargetY) * 0.06;
      }

      const cosA = Math.cos(this._actionRearAngle);
      const sinA = Math.sin(this._actionRearAngle);
      const nx = -sinA;
      const ny = -cosA;

      // Position camera BEHIND trailing car looking forward along the battle line
      const trailDist = 28.0 + Math.min(48.0, effectiveSpan * 0.50);
      destCamX = this._actionRearTargetX - cosA * trailDist + nx * 3.5;
      destCamY = this._actionRearTargetY + sinA * trailDist + ny * 3.5;
      destCamZ = 5.2 + Math.min(22.0, effectiveSpan * 0.25) + battleElev;

      // Look target centered on battle midpoint
      destTargetX = midX;
      destTargetY = midY;
      destTargetZ = 2.0 + battleElev;

      targetFov = Math.max(42, Math.min(68, 42 + (effectiveSpan / 65) * 18));
      camGlide = 0.055;
      targetGlide = 0.075;
    } else if (cameraPreset === 'follow' && focusCar) {
      // CLASSIC BROADCAST FOLLOW CAM: Smooth high-altitude TV tracking centered on P1 and P2
      destTargetX = midX;
      destTargetY = midY;
      destTargetZ = 3.5 + battleElev;

      const canonicalCamZ = 95.0 + Math.min(60.0, effectiveSpan * 0.45) + battleElev;
      destCamX = midX - 120.0;
      destCamY = midY + 65.0;
      destCamZ = canonicalCamZ;

      targetFov = Math.max(45, Math.min(62, 45 + (effectiveSpan / 75) * 14));
      camGlide = 0.055;
      targetGlide = 0.060;
    } else if (cameraPreset === 'onboard' && focusCar) {
      // ONBOARD T-CAM (Roll-hoop periscope camera elevated above cockpit & halo)
      const cosA = Math.cos(focusCar.angle);
      const sinA = Math.sin(focusCar.angle);
      const focusElev = this.getTerrainHeight(focusCar.x, -focusCar.y);

      destCamX = focusCar.x - cosA * 2.0;
      destCamY = -focusCar.y + sinA * 2.0;
      destCamZ = 5.8 + focusElev;

      destTargetX = focusCar.x + cosA * 52;
      destTargetY = -focusCar.y - sinA * 52;
      destTargetZ = 2.6 + focusElev;

      targetFov = 44;
      camGlide = 0.25;
      targetGlide = 0.25;
    } else if (cameraPreset === 'heli' && focusCar) {
      // CINEMATIC AERIAL PURSUIT HELICOPTER: Sweeping sky perspective framing P1 and P2
      if (typeof this._heliAngle !== 'number' || this._lastHeliFocus !== p1) {
        this._heliAngle = refAngle;
        this._heliTargetX = midX;
        this._heliTargetY = midY;
        this._lastHeliFocus = p1;
      } else {
        let diffAngle = refAngle - this._heliAngle;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        this._heliAngle += diffAngle * 0.022; // Very gentle gyro-stabilized aerial pan

        this._heliTargetX += (midX - this._heliTargetX) * 0.055;
        this._heliTargetY += (midY - this._heliTargetY) * 0.055;
      }

      const cosA = Math.cos(this._heliAngle);
      const sinA = Math.sin(this._heliAngle);
      const nx = -sinA;
      const ny = -cosA;

      const trailDist = 65.0 + Math.min(60.0, effectiveSpan * 0.45);
      const lateralDist = 38.0 + Math.min(26.0, effectiveSpan * 0.20);
      destCamX = this._heliTargetX - cosA * trailDist + nx * lateralDist;
      destCamY = this._heliTargetY + sinA * trailDist + ny * lateralDist;
      destCamZ = 68.0 + Math.min(55.0, effectiveSpan * 0.45) + battleElev;

      destTargetX = this._heliTargetX;
      destTargetY = this._heliTargetY;
      destTargetZ = 2.0 + battleElev;

      targetFov = Math.max(40, Math.min(62, 40 + (effectiveSpan / 70) * 16));
      camGlide = 0.045;
      targetGlide = 0.065;
    } else if (cameraPreset === 'broadcast') {
      // TV GANTRY CAMERA (Start / Finish Gantry view)
      const cx = t.cx[0];
      const cy = -t.cy[0];
      const tx = t.tx[0];
      const ty = -t.ty[0];
      const nx = -ty;
      const ny = tx;

      destCamX = cx + tx * 80 + nx * 28;
      destCamY = cy + ty * 80 + ny * 28;
      destCamZ = 10.5;

      const incoming = (focusCar && focusCar.alive) ? focusCar : (leader && leader.alive ? leader : null);
      destTargetX = incoming ? incoming.x : cx - tx * 35;
      destTargetY = incoming ? -incoming.y : cy - ty * 35;
      destTargetZ = 3.2;

      targetFov = 42;
      camGlide = 0.06;
      targetGlide = 0.09;
    } else {
      // DEFAULT: 'chase' preset (Dynamic Decoupled Smooth 3rd-person follow framing P1 & P2)
      if (hasFinisher && !opts.manual) {
        const cx = t.cx[0];
        const cy = -t.cy[0];
        const tx = t.tx[0];
        const ty = -t.ty[0];
        const nx = -ty;
        const ny = tx;

        destCamX = cx + tx * 80 + nx * 28;
        destCamY = cy + ty * 80 + ny * 28;
        destCamZ = 10.5;

        const incomingFinisher = leader && leader.alive ? leader : null;
        destTargetX = incomingFinisher ? incomingFinisher.x : cx - tx * 35;
        destTargetY = incomingFinisher ? -incomingFinisher.y : cy - ty * 35;
        destTargetZ = 3.2;

        targetFov = 42;
        camGlide = 0.05;
        targetGlide = 0.08;
      } else if (focusCar) {
        if (typeof this._chaseAngle !== 'number' || this._lastFocusCar !== p1) {
          this._chaseAngle = refAngle;
          this._chaseTargetX = midX;
          this._chaseTargetY = midY;
          this._lastFocusCar = p1;
        } else {
          const posFollowK = 0.06;
          this._chaseTargetX += (midX - this._chaseTargetX) * posFollowK;
          this._chaseTargetY += (midY - this._chaseTargetY) * posFollowK;

          let diffAngle = refAngle - this._chaseAngle;
          while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
          while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;

          this._chaseAngle += diffAngle * 0.025; // Smooth low-pass: ignores steering twitches
        }

        const cosA = Math.cos(this._chaseAngle);
        const sinA = Math.sin(this._chaseAngle);

        const distBehind = 38.0 + Math.min(48.0, effectiveSpan * 0.50);
        const heightAbove = 14.0 + Math.min(24.0, effectiveSpan * 0.30);
        destCamX = this._chaseTargetX - cosA * distBehind;
        destCamY = this._chaseTargetY + sinA * distBehind;
        destCamZ = heightAbove + battleElev;

        const lookAhead = 12.0;
        destTargetX = midX + cosA * lookAhead;
        destTargetY = midY - sinA * lookAhead;
        destTargetZ = 2.4 + battleElev;

        targetFov = Math.max(42, Math.min(65, 42 + (effectiveSpan / 70) * 16));
        camGlide = 0.055;
        targetGlide = 0.075;
      }
    }

    // -------------------------------------------------------------
    // FLAWLESS CINEMATIC CAMERA TRANSITION & MOTION ENGINE
    // Synchronizes camera position, target, FOV, and terrain elevation
    // with smooth quintic easing and a parabolic altitude arc.
    // -------------------------------------------------------------
    const now = performance.now();
    const isOrbitActive = (cameraPreset === 'orbit' || !opts.follow || !focusCar);

    if (this._lastActivePreset && cameraPreset !== this._lastActivePreset) {
      // Capture departing target and offset relative to target
      const startTarget = this.controls.target.clone();
      const startOffset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
      const startFov = this.camera.fov;

      const liveDestOffset = new THREE.Vector3(
        destCamX - destTargetX,
        destCamY - destTargetY,
        destCamZ - destTargetZ
      );

      // Polar / cylindrical coordinate parameters for a smooth circular orbital sweep around cars
      const r0 = Math.hypot(startOffset.x, startOffset.y);
      const r1 = Math.hypot(liveDestOffset.x, liveDestOffset.y);
      let phi0 = r0 > 0.5 ? Math.atan2(startOffset.y, startOffset.x) : 0;
      let phi1 = r1 > 0.5 ? Math.atan2(liveDestOffset.y, liveDestOffset.x) : phi0;
      if (r0 <= 0.5) phi0 = phi1;

      let diffPhi = phi1 - phi0;
      while (diffPhi > Math.PI) diffPhi -= Math.PI * 2;
      while (diffPhi < -Math.PI) diffPhi += Math.PI * 2;

      const z0 = startOffset.z;
      const z1 = liveDestOffset.z;

      // Generous, majestic 2.2s cinematic sweep
      const duration = 2200;
      const peakArcHeight = Math.min(14.0, Math.max(4.0, Math.abs(diffPhi) * 3.5));

      this._camTransition = {
        active: true,
        startTime: now,
        duration,
        startTarget,
        r0,
        r1,
        phi0,
        diffPhi,
        z0,
        z1,
        startFov,
        peakArcHeight,
      };
    }
    this._lastActivePreset = cameraPreset;

    if (this._camTransition && this._camTransition.active) {
      const elapsed = now - this._camTransition.startTime;
      const progress = Math.min(1.0, elapsed / this._camTransition.duration);

      // Quintic SmootherStep curve: s'(0)=0, s''(0)=0, s'(1)=0, s''(1)=0 (infinite smoothness)
      // s(t) = t^3 * (t * (6t - 15) + 10)
      const s = progress * progress * progress * (progress * (progress * 6 - 15) + 10);

      // 1. Look target: smoothly glides from startTarget to destTarget
      const curTargetX = this._camTransition.startTarget.x + (destTargetX - this._camTransition.startTarget.x) * s;
      const curTargetY = this._camTransition.startTarget.y + (destTargetY - this._camTransition.startTarget.y) * s;
      const curTargetZ = this._camTransition.startTarget.z + (destTargetZ - this._camTransition.startTarget.z) * s;

      // 2. Circular / cylindrical orbital sweep around target (constant radius arc, NEVER cuts through car!)
      const curPhi = this._camTransition.phi0 + this._camTransition.diffPhi * s;
      const curRadius = this._camTransition.r0 + (this._camTransition.r1 - this._camTransition.r0) * s;
      const arcZ = Math.sin(Math.PI * s) * this._camTransition.peakArcHeight;
      const curZOffset = this._camTransition.z0 + (this._camTransition.z1 - this._camTransition.z0) * s + arcZ;

      const curOffsetX = Math.cos(curPhi) * curRadius;
      const curOffsetY = Math.sin(curPhi) * curRadius;

      // 3. Final camera world coordinates
      const curX = curTargetX + curOffsetX;
      const curY = curTargetY + curOffsetY;
      let curZ = curTargetZ + curZOffset;

      // Strict terrain elevation guard: camera never clips through hills or mounds
      const groundElev = this.getTerrainHeight(curX, curY);
      if (curZ < groundElev + 3.0) {
        curZ = groundElev + 3.0;
      }

      const curFov = this._camTransition.startFov + (targetFov - this._camTransition.startFov) * s;

      this.camera.position.set(curX, curY, curZ);
      this.controls.target.set(curTargetX, curTargetY, curTargetZ);
      this.camera.fov = curFov;
      this.camera.updateProjectionMatrix();

      if (progress >= 1.0) {
        this._camTransition.active = false;
      }
    } else if (isOrbitActive) {
      // In steady-state orbit mode, OrbitControls auto-rotates around target
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.55;
      this.controls.target.x += (destTargetX - this.controls.target.x) * 0.05;
      this.controls.target.y += (destTargetY - this.controls.target.y) * 0.05;
      this.controls.target.z += (destTargetZ - this.controls.target.z) * 0.05;

      if (Math.abs(this.camera.fov - targetFov) > 0.1) {
        this.camera.fov += (targetFov - this.camera.fov) * 0.08;
        this.camera.updateProjectionMatrix();
      }
    } else {
      // Normal steady-state smooth tracking
      this.controls.autoRotate = false;
      this.camera.position.x += (destCamX - this.camera.position.x) * camGlide;
      this.camera.position.y += (destCamY - this.camera.position.y) * camGlide;
      this.camera.position.z += (destCamZ - this.camera.position.z) * camGlide;

      this.controls.target.x += (destTargetX - this.controls.target.x) * targetGlide;
      this.controls.target.y += (destTargetY - this.controls.target.y) * targetGlide;
      this.controls.target.z += (destTargetZ - this.controls.target.z) * targetGlide;

      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov += (targetFov - this.camera.fov) * 0.06;
        this.camera.updateProjectionMatrix();
      }
    }

    this.controls.update();
    if (this.skyMesh) {
      this.skyMesh.position.copy(this.camera.position);
    }

    // Identify Top 10 positions on track for selective billboard position badges
    const top10 = rankedCars.slice(0, 10);
    const visibleSet = new Set(top10);
    if (sim && sim.player && sim.player.alive) visibleSet.add(sim.player);
    if (focusCar && focusCar.alive) visibleSet.add(focusCar);

    // Update Simulation Fleet (All cars visible; P.x badges shown selectively for Top 10)
    for (let i = 0; i < this.carPool.length; i++) {
      const mesh = this.carPool[i];
      const car = sim.cars[i];
      const shouldShow = car && (car.alive || car.finished) && (opts.ghosts || car === leader || car.crashed || car.finished);
      if (shouldShow) {
        mesh.visible = true;

        const targetX = car.x;
        const targetY = -car.y;
        const targetAngle = -car.angle;

        const targetZ = (car.crashed && car.alive) ? this.getTerrainHeight(targetX, targetY) : 0;

        if (typeof mesh.userData.curX !== 'number' || Math.hypot(targetX - mesh.userData.curX, targetY - mesh.userData.curY) > 60) {
          mesh.userData.curX = targetX;
          mesh.userData.curY = targetY;
          mesh.userData.curZ = targetZ;
          mesh.userData.curAngle = targetAngle;
          mesh.userData.curPitch = 0;
          mesh.userData.curRoll = 0;
        } else {
          const kPos = 0.60;
          const kRot = 0.38;
          mesh.userData.curX += (targetX - mesh.userData.curX) * kPos;
          mesh.userData.curY += (targetY - mesh.userData.curY) * kPos;
          mesh.userData.curZ += (targetZ - mesh.userData.curZ) * kPos;

          let diff = targetAngle - mesh.userData.curAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          mesh.userData.curAngle += diff * kRot;

          // Terrain slope gradient & surface conformal rotation (only off-track hills have elevation)
          if (targetZ > 0.05) {
            const delta = 4.0;
            const cx = mesh.userData.curX;
            const cy = mesh.userData.curY;
            const hE = this.getTerrainHeight(cx + delta, cy);
            const hW = this.getTerrainHeight(cx - delta, cy);
            const hN = this.getTerrainHeight(cx, cy + delta);
            const hS = this.getTerrainHeight(cx, cy - delta);
            const dzdx = (hE - hW) / (2 * delta);
            const dzdy = (hN - hS) / (2 * delta);

            const yaw = mesh.userData.curAngle;
            const cosY = Math.cos(yaw);
            const sinY = Math.sin(yaw);
            const forwardSlope = dzdx * cosY + dzdy * sinY;
            const lateralSlope = -dzdx * sinY + dzdy * cosY;

            const targetPitch = -Math.atan(forwardSlope);
            const targetRoll = Math.atan(lateralSlope);

            if (typeof mesh.userData.curPitch !== 'number') {
              mesh.userData.curPitch = targetPitch;
              mesh.userData.curRoll = targetRoll;
            } else {
              mesh.userData.curPitch += (targetPitch - mesh.userData.curPitch) * 0.40;
              mesh.userData.curRoll += (targetRoll - mesh.userData.curRoll) * 0.40;
            }
          } else {
            // Track surface is 100% flat at Z=0; pitch and roll smoothly return to 0 with zero CPU overhead
            if (mesh.userData.curPitch !== 0 || mesh.userData.curRoll !== 0) {
              mesh.userData.curPitch = (mesh.userData.curPitch || 0) * 0.70;
              mesh.userData.curRoll = (mesh.userData.curRoll || 0) * 0.70;
              if (Math.abs(mesh.userData.curPitch) < 0.001) mesh.userData.curPitch = 0;
              if (Math.abs(mesh.userData.curRoll) < 0.001) mesh.userData.curRoll = 0;
            }
          }
        }

        mesh.position.set(mesh.userData.curX, mesh.userData.curY, mesh.userData.curZ);
        mesh.rotation.order = 'ZYX';
        mesh.rotation.set(mesh.userData.curRoll, mesh.userData.curPitch, mesh.userData.curAngle);

        // Selective P.x position badge: Only shown for Top 3 + 3 nearest chasers
        const rank = carRankMap.get(car);
        const badge = mesh.userData.badgeSprite;
        const showBadge = visibleSet.has(car) || car.crashed;
        if (badge) {
          if (car.crashed) {
            badge.visible = true;
            if (badge.material.map !== this.eliminatedTexture) {
              badge.material.map = this.eliminatedTexture;
            }
            badge.scale.set(8.2, 2.3, 1);
          } else if (showBadge && rank) {
            badge.visible = true;
            const tex = this.posTextures[rank] || this.posTextures[80];
            if (badge.material.map !== tex) {
              badge.material.map = tex;
            }
            badge.scale.set(2.3, 2.3, 1);
          } else {
            badge.visible = false;
          }
        }
      } else {
        mesh.visible = false;
        mesh.userData.curX = null;
      }
    }

    // Update Sensors / Rays on the leader
    if (leader && leader.alive && opts.sensors) {
      this.updateRays(leader);
    } else {
      this.rayGroup.visible = false;
    }

    // Update Player Car (Manual drive mode)
    if (sim.player && sim.player.alive) {
      this.playerCar.visible = true;
      const targetX = sim.player.x;
      const targetY = -sim.player.y;
      const targetZ = (sim.player.crashed) ? this.getTerrainHeight(targetX, targetY) : 0;
      const targetAngle = -sim.player.angle;

      if (typeof this.playerCar.userData.curX !== 'number' || Math.hypot(targetX - this.playerCar.userData.curX, targetY - this.playerCar.userData.curY) > 60) {
        this.playerCar.userData.curX = targetX;
        this.playerCar.userData.curY = targetY;
        this.playerCar.userData.curZ = targetZ;
        this.playerCar.userData.curAngle = targetAngle;
        this.playerCar.userData.curPitch = 0;
        this.playerCar.userData.curRoll = 0;
      } else {
        const kPos = 0.65;
        const kRot = 0.42;
        this.playerCar.userData.curX += (targetX - this.playerCar.userData.curX) * kPos;
        this.playerCar.userData.curY += (targetY - this.playerCar.userData.curY) * kPos;
        this.playerCar.userData.curZ += (targetZ - this.playerCar.userData.curZ) * kPos;

        let diff = targetAngle - this.playerCar.userData.curAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.playerCar.userData.curAngle += diff * kRot;

        // Terrain slope gradient & surface conformal rotation (only off-track hills have elevation)
        if (targetZ > 0.05) {
          const delta = 4.0;
          const cx = this.playerCar.userData.curX;
          const cy = this.playerCar.userData.curY;
          const hE = this.getTerrainHeight(cx + delta, cy);
          const hW = this.getTerrainHeight(cx - delta, cy);
          const hN = this.getTerrainHeight(cx, cy + delta);
          const hS = this.getTerrainHeight(cx, cy - delta);
          const dzdx = (hE - hW) / (2 * delta);
          const dzdy = (hN - hS) / (2 * delta);

          const yaw = this.playerCar.userData.curAngle;
          const cosY = Math.cos(yaw);
          const sinY = Math.sin(yaw);
          const forwardSlope = dzdx * cosY + dzdy * sinY;
          const lateralSlope = -dzdx * sinY + dzdy * cosY;

          const targetPitch = -Math.atan(forwardSlope);
          const targetRoll = Math.atan(lateralSlope);

          if (typeof this.playerCar.userData.curPitch !== 'number') {
            this.playerCar.userData.curPitch = targetPitch;
            this.playerCar.userData.curRoll = targetRoll;
          } else {
            this.playerCar.userData.curPitch += (targetPitch - this.playerCar.userData.curPitch) * 0.40;
            this.playerCar.userData.curRoll += (targetRoll - this.playerCar.userData.curRoll) * 0.40;
          }
        } else {
          if (this.playerCar.userData.curPitch !== 0 || this.playerCar.userData.curRoll !== 0) {
            this.playerCar.userData.curPitch = (this.playerCar.userData.curPitch || 0) * 0.70;
            this.playerCar.userData.curRoll = (this.playerCar.userData.curRoll || 0) * 0.70;
            if (Math.abs(this.playerCar.userData.curPitch) < 0.001) this.playerCar.userData.curPitch = 0;
            if (Math.abs(this.playerCar.userData.curRoll) < 0.001) this.playerCar.userData.curRoll = 0;
          }
        }
      }

      this.playerCar.position.set(this.playerCar.userData.curX, this.playerCar.userData.curY, this.playerCar.userData.curZ);
      this.playerCar.rotation.order = 'ZYX';
      this.playerCar.rotation.set(this.playerCar.userData.curRoll, this.playerCar.userData.curPitch, this.playerCar.userData.curAngle);

      // Update P.x position badge / ELIMINATED badge over player car
      const rank = carRankMap.get(sim.player);
      const badge = this.playerCar.userData.badgeSprite;
      const showBadge = visibleSet.has(sim.player) || sim.player.crashed;
      if (badge) {
        if (sim.player.crashed) {
          badge.visible = true;
          if (badge.material.map !== this.eliminatedTexture) {
            badge.material.map = this.eliminatedTexture;
          }
          badge.scale.set(8.2, 2.3, 1);
        } else if (showBadge && rank) {
          badge.visible = true;
          const tex = this.posTextures[rank] || this.posTextures[80];
          if (badge.material.map !== tex) {
            badge.material.map = tex;
          }
          badge.scale.set(2.3, 2.3, 1);
        } else {
          badge.visible = false;
        }
      }
    } else {
      this.playerCar.visible = false;
    }

    // Update Dynamic Tire Barrier Physics Transforms
    this.updateTireBarriers(sim);

    // Update Persistent Rubber Skid Marks
    this.updateSkidmarks(sim);

    // Update Death Bursts
    this.processDeathEvents(sim);
    this.updateBursts();

    // Update Tire Smoke Particles
    this.updateTireSmoke();

    // Animate shimmering water ripples
    if (this._waterNormalMap) {
      const tSec = performance.now() * 0.001;
      this._waterNormalMap.offset.x = (tSec * 0.022) % 1;
      this._waterNormalMap.offset.y = (tSec * 0.015) % 1;
    }

    this.renderer.render(this.scene, this.camera);
  }

  updateRays(car) {
    this.rayGroup.visible = true;
    const Lmax = CONFIG.sensors.length;
    const ox = car.x;
    const oy = -car.y;
    const oz = 4.2;

    for (let r = 0; r < RAY_ANGLES.length; r++) {
      const a = car.angle + RAY_ANGLES[r];
      const d = car.rayDist[r];
      const ex = ox + Math.cos(a) * d;
      const ey = oy - Math.sin(a) * d;
      const ez = 4.2;

      const line = this.rayLines[r];
      const pos = line.geometry.attributes.position.array;
      pos[0] = ox;
      pos[1] = oy;
      pos[2] = oz;
      pos[3] = ex;
      pos[4] = ey;
      pos[5] = ez;
      line.geometry.attributes.position.needsUpdate = true;

      // Dynamic color interpolation from green/cyan (far) to red (close obstacle)
      const frac = Math.min(1, Math.max(0, d / Lmax));
      const colAttr = line.geometry.attributes.color;
      if (colAttr) {
        const cArr = colAttr.array;
        // Origin: bright cyan-green
        cArr[0] = 0.1; cArr[1] = 0.95; cArr[2] = 0.7;
        // End point: red when near wall (frac=0), bright green/cyan when clear (frac=1)
        cArr[3] = 1.0 - frac * 0.8;
        cArr[4] = 0.2 + frac * 0.75;
        cArr[5] = 0.1 + frac * 0.4;
        colAttr.needsUpdate = true;
      }

      const hit = this.rayHits[r];
      if (d < Lmax) {
        hit.visible = true;
        hit.position.set(ex, ey, ez);
        if (hit.material) {
          // Glow red when danger/close, cyan/yellow when far
          hit.material.color.setRGB(1.0 - frac * 0.8, 0.2 + frac * 0.75, 0.1 + frac * 0.6);
        }
      } else {
        hit.visible = false;
      }
    }
  }
}
