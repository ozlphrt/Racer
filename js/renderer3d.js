import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { CONFIG } from './config.js';
import { RAY_ANGLES } from './car.js';
import { audio } from './audio.js';

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

const TRAIL_LEN = 120;

export class Renderer3D {
  constructor(canvas, track) {
    this.canvas = canvas;
    this.track = track;
    this.w = canvas.clientWidth || 800;
    this.h = canvas.clientHeight || 600;

    // 1. Three.js Scene, Camera, Renderer
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x1a3b5c);

    this.camera = new THREE.PerspectiveCamera(42, this.w / this.h, 5, 24000);
    this.camera.filmGauge = 35;
    this.camera.setFocalLength(32);
    this.camera.up.set(0, 0, 1); // Z is the vertical altitude axis in our world
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setSize(this.w, this.h, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

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
    this.setupTrack();
    this.setupCars();
    this.setupRays();
    this.setupTrees();
    this.setupBursts();
    this.setupSkidmarks();
    this.setupTireSmoke();
    this.setupTrail();

    this._rankedCars = [];
    this._carRankMap = new Map();

    this.resetCamera();
  }

  setupSky() {
    // 1. Procedural atmospheric daytime sky canvas (balanced, non-glaring)
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 1024;
    const ctx = canvas.getContext('2d');

    // Natural, realistic sky gradient from deep space zenith to rich horizon
    const grad = ctx.createLinearGradient(0, 0, 0, 1024);
    grad.addColorStop(0.00, '#0a1628'); // Deep space zenith
    grad.addColorStop(0.18, '#102d54'); // Dark royal blue
    grad.addColorStop(0.40, '#1a497b'); // Deep azure
    grad.addColorStop(0.62, '#2d659e'); // Natural sky blue
    grad.addColorStop(0.78, '#4f85ba'); // Soft horizon transition
    grad.addColorStop(0.88, '#6a97c4'); // Atmospheric horizon mist
    grad.addColorStop(0.94, '#3b5f48'); // Soft mountain/meadow horizon blend
    grad.addColorStop(1.00, '#1c361a'); // Terrain fade

    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 1024);

    // Soft procedural cirrus cloud bands
    ctx.fillStyle = 'rgba(215, 230, 245, 0.16)';
    for (let i = 0; i < 14; i++) {
      const cy = 200 + i * 36 + Math.sin(i * 1.8) * 14;
      const ch = 10 + (i % 4) * 7;
      ctx.beginPath();
      ctx.ellipse(256 + Math.cos(i) * 90, cy, 260, ch, 0, 0, Math.PI * 2);
      ctx.fill();
    }

    // Distant soft mountain silhouette along the horizon
    ctx.fillStyle = 'rgba(16, 32, 22, 0.55)';
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

    // Atmospheric Depth Fog for distant trees and terrain blending
    this.scene.fog = new THREE.Fog(0x3a6080, 2400, 9500);
  }

  setupLighting() {
    const hemiLight = new THREE.HemisphereLight(0x8cb8df, 0x1a2e18, 0.75);
    this.scene.add(hemiLight);

    this.dirLight = new THREE.DirectionalLight(0xfff5e8, 1.35);
    this.dirLight.castShadow = true;
    this.dirLight.shadow.mapSize.width = 4096;
    this.dirLight.shadow.mapSize.height = 4096;
    this.dirLight.shadow.camera.near = 50;
    this.dirLight.shadow.camera.far = 5000;
    this.dirLight.shadow.bias = -0.00008;
    this.dirLight.shadow.normalBias = 0.002;
    this.scene.add(this.dirLight);
    this.scene.add(this.dirLight.target);

    const ambLight = new THREE.AmbientLight(0x162216, 0.30);
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

    // High midday sun angle ensuring shadows anchor directly under each car's chassis & tires
    this.dirLight.position.set(cx + span * 0.25, cy - span * 0.35, 2400);
    this.dirLight.target.position.set(cx, cy, 0);

    const d = span * 1.15;
    this.dirLight.shadow.camera.left = -d;
    this.dirLight.shadow.camera.right = d;
    this.dirLight.shadow.camera.top = d;
    this.dirLight.shadow.camera.bottom = -d;
    this.dirLight.shadow.camera.updateProjectionMatrix();
  }

  setupTerrain() {
    // Seamless, non-tiled balanced green matte terrain
    const geo = new THREE.PlaneGeometry(24000, 24000);
    const mat = new THREE.MeshStandardMaterial({
      color: 0x244222,
      roughness: 0.92,
      metalness: 0.02,
    });

    const terrain = new THREE.Mesh(geo, mat);
    terrain.receiveShadow = true;
    terrain.position.z = 0;
    this.scene.add(terrain);
  }

  setTrack(track) {
    this.track = track;
    if (this.trackMesh) this.scene.remove(this.trackMesh);
    if (this.decorGroup) this.scene.remove(this.decorGroup);
    if (this.treeGroup) this.scene.remove(this.treeGroup);
    this.clearBursts();
    this.clearSkidmarks();
    this.clearTireSmoke();
    if (this.trailMesh) this.trailMesh.geometry.setDrawRange(0, 0);
    if (this.trailHistory) this.trailHistory.length = 0;
    this.trailOwner = null;
    this.updateLightPosition();
    this.setupTrack();
    this.setupTrees();
    this.resetCamera();
  }

  setupTrack() {
    const t = this.track;
    const N = t.N;

    // Track surface mesh flush at ground level
    const vertices = [];
    const indices = [];
    const uvs = [];

    for (let i = 0; i < N; i++) {
      // Outer point
      vertices.push(t.ox[i], -t.oy[i], 0.01);
      uvs.push(0, i / N * 20);
      // Inner point
      vertices.push(t.ix[i], -t.iy[i], 0.01);
      uvs.push(1, i / N * 20);

      const nxt = (i + 1) % N;
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = nxt * 2;
      const v3 = nxt * 2 + 1;

      indices.push(v0, v1, v2);
      indices.push(v1, v3, v2);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();

    const mat = new THREE.MeshStandardMaterial({
      color: C.asphalt,
      roughness: 0.85,
      metalness: 0.1,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });

    this.trackMesh = new THREE.Mesh(geo, mat);
    this.trackMesh.castShadow = false;
    this.trackMesh.receiveShadow = true;
    this.scene.add(this.trackMesh);

    // Decorative track lines & kerbs
    this.decorGroup = new THREE.Group();

    // Outer & Inner Solid White Boundary Line Mesh Ribbons (2.2px wide)
    const lineWidth = 2.2;
    const borderMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.35,
      metalness: 0.05,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
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
        t.ox[i], -t.oy[i], 0.025,
        t.ox[i] + onx * lineWidth, -t.oy[i] + ony * lineWidth, 0.025
      );
      outerBorderIndices.push(v0, v1, v2, v1, v3, v2);

      // 2. Inner track edge normal pointing outwards towards centerline
      const idx = t.cx[i] - t.ix[i];
      const idy = -t.cy[i] - (-t.iy[i]);
      const iDist = Math.hypot(idx, idy) || 1;
      const inx = idx / iDist;
      const iny = idy / iDist;

      innerBorderVerts.push(
        t.ix[i], -t.iy[i], 0.025,
        t.ix[i] + inx * lineWidth, -t.iy[i] + iny * lineWidth, 0.025
      );
      innerBorderIndices.push(v0, v1, v2, v1, v3, v2);
    }

    const outerBorderGeo = new THREE.BufferGeometry();
    outerBorderGeo.setAttribute('position', new THREE.Float32BufferAttribute(outerBorderVerts, 3));
    outerBorderGeo.setIndex(outerBorderIndices);
    outerBorderGeo.computeVertexNormals();
    const outerBorderMesh = new THREE.Mesh(outerBorderGeo, borderMat);
    outerBorderMesh.renderOrder = 4;
    this.decorGroup.add(outerBorderMesh);

    const innerBorderGeo = new THREE.BufferGeometry();
    innerBorderGeo.setAttribute('position', new THREE.Float32BufferAttribute(innerBorderVerts, 3));
    innerBorderGeo.setIndex(innerBorderIndices);
    innerBorderGeo.computeVertexNormals();
    const innerBorderMesh = new THREE.Mesh(innerBorderGeo, borderMat);
    innerBorderMesh.renderOrder = 4;
    this.decorGroup.add(innerBorderMesh);

    // 3. Centerline Solid Dashed Markings (Bold dashed quads)
    const centerDashVerts = [];
    const centerDashIndices = [];
    const dashHalfWidth = 0.8;
    const centerMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.4,
      metalness: 0.05,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
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
        t.cx[i] - nx1 * dashHalfWidth, -t.cy[i] - ny1 * dashHalfWidth, 0.022,
        t.cx[i] + nx1 * dashHalfWidth, -t.cy[i] + ny1 * dashHalfWidth, 0.022,
        t.cx[iEnd] - nx2 * dashHalfWidth, -t.cy[iEnd] - ny2 * dashHalfWidth, 0.022,
        t.cx[iEnd] + nx2 * dashHalfWidth, -t.cy[iEnd] + ny2 * dashHalfWidth, 0.022
      );
      centerDashIndices.push(v0, v1, v2, v1, v3, v2);
      dashIdx++;
    }

    const centerDashGeo = new THREE.BufferGeometry();
    centerDashGeo.setAttribute('position', new THREE.Float32BufferAttribute(centerDashVerts, 3));
    centerDashGeo.setIndex(centerDashIndices);
    centerDashGeo.computeVertexNormals();
    const centerDashMesh = new THREE.Mesh(centerDashGeo, centerMat);
    centerDashMesh.renderOrder = 3;
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

            const zTrk = 0.026;
            const zVrg0 = 0.026 + 0.012 * (w0 / maxKerbWidth);
            const zVrg1 = 0.026 + 0.012 * (w1 / maxKerbWidth);

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

          const zTrk = 0.026;
          const zVrg = 0.038;

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

            const zTrk = 0.026;
            const zVrg0 = 0.026 + 0.012 * (w0 / maxKerbWidth);
            const zVrg1 = 0.026 + 0.012 * (w1 / maxKerbWidth);

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
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      depthTest: true,
    });
    const kerbWhiteMat = new THREE.MeshStandardMaterial({
      color: C.kerbWhite,
      roughness: 0.55,
      metalness: 0.1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -3,
      polygonOffsetUnits: -3,
      depthTest: true,
    });

    if (redVerts.length) {
      kerbRedGeo.setAttribute('position', new THREE.Float32BufferAttribute(redVerts, 3));
      kerbRedGeo.computeVertexNormals();
      const redKerbMesh = new THREE.Mesh(kerbRedGeo, kerbRedMat);
      redKerbMesh.renderOrder = 8;
      this.decorGroup.add(redKerbMesh);
    }
    if (whiteVerts.length) {
      kerbWhiteGeo.setAttribute('position', new THREE.Float32BufferAttribute(whiteVerts, 3));
      kerbWhiteGeo.computeVertexNormals();
      const whiteKerbMesh = new THREE.Mesh(kerbWhiteGeo, kerbWhiteMat);
      whiteKerbMesh.renderOrder = 8;
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
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      depthTest: true,
    });
    const tarmacBand = new THREE.Mesh(bandGeo, bandMat);
    tarmacBand.renderOrder = 12;

    // Position flush on the tarmac surface
    tarmacBand.position.set((ix + ox) / 2, (iy + oy) / 2, 0.025);

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
      polygonOffsetFactor: -4,
      polygonOffsetUnits: -4,
      depthTest: true,
    });
    const startBar = new THREE.Mesh(barGeo, barMat);
    startBar.renderOrder = 14;
    startBar.position.set(
      (ix + ox) / 2 - tx * (bandLength + 4.0),
      (iy + oy) / 2 - ty * (bandLength + 4.0),
      0.026
    );
    startBar.rotation.z = roadAngle;
    this.decorGroup.add(startBar);

    // 3. Sleek 3D Overhead Gantry Arch with 5 F1 Starting Light Pods & Double-Sided LED Scoreboard
    const gantryGroup = new THREE.Group();
    const gantryHeight = 18.0; // Scaled for direct forward eye-level sightline as cars pass under
    const pillarRadius = 1.3;
    const pillarClearance = 7.5; // Margin outside road edge

    const innerPillarPos = new THREE.Vector3(ix - nx * pillarClearance, iy - ny * pillarClearance, gantryHeight / 2);
    const outerPillarPos = new THREE.Vector3(ox + nx * pillarClearance, oy + ny * pillarClearance, gantryHeight / 2);

    const pillarMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.85, roughness: 0.25 });
    const beamMat = new THREE.MeshStandardMaterial({ color: 0x0b1120, metalness: 0.9, roughness: 0.2 });

    // Left & Right Vertical Columns
    const cylGeo = new THREE.CylinderGeometry(pillarRadius, pillarRadius, gantryHeight, 16);
    cylGeo.rotateX(Math.PI / 2);

    const innerCol = new THREE.Mesh(cylGeo, pillarMat);
    innerCol.position.copy(innerPillarPos);
    innerCol.castShadow = true;
    gantryGroup.add(innerCol);

    const outerCol = new THREE.Mesh(cylGeo, pillarMat);
    outerCol.position.copy(outerPillarPos);
    outerCol.castShadow = true;
    gantryGroup.add(outerCol);

    // Overhead Horizontal Crossbeam
    const spanDist = innerPillarPos.distanceTo(outerPillarPos);
    const beamGeo = new THREE.BoxGeometry(spanDist + 3.5, 3.8, 3.0);
    const beam = new THREE.Mesh(beamGeo, beamMat);

    const gantryCenter = new THREE.Vector3().addVectors(innerPillarPos, outerPillarPos).multiplyScalar(0.5);
    gantryCenter.z = gantryHeight;
    beam.position.copy(gantryCenter);

    const beamAngle = Math.atan2(outerPillarPos.y - innerPillarPos.y, outerPillarPos.x - innerPillarPos.x);
    beam.rotation.z = beamAngle;
    beam.castShadow = true;
    gantryGroup.add(beam);

    // 4. Large Digital Overhead Scoreboard Housing (Mounted right on the crossbeam spanning the track)
    const plateWidth = Math.min(38.0, spanDist * 0.72);
    const plateHeight = 6.4;
    const plateDepth = 2.2;

    const plateHousingGeo = new THREE.BoxGeometry(plateWidth, plateDepth, plateHeight);
    const plateHousingMat = new THREE.MeshStandardMaterial({
      color: 0x030712,
      metalness: 0.92,
      roughness: 0.2,
    });
    const plateHousing = new THREE.Mesh(plateHousingGeo, plateHousingMat);
    plateHousing.position.copy(gantryCenter);
    plateHousing.rotation.z = beamAngle;
    plateHousing.castShadow = true;
    gantryGroup.add(plateHousing);

    // Carbon / Neon Trim Framing Border around the Scoreboard
    const trimMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.8,
      roughness: 0.3,
    });
    const topTrimGeo = new THREE.BoxGeometry(plateWidth + 0.6, plateDepth + 0.3, 0.4);
    const topTrim = new THREE.Mesh(topTrimGeo, trimMat);
    topTrim.position.set(0, 0, plateHeight * 0.5 + 0.2);
    plateHousing.add(topTrim);
    const btmTrim = new THREE.Mesh(topTrimGeo, trimMat);
    btmTrim.position.set(0, 0, -plateHeight * 0.5 - 0.2);
    plateHousing.add(btmTrim);

    // 5 F1 Starting Light Pods mounted under the crossbeam facing incoming cars
    this.gantryLedMats = [];
    this.gantryLeds = [];
    this._lastStartLightStep = -1;
    for (let i = -2; i <= 2; i++) {
      const housingGeo = new THREE.BoxGeometry(2.2, 1.6, 2.6);
      const housing = new THREE.Mesh(housingGeo, beamMat);
      const offset = new THREE.Vector3(
        Math.cos(beamAngle) * (i * 5.8),
        Math.sin(beamAngle) * (i * 5.8),
        -plateHeight * 0.5 - 1.4
      );
      housing.position.addVectors(gantryCenter, offset);
      housing.rotation.z = beamAngle;
      gantryGroup.add(housing);

      // LED bulb facing incoming cars
      const ledGeo = new THREE.SphereGeometry(0.75, 14, 14);
      const ledMat = new THREE.MeshStandardMaterial({
        color: 0xef4444,
        emissive: 0xef4444,
        emissiveIntensity: 3.2,
        roughness: 0.1,
      });
      const led = new THREE.Mesh(ledGeo, ledMat);
      led.position.addVectors(housing.position, new THREE.Vector3(-tx * 0.9, -ty * 0.9, 0));
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
    frontDisplayGeo.rotateY(Math.PI);
    const frontDisplay = new THREE.Mesh(frontDisplayGeo, displayMat);
    frontDisplay.position.copy(plateHousing.position);
    frontDisplay.position.add(new THREE.Vector3(-tx * (plateDepth * 0.5 + 0.06), -ty * (plateDepth * 0.5 + 0.06), 0));
    frontDisplay.rotation.z = beamAngle;
    gantryGroup.add(frontDisplay);

    // Back Display (Facing cars downstream)
    const backDisplayGeo = new THREE.PlaneGeometry(plateWidth - 0.6, plateHeight - 0.6);
    backDisplayGeo.rotateX(Math.PI / 2);
    const backDisplay = new THREE.Mesh(backDisplayGeo, displayMat);
    backDisplay.position.copy(plateHousing.position);
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
    const currentLeader = (sim?.player && (sim.player.alive || sim.player.finished)) ? sim.player : (sim?.leader || leader);
    const lapsDone = currentLeader ? (currentLeader.laps || 0) : 0;
    const currentLap = Math.min(lapsDone + 1, maxLaps);
    const lapsRemaining = Math.max(0, maxLaps - lapsDone);
    const isFinished = currentLeader ? currentLeader.finished : false;

    let mainText = `${lapsRemaining} ${lapsRemaining === 1 ? 'LAP' : 'LAPS'} TO GO`;
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
    } else if (isFinished) {
      mainText = 'CHEQUERED FLAG';
      subText = 'RACE FINISHED · WINNER P1';
      color = '#a3e635'; // Neon Lime Green
      isFinal = true;
    } else if (currentLap === maxLaps || lapsRemaining === 1) {
      mainText = '1 LAP TO GO';
      subText = 'FINAL LAP · LEADER ON LAST LAP';
      color = '#fbbf24'; // Radiant Gold
      isFinal = true;
    } else if (lapsRemaining === 2) {
      mainText = '2 LAPS TO GO';
      subText = `LAP ${currentLap} OF ${maxLaps} · RACE LEADER`;
      color = '#f472b6'; // Hot Pink / Magenta
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

    // 1. Classic Motorsport White Roundel Disc
    ctx.beginPath();
    ctx.arc(256, 256, 230, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
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

    // High quality translucent glass circular badge
    ctx.beginPath();
    ctx.arc(64, 64, 54, 0, Math.PI * 2);
    ctx.fillStyle = badgeBg;
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = borderColor;
    ctx.stroke();

    // Subtle inner accent ring
    ctx.beginPath();
    ctx.arc(64, 64, 47, 0, Math.PI * 2);
    ctx.lineWidth = 1.8;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.stroke();

    // Text: position number with extra bold font (clean number without P. prefix)
    const posStr = `${pos}`;
    const fontSize = posStr.length === 1 ? 58 : posStr.length === 2 ? 48 : 38;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `900 ${fontSize}px "Outfit", "JetBrains Mono", Impact, "Arial Black", sans-serif`;

    // Drop shadow
    ctx.shadowColor = 'rgba(0, 0, 0, 0.95)';
    ctx.shadowBlur = 8;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 2;

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
      opacity: 0.78, // Translucent: allows skidmarks and track details to show through clearly
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 999; // Render on top with alpha transparency after track and skidmarks
    sprite.scale.set(3.8, 3.8, 1);
    sprite.position.set(0, 0, 5.8);
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
        this.applyF1ModelToFleet(gltf.scene);
      },
      undefined,
      (err) => {
        console.warn('Could not load full 2022 F1 3D model, using procedural race car mesh:', err);
      }
    );
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
    const model = template.clone(true);

    // Scale and orient the 2022 F1 ground-effect car
    const s = 6.0;
    model.scale.set(s, s, s);
    // Orient: Yaw 180 deg around vertical axis so front points forward along +X, while roof stays upright (+Z)
    model.rotation.set(Math.PI / 2, Math.PI, 0);
    model.position.set(0.6, 0, 0);

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

        const isFrontWingMesh = child.name === 'Object_8';
        const isRearWingMesh = child.name === 'Object_10';

        const origMap = child.material?.map || this.f1Texture;
        const origRoughness = child.material?.roughness ?? 0.5;
        const origMetalness = child.material?.metalness ?? 0.0;

        const geo = child.geometry.clone();
        child.geometry = geo;

        const posAttr = geo.attributes.position;
        const count = posAttr.count;
        const liveryColorArr = new Float32Array(count * 3);
        const isBodyArr = new Float32Array(count);

        for (let i = 0; i < count; i++) {
          const x = posAttr.getX(i);
          const y = posAttr.getY(i);
          const z = posAttr.getZ(i);
          const absZ = Math.abs(z);

          // 1. TYRES / WHEELS (Must remain 100% exact as defined in original 3D model)
          const isFrontTire = absZ > 0.50 && Math.abs(x - 1.58) < 0.45 && y < 0.58;
          const isRearTire = absZ > 0.50 && Math.abs(x - (-1.48)) < 0.50 && y < 0.58;
          const isTire = isFrontTire || isRearTire || (absZ > 0.54 && y < 0.58);

          // 2. SIDE SPOILERS, FLOOR, BARGEBOARDS, DIFFUSER, & WING ENDPLATES (Must remain 100% exact as defined in original 3D model)
          const isSpoilerOrFloor = !isTire && (
            y < 0.13 || 
            (absZ > 0.46 && y < 0.26) || 
            (x < -0.95 && y < 0.22) ||
            (absZ > 0.48)
          );

          if (isTire || isSpoilerOrFloor) {
            // Non-body parts: render 100% identical to original 3D model texture and material
            isBodyArr[i] = 0.0;
            liveryColorArr[i * 3] = 1.0;
            liveryColorArr[i * 3 + 1] = 1.0;
            liveryColorArr[i * 3 + 2] = 1.0;
          } else {
            // Bodywork parts: apply multi-color team livery (matching leaderboard car sideview)
            isBodyArr[i] = 1.0;
            let c;
            if (isFrontWingMesh) {
              // Front Wing aerodynamic flap cascade -> Secondary team color
              c = cSec;
            } else if (isRearWingMesh) {
              // Rear Wing aerodynamic upper flap / DRS -> Accent team color
              c = cAcc;
            } else {
              // Main Bodywork (Object_6):
              if (x > 1.75) {
                // Nose Tip & Front Nose Cone -> Secondary Color (cSec)
                c = cSec;
              } else if (
                (x < -0.15 && x > -1.25 && y > 0.56 && absZ < 0.12) ||
                (x >= -0.25 && x <= 0.35 && y > 0.54 && absZ < 0.24)
              ) {
                // Halo Safety Ring & Shark Fin Aero Spine -> Accent Color (cAcc)
                c = cAcc;
              } else if (absZ >= 0.25 && absZ <= 0.46 && x >= -0.4 && x <= 0.65 && y >= 0.20 && y <= 0.38) {
                // Sculpted Sidepod Radiator Inlets & Flanks -> Quad Color (cQuad)
                c = cQuad;
              } else {
                // Main Chassis Monocoque, Cockpit Flanks & Engine Cover -> Primary Color (cPri)
                c = cPri;
              }
            }

            liveryColorArr[i * 3] = c.r;
            liveryColorArr[i * 3 + 1] = c.g;
            liveryColorArr[i * 3 + 2] = c.b;
          }
        }

        geo.setAttribute('liveryColor', new THREE.BufferAttribute(liveryColorArr, 3));
        geo.setAttribute('isBody', new THREE.BufferAttribute(isBodyArr, 1));

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
            varying vec3 vLiveryColor;
            varying float vIsBody;
            varying vec3 vModelPos;`
          );
          shader.vertexShader = shader.vertexShader.replace(
            '#include <begin_vertex>',
            `#include <begin_vertex>
            vLiveryColor = liveryColor;
            vIsBody = isBody;
            vModelPos = position;`
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <common>',
            `#include <common>
            uniform sampler2D decalTex;
            varying vec3 vLiveryColor;
            varying float vIsBody;
            varying vec3 vModelPos;`
          );
          shader.fragmentShader = shader.fragmentShader.replace(
            '#include <map_fragment>',
            `#ifdef USE_MAP
              vec4 texColor = texture2D( map, vMapUv );
              if (vIsBody > 0.5) {
                diffuseColor.rgb = vLiveryColor;
              } else {
                diffuseColor = texColor;
              }
            #else
              if (vIsBody > 0.5) {
                diffuseColor.rgb = vLiveryColor;
              }
            #endif

            // Surface Decal Wrapping directly onto the 3D bodywork curvature
            if (vIsBody > 0.5) {
              vec4 decal = vec4(0.0);

              // 1. Nose Cone Roundel (compact 1:1 circular disc facing forward/upwards):
              if (vModelPos.x >= 0.94 && vModelPos.x <= 1.18 && abs(vModelPos.z) <= 0.12 && vModelPos.y >= 0.32) {
                float uNose = clamp((vModelPos.z - (-0.12)) / 0.24, 0.0, 1.0);
                float vNose = clamp((1.18 - vModelPos.x) / 0.24, 0.0, 1.0);
                vec4 s = texture2D(decalTex, vec2(uNose, vNose));
                if (s.a > 0.05) decal = s;
              }
              // 2. Shark Fin Left side (compact 1:1 circular disc):
              else if (vModelPos.x >= -0.42 && vModelPos.x <= -0.24 && vModelPos.y >= 0.49 && vModelPos.y <= 0.67 && vModelPos.z >= 0.001) {
                float uFinL = clamp((-0.24 - vModelPos.x) / 0.18, 0.0, 1.0);
                float vFinL = clamp((vModelPos.y - 0.49) / 0.18, 0.0, 1.0);
                vec4 s = texture2D(decalTex, vec2(uFinL, vFinL));
                if (s.a > 0.05) decal = s;
              }
              // 3. Shark Fin Right side (compact 1:1 circular disc):
              else if (vModelPos.x >= -0.42 && vModelPos.x <= -0.24 && vModelPos.y >= 0.49 && vModelPos.y <= 0.67 && vModelPos.z <= -0.001) {
                float uFinR = clamp((vModelPos.x - (-0.42)) / 0.18, 0.0, 1.0);
                float vFinR = clamp((vModelPos.y - 0.49) / 0.18, 0.0, 1.0);
                vec4 s = texture2D(decalTex, vec2(uFinR, vFinR));
                if (s.a > 0.05) decal = s;
              }

              if (decal.a > 0.05) {
                diffuseColor.rgb = mix(diffuseColor.rgb, decal.rgb, decal.a);
              }
            }`
          );
        };

        child.material = mat;
      }
    });

    group.add(model);
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
    const minSafeDist = t.half + 40;
    const minSafeDistSq = minSafeDist * minSafeDist;

    // Deterministic PRNG based on track geometry
    let s = (Math.round(b.minX + b.minY + b.w * 13 + b.h * 17) & 0x7fffffff) || 48271;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const pad = 260;
    const minX = b.minX - pad;
    const maxX = b.maxX + pad;
    const minY = b.minY - pad;
    const maxY = b.maxY + pad;

    // 1. Organic cluster centers (groves) with diverse species biomes
    const numClusters = 10 + Math.floor(rand() * 6);
    const clusterCenters = [];
    for (let c = 0; c < numClusters; c++) {
      // Each grove has a dominant tree species archetype (0: Pine, 1: Oak, 2: Cypress, 3: Birch)
      const groveType = Math.floor(rand() * 4);
      clusterCenters.push({
        cx: minX + rand() * (maxX - minX),
        cy: minY + rand() * (maxY - minY),
        radius: 45 + rand() * 85,
        count: 3 + Math.floor(rand() * 5),
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

    // Standalone trees for sparse natural meadow scattering
    const standalone = 22 + Math.floor(rand() * 10);
    for (let i = 0; i < standalone; i++) {
      candidates.push({
        x: minX + rand() * (maxX - minX),
        y: minY + rand() * (maxY - minY),
        species: Math.floor(rand() * 4),
      });
    }

    const placedPines = [];
    const placedOaks = [];
    const placedCypresses = [];
    const placedBirches = [];

    const allPlaced = [];
    for (const cand of candidates) {
      const { x, y, species } = cand;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;

      const nearestIdx = t.nearestIndex(x, y, 0, t.N / 2, t.N / 2);
      if (t.lateralDistSq(x, y, nearestIdx) > minSafeDistSq) {
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
            const treeData = { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit };
            placedPines.push(treeData);
            allPlaced.push(treeData);
          } else if (species === 1) {
            // Broadleaf Oak: Lush leafy summer canopy
            hue = 0.28 + (rand() - 0.5) * 0.08;
            sat = 0.52 + rand() * 0.18;
            lit = 0.22 + rand() * 0.10;
            const treeData = { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit };
            placedOaks.push(treeData);
            allPlaced.push(treeData);
          } else if (species === 2) {
            // Columnar Cypress: Dusty Mediterranean olive & warm sage
            hue = 0.32 + (rand() - 0.5) * 0.05;
            sat = 0.42 + rand() * 0.15;
            lit = 0.19 + rand() * 0.07;
            const treeData = { x, y, r, yaw, leanX, leanY, heightMult: heightMult * 1.35, hue, sat, lit };
            placedCypresses.push(treeData);
            allPlaced.push(treeData);
          } else {
            // Birch / Blossom: Golden amber & autumn ochre leaves
            hue = 0.09 + rand() * 0.08;
            sat = 0.72 + rand() * 0.18;
            lit = 0.36 + rand() * 0.12;
            const treeData = { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit };
            placedBirches.push(treeData);
            allPlaced.push(treeData);
          }
        }
      }
    }

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const darkWoodMat = new THREE.MeshStandardMaterial({ color: 0x3d2314, roughness: 0.9, metalness: 0.05 });
    const paleWoodMat = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, roughness: 0.8, metalness: 0.1 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.78, flatShading: true });

    // === SPECIES 0: ALPINE PINE (3-Tier Layered Conifer) ===
    if (placedPines.length > 0) {
      const count = placedPines.length;
      const trunkGeo = new THREE.CylinderGeometry(0.5, 0.9, 1.0, 6);
      trunkGeo.rotateX(Math.PI / 2);
      const pineTrunkInst = new THREE.InstancedMesh(trunkGeo, darkWoodMat, count);

      const coneGeo = new THREE.ConeGeometry(1.0, 1.0, 7);
      coneGeo.rotateX(Math.PI / 2);
      const cone1Inst = new THREE.InstancedMesh(coneGeo, leafMat, count);
      const cone2Inst = new THREE.InstancedMesh(coneGeo, leafMat, count);
      const cone3Inst = new THREE.InstancedMesh(coneGeo, leafMat, count);

      for (let i = 0; i < count; i++) {
        const { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit } = placedPines[i];
        const trunkH = (r * 0.75 + 4) * heightMult;
        const trunkR = Math.max(1.0, r * 0.12);

        // Trunk
        dummy.position.set(x, -y, trunkH / 2);
        dummy.scale.set(trunkR, trunkR, trunkH);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        pineTrunkInst.setMatrixAt(i, dummy.matrix);

        // Tier 1 Cone (Base)
        const cone1H = r * 1.25 * heightMult;
        const cone1Z = trunkH * 0.5 + cone1H / 2;
        dummy.position.set(x, -y, cone1Z);
        dummy.scale.set(r * 1.05, r * 1.05, cone1H);
        dummy.updateMatrix();
        cone1Inst.setMatrixAt(i, dummy.matrix);

        // Tier 2 Cone (Mid)
        const cone2H = r * 1.05 * heightMult;
        const cone2Z = cone1Z + cone1H * 0.38;
        const cone2R = r * 0.75;
        dummy.position.set(x, -y, cone2Z);
        dummy.scale.set(cone2R, cone2R, cone2H);
        dummy.updateMatrix();
        cone2Inst.setMatrixAt(i, dummy.matrix);

        // Tier 3 Cone (Top Crown)
        const cone3H = r * 0.85 * heightMult;
        const cone3Z = cone2Z + cone2H * 0.38;
        const cone3R = r * 0.48;
        dummy.position.set(x, -y, cone3Z);
        dummy.scale.set(cone3R, cone3R, cone3H);
        dummy.updateMatrix();
        cone3Inst.setMatrixAt(i, dummy.matrix);

        color.setHSL(hue, sat, lit);
        cone1Inst.setColorAt(i, color);
        color.setHSL(hue, sat, Math.min(0.9, lit * 1.12));
        cone2Inst.setColorAt(i, color);
        color.setHSL(hue, sat, Math.min(0.9, lit * 1.25));
        cone3Inst.setColorAt(i, color);
      }

      pineTrunkInst.instanceMatrix.needsUpdate = true;
      cone1Inst.instanceMatrix.needsUpdate = true;
      cone2Inst.instanceMatrix.needsUpdate = true;
      cone3Inst.instanceMatrix.needsUpdate = true;
      if (cone1Inst.instanceColor) cone1Inst.instanceColor.needsUpdate = true;
      if (cone2Inst.instanceColor) cone2Inst.instanceColor.needsUpdate = true;
      if (cone3Inst.instanceColor) cone3Inst.instanceColor.needsUpdate = true;
      pineTrunkInst.castShadow = true; pineTrunkInst.receiveShadow = true;
      cone1Inst.castShadow = true; cone1Inst.receiveShadow = true;
      cone2Inst.castShadow = true; cone2Inst.receiveShadow = true;
      cone3Inst.castShadow = true; cone3Inst.receiveShadow = true;

      this.treeGroup.add(pineTrunkInst, cone1Inst, cone2Inst, cone3Inst);
    }

    // === SPECIES 1: BROADLEAF OAK (Multi-Cluster Rounded Crown) ===
    if (placedOaks.length > 0) {
      const count = placedOaks.length;
      const trunkGeo = new THREE.CylinderGeometry(0.7, 1.3, 1.0, 7);
      trunkGeo.rotateX(Math.PI / 2);
      const oakTrunkInst = new THREE.InstancedMesh(trunkGeo, darkWoodMat, count);

      const crownGeo = new THREE.DodecahedronGeometry(1.0, 1);
      crownGeo.rotateX(Math.PI / 2);
      const oakMainInst = new THREE.InstancedMesh(crownGeo, leafMat, count);
      const oakLeftInst = new THREE.InstancedMesh(crownGeo, leafMat, count);
      const oakRightInst = new THREE.InstancedMesh(crownGeo, leafMat, count);

      for (let i = 0; i < count; i++) {
        const { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit } = placedOaks[i];
        const trunkH = (r * 0.65 + 3.5) * heightMult;
        const trunkR = Math.max(1.3, r * 0.16);

        // Trunk
        dummy.position.set(x, -y, trunkH / 2);
        dummy.scale.set(trunkR, trunkR, trunkH);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        oakTrunkInst.setMatrixAt(i, dummy.matrix);

        // Center Dominant Canopy Dome
        const crownR = r * 0.95;
        const crownZ = trunkH + crownR * 0.6;
        dummy.position.set(x, -y, crownZ);
        dummy.scale.set(crownR, crownR * 0.95, crownR * 0.85);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        oakMainInst.setMatrixAt(i, dummy.matrix);

        // Asymmetric Left Cluster
        const cLeftR = r * 0.68;
        const offX = Math.cos(yaw) * (r * 0.45);
        const offY = Math.sin(yaw) * (r * 0.45);
        dummy.position.set(x + offX, -y - offY, crownZ - crownR * 0.15);
        dummy.scale.set(cLeftR, cLeftR, cLeftR * 0.8);
        dummy.rotation.set(leanX, leanY, yaw + 1.2);
        dummy.updateMatrix();
        oakLeftInst.setMatrixAt(i, dummy.matrix);

        // Asymmetric Right Cluster
        const cRightR = r * 0.62;
        const offX2 = Math.cos(yaw + 2.2) * (r * 0.42);
        const offY2 = Math.sin(yaw + 2.2) * (r * 0.42);
        dummy.position.set(x + offX2, -y - offY2, crownZ - crownR * 0.10);
        dummy.scale.set(cRightR, cRightR, cRightR * 0.82);
        dummy.rotation.set(leanX, leanY, yaw - 1.4);
        dummy.updateMatrix();
        oakRightInst.setMatrixAt(i, dummy.matrix);

        color.setHSL(hue, sat, lit);
        oakMainInst.setColorAt(i, color);
        color.setHSL(hue + 0.02, sat, Math.min(0.9, lit * 0.92));
        oakLeftInst.setColorAt(i, color);
        color.setHSL(hue - 0.02, sat, Math.min(0.9, lit * 1.15));
        oakRightInst.setColorAt(i, color);
      }

      oakTrunkInst.instanceMatrix.needsUpdate = true;
      oakMainInst.instanceMatrix.needsUpdate = true;
      oakLeftInst.instanceMatrix.needsUpdate = true;
      oakRightInst.instanceMatrix.needsUpdate = true;
      if (oakMainInst.instanceColor) oakMainInst.instanceColor.needsUpdate = true;
      if (oakLeftInst.instanceColor) oakLeftInst.instanceColor.needsUpdate = true;
      if (oakRightInst.instanceColor) oakRightInst.instanceColor.needsUpdate = true;
      oakTrunkInst.castShadow = true; oakTrunkInst.receiveShadow = true;
      oakMainInst.castShadow = true; oakMainInst.receiveShadow = true;
      oakLeftInst.castShadow = true; oakLeftInst.receiveShadow = true;
      oakRightInst.castShadow = true; oakRightInst.receiveShadow = true;

      this.treeGroup.add(oakTrunkInst, oakMainInst, oakLeftInst, oakRightInst);
    }

    // === SPECIES 2: MEDITERRANEAN CYPRESS (Tall Columnar Silhouette) ===
    if (placedCypresses.length > 0) {
      const count = placedCypresses.length;
      const trunkGeo = new THREE.CylinderGeometry(0.45, 0.65, 1.0, 6);
      trunkGeo.rotateX(Math.PI / 2);
      const cypTrunkInst = new THREE.InstancedMesh(trunkGeo, darkWoodMat, count);

      const colGeo = new THREE.CylinderGeometry(0.35, 0.95, 1.0, 8);
      colGeo.rotateX(Math.PI / 2);
      const cypBodyInst = new THREE.InstancedMesh(colGeo, leafMat, count);

      const topGeo = new THREE.ConeGeometry(0.85, 1.0, 8);
      topGeo.rotateX(Math.PI / 2);
      const cypTopInst = new THREE.InstancedMesh(topGeo, leafMat, count);

      for (let i = 0; i < count; i++) {
        const { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit } = placedCypresses[i];
        const trunkH = (r * 0.4 + 2.5) * heightMult;
        const trunkR = Math.max(0.9, r * 0.08);

        // Trunk
        dummy.position.set(x, -y, trunkH / 2);
        dummy.scale.set(trunkR, trunkR, trunkH);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        cypTrunkInst.setMatrixAt(i, dummy.matrix);

        // Columnar Foliage Body
        const cypR = r * 0.55;
        const bodyH = r * 2.2 * heightMult;
        const bodyZ = trunkH + bodyH / 2;
        dummy.position.set(x, -y, bodyZ);
        dummy.scale.set(cypR, cypR, bodyH);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        cypBodyInst.setMatrixAt(i, dummy.matrix);

        // Pointed Crown Tip
        const topH = r * 1.0 * heightMult;
        const topZ = trunkH + bodyH + topH / 2;
        dummy.position.set(x, -y, topZ);
        dummy.scale.set(cypR * 0.85, cypR * 0.85, topH);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        cypTopInst.setMatrixAt(i, dummy.matrix);

        color.setHSL(hue, sat, lit);
        cypBodyInst.setColorAt(i, color);
        color.setHSL(hue, sat, Math.min(0.9, lit * 1.2));
        cypTopInst.setColorAt(i, color);
      }

      cypTrunkInst.instanceMatrix.needsUpdate = true;
      cypBodyInst.instanceMatrix.needsUpdate = true;
      cypTopInst.instanceMatrix.needsUpdate = true;
      if (cypBodyInst.instanceColor) cypBodyInst.instanceColor.needsUpdate = true;
      if (cypTopInst.instanceColor) cypTopInst.instanceColor.needsUpdate = true;
      cypTrunkInst.castShadow = true; cypTrunkInst.receiveShadow = true;
      cypBodyInst.castShadow = true; cypBodyInst.receiveShadow = true;
      cypTopInst.castShadow = true; cypTopInst.receiveShadow = true;

      this.treeGroup.add(cypTrunkInst, cypBodyInst, cypTopInst);
    }

    // === SPECIES 3: GOLDEN AUTUMN BIRCH (Pale Trunk + Fluffy Amber Canopy) ===
    if (placedBirches.length > 0) {
      const count = placedBirches.length;
      const trunkGeo = new THREE.CylinderGeometry(0.45, 0.75, 1.0, 6);
      trunkGeo.rotateX(Math.PI / 2);
      const birchTrunkInst = new THREE.InstancedMesh(trunkGeo, paleWoodMat, count);

      const crownGeo = new THREE.DodecahedronGeometry(1.0, 1);
      crownGeo.rotateX(Math.PI / 2);
      const birchCrown1Inst = new THREE.InstancedMesh(crownGeo, leafMat, count);
      const birchCrown2Inst = new THREE.InstancedMesh(crownGeo, leafMat, count);

      for (let i = 0; i < count; i++) {
        const { x, y, r, yaw, leanX, leanY, heightMult, hue, sat, lit } = placedBirches[i];
        const trunkH = (r * 0.85 + 4) * heightMult;
        const trunkR = Math.max(0.9, r * 0.11);

        // Trunk
        dummy.position.set(x, -y, trunkH / 2);
        dummy.scale.set(trunkR, trunkR, trunkH);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        birchTrunkInst.setMatrixAt(i, dummy.matrix);

        // Lower Fluffy Amber Crown
        const c1R = r * 0.85;
        const c1Z = trunkH * 0.75 + c1R * 0.6;
        dummy.position.set(x, -y, c1Z);
        dummy.scale.set(c1R, c1R, c1R * 0.9);
        dummy.rotation.set(leanX, leanY, yaw);
        dummy.updateMatrix();
        birchCrown1Inst.setMatrixAt(i, dummy.matrix);

        // Upper Golden Crown
        const c2R = r * 0.62;
        const c2Z = c1Z + c1R * 0.55;
        dummy.position.set(x, -y, c2Z);
        dummy.scale.set(c2R, c2R, c2R * 0.95);
        dummy.rotation.set(leanX, leanY, yaw + 0.8);
        dummy.updateMatrix();
        birchCrown2Inst.setMatrixAt(i, dummy.matrix);

        color.setHSL(hue, sat, lit);
        birchCrown1Inst.setColorAt(i, color);
        color.setHSL(hue + 0.02, sat, Math.min(0.9, lit * 1.15));
        birchCrown2Inst.setColorAt(i, color);
      }

      birchTrunkInst.instanceMatrix.needsUpdate = true;
      birchCrown1Inst.instanceMatrix.needsUpdate = true;
      birchCrown2Inst.instanceMatrix.needsUpdate = true;
      if (birchCrown1Inst.instanceColor) birchCrown1Inst.instanceColor.needsUpdate = true;
      if (birchCrown2Inst.instanceColor) birchCrown2Inst.instanceColor.needsUpdate = true;
      birchTrunkInst.castShadow = true; birchTrunkInst.receiveShadow = true;
      birchCrown1Inst.castShadow = true; birchCrown1Inst.receiveShadow = true;
      birchCrown2Inst.castShadow = true; birchCrown2Inst.receiveShadow = true;

      this.treeGroup.add(birchTrunkInst, birchCrown1Inst, birchCrown2Inst);
    }

    this.scene.add(this.treeGroup);
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

  setupTireSmoke() {
    this.maxSmokeQuads = 1200;
    this.smokeQuads = [];
    const maxVerts = this.maxSmokeQuads * 4;
    const maxIndices = this.maxSmokeQuads * 6;

    this.smokePosArr = new Float32Array(maxVerts * 3);
    this.smokeAlphaArr = new Float32Array(maxVerts);
    this.smokeUvArr = new Float32Array(maxVerts * 2);
    const indices = new Uint32Array(maxIndices);

    for (let i = 0; i < this.maxSmokeQuads; i++) {
      const v0 = i * 4;
      const i0 = i * 6;
      indices[i0] = v0;
      indices[i0 + 1] = v0 + 1;
      indices[i0 + 2] = v0 + 2;
      indices[i0 + 3] = v0 + 2;
      indices[i0 + 4] = v0 + 1;
      indices[i0 + 5] = v0 + 3;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.smokePosArr, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.smokeAlphaArr, 1));
    geo.setAttribute('uv', new THREE.BufferAttribute(this.smokeUvArr, 2));
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

      float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
      }

      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        vec2 u = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i + vec2(0.0, 0.0)), hash(i + vec2(1.0, 0.0)), u.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), u.x), u.y);
      }

      float fbm(vec2 p) {
        float v = 0.0;
        v += 0.55 * noise(p); p = p * 2.1;
        v += 0.30 * noise(p); p = p * 2.2;
        v += 0.15 * noise(p);
        return v;
      }

      void main() {
        // Continuous soft Gaussian edge falloff across ribbon width (u in [0, 1])
        float uDist = abs(vUv.x - 0.5) * 2.0;
        float softEdge = exp(-uDist * uDist * 4.2);

        // Continuous streaming longitudinal wisps
        float turb = fbm(vec2(vUv.x * 3.0, vUv.y * 10.0));

        // Translucent motorsport white-grey tire friction vapor
        vec3 smokeColor = vec3(0.92, 0.94, 0.96);
        float alpha = softEdge * vAlpha * (0.60 + 0.40 * turb) * 0.40;

        gl_FragColor = vec4(smokeColor, alpha);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      vertexShader: vertShader,
      fragmentShader: fragShader,
      transparent: true,
      depthWrite: false,
      blending: THREE.NormalBlending,
      side: THREE.DoubleSide,
    });

    this.smokeMesh = new THREE.Mesh(geo, mat);
    this.smokeMesh.frustumCulled = false;
    this.smokeMesh.renderOrder = 450;
    this.scene.add(this.smokeMesh);
  }

  clearTireSmoke() {
    this.smokeQuads = [];
    if (this.smokeMesh) this.smokeMesh.geometry.setDrawRange(0, 0);
  }

  addTireSmokeQuad(p0x, p0y, p1x, p1y, nx, ny, intensity) {
    if (this.smokeQuads.length >= this.maxSmokeQuads) {
      this.smokeQuads.shift();
    }
    this.smokeQuads.push({
      p0x, p0y,
      p1x, p1y,
      nx, ny,
      w0: 1.0,
      w1: 1.0,
      z0: 0.12,
      z1: 0.12,
      alpha: Math.min(0.70, intensity * 0.65),
      life: 1.0,
      decay: 1.45 + Math.random() * 0.35,
      growthRate: 3.0,
      riseRate: 0.55,
    });
  }

  updateTireSmoke() {
    if (!this.smokeQuads || this.smokeQuads.length === 0) {
      if (this.smokeMesh) this.smokeMesh.geometry.setDrawRange(0, 0);
      return;
    }

    const dt = 1 / 60;
    let writeIdx = 0;

    for (let i = this.smokeQuads.length - 1; i >= 0; i--) {
      const q = this.smokeQuads[i];
      q.life -= q.decay * dt;
      if (q.life <= 0) {
        this.smokeQuads.splice(i, 1);
        continue;
      }

      // Continuous ribbon expands in width and lifts gently as it dissipates
      q.w0 += q.growthRate * dt;
      q.w1 += q.growthRate * dt;
      q.z0 += q.riseRate * dt;
      q.z1 += q.riseRate * dt;

      const vOffset = writeIdx * 4;
      const a = q.alpha * Math.pow(q.life, 1.25);

      // v0: previous left
      this.smokePosArr[vOffset * 3] = q.p0x - q.nx * q.w0;
      this.smokePosArr[vOffset * 3 + 1] = q.p0y - q.ny * q.w0;
      this.smokePosArr[vOffset * 3 + 2] = q.z0;
      this.smokeAlphaArr[vOffset] = a;
      this.smokeUvArr[vOffset * 2] = 0.0;
      this.smokeUvArr[vOffset * 2 + 1] = 0.0;

      // v1: previous right
      this.smokePosArr[(vOffset + 1) * 3] = q.p0x + q.nx * q.w0;
      this.smokePosArr[(vOffset + 1) * 3 + 1] = q.p0y + q.ny * q.w0;
      this.smokePosArr[(vOffset + 1) * 3 + 2] = q.z0;
      this.smokeAlphaArr[vOffset + 1] = a;
      this.smokeUvArr[(vOffset + 1) * 2] = 1.0;
      this.smokeUvArr[(vOffset + 1) * 2 + 1] = 0.0;

      // v2: current left
      this.smokePosArr[(vOffset + 2) * 3] = q.p1x - q.nx * q.w1;
      this.smokePosArr[(vOffset + 2) * 3 + 1] = q.p1y - q.ny * q.w1;
      this.smokePosArr[(vOffset + 2) * 3 + 2] = q.z1;
      this.smokeAlphaArr[vOffset + 2] = a;
      this.smokeUvArr[(vOffset + 2) * 2] = 0.0;
      this.smokeUvArr[(vOffset + 2) * 2 + 1] = 1.0;

      // v3: current right
      this.smokePosArr[(vOffset + 3) * 3] = q.p1x + q.nx * q.w1;
      this.smokePosArr[(vOffset + 3) * 3 + 1] = q.p1y + q.ny * q.w1;
      this.smokePosArr[(vOffset + 3) * 3 + 2] = q.z1;
      this.smokeAlphaArr[vOffset + 3] = a;
      this.smokeUvArr[(vOffset + 3) * 2] = 1.0;
      this.smokeUvArr[(vOffset + 3) * 2 + 1] = 1.0;

      writeIdx++;
    }

    this.smokeMesh.geometry.attributes.position.needsUpdate = true;
    this.smokeMesh.geometry.attributes.alpha.needsUpdate = true;
    this.smokeMesh.geometry.attributes.uv.needsUpdate = true;
    this.smokeMesh.geometry.setDrawRange(0, writeIdx * 6);
  }

  setupSkidmarks() {
    this.maxSkidQuads = 40000;
    const maxVerts = this.maxSkidQuads * 4;
    const maxIndices = this.maxSkidQuads * 6;

    this.skidPosArr = new Float32Array(maxVerts * 3);
    this.skidAlphaArr = new Float32Array(maxVerts);
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
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.skidPosArr, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.skidAlphaArr, 1));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    geo.setDrawRange(0, 0);

    const vertShader = `
      attribute float alpha;
      varying float vAlpha;
      void main() {
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const fragShader = `
      varying float vAlpha;
      void main() {
        vec3 rubber = vec3(0.06, 0.07, 0.09);
        gl_FragColor = vec4(rubber, vAlpha * 0.72);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      vertexShader: vertShader,
      fragmentShader: fragShader,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -1.5,
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

  addSkidQuad(v0x, v0y, v1x, v1y, v2x, v2y, v3x, v3y, alpha) {
    const quadIdx = this.skidHead;
    const vOffset = quadIdx * 4;
    const z = 0.02;

    // v0
    this.skidPosArr[vOffset * 3] = v0x;
    this.skidPosArr[vOffset * 3 + 1] = v0y;
    this.skidPosArr[vOffset * 3 + 2] = z;
    this.skidAlphaArr[vOffset] = alpha;

    // v1
    this.skidPosArr[(vOffset + 1) * 3] = v1x;
    this.skidPosArr[(vOffset + 1) * 3 + 1] = v1y;
    this.skidPosArr[(vOffset + 1) * 3 + 2] = z;
    this.skidAlphaArr[vOffset + 1] = alpha;

    // v2
    this.skidPosArr[(vOffset + 2) * 3] = v2x;
    this.skidPosArr[(vOffset + 2) * 3 + 1] = v2y;
    this.skidPosArr[(vOffset + 2) * 3 + 2] = z;
    this.skidAlphaArr[vOffset + 2] = alpha;

    // v3
    this.skidPosArr[(vOffset + 3) * 3] = v3x;
    this.skidPosArr[(vOffset + 3) * 3 + 1] = v3y;
    this.skidPosArr[(vOffset + 3) * 3 + 2] = z;
    this.skidAlphaArr[vOffset + 3] = alpha;

    this.skidHead = (this.skidHead + 1) % this.maxSkidQuads;
    if (this.skidCount < this.maxSkidQuads) this.skidCount++;
  }

  updateSkidmarks(sim) {
    if (!sim || !sim.cars) return;
    const candidateCars = sim.player && sim.player.alive ? [sim.player, ...sim.cars] : sim.cars;
    let added = false;

    for (let i = 0; i < candidateCars.length; i++) {
      const car = candidateCars[i];
      if (!car || !car.alive || car.finished) {
        if (this.carPrevTires.has(car)) this.carPrevTires.delete(car);
        continue;
      }

      // Detect skid conditions: heavy braking, understeer, oversteer, or crashing slide
      const isHeavyBraking = car.throttle < -0.32 && car.speed > 60;
      const isSlip = Math.abs(car.slipAngle || 0) > 0.12 && car.speed > 55;
      const isCrashSlide = car.crashed && car.speed > 20;

      if (isHeavyBraking || isSlip || isCrashSlide) {
        const slipInt = Math.max(0, (Math.abs(car.slipAngle || 0) - 0.10) * 2.5);
        const brakeInt = isHeavyBraking ? Math.min(0.75, (-car.throttle - 0.30) * 1.5) : 0;
        const crashInt = isCrashSlide ? 0.70 : 0;
        const intensity = Math.min(0.75, Math.max(slipInt, brakeInt, crashInt));

        const cos = Math.cos(car.angle);
        const sin = Math.sin(car.angle);
        // Contact patch of Left and Right rear tires
        const lx = car.x - cos * 8.0 - sin * 5.2;
        const ly = -car.y + sin * 8.0 + cos * 5.2;
        const rx = car.x - cos * 8.0 + sin * 5.2;
        const ry = -car.y + sin * 8.0 - cos * 5.2;

        const prev = this.carPrevTires.get(car);
        if (prev) {
          const dL = Math.hypot(lx - prev.lx, ly - prev.ly);
          if (dL > 0.45 && dL < 30) {
            const hw = 0.8; // half width of tire skid mark
            const nx = -sin * hw;
            const ny = -cos * hw;

            // Left tire skid quad
            this.addSkidQuad(
              prev.lx - nx, prev.ly - ny,
              prev.lx + nx, prev.ly + ny,
              lx - nx, ly - ny,
              lx + nx, ly + ny,
              intensity
            );

            // Right tire skid quad
            this.addSkidQuad(
              prev.rx - nx, prev.ry - ny,
              prev.rx + nx, prev.ry + ny,
              rx - nx, ry - ny,
              rx + nx, ry + ny,
              intensity
            );
            // Continuous extruded tire smoke vapor ribbons
            const normX = -sin;
            const normY = -cos;
            this.addTireSmokeQuad(prev.lx, prev.ly, lx, ly, normX, normY, intensity);
            this.addTireSmokeQuad(prev.rx, prev.ry, rx, ry, normX, normY, intensity);
            added = true;
          }
        }
        this.carPrevTires.set(car, { lx, ly, rx, ry });
      } else {
        if (this.carPrevTires.has(car)) this.carPrevTires.delete(car);
      }
    }

    if (added && this.skidMesh) {
      this.skidMesh.geometry.attributes.position.needsUpdate = true;
      this.skidMesh.geometry.attributes.alpha.needsUpdate = true;
      this.skidMesh.geometry.setDrawRange(0, this.skidCount * 6);
    }
  }

  setupTrail() {
    this.trailHistory = [];
    this.trailOwner = null;
    this.maxTrailPoints = 50;

    const maxVerts = this.maxTrailPoints * 2;
    const posArr = new Float32Array(maxVerts * 3);
    const alphaArr = new Float32Array(maxVerts);
    const colorArr = new Float32Array(maxVerts * 3);
    const uvArr = new Float32Array(maxVerts * 2);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    geo.setAttribute('alpha', new THREE.BufferAttribute(alphaArr, 1));
    geo.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uvArr, 2));

    // Indices for triangle strip
    const indices = [];
    for (let i = 0; i < this.maxTrailPoints - 1; i++) {
      const v0 = i * 2;
      const v1 = i * 2 + 1;
      const v2 = (i + 1) * 2;
      const v3 = (i + 1) * 2 + 1;
      indices.push(v0, v1, v2);
      indices.push(v1, v3, v2);
    }
    geo.setIndex(indices);
    geo.setDrawRange(0, 0);

    const vertShader = `
      attribute float alpha;
      varying float vAlpha;
      varying vec3 vColor;
      varying vec2 vUv;
      void main() {
        vAlpha = alpha;
        vColor = color;
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;
    const fragShader = `
      varying float vAlpha;
      varying vec3 vColor;
      varying vec2 vUv;
      void main() {
        // Twin aerodynamic vortex filaments (u=0.25 and u=0.75)
        float dLeft = abs(vUv.x - 0.25);
        float dRight = abs(vUv.x - 0.75);
        float twinFilaments = max(exp(-dLeft * dLeft * 50.0), exp(-dRight * dRight * 50.0));
        
        // Soft central aerodynamic air wake
        float centerWake = pow(1.0 - abs(vUv.x - 0.5) * 2.0, 1.2);
        
        // Team color with luminous core filaments
        vec3 col = mix(vColor, vec3(1.0, 1.0, 1.0), twinFilaments * 0.35 + centerWake * 0.15);
        
        // Clean, well-defined aerodynamic slipstream wake
        float intensity = centerWake * 0.35 + twinFilaments * 0.65;
        float alpha = clamp(vAlpha * intensity * 0.85, 0.0, 1.0);
        
        gl_FragColor = vec4(col, alpha);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      vertexShader: vertShader,
      fragmentShader: fragShader,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    });

    this.trailMesh = new THREE.Mesh(geo, mat);
    this.trailMesh.frustumCulled = false;
    this.trailMesh.renderOrder = 400;
    this.scene.add(this.trailMesh);
  }

  updateTrail(focusCar, sim) {
    if (!focusCar || !focusCar.alive) {
      if (this.trailMesh) this.trailMesh.geometry.setDrawRange(0, 0);
      this.trailHistory.length = 0;
      this.trailOwner = null;
      return;
    }

    if (focusCar !== this.trailOwner) {
      this.trailHistory.length = 0;
      this.trailOwner = focusCar;
    }

    const cos = Math.cos(focusCar.angle);
    const sin = Math.sin(focusCar.angle);
    // Emit trail right behind the rear diffuser / rear wheels
    const rearX = focusCar.x - cos * 11.5;
    const rearY = -focusCar.y + sin * 11.5;
    const normX = -sin;
    const normY = -cos;

    this.trailHistory.push({ x: rearX, y: rearY, nx: normX, ny: normY });
    if (this.trailHistory.length > this.maxTrailPoints) {
      this.trailHistory.shift();
    }

    const count = this.trailHistory.length;
    if (count < 2) {
      this.trailMesh.geometry.setDrawRange(0, 0);
      return;
    }

    // Match team color of the followed car
    const carIdx = sim.cars ? sim.cars.indexOf(focusCar) : -1;
    const teamIdx = focusCar.manual ? 1 : (carIdx >= 0 ? carIdx % TEAM_PALETTE.length : 3);
    const hex = TEAM_PALETTE[teamIdx].hex;
    const col = new THREE.Color(hex);

    const posArr = this.trailMesh.geometry.attributes.position.array;
    const alphaArr = this.trailMesh.geometry.attributes.alpha.array;
    const colorArr = this.trailMesh.geometry.attributes.color.array;
    const uvArr = this.trailMesh.geometry.attributes.uv.array;

    const halfW = 2.8; // Sleek aerodynamic ribbon width

    for (let i = 0; i < count; i++) {
      const pt = this.trailHistory[i];
      // Smooth power-curve fade from 0.42 near car down to 0 at trail end
      const progress = i / (count - 1);
      const a = Math.pow(progress, 1.25) * 0.42;

      // Left vertex (u = 0)
      const v0 = i * 2;
      posArr[v0 * 3] = pt.x - pt.nx * halfW;
      posArr[v0 * 3 + 1] = pt.y - pt.ny * halfW;
      posArr[v0 * 3 + 2] = 0.35;
      alphaArr[v0] = a;
      colorArr[v0 * 3] = col.r;
      colorArr[v0 * 3 + 1] = col.g;
      colorArr[v0 * 3 + 2] = col.b;
      uvArr[v0 * 2] = 0.0;
      uvArr[v0 * 2 + 1] = progress;

      // Right vertex (u = 1)
      const v1 = i * 2 + 1;
      posArr[v1 * 3] = pt.x + pt.nx * halfW;
      posArr[v1 * 3 + 1] = pt.y + pt.ny * halfW;
      posArr[v1 * 3 + 2] = 0.35;
      alphaArr[v1] = a;
      colorArr[v1 * 3] = col.r;
      colorArr[v1 * 3 + 1] = col.g;
      colorArr[v1 * 3 + 2] = col.b;
      uvArr[v1 * 2] = 1.0;
      uvArr[v1 * 2 + 1] = progress;
    }

    this.trailMesh.geometry.attributes.position.needsUpdate = true;
    this.trailMesh.geometry.attributes.alpha.needsUpdate = true;
    this.trailMesh.geometry.attributes.color.needsUpdate = true;
    this.trailMesh.geometry.attributes.uv.needsUpdate = true;
    this.trailMesh.geometry.setDrawRange(0, (count - 1) * 6);
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
    this._autoPreset = null;
    this._autoNextSwitch = 0;
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

  render(sim, opts, leader) {
    if (this.lastGen !== sim.generation || (sim.time < 0.15 && (this.lastSimTime || 0) > 1.0)) {
      this.lastGen = sim.generation;
    }
    this.lastSimTime = sim.time;
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

    if (cameraPreset === 'auto') {
      const now = performance.now();
      if (!this._autoPreset || !this._autoNextSwitch || now >= this._autoNextSwitch) {
        const pool = ['chase', 'action', 'action_rear', 'onboard', 'heli', 'follow', 'broadcast'];
        const choices = pool.filter((p) => p !== this._autoPreset);
        this._autoPreset = choices[Math.floor(Math.random() * choices.length)] || 'chase';
        // Random broadcast shot duration between 6.5s and 9.5s
        this._autoNextSwitch = now + (6500 + Math.random() * 3000);
      }
      cameraPreset = this._autoPreset;
    }

    // 2. Camera View & Preset Positioning
    if (cameraPreset === 'orbit' || !opts.follow || !focusCar) {
      this.controls.autoRotate = true;
      this.controls.autoRotateSpeed = 0.55;
      if (Math.abs(this.camera.fov - 42) > 0.1) {
        this.camera.fov += (42 - this.camera.fov) * 0.08;
        this.camera.updateProjectionMatrix();
      }
    } else if (cameraPreset === 'action' && focusCar) {
      // ACTION FRONT CAM (Front reverse angle looking back: P1 permanently locked dead-center in viewport)
      this.controls.autoRotate = false;

      const p1 = (opts.manual && sim.player && (sim.player.alive || sim.player.finished)) ? sim.player : (rankedCars[0] || focusCar);
      let p2 = rankedCars.find((c) => c !== p1 && (c.alive || c.finished)) || (sim.cars && sim.cars.find((c) => c !== p1 && c.alive)) || null;

      const p1X = p1.x;
      const p1Y = -p1.y;
      const p1Angle = p1.angle;

      const p2X = (p2 && (p2.alive || p2.finished)) ? p2.x : (p1X - Math.cos(p1Angle) * 24.0);
      const p2Y = (p2 && (p2.alive || p2.finished)) ? -p2.y : (p1Y + Math.sin(p1Angle) * 24.0);

      const dx = p1X - p2X;
      const dy = p1Y - p2Y;
      const carGap = Math.hypot(dx, dy);

      // Fast, responsive gyro tracking to ensure camera stays directly in front of P1 through sharp hairpins
      if (typeof this._actionAngle !== 'number' || this._lastActionFocus !== p1) {
        this._actionAngle = p1Angle;
        this._actionTargetX = p1X;
        this._actionTargetY = p1Y;
        this._lastActionFocus = p1;
      } else {
        let diffAngle = p1Angle - this._actionAngle;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        this._actionAngle += diffAngle * 0.22; // High-response orientation tracking

        this._actionTargetX += (p1X - this._actionTargetX) * 0.30;
        this._actionTargetY += (p1Y - this._actionTargetY) * 0.30;
      }

      const cosA = Math.cos(this._actionAngle);
      const sinA = Math.sin(this._actionAngle);
      const nx = -sinA;
      const ny = -cosA;

      // Distance ahead scales smoothly with gap so P1 and chasing pack are framed with comfortable clearance
      const leadDist = 32.0 + Math.min(28.0, carGap * 0.22);
      const destCamX = this._actionTargetX + cosA * leadDist + nx * 2.0;
      const destCamY = this._actionTargetY - sinA * leadDist + ny * 2.0;
      // Altitude elevates comfortably for clear broadcast sightline over P1 to chasers behind
      const destCamZ = 5.5 + Math.min(8.0, carGap * 0.10);

      // Look target is anchored on P1 to guarantee P1 NEVER leaves the viewport
      const destTargetX = p1X - cosA * 2.0;
      const destTargetY = p1Y + sinA * 2.0;
      const destTargetZ = 1.6;

      // Dynamic adaptive wide-angle FOV so both P1 and chasing P2 remain in frame
      const targetFov = Math.max(46, Math.min(68, 46 + (carGap / 60) * 16));
      this.camera.fov += (targetFov - this.camera.fov) * 0.10;
      this.camera.updateProjectionMatrix();

      const camGlide = 0.18;
      const targetGlide = 0.30; // Responsive target lock on P1

      this.camera.position.x += (destCamX - this.camera.position.x) * camGlide;
      this.camera.position.y += (destCamY - this.camera.position.y) * camGlide;
      this.camera.position.z += (destCamZ - this.camera.position.z) * camGlide;

      this.controls.target.x += (destTargetX - this.controls.target.x) * targetGlide;
      this.controls.target.y += (destTargetY - this.controls.target.y) * targetGlide;
      this.controls.target.z += (destTargetZ - this.controls.target.z) * targetGlide;
    } else if (cameraPreset === 'action_rear' && focusCar) {
      // ACTION REAR CAM (Pursuit battle angle behind P2/P1 looking forward with P1 & P2 locked in frame)
      this.controls.autoRotate = false;

      const p1 = (opts.manual && sim.player && (sim.player.alive || sim.player.finished)) ? sim.player : (rankedCars[0] || focusCar);
      let p2 = rankedCars.find((c) => c !== p1 && (c.alive || c.finished)) || (sim.cars && sim.cars.find((c) => c !== p1 && c.alive)) || null;

      const p1X = p1.x;
      const p1Y = -p1.y;
      const p1Angle = p1.angle;

      const p2X = (p2 && (p2.alive || p2.finished)) ? p2.x : (p1X - Math.cos(p1Angle) * 24.0);
      const p2Y = (p2 && (p2.alive || p2.finished)) ? -p2.y : (p1Y + Math.sin(p1Angle) * 24.0);

      const dx = p1X - p2X;
      const dy = p1Y - p2Y;
      const carGap = Math.hypot(dx, dy);

      // Trailing reference car (P2 if exists, else behind P1)
      const rearAnchorX = (p2 && (p2.alive || p2.finished)) ? p2.x : p1X;
      const rearAnchorY = (p2 && (p2.alive || p2.finished)) ? -p2.y : p1Y;
      const leadAngle = (p2 && (p2.alive || p2.finished)) ? p2.angle : p1Angle;

      // Low-pass orientation damping on rear chase angle
      if (typeof this._actionRearAngle !== 'number' || this._lastActionRearFocus !== p1) {
        this._actionRearAngle = leadAngle;
        this._actionRearTargetX = rearAnchorX;
        this._actionRearTargetY = rearAnchorY;
        this._lastActionRearFocus = p1;
      } else {
        let diffAngle = leadAngle - this._actionRearAngle;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        this._actionRearAngle += diffAngle * 0.12; // Responsive gyro-stabilized tracking

        this._actionRearTargetX += (rearAnchorX - this._actionRearTargetX) * 0.20;
        this._actionRearTargetY += (rearAnchorY - this._actionRearTargetY) * 0.20;
      }

      const cosA = Math.cos(this._actionRearAngle);
      const sinA = Math.sin(this._actionRearAngle);
      const nx = -sinA;
      const ny = -cosA;

      // Position camera BEHIND trailing car looking forward towards leader P1
      const trailDist = 16.0 + Math.min(26.0, carGap * 0.25);
      const destCamX = this._actionRearTargetX - cosA * trailDist + nx * 3.5;
      const destCamY = this._actionRearTargetY + sinA * trailDist + ny * 3.5;
      // Altitude elevates to maintain clear sightline over P2 onto leader P1
      const destCamZ = 4.2 + Math.min(11.0, carGap * 0.14);

      // Target centered with 65% weight on P1 to guarantee P1 stays in the viewport
      const destTargetX = p1X * 0.65 + p2X * 0.35;
      const destTargetY = p1Y * 0.65 + p2Y * 0.35;
      const destTargetZ = 2.0;

      // Dynamic adaptive FOV zoom ensuring both cars remain framed
      const targetFov = Math.max(42, Math.min(68, 42 + (carGap / 60) * 18));
      this.camera.fov += (targetFov - this.camera.fov) * 0.10;
      this.camera.updateProjectionMatrix();

      const camGlide = 0.14;
      const targetGlide = 0.18;

      this.camera.position.x += (destCamX - this.camera.position.x) * camGlide;
      this.camera.position.y += (destCamY - this.camera.position.y) * camGlide;
      this.camera.position.z += (destCamZ - this.camera.position.z) * camGlide;

      this.controls.target.x += (destTargetX - this.controls.target.x) * targetGlide;
      this.controls.target.y += (destTargetY - this.controls.target.y) * targetGlide;
      this.controls.target.z += (destTargetZ - this.controls.target.z) * targetGlide;
    } else if (cameraPreset === 'follow' && focusCar) {
      // CLASSIC BROADCAST FOLLOW CAM (Smooth high TV tracking altitude 95.0)
      this.controls.autoRotate = false;

      const targetX = focusCar.x;
      const targetY = -focusCar.y;
      const targetZ = 3.5;

      const panSpeed = 0.12;
      const dx = (targetX - this.controls.target.x) * panSpeed;
      const dy = (targetY - this.controls.target.y) * panSpeed;
      const dz = (targetZ - this.controls.target.z) * panSpeed;

      this.controls.target.x += dx;
      this.controls.target.y += dy;
      this.controls.target.z += dz;

      this.camera.position.x += dx;
      this.camera.position.y += dy;

      const canonicalCamZ = 95.0;
      this.camera.position.z += (canonicalCamZ - this.camera.position.z) * 0.06;

      if (Math.abs(this.camera.fov - 45) > 0.1) {
        this.camera.fov += (45 - this.camera.fov) * 0.08;
        this.camera.updateProjectionMatrix();
      }
    } else if (cameraPreset === 'onboard' && focusCar) {
      // ONBOARD T-CAM (Roll-hoop periscope camera elevated above cockpit & halo)
      this.controls.autoRotate = false;
      const cosA = Math.cos(focusCar.angle);
      const sinA = Math.sin(focusCar.angle);

      // Positioned atop the airbox roll-hoop mount with elevated forward sightline
      const destCamX = focusCar.x - cosA * 2.0;
      const destCamY = -focusCar.y + sinA * 2.0;
      const destCamZ = 5.8;

      const destTargetX = focusCar.x + cosA * 52;
      const destTargetY = -focusCar.y - sinA * 52;
      const destTargetZ = 2.6;

      const camGlide = 0.35;
      const targetGlide = 0.35;

      this.camera.position.x += (destCamX - this.camera.position.x) * camGlide;
      this.camera.position.y += (destCamY - this.camera.position.y) * camGlide;
      this.camera.position.z += (destCamZ - this.camera.position.z) * camGlide;

      this.controls.target.x += (destTargetX - this.controls.target.x) * targetGlide;
      this.controls.target.y += (destTargetY - this.controls.target.y) * targetGlide;
      this.controls.target.z += (destTargetZ - this.controls.target.z) * targetGlide;

      if (Math.abs(this.camera.fov - 44) > 0.1) {
        this.camera.fov += (44 - this.camera.fov) * 0.08;
        this.camera.updateProjectionMatrix();
      }
    } else if (cameraPreset === 'heli' && focusCar) {
      // CINEMATIC AERIAL PURSUIT HELICOPTER (High sweeping pursuit keeping P1 and P2 framed smoothly)
      this.controls.autoRotate = false;

      const p1 = (opts.manual && sim.player && (sim.player.alive || sim.player.finished)) ? sim.player : (rankedCars[0] || focusCar);
      let p2 = rankedCars.find((c) => c !== p1 && (c.alive || c.finished)) || (sim.cars && sim.cars.find((c) => c !== p1 && c.alive)) || null;

      const p1X = p1.x;
      const p1Y = -p1.y;
      const p1Angle = p1.angle;

      const p2X = (p2 && (p2.alive || p2.finished)) ? p2.x : (p1X - Math.cos(p1Angle) * 30.0);
      const p2Y = (p2 && (p2.alive || p2.finished)) ? -p2.y : (p1Y + Math.sin(p1Angle) * 30.0);

      const dx = p1X - p2X;
      const dy = p1Y - p2Y;
      const carGap = Math.hypot(dx, dy);

      // Weighted midpoint between P1 and P2
      const midX = p1X * 0.58 + p2X * 0.42;
      const midY = p1Y * 0.58 + p2Y * 0.42;

      if (typeof this._heliAngle !== 'number' || this._lastHeliFocus !== p1) {
        this._heliAngle = p1Angle;
        this._heliTargetX = midX;
        this._heliTargetY = midY;
        this._lastHeliFocus = p1;
      } else {
        let diffAngle = p1Angle - this._heliAngle;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        this._heliAngle += diffAngle * 0.055; // Smooth gyro-stabilized pan

        this._heliTargetX += (midX - this._heliTargetX) * 0.10;
        this._heliTargetY += (midY - this._heliTargetY) * 0.10;
      }

      const cosA = Math.cos(this._heliAngle);
      const sinA = Math.sin(this._heliAngle);
      const nx = -sinA;
      const ny = -cosA;

      // Elevated aerial perspective: distance & altitude scale dynamically with P1-P2 gap
      const trailDist = 62.0 + Math.min(48.0, carGap * 0.35);
      const lateralDist = 36.0 + Math.min(22.0, carGap * 0.18);
      const destCamX = this._heliTargetX - cosA * trailDist + nx * lateralDist;
      const destCamY = this._heliTargetY + sinA * trailDist + ny * lateralDist;
      const destCamZ = 64.0 + Math.min(50.0, carGap * 0.40);

      const destTargetX = this._heliTargetX;
      const destTargetY = this._heliTargetY;
      const destTargetZ = 2.0;

      // Dynamic adaptive FOV zoom ensuring both P1 and P2 stay in the viewport
      const targetFov = Math.max(40, Math.min(62, 40 + (carGap / 70) * 16));
      this.camera.fov += (targetFov - this.camera.fov) * 0.06;
      this.camera.updateProjectionMatrix();

      const camGlide = 0.075;
      const targetGlide = 0.095;

      this.camera.position.x += (destCamX - this.camera.position.x) * camGlide;
      this.camera.position.y += (destCamY - this.camera.position.y) * camGlide;
      this.camera.position.z += (destCamZ - this.camera.position.z) * camGlide;

      this.controls.target.x += (destTargetX - this.controls.target.x) * targetGlide;
      this.controls.target.y += (destTargetY - this.controls.target.y) * targetGlide;
      this.controls.target.z += (destTargetZ - this.controls.target.z) * targetGlide;
    } else if (cameraPreset === 'broadcast') {
      // TV GANTRY CAMERA (Start / Finish Gantry view)
      this.controls.autoRotate = false;
      const t = this.track;
      const cx = t.cx[0];
      const cy = -t.cy[0];
      const tx = t.tx[0];
      const ty = -t.ty[0];
      const nx = -ty;
      const ny = tx;

      const destCamX = cx + tx * 80 + nx * 28;
      const destCamY = cy + ty * 80 + ny * 28;
      const destCamZ = 10.5;

      const incoming = (focusCar && focusCar.alive) ? focusCar : (leader && leader.alive ? leader : null);
      const destTargetX = incoming ? incoming.x : cx - tx * 35;
      const destTargetY = incoming ? -incoming.y : cy - ty * 35;
      const destTargetZ = 3.2;

      const camGlide = 0.06;
      const targetGlide = 0.09;

      this.camera.position.x += (destCamX - this.camera.position.x) * camGlide;
      this.camera.position.y += (destCamY - this.camera.position.y) * camGlide;
      this.camera.position.z += (destCamZ - this.camera.position.z) * camGlide;

      this.controls.target.x += (destTargetX - this.controls.target.x) * targetGlide;
      this.controls.target.y += (destTargetY - this.controls.target.y) * targetGlide;
      this.controls.target.z += (destTargetZ - this.controls.target.z) * targetGlide;

      if (Math.abs(this.camera.fov - 42) > 0.1) {
        this.camera.fov += (42 - this.camera.fov) * 0.08;
        this.camera.updateProjectionMatrix();
      }
    } else {
      // DEFAULT: 'chase' preset (Dynamic Decoupled Smooth 3rd-person follow)
      this.controls.autoRotate = false;

      if (hasFinisher && !opts.manual) {
        const t = this.track;
        const cx = t.cx[0];
        const cy = -t.cy[0];
        const tx = t.tx[0];
        const ty = -t.ty[0];
        const nx = -ty;
        const ny = tx;

        const destCamX = cx + tx * 80 + nx * 28;
        const destCamY = cy + ty * 80 + ny * 28;
        const destCamZ = 10.5;

        const incomingFinisher = leader && leader.alive ? leader : null;
        const destTargetX = incomingFinisher ? incomingFinisher.x : cx - tx * 35;
        const destTargetY = incomingFinisher ? -incomingFinisher.y : cy - ty * 35;
        const destTargetZ = 3.2;

        const camGlide = 0.05;
        const targetGlide = 0.08;

        this.camera.position.x += (destCamX - this.camera.position.x) * camGlide;
        this.camera.position.y += (destCamY - this.camera.position.y) * camGlide;
        this.camera.position.z += (destCamZ - this.camera.position.z) * camGlide;

        this.controls.target.x += (destTargetX - this.controls.target.x) * targetGlide;
        this.controls.target.y += (destTargetY - this.controls.target.y) * targetGlide;
        this.controls.target.z += (destTargetZ - this.controls.target.z) * targetGlide;
      } else if (focusCar) {
        if (typeof this._chaseAngle !== 'number' || this._lastFocusCar !== focusCar) {
          this._chaseAngle = focusCar.angle;
          this._chaseTargetX = focusCar.x;
          this._chaseTargetY = -focusCar.y;
          this._lastFocusCar = focusCar;
        } else {
          const posFollowK = 0.10;
          this._chaseTargetX += (focusCar.x - this._chaseTargetX) * posFollowK;
          this._chaseTargetY += (-focusCar.y - this._chaseTargetY) * posFollowK;

          let diffAngle = focusCar.angle - this._chaseAngle;
          while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
          while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;

          const angularDamping = 0.048;
          this._chaseAngle += diffAngle * angularDamping;
        }

        const cosA = Math.cos(this._chaseAngle);
        const sinA = Math.sin(this._chaseAngle);

        const distBehind = 42.0;
        const heightAbove = 15.2;
        const destCamX = this._chaseTargetX - cosA * distBehind;
        const destCamY = this._chaseTargetY + sinA * distBehind;
        const destCamZ = heightAbove;

        const lookAhead = 16.0;
        const destTargetX = this._chaseTargetX + cosA * lookAhead;
        const destTargetY = this._chaseTargetY - sinA * lookAhead;
        const destTargetZ = 2.8;

        const camGlide = 0.08;
        const targetGlide = 0.10;

        this.camera.position.x += (destCamX - this.camera.position.x) * camGlide;
        this.camera.position.y += (destCamY - this.camera.position.y) * camGlide;
        this.camera.position.z += (destCamZ - this.camera.position.z) * camGlide;

        this.controls.target.x += (destTargetX - this.controls.target.x) * targetGlide;
        this.controls.target.y += (destTargetY - this.controls.target.y) * targetGlide;
        this.controls.target.z += (destTargetZ - this.controls.target.z) * targetGlide;
      }

      if (Math.abs(this.camera.fov - 42) > 0.1) {
        this.camera.fov += (42 - this.camera.fov) * 0.08;
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

        if (typeof mesh.userData.curX !== 'number' || Math.hypot(targetX - mesh.userData.curX, targetY - mesh.userData.curY) > 60) {
          mesh.userData.curX = targetX;
          mesh.userData.curY = targetY;
          mesh.userData.curAngle = targetAngle;
        } else {
          const kPos = 0.60;
          const kRot = 0.38;
          mesh.userData.curX += (targetX - mesh.userData.curX) * kPos;
          mesh.userData.curY += (targetY - mesh.userData.curY) * kPos;

          let diff = targetAngle - mesh.userData.curAngle;
          while (diff > Math.PI) diff -= Math.PI * 2;
          while (diff < -Math.PI) diff += Math.PI * 2;
          mesh.userData.curAngle += diff * kRot;
        }

        mesh.position.set(mesh.userData.curX, mesh.userData.curY, 0);
        mesh.rotation.z = mesh.userData.curAngle;

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
            badge.scale.set(13.6, 3.8, 1);
          } else if (showBadge && rank) {
            badge.visible = true;
            const tex = this.posTextures[rank] || this.posTextures[80];
            if (badge.material.map !== tex) {
              badge.material.map = tex;
            }
            badge.scale.set(3.8, 3.8, 1);
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
      const targetAngle = -sim.player.angle;

      if (typeof this.playerCar.userData.curX !== 'number' || Math.hypot(targetX - this.playerCar.userData.curX, targetY - this.playerCar.userData.curY) > 60) {
        this.playerCar.userData.curX = targetX;
        this.playerCar.userData.curY = targetY;
        this.playerCar.userData.curAngle = targetAngle;
      } else {
        const kPos = 0.65;
        const kRot = 0.42;
        this.playerCar.userData.curX += (targetX - this.playerCar.userData.curX) * kPos;
        this.playerCar.userData.curY += (targetY - this.playerCar.userData.curY) * kPos;

        let diff = targetAngle - this.playerCar.userData.curAngle;
        while (diff > Math.PI) diff -= Math.PI * 2;
        while (diff < -Math.PI) diff += Math.PI * 2;
        this.playerCar.userData.curAngle += diff * kRot;
      }

      this.playerCar.position.set(this.playerCar.userData.curX, this.playerCar.userData.curY, 0);
      this.playerCar.rotation.z = this.playerCar.userData.curAngle;

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
          badge.scale.set(13.6, 3.8, 1);
        } else if (showBadge && rank) {
          badge.visible = true;
          const tex = this.posTextures[rank] || this.posTextures[80];
          if (badge.material.map !== tex) {
            badge.material.map = tex;
          }
          badge.scale.set(3.8, 3.8, 1);
        } else {
          badge.visible = false;
        }
      }
    } else {
      this.playerCar.visible = false;
    }

    // Update Persistent Rubber Skid Marks
    this.updateSkidmarks(sim);

    // Update Fading Luminous Ribbon Trail behind followed car
    this.updateTrail(focusCar, sim);

    // Update Death Bursts
    this.processDeathEvents(sim);
    this.updateBursts();

    // Update Tire Smoke Particles
    this.updateTireSmoke();

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
      const ez = oz;

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
