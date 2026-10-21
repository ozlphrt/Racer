import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DecalGeometry } from 'three/examples/jsm/geometries/DecalGeometry.js';
import { CONFIG } from './config.js';
import { getRenderPose } from './renderPose.js';
import { batchStaticMeshes, batchSceneryInstances } from './staticBatch.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RAY_ANGLES } from './car.js';
import { audio } from './audio.js';
import { TireBarrierSystem } from './tireBarriers.js';
import { carSideviewRenderer } from './carSideviewRenderer.js';

// F1 Number Decals Configuration (Calibrated in 3D Decal Studio)
export const F1_DECAL_CONFIG = {
  front: { posX: -10.05, posY: 0.05, posZ: 1,    scaleX: 4.35, scaleY: 2.45, rotX: 21,  rotY: -3,  rotZ: -90 },
  top:   { posX: 0.82,  posY: 0.24,  posZ: 3.29, scaleX: 3.75, scaleY: 3.9,  rotX: 0,   rotY: 10,  rotZ: -90 },
  rear:  { posX: 12.14, posY: 0.03,  posZ: 4.24, scaleX: 3.45, scaleY: 2.75, rotX: 5,   rotY: 0,   rotZ: 90 },
  left:  { posX: 5.4,   posY: -1.7,  posZ: 2.4,  scaleX: 4.4,  scaleY: 3.45, rotX: 90,  rotY: 0,   rotZ: 0 },
  right: { posX: 4.2,   posY: 1.9,   posZ: 2.44, scaleX: 4.75, scaleY: 3.45, rotX: -90, rotY: 180, rotZ: 0 }
};

// Authentic F1 Racing Numbers (Decoupled from positions & grid slots)
export const F1_CAR_NUMBERS = [
  44, 63, // Team 0 (Silver Arrows / Black & Gold)
  16, 55, // Team 1 (Scuderia Ferrari Rosso Corsa)
  1,  11, // Team 2 (Red Bull Championship)
  4,  81, // Team 3 (McLaren Papaya)
  14, 18, // Team 4 (Aston Martin Emerald)
  10, 31, // Team 5 (Alpine Sport)
  23, 2,  // Team 6 (Williams Racing)
  3,  22, // Team 7 (Visa Cash App RB)
  77, 24, // Team 8 (Kick Sauber)
  20, 27, // Team 9 (Haas F1 Team)
];

export function getCarNumber(carIdx, isPlayer = false) {
  if (isPlayer) return 7;
  if (typeof carIdx === 'number' && carIdx >= 0 && carIdx < F1_CAR_NUMBERS.length) {
    return F1_CAR_NUMBERS[carIdx];
  }
  return typeof carIdx === 'number' ? (carIdx + 1) : 1;
}

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
  kerbRed: 0x8f282b,
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
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.0));
    this.renderer.shadowMap.enabled = false; // Disables redundant shadow depth pass (cars use dedicated high-res AO contact shadows)

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
    const vertexShader = `
      varying vec3 vWorldDir;
      void main() {
        vWorldDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `;

    const fragmentShader = `
      varying vec3 vWorldDir;
      uniform vec3 uSunDir;
      uniform float uTime;

      // 3D Simplex / Gradient Noise for natural organic clouds
      vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
      vec4 permute(vec4 x) { return mod289(((x * 34.0) + 1.0) * x); }
      vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

      float snoise(vec3 v) {
        const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
        const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);

        vec3 i  = floor(v + dot(v, C.yyy));
        vec3 x0 = v - i + dot(i, C.xxx);

        vec3 g = step(x0.yzx, x0.xyz);
        vec3 l = 1.0 - g;
        vec3 i1 = min(g.xyz, l.zxy);
        vec3 i2 = max(g.xyz, l.zxy);

        vec3 x1 = x0 - i1 + C.xxx;
        vec3 x2 = x0 - i2 + C.yyy;
        vec3 x3 = x0 - D.yyy;

        i = mod289(i);
        vec4 p = permute(permute(permute(
                  i.z + vec4(0.0, i1.z, i2.z, 1.0))
                + i.y + vec4(0.0, i1.y, i2.y, 1.0))
                + i.x + vec4(0.0, i1.x, i2.x, 1.0));

        float n_ = 0.142857142857;
        vec3  ns = n_ * D.wyz - D.xzx;

        vec4 j = p - 49.0 * floor(p * ns.z * ns.z);

        vec4 x_ = floor(j * ns.z);
        vec4 y_ = floor(j - 7.0 * x_);

        vec4 x = x_ * ns.x + ns.yyyy;
        vec4 y = y_ * ns.x + ns.yyyy;
        vec4 h = 1.0 - abs(x) - abs(y);

        vec4 b0 = vec4(x.xy, y.xy);
        vec4 b1 = vec4(x.zw, y.zw);

        vec4 s0 = floor(b0) * 2.0 + 1.0;
        vec4 s1 = floor(b1) * 2.0 + 1.0;
        vec4 sh = -step(h, vec4(0.0));

        vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
        vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;

        vec3 p0 = vec3(a0.xy, h.x);
        vec3 p1 = vec3(a0.zw, h.y);
        vec3 p2 = vec3(a1.xy, h.z);
        vec3 p3 = vec3(a1.zw, h.w);

        vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
        p0 *= norm.x;
        p1 *= norm.y;
        p2 *= norm.z;
        p3 *= norm.w;

        vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
        m = m * m;
        return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
      }

      // Multi-octave Fractal Brownian Motion for natural organic clouds
      float fbm(vec3 p) {
        float total = 0.0;
        float amp = 0.52;
        float freq = 1.0;
        for (int i = 0; i < 4; i++) {
          total += snoise(p * freq) * amp;
          freq *= 2.15;
          amp *= 0.48;
        }
        return total;
      }

      void main() {
        vec3 dir = normalize(vWorldDir);
        float z = dir.z;

        // 1. Natural Rayleigh Atmospheric Gradient
        // Deep crystal azure at zenith -> open sky blue -> luminous soft cerulean -> warm golden horizon haze
        vec3 cZenith = vec3(0.07, 0.35, 0.72);   // Rich deep sapphire azure
        vec3 cMidSky = vec3(0.24, 0.58, 0.92);   // Crisp open afternoon sky blue
        vec3 cLowSky = vec3(0.56, 0.79, 0.98);   // Soft luminous cerulean
        vec3 cHorizon = vec3(0.82, 0.90, 0.97);  // Airy distant atmospheric horizon haze
        vec3 cGround  = vec3(0.55, 0.65, 0.59);  // Distant landscape ground blend

        vec3 skyColor;
        if (z >= 0.0) {
          float h = pow(z, 0.65);
          if (h < 0.25) {
            skyColor = mix(cHorizon, cLowSky, h / 0.25);
          } else if (h < 0.70) {
            skyColor = mix(cLowSky, cMidSky, (h - 0.25) / 0.45);
          } else {
            skyColor = mix(cMidSky, cZenith, (h - 0.70) / 0.30);
          }
        } else {
          // Below horizon: smooth blend into ground fog
          float d = clamp(-z * 18.0, 0.0, 1.0);
          skyColor = mix(cHorizon, cGround, d);
        }

        // 2. Solar Glare & Corona (Aligned with directional sun vector)
        float cosTheta = dot(dir, uSunDir);
        if (cosTheta > 0.0) {
          // Warm golden forward-scatter atmospheric glow
          float forwardScatter = pow(cosTheta, 3.8) * 0.28;
          vec3 sunHaze = vec3(1.0, 0.88, 0.68) * forwardScatter;

          // Intense Mie solar corona around sun
          float corona = pow(cosTheta, 28.0) * 0.65;
          vec3 coronaColor = vec3(1.0, 0.94, 0.78) * corona;

          // Crisp brilliant solar disc
          float disc = smoothstep(0.9992, 0.9998, cosTheta);
          vec3 discColor = vec3(1.0, 1.0, 0.95) * (disc * 3.5);

          skyColor += sunHaze + coronaColor + discColor;
        }

        // 3. Realistic Natural Fractal Clouds (Spherical Cloud Dome Layer)
        if (z > 0.015) {
          // Project celestial ray onto cloud dome altitude
          float cloudDist = 1.0 / max(0.08, z);
          vec2 cloudCoord = dir.xy * cloudDist * 0.42;

          // 3D position with subtle time drift for organic vitality
          vec3 p = vec3(cloudCoord * 0.95, uTime * 0.003 + 12.4);

          float n = fbm(p);
          float nFiner = snoise(vec3(cloudCoord * 2.8, uTime * 0.006));
          float cloudShape = n * 0.80 + nFiner * 0.20;

          // Natural non-linear density thresholding
          float coverage = 0.08; // Delicate, airy afternoon cumulus & cirrus
          float density = smoothstep(coverage, coverage + 0.42, cloudShape);

          // Atmospheric fade towards horizon (aerial perspective)
          float horizonFade = smoothstep(0.015, 0.18, z);
          density *= horizonFade;

          if (density > 0.001) {
            // Cloud shading & sunlight transmission
            float sunIllum = max(0.0, dot(dir, uSunDir));
            vec3 cloudHighlight = mix(vec3(1.0, 0.98, 0.94), vec3(1.0, 0.92, 0.75), pow(sunIllum, 2.0));
            vec3 cloudShadow = mix(vec3(0.68, 0.78, 0.88), vec3(0.78, 0.85, 0.92), z);
            
            // Internal light scattering
            float lightDiff = clamp(cloudShape * 1.5 + sunIllum * 0.35, 0.0, 1.0);
            vec3 cloudFinalColor = mix(cloudShadow, cloudHighlight, lightDiff);

            skyColor = mix(skyColor, cloudFinalColor, density * 0.88);
          }
        }

        // 4. Distant Organic Multi-Harmonic Mountain Ridge on the Horizon
        if (z >= -0.015 && z < 0.075) {
          float azimuth = atan(dir.y, dir.x);
          // Layer 1: Distant majestic mountain silhouette (multi-frequency natural ridge)
          float ridge1 = 0.012 + sin(azimuth * 3.7 + 1.2) * 0.010 
                               + sin(azimuth * 8.3 - 0.4) * 0.007 
                               + cos(azimuth * 19.1 + 2.1) * 0.004
                               + sin(azimuth * 37.0) * 0.002;
          
          if (z < ridge1) {
            float mHeight = clamp((ridge1 - z) / ridge1, 0.0, 1.0);
            vec3 farMtnColor = mix(vec3(0.48, 0.62, 0.76), vec3(0.38, 0.50, 0.64), mHeight);
            float mtnFog = smoothstep(0.0, 0.035, ridge1 - z);
            skyColor = mix(skyColor, farMtnColor, mtnFog * 0.75);
          }

          // Layer 2: Closer gentle foothill layer
          float ridge2 = 0.006 + sin(azimuth * 5.2 + 2.8) * 0.006 
                               + cos(azimuth * 12.7 + 1.1) * 0.003
                               + sin(azimuth * 27.5) * 0.0015;
          if (z < ridge2) {
            float fHeight = clamp((ridge2 - z) / max(0.001, ridge2), 0.0, 1.0);
            vec3 nearMtnColor = mix(vec3(0.42, 0.54, 0.58), vec3(0.32, 0.44, 0.46), fHeight);
            float nearFog = smoothstep(0.0, 0.02, ridge2 - z);
            skyColor = mix(skyColor, nearMtnColor, nearFog * 0.82);
          }
        }

        gl_FragColor = vec4(skyColor, 1.0);
      }
    `;

    // Dome hemisphere/sphere inverted mesh
    const skyGeo = new THREE.SphereGeometry(14000, 64, 48);
    // Rotate sphere so top pole points along +Z (vertical world axis)
    skyGeo.rotateX(Math.PI / 2);

    const defaultSunDir = new THREE.Vector3(Math.cos(2.10) * 1.9, Math.sin(2.10) * 1.9, 1.55).normalize();

    this.skyMat = new THREE.ShaderMaterial({
      vertexShader,
      fragmentShader,
      uniforms: {
        uSunDir: { value: defaultSunDir },
        uTime: { value: 0.0 }
      },
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    });

    this.skyMesh = new THREE.Mesh(skyGeo, this.skyMat);
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
    this.dirLight.castShadow = false;
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
    const spanX = (b.maxX - b.minX) * 0.52;
    const spanY = (b.maxY - b.minY) * 0.52;
    const span = Math.max(spanX, spanY) + 60;

    // Pleasant afternoon sun angle (~40 deg above horizon) from South-West
    // Generates distinct angled shadows revealing terrain relief, barriers, and cars,
    // while keeping the track and landscape bright, clear, and vibrant (not dark dusk).
    const sunDistance = span * 1.85;
    const sunAngle = 2.10; // South-West azimuth (~120 degrees)
    const sunX = cx + Math.cos(sunAngle) * sunDistance;
    const sunY = cy + Math.sin(sunAngle) * sunDistance;
    const sunZ = span * 1.55; // Natural ~40 deg afternoon elevation

    this.dirLight.position.set(sunX, sunY, sunZ);
    this.dirLight.target.position.set(cx, cy, 0);

    if (this.skyMat && this.skyMat.uniforms && this.skyMat.uniforms.uSunDir) {
      this.skyMat.uniforms.uSunDir.value.set(sunX - cx, sunY - cy, sunZ).normalize();
    }

    // Tightened shadow frustum concentrates 2048x2048 shadow map directly onto the circuit and cars
    const d = span * 1.08;
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
      let bestK = 0;
      const N = t.N;
      // Fast two-phase coarse-to-fine search (8x fewer distance calculations)
      const step = 8;
      for (let k = 0; k < N; k += step) {
        const dx = t.cx[k] - tx;
        const dy = t.cy[k] - ty;
        const dSq = dx * dx + dy * dy;
        if (dSq < minDSq) {
          minDSq = dSq;
          bestK = k;
        }
      }
      // Refine fine window around best coarse sample
      const fineStart = bestK - step;
      const fineEnd = bestK + step;
      for (let k = fineStart; k <= fineEnd; k++) {
        const ik = ((k % N) + N) % N;
        const dx = t.cx[ik] - tx;
        const dy = t.cy[ik] - ty;
        const dSq = dx * dx + dy * dy;
        if (dSq < minDSq) {
          minDSq = dSq;
          bestK = ik;
        }
      }
      // Exact continuous segment projection on neighboring segments
      const prevK = (bestK - 1 + N) % N;
      const nextK = (bestK + 1) % N;
      const distToSeg = (x1, y1, x2, y2) => {
        const vx = x2 - x1;
        const vy = y2 - y1;
        const lenSq = vx * vx + vy * vy;
        if (lenSq < 0.001) return minDSq;
        const u = Math.max(0, Math.min(1, ((tx - x1) * vx + (ty - y1) * vy) / lenSq));
        const px = x1 + u * vx;
        const py = y1 + u * vy;
        const ddx = tx - px;
        const ddy = ty - py;
        return ddx * ddx + ddy * ddy;
      };
      minDSq = Math.min(minDSq, distToSeg(t.cx[prevK], t.cy[prevK], t.cx[bestK], t.cy[bestK]));
      minDSq = Math.min(minDSq, distToSeg(t.cx[bestK], t.cy[bestK], t.cx[nextK], t.cy[nextK]));
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
    // Terrain probes share static water geometry instead of allocating 63 objects per call.
    if (this._waterBodiesTrack === this.track && this._waterBodiesBounds === this.track.bounds) {
      return this._waterBodies;
    }
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

    this._waterBodiesTrack = this.track;
    this._waterBodiesBounds = this.track.bounds;
    this._waterBodies = { lakes, river };
    return this._waterBodies;
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

    // 1. Direct roadbed trough: strictly depressed (-0.14m) directly under asphalt (Z=0.12m) to eliminate Z-fighting
    if (distToTrack <= trackHalf + 25.0) {
      return -0.14;
    }

    // 2. Smooth roadbed transition from -0.14m up to 0.00m at verge edge
    if (distToTrack <= trackHalf + 55.0) {
      const tNorm = (distToTrack - (trackHalf + 25.0)) / 30.0;
      return -0.14 * (1.0 - tNorm * tNorm * (3.0 - 2.0 * tNorm));
    }

    // 3. Wide flat verge apron (220m margin outside track edge, ~262m from centerline)
    // Guarantees all triangles crossing or bordering the track are flush at 0.00m (under asphalt Z=0.12m)
    const flatRadius = trackHalf + 220.0;
    if (distToTrack <= flatRadius) {
      return 0.0;
    }

    // Smooth cubic ease-in from verge into rolling mini hills and mini bumps
    const hillEaseDist = 80.0;
    const hillRatio = Math.min(1.0, (distToTrack - flatRadius) / hillEaseDist);
    const hillBlend = hillRatio * hillRatio * (3.0 - 2.0 * hillRatio);

    // Continuous non-linear turbulent coordinate warping for natural flowing landscape features
    const rx1 = x * 0.857 - y * 0.515;
    const ry1 = x * 0.515 + y * 0.857;
    const rx2 = x * 0.292 + y * 0.956;
    const ry2 = -x * 0.956 + y * 0.292;

    const warpX = Math.sin(rx1 * 0.0042 + 1.7) * 45.0 + Math.cos(ry2 * 0.0068 - 0.8) * 25.0;
    const warpY = Math.cos(rx2 * 0.0048 - 1.1) * 45.0 + Math.sin(ry1 * 0.0058 + 2.3) * 25.0;
    const wx = x + warpX;
    const wy = y + warpY;

    // 4. Random Mini Hills Sized ~10 to 75 Cars (~50m to ~375m diameter):
    // Formula 1 car length is ~5m.
    // Category A: 10-20 Car-Sized Mini Mounds (~50m - 100m diameter, 2.5m - 4.5m height)
    const kS1 = Math.sin(wx * 0.068 + wy * 0.052 + 1.3);
    const kS2 = Math.cos(wx * -0.058 + wy * 0.064 + 2.7);
    const kS3 = Math.sin(wx * 0.082 - wy * 0.045 + 0.6);
    const smallHills = (Math.pow(Math.max(0, kS1), 2.2) * 3.8 +
                        Math.pow(Math.max(0, kS2), 2.2) * 3.2 +
                        Math.pow(Math.max(0, kS3), 2.4) * 2.8);

    // Category B: 25-45 Car-Sized Medium Knolls (~125m - 225m diameter, 4.5m - 8.0m height)
    const kM1 = Math.sin(wx * 0.032 - wy * 0.026 + 0.9);
    const kM2 = Math.cos(wx * 0.024 + wy * 0.031 + 2.2);
    const kM3 = Math.sin(wx * -0.038 - wy * 0.019 + 1.5);
    const medHills = (Math.pow(Math.max(0, kM1), 1.9) * 5.8 +
                      Math.pow(Math.max(0, kM2), 1.9) * 5.2 +
                      Math.pow(Math.max(0, kM3), 2.0) * 4.4);

    // Category C: 50-75 Car-Sized Large Mini Hills (~250m - 375m diameter, 7.0m - 12.0m height)
    const kL1 = Math.sin(wx * 0.016 + wy * 0.013 + 1.8);
    const kL2 = Math.cos(wx * -0.018 + wy * 0.015 + 0.4);
    const largeHills = (Math.pow(Math.max(0, kL1), 1.7) * 8.5 +
                        Math.pow(Math.max(0, kL2), 1.7) * 7.5);

    // Rolling harmonic swells connecting the hills into a flowing natural landscape
    const rollingBase = Math.sin(wx * 0.0085 + wy * 0.0070 + 1.1) * 3.4 +
                        Math.cos(wx * 0.0135 - wy * 0.0120 + 2.5) * 2.6;

    const miniHills = (smallHills + medHills + largeHills + rollingBase) * hillBlend;

    // 5. Tactile Mini Bumps & Peat Hummocks (wavelength ~55m - 130m, height 0.8m - 2.0m)
    const b1 = Math.sin(wx * 0.045 - wy * 0.038 + 0.8) * 1.05;
    const b2 = Math.cos(wx * 0.072 + wy * 0.065 + 1.9) * 0.65;
    const b3 = (Math.abs(Math.sin(wx * 0.034 + 0.5) * Math.cos(wy * 0.031 - 0.4)) - 0.35) * 1.1;
    const miniBumps = (b1 + b2 + b3) * hillBlend;

    // 6. Regional Macro Topography (wavelength 700m - 2200m, height 18m - 65m)
    const macroFlatRadius = trackHalf + 110.0;
    let macroElevation = 0;
    if (distToTrack > macroFlatRadius) {
      const blendDist = 260.0;
      const blendRatio = Math.min(1.0, (distToTrack - macroFlatRadius) / blendDist);
      const macroBlend = blendRatio * blendRatio * (3.0 - 2.0 * blendRatio);

      const m1 = Math.sin(x * 0.0010 + 0.5) * Math.cos(y * 0.0010 - 0.4) * 65.0;
      const m2 = Math.sin(x * 0.0022 - y * 0.0018 + 1.2) * 28.0;
      const m3 = Math.cos(x * 0.0045 + y * 0.0040) * 12.0;
      macroElevation = Math.max(0, m1 + m2 + m3 + 16.0) * macroBlend;
    }

    let elevation = macroElevation + miniHills + miniBumps;

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

    // Bulletproof Lake Basin Sculpting:
    // Guarantees terrain is fully hollowed out below the water level inside the lake perimeter,
    // with smooth, natural shoreline banking into surrounding hills.
    const { lakes, river } = this.getWaterBodies();
    for (const lake of lakes) {
      const dx = (x - lake.cx) / lake.rx;
      const dy = (y - lake.cy) / lake.ry;
      const lakeDist = Math.hypot(dx, dy);

      if (lakeDist < 1.40) {
        // Deep lake bed: 4.5m to 8.5m below water level
        const bedDepth = 4.5 + 4.0 * Math.pow(Math.max(0, 1.0 - Math.min(1.0, lakeDist)), 1.5);
        const bedElevation = Math.max(-0.08, lake.waterZ - bedDepth);

        if (lakeDist <= 0.95) {
          // Deep interior: strictly clamped to underwater basin bed
          elevation = Math.min(elevation, bedElevation);
        } else {
          // Shoreline slope transition (0.95 to 1.40):
          // Smooth cubic Hermite interpolation from lake bed up to surrounding terrain
          const t = (lakeDist - 0.95) / (1.40 - 0.95);
          const sCurve = t * t * (3.0 - 2.0 * t);
          const blended = bedElevation + (elevation - bedElevation) * sCurve;

          // Critical physical constraint: any point inside or on the lake boundary (lakeDist <= 1.0)
          // MUST be strictly below the water surface so terrain NEVER pokes into or above water!
          const maxAllowed = (lakeDist <= 1.02)
            ? (lake.waterZ - 0.35 - (1.02 - lakeDist) * 3.5)
            : (lake.waterZ - 0.35 + (lakeDist - 1.02) * 45.0);

          elevation = Math.min(blended, maxAllowed);
        }
      }
    }

    // Carve riverbed trench below water level
    for (let i = 0; i < river.length; i += 2) {
      const rp = river[i];
      const rDist = Math.hypot(x - rp.x, y - rp.y);
      const rRadius = rp.width * 1.8;
      if (rDist < rRadius) {
        const bedElevation = Math.max(-0.08, rp.waterZ - 3.5);
        if (rDist <= rp.width * 0.5) {
          elevation = Math.min(elevation, bedElevation);
        } else {
          const t = (rDist - rp.width * 0.5) / (rRadius - rp.width * 0.5);
          const sCurve = t * t * (3.0 - 2.0 * t);
          const blended = bedElevation + (elevation - bedElevation) * sCurve;
          const maxAllowed = rp.waterZ - 0.25 + (t * 20.0);
          elevation = Math.min(blended, maxAllowed);
        }
      }
    }

    return Math.max(-0.08, elevation);
  }

  getExactMeshHeight(worldX, worldY) {
    if (!this.terrainMesh || !this.terrainMesh.geometry || !this.terrainMesh.geometry.attributes.position) {
      return this.getTerrainHeight(worldX, worldY);
    }
    const pos = this.terrainMesh.geometry.attributes.position.array;
    const w = 24000;
    const segs = 160;
    const gridX1 = segs + 1;
    const seg = w / segs;

    // Convert worldX, worldY into grid cell coordinates
    const u = Math.max(0, Math.min(segs - 1e-6, (worldX + w / 2) / seg));
    const v = Math.max(0, Math.min(segs - 1e-6, (w / 2 - worldY) / seg));

    const col = Math.floor(u);
    const row = Math.floor(v);
    const fx = u - col;
    const fy = v - row;

    const a = row * gridX1 + col;
    const b = (row + 1) * gridX1 + col;
    const c = (row + 1) * gridX1 + (col + 1);
    const d = row * gridX1 + (col + 1);

    const za = pos[a * 3 + 2];
    const zb = pos[b * 3 + 2];
    const zc = pos[c * 3 + 2];
    const zd = pos[d * 3 + 2];

    if (fx + fy <= 1) {
      return za * (1 - fx - fy) + zd * fx + zb * fy;
    } else {
      return zc * (fx + fy - 1) + zb * (1 - fx) + zd * (1 - fy);
    }
  }

  setupTerrain() {
    if (this.terrainMesh) {
      this.scene.remove(this.terrainMesh);
      if (this.terrainMesh.geometry) this.terrainMesh.geometry.dispose();
      if (this.terrainMesh.material) this.terrainMesh.material.dispose();
      this.terrainMesh = null;
    }

    const w = 24000;
    const segs = 160;
    const geo = new THREE.PlaneGeometry(w, w, segs, segs);
    const pos = geo.attributes.position.array;
    const count = geo.attributes.position.count;
    const colors = new Float32Array(count * 3);
    const dists = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      const vx = pos[i * 3];
      const vy = pos[i * 3 + 1];
      dists[i] = this.getMinDistToTrack(vx, -vy);
      pos[i * 3 + 2] = this.getTerrainHeight(vx, vy);
    }

    // Bulletproof Topological Clearance for Track & Water Bodies:
    if (geo.index) {
      const indices = geo.index.array;
      const numTris = indices.length / 3;
      const trackHalfDist = ((this.track && this.track.width) || 84) * 0.5;
      const { lakes: waterLakes } = this.getWaterBodies();

      for (let k = 0; k < numTris; k++) {
        const iA = indices[k * 3];
        const iB = indices[k * 3 + 1];
        const iC = indices[k * 3 + 2];
        const minD = Math.min(dists[iA], dists[iB], dists[iC]);

        // 1. Roadbed clearance
        if (minD <= trackHalfDist + 240.0) {
          if (pos[iA * 3 + 2] > 0.0) pos[iA * 3 + 2] = 0.0;
          if (pos[iB * 3 + 2] > 0.0) pos[iB * 3 + 2] = 0.0;
          if (pos[iC * 3 + 2] > 0.0) pos[iC * 3 + 2] = 0.0;
        }

        if (minD <= trackHalfDist + 65.0) {
          if (pos[iA * 3 + 2] > -0.14) pos[iA * 3 + 2] = -0.14;
          if (pos[iB * 3 + 2] > -0.14) pos[iB * 3 + 2] = -0.14;
          if (pos[iC * 3 + 2] > -0.14) pos[iC * 3 + 2] = -0.14;
        }

        // 2. Lake clearance: guarantee no triangle ever rises above lake water level
        for (const lake of waterLakes) {
          const vAx = pos[iA * 3], vAy = pos[iA * 3 + 1];
          const vBx = pos[iB * 3], vBy = pos[iB * 3 + 1];
          const vCx = pos[iC * 3], vCy = pos[iC * 3 + 1];

          const dA = Math.hypot((vAx - lake.cx) / lake.rx, (vAy - lake.cy) / lake.ry);
          const dB = Math.hypot((vBx - lake.cx) / lake.rx, (vBy - lake.cy) / lake.ry);
          const dC = Math.hypot((vCx - lake.cx) / lake.rx, (vCy - lake.cy) / lake.ry);

          const minLakeD = Math.min(dA, dB, dC);

          if (minLakeD < 1.05) {
            const clampLakeVertex = (idx, dist) => {
              if (dist <= 1.02) {
                const maxZ = lake.waterZ - 0.35 - (1.02 - dist) * 3.5;
                if (pos[idx * 3 + 2] > maxZ) pos[idx * 3 + 2] = maxZ;
              }
            };
            clampLakeVertex(iA, dA);
            clampLakeVertex(iB, dB);
            clampLakeVertex(iC, dC);
          }
        }
      }
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
      normalScale: new THREE.Vector2(1.5, 1.5),
      flatShading: false,
    });

    this.terrainMesh = new THREE.Mesh(geo, mat);
    this.terrainMesh.receiveShadow = false;
    this.terrainMesh.castShadow = false;
    this.terrainMesh.matrixAutoUpdate = false;
    this.terrainMesh.updateMatrix();
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
      lakeMesh.receiveShadow = false;
      lakeMesh.matrixAutoUpdate = false;
      lakeMesh.updateMatrix();
      this.waterGroup.add(lakeMesh);

      // Sandy gravel shoreline ring
      const shoreGeo = new THREE.RingGeometry(lake.rx * 0.96, lake.rx * 1.14, 64);
      shoreGeo.scale(1.0, lake.ry / lake.rx, 1.0);
      const shoreMesh = new THREE.Mesh(shoreGeo, shoreMat);
      shoreMesh.position.set(lake.cx, lake.cy, lake.waterZ - 0.12);
      shoreMesh.receiveShadow = false;
      shoreMesh.matrixAutoUpdate = false;
      shoreMesh.updateMatrix();
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
      riverMesh.receiveShadow = false;
      riverMesh.matrixAutoUpdate = false;
      riverMesh.updateMatrix();
      this.waterGroup.add(riverMesh);
    }

    this.waterGroup.matrixAutoUpdate = false;
    this.waterGroup.updateMatrix();
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
      vertices.push(t.ox[idx], -t.oy[idx], 0.12);
      uvs.push(0, vDist);

      // Inner point (u = uMax)
      vertices.push(t.ix[idx], -t.iy[idx], 0.12);
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
    this.trackMesh.receiveShadow = false;
    this.trackMesh.matrixAutoUpdate = false;
    this.trackMesh.updateMatrix();
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
        t.ox[i], -t.oy[i], 0.14,
        t.ox[i] + onx * lineWidth, -t.oy[i] + ony * lineWidth, 0.14
      );
      outerBorderIndices.push(v0, v1, v2, v1, v3, v2);

      // 2. Inner track edge normal pointing outwards towards centerline
      const idx = t.cx[i] - t.ix[i];
      const idy = -t.cy[i] - (-t.iy[i]);
      const iDist = Math.hypot(idx, idy) || 1;
      const inx = idx / iDist;
      const iny = idy / iDist;

      innerBorderVerts.push(
        t.ix[i], -t.iy[i], 0.14,
        t.ix[i] + inx * lineWidth, -t.iy[i] + iny * lineWidth, 0.14
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
        t.cx[i] - nx1 * dashHalfWidth, -t.cy[i] - ny1 * dashHalfWidth, 0.13,
        t.cx[i] + nx1 * dashHalfWidth, -t.cy[i] + ny1 * dashHalfWidth, 0.13,
        t.cx[iEnd] - nx2 * dashHalfWidth, -t.cy[iEnd] - ny2 * dashHalfWidth, 0.13,
        t.cx[iEnd] + nx2 * dashHalfWidth, -t.cy[iEnd] + ny2 * dashHalfWidth, 0.13
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

            const zTrk = 0.12;
            const zVrg0 = 0.12 + 0.10 * (w0 / maxKerbWidth);
            const zVrg1 = 0.12 + 0.10 * (w1 / maxKerbWidth);

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

          const zTrk = 0.12;
          const zVrg = 0.22;

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

            const zTrk = 0.12;
            const zVrg0 = 0.12 + 0.10 * (w0 / maxKerbWidth);
            const zVrg1 = 0.12 + 0.10 * (w1 / maxKerbWidth);

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
    tarmacBand.position.set((ix + ox) / 2, (iy + oy) / 2, 0.14);

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
      0.15
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
    this.lapPlateTexture.generateMipmaps = false;

    const displayMat = new THREE.MeshStandardMaterial({
      map: this.lapPlateTexture,
      emissive: 0xffffff,
      emissiveMap: this.lapPlateTexture,
      emissiveIntensity: 1.4,
      roughness: 0.15,
      metalness: 0.05,
    });
    this.lapPlateDisplayMat = displayMat;

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
    this.updateLapPlate(null, null);

    batchStaticMeshes(gantryGroup);
    this.decorGroup.add(gantryGroup);
    this.setupStartingGridBoxes();
  }

  setupStartingGridBoxes() {
    if (this.gridBoxesGroup) {
      this.decorGroup.remove(this.gridBoxesGroup);
    }
    this.gridBoxesGroup = new THREE.Group();
    const t = this.track;
    if (!t || !t.N) return;

    const trackWidth = t.width || 84;
    // Authentic F1 grid box dimensions for 26-unit cars: 30 units long x 15 units wide
    const boxLength = 30.0;
    const boxWidth = 15.0;
    const pop = CONFIG.ga?.population || 20;

    const lineMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.6,
      metalness: 0.1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -5,
      polygonOffsetUnits: -5,
      depthTest: true,
    });

    const yellowStopMat = new THREE.MeshStandardMaterial({
      color: 0xfacc15,
      roughness: 0.5,
      metalness: 0.1,
      side: THREE.DoubleSide,
      polygonOffset: true,
      polygonOffsetFactor: -6,
      polygonOffsetUnits: -6,
      depthTest: true,
    });

    for (let i = 0; i < pop; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2; // 0 = inside/pole, 1 = outside
      // Generous F1 row spacing (34 units) and stagger (17 units) so cars have clean clearance without touching
      const distBack = 20 + row * 34 + (col === 1 ? 17 : 0);
      const latOffset = (col === 0 ? -1 : 1) * (trackWidth * 0.22);

      const sampleIdx = t.wrap(Math.round(t.N - distBack / t.spacing));
      const cx = t.cx[sampleIdx];
      const cy = t.cy[sampleIdx];
      const tx = t.tx[sampleIdx];
      const ty = t.ty[sampleIdx];
      const nx = -ty;
      const ny = tx;

      const posX = cx + nx * latOffset;
      const posY = cy + ny * latOffset;
      const roadAngle = Math.atan2(ty, tx);

      const slotGroup = new THREE.Group();
      slotGroup.position.set(posX, posY, 0.14);
      slotGroup.rotation.z = roadAngle;

      // 1. Front yellow stop marker line (where front wing aligns)
      const stopGeo = new THREE.PlaneGeometry(boxWidth, 0.85);
      const stopMesh = new THREE.Mesh(stopGeo, yellowStopMat);
      stopMesh.position.set(0, boxLength * 0.43, 0);
      slotGroup.add(stopMesh);

      // 2. Left and right white slot guide lines
      const sideGeo = new THREE.PlaneGeometry(0.40, boxLength * 0.88);
      const leftLine = new THREE.Mesh(sideGeo, lineMat);
      leftLine.position.set(-boxWidth * 0.5, 0, 0);
      const rightLine = new THREE.Mesh(sideGeo, lineMat);
      rightLine.position.set(boxWidth * 0.5, 0, 0);
      slotGroup.add(leftLine, rightLine);

      // 3. Rear transverse line
      const rearGeo = new THREE.PlaneGeometry(boxWidth, 0.35);
      const rearMesh = new THREE.Mesh(rearGeo, lineMat);
      rearMesh.position.set(0, -boxLength * 0.45, 0);
      slotGroup.add(rearMesh);

      this.gridBoxesGroup.add(slotGroup);
    }

    batchStaticMeshes(this.gridBoxesGroup);
    this.gridBoxesGroup.visible = Boolean(CONFIG.gridBox ?? true);
    this.decorGroup.add(this.gridBoxesGroup);
  }

  setGridBoxVisible(visible) {
    if (this.gridBoxesGroup) {
      this.gridBoxesGroup.visible = Boolean(visible);
    }
  }

  updateGantryLights(sim) {
    if (!this.gantryLedMats || this.gantryLedMats.length === 0) return;

    const startDelay = CONFIG.generation?.startDelay || 2.0;
    const t = sim ? sim.time : startDelay;

    if (this._recordCelebrationUntil && performance.now() < this._recordCelebrationUntil) {
      // Celebration strobe sequence across the 5 lights
      const tNow = performance.now();
      const isRace = this._recordType === 'race';
      const strobeIdx = Math.floor((tNow / (isRace ? 85 : 110)) % 5);
      for (let i = 0; i < 5; i++) {
        const mat = this.gantryLedMats[i];
        if (mat) {
          if (i === strobeIdx) {
            mat.color.setHex(0xffffff);
            mat.emissive.setHex(0xffffff);
            mat.emissiveIntensity = 6.0;
          } else if (Math.abs(i - strobeIdx) === 1) {
            mat.color.setHex(isRace ? 0x38bdf8 : 0xc084fc);
            mat.emissive.setHex(isRace ? 0x0284c7 : 0xa855f7);
            mat.emissiveIntensity = 4.5;
          } else {
            mat.color.setHex(isRace ? 0x34d399 : 0xfbbf24);
            mat.emissive.setHex(isRace ? 0x10b981 : 0xf59e0b);
            mat.emissiveIntensity = 2.5;
          }
        }
      }
      return;
    }

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

  updateLapPlateTexture(dataOrMain, subText, accentColor = '#38bdf8', isFinal = false) {
    if (!this.lapPlateCtx) return;
    const ctx = this.lapPlateCtx;
    const w = 1024;
    const h = 320;

    let data;
    if (dataOrMain && typeof dataOrMain === 'object') {
      data = dataOrMain;
    } else {
      data = {
        lapsMain: dataOrMain || '5 LAPS',
        lapsSub: subText || 'TO GO',
        lapsLabel: 'LAPS TO GO',
        lapsColor: accentColor,
        bestMain: '--.--s',
        bestSub: 'CIRCUIT RECORD',
        bestLabel: 'BEST LAP',
        bestColor: accentColor,
        topHeaderLeft: 'GRAND PRIX',
        topHeaderCenter: subText || 'LAP 1 OF 5',
        topHeaderRight: 'LIVE',
        accentColor: accentColor,
        isFinal: isFinal,
        isCelebrating: false,
      };
    }

    ctx.clearRect(0, 0, w, h);

    // Deep high-contrast dark chassis background
    ctx.fillStyle = '#040711';
    ctx.fillRect(0, 0, w, h);

    // Subtle carbon grid scanline pattern
    ctx.fillStyle = 'rgba(255, 255, 255, 0.025)';
    for (let y = 0; y < h; y += 8) {
      ctx.fillRect(0, y, w, 4);
    }

    const mainBorderColor = data.accentColor || '#38bdf8';

    // Outer neon glow border
    ctx.lineWidth = 10;
    ctx.strokeStyle = mainBorderColor;
    ctx.strokeRect(5, 5, w - 10, h - 10);

    // Inner bevel border
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
    ctx.strokeRect(16, 16, w - 32, h - 32);

    // Checkered pattern side accents when in Final Lap or Chequered Flag
    if (data.isFinal) {
      const chSize = 20;
      const chRows = Math.floor((h - 40) / chSize);
      for (let r = 0; r < chRows; r++) {
        for (let c = 0; c < 2; c++) {
          ctx.fillStyle = (r + c) % 2 === 0 ? '#ffffff' : '#090d16';
          ctx.fillRect(20 + c * chSize, 20 + r * chSize, chSize, chSize);
          ctx.fillRect(w - 20 - (c + 1) * chSize, 20 + r * chSize, chSize, chSize);
        }
      }
    }

    // -------------------------------------------------------------
    // TOP STATUS BANNER (y = 22 .. 68)
    // -------------------------------------------------------------
    const topBarY = 22;
    const topBarH = 46;
    ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
    ctx.beginPath();
    ctx.roundRect(64, topBarY, w - 128, topBarH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.16)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Top Header Left (e.g. "LEADER: P1" or "START GRID")
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = '800 20px "Outfit", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText((data.topHeaderLeft || 'GRAND PRIX').toUpperCase(), 84, topBarY + topBarH * 0.5);

    // Top Header Center (e.g. "LAP 2 OF 5")
    ctx.textAlign = 'center';
    ctx.font = '900 26px "Outfit", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = mainBorderColor;
    ctx.shadowColor = mainBorderColor;
    ctx.shadowBlur = 12;
    ctx.fillText((data.topHeaderCenter || 'LAP 1 OF 5').toUpperCase(), w * 0.5, topBarY + topBarH * 0.5);
    ctx.shadowBlur = 0;

    // Top Header Right (e.g. "● LIVE TIMING" or "★ RECORD PACE")
    ctx.textAlign = 'right';
    ctx.font = '800 20px "Outfit", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = data.isCelebrating ? '#facc15' : '#38bdf8';
    ctx.fillText((data.topHeaderRight || '● LIVE').toUpperCase(), w - 84, topBarY + topBarH * 0.5);

    // Horizontal Divider Line below Top Banner
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(64, 76);
    ctx.lineTo(w - 64, 76);
    ctx.stroke();

    // -------------------------------------------------------------
    // CENTER VERTICAL DIVIDER (x = 512, y = 82 .. 300)
    // -------------------------------------------------------------
    const centerGrad = ctx.createLinearGradient(512, 82, 512, 300);
    centerGrad.addColorStop(0, 'rgba(56, 189, 248, 0.1)');
    centerGrad.addColorStop(0.5, mainBorderColor);
    centerGrad.addColorStop(1, 'rgba(56, 189, 248, 0.1)');
    ctx.strokeStyle = centerGrad;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(512, 82);
    ctx.lineTo(512, 300);
    ctx.stroke();

    // Subtle neon connector dots
    ctx.fillStyle = mainBorderColor;
    ctx.beginPath();
    ctx.arc(512, 82, 3.5, 0, Math.PI * 2);
    ctx.arc(512, 300, 3.5, 0, Math.PI * 2);
    ctx.fill();

    // -------------------------------------------------------------
    // LEFT HALF: LAPS TO GO (Center x = 276)
    // -------------------------------------------------------------
    const leftCenterX = 276;
    const lapsColor = data.lapsColor || '#38bdf8';

    // Left Category Header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 20px "Outfit", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = lapsColor;
    ctx.shadowColor = lapsColor;
    ctx.shadowBlur = 8;
    ctx.fillText((data.lapsLabel || 'LAPS TO GO').toUpperCase(), leftCenterX, 88);
    ctx.shadowBlur = 0;

    // Left Primary Large Digits (Dynamic Font Size)
    ctx.textBaseline = 'middle';
    const lapsText = String(data.lapsMain || '5 LAPS');
    let lapsFontSize = 84;
    if (lapsText.length > 9) lapsFontSize = 54;
    else if (lapsText.length > 6) lapsFontSize = 66;

    ctx.font = `900 ${lapsFontSize}px "JetBrains Mono", "Outfit", Impact, sans-serif`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = lapsColor;
    ctx.shadowBlur = 20;
    ctx.fillText(lapsText, leftCenterX, 184);
    ctx.shadowBlur = 0;

    // Left Subtext
    ctx.textBaseline = 'bottom';
    ctx.font = '700 22px "Outfit", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText((data.lapsSub || 'TO GO').toUpperCase(), leftCenterX, 292);

    // -------------------------------------------------------------
    // RIGHT HALF: BEST LAP (Center x = 748)
    // -------------------------------------------------------------
    const rightCenterX = 748;
    const bestColor = data.bestColor || '#38bdf8';

    // Right Category Header
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.font = '800 20px "Outfit", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = bestColor;
    ctx.shadowColor = bestColor;
    ctx.shadowBlur = 8;
    ctx.fillText((data.bestLabel || 'BEST LAP').toUpperCase(), rightCenterX, 88);
    ctx.shadowBlur = 0;

    // Right Primary Large Digits (Dynamic Font Size)
    ctx.textBaseline = 'middle';
    const bestText = String(data.bestMain || '--.--s');
    let bestFontSize = 84;
    if (bestText.length > 9) bestFontSize = 56;
    else if (bestText.length > 6) bestFontSize = 68;

    ctx.font = `900 ${bestFontSize}px "JetBrains Mono", "Outfit", Impact, monospace`;
    ctx.fillStyle = '#ffffff';
    ctx.shadowColor = bestColor;
    ctx.shadowBlur = data.isCelebrating ? 28 : 20;
    ctx.fillText(bestText, rightCenterX, 184);
    ctx.shadowBlur = 0;

    // Right Subtext
    ctx.textBaseline = 'bottom';
    ctx.font = '700 22px "Outfit", "Segoe UI", system-ui, sans-serif';
    ctx.fillStyle = data.isCelebrating ? '#f8fafc' : '#94a3b8';
    ctx.fillText((data.bestSub || 'CIRCUIT RECORD').toUpperCase(), rightCenterX, 292);

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

    let leaderTag = 'P1';
    if (currentLeader) {
      if (currentLeader.manual) {
        leaderTag = 'PLAYER';
      } else if (currentLeader.carNumber) {
        leaderTag = `CAR #${currentLeader.carNumber}`;
      } else if (typeof currentLeader.idx === 'number') {
        leaderTag = `CAR #${currentLeader.idx + 1}`;
      }
    }

    // 1. Determine Laps To Go Panel Data
    let lapsLabel = 'RACE DISTANCE';
    let lapsMain = `${lapsRemaining} LAPS`;
    let lapsSub = 'TO GO';
    let lapsColor = '#38bdf8'; // Cyan
    let isFinal = false;

    if (simTime < startDelay) {
      lapsLabel = 'START GRID';
      lapsMain = `${maxLaps} LAPS`;
      lapsSub = 'COUNTDOWN · HOLD GRID';
      lapsColor = '#ef4444'; // Red
      isFinal = false;
    } else if (simTime < startDelay + 2.8) {
      lapsLabel = 'RACE START';
      lapsMain = `${maxLaps} LAPS`;
      lapsSub = 'GREEN LIGHTS · GO!';
      lapsColor = '#22c55e'; // Green
      isFinal = true;
    } else if (isFinished || lapsDone >= maxLaps || (sim?.checkeredFlagTimer !== null && sim?.checkeredFlagTimer > 0)) {
      lapsLabel = 'RACE FINISH';
      lapsMain = 'CHEQUERED';
      const rem = (sim?.checkeredFlagTimer !== null && sim?.checkeredFlagTimer > 0)
        ? `${Math.ceil(sim.checkeredFlagTimer)}s WINDOW`
        : 'WINNER FINISHED';
      lapsSub = `FLAG · ${rem}`;
      lapsColor = '#fbbf24'; // Radiant Gold
      isFinal = true;
    } else if (lapsRemaining === 1) {
      lapsLabel = 'FINAL LAP';
      lapsMain = 'FINAL LAP';
      lapsSub = `1 LAP TO GO · ${leaderTag}`;
      lapsColor = '#fbbf24'; // Radiant Gold
      isFinal = true;
    } else if (lapsRemaining === 2) {
      lapsLabel = 'LAPS TO GO';
      lapsMain = '2 LAPS';
      lapsSub = 'NEXT IS FINAL LAP';
      lapsColor = '#f472b6'; // Magenta
    } else {
      lapsLabel = 'LAPS TO GO';
      lapsMain = `${lapsRemaining} LAPS`;
      lapsSub = `LAP ${currentLap} OF ${maxLaps}`;
      lapsColor = '#38bdf8'; // Cyan
    }

    // 2. Determine Best Lap Data
    const raceBest = (sim?.raceBestLap && Number.isFinite(sim.raceBestLap) && sim.raceBestLap > 5 && sim.raceBestLap < 99)
      ? sim.raceBestLap
      : null;
    const allTimeRecord = (sim?.bestLapEver && Number.isFinite(sim.bestLapEver) && sim.bestLapEver > 5 && sim.bestLapEver < 99)
      ? sim.bestLapEver
      : null;

    let bestLapTime = null;
    let bestLapHolder = null;
    let isRecord = false;

    if (raceBest !== null) {
      bestLapTime = raceBest;
      if (sim?.player && sim.player.bestLap && Math.abs(sim.player.bestLap - raceBest) < 0.02) {
        bestLapHolder = 'PLAYER';
      } else if (sim?.cars) {
        const matchingCar = sim.cars.find((c) => c.bestLap && Math.abs(c.bestLap - raceBest) < 0.02);
        if (matchingCar) {
          bestLapHolder = `CAR #${matchingCar.carNumber || (matchingCar.idx + 1)}`;
        }
      }
      if (!bestLapHolder) bestLapHolder = leaderTag || 'P1';

      if (allTimeRecord !== null && raceBest <= allTimeRecord + 0.005) {
        isRecord = true;
      }
    } else if (allTimeRecord !== null) {
      bestLapTime = allTimeRecord;
      bestLapHolder = 'RECORD';
      isRecord = true;
    }

    const nowMs = performance.now();
    const isCelebrating = Boolean(this._recordCelebrationUntil && nowMs < this._recordCelebrationUntil);

    let bestLabel = 'BEST LAP';
    let bestMain = '--.--s';
    let bestSub = 'AWAITING LAP 1';
    let bestColor = '#38bdf8';

    if (isCelebrating) {
      const isRaceCelebration = this._recordType === 'race';
      const recTime = (this._recordLapDuration && Number.isFinite(this._recordLapDuration))
        ? `${this._recordLapDuration.toFixed(2)}s`
        : (bestLapTime ? `${bestLapTime.toFixed(2)}s` : '--.--s');
      const recCar = this._recordCarName || bestLapHolder || 'P1';

      bestMain = recTime;
      if (isRaceCelebration) {
        bestLabel = '★ RACE FASTEST ★';
        bestSub = `${recCar} · SESSION BEST`;
        bestColor = '#38bdf8';
      } else {
        bestLabel = '👑 CIRCUIT RECORD 👑';
        bestSub = `${recCar} · ALL-TIME FASTEST`;
        bestColor = '#c084fc';
      }

      if (this.lapPlateDisplayMat) {
        this.lapPlateDisplayMat.emissiveIntensity = 1.7 + 0.6 * Math.sin(nowMs * (isRaceCelebration ? 0.012 : 0.008));
      }
    } else {
      if (this.lapPlateDisplayMat && this.lapPlateDisplayMat.emissiveIntensity !== 1.4) {
        this.lapPlateDisplayMat.emissiveIntensity = 1.4;
      }

      if (bestLapTime !== null) {
        bestMain = `${bestLapTime.toFixed(2)}s`;
        if (isRecord) {
          bestLabel = '👑 CIRCUIT RECORD';
          bestSub = raceBest !== null ? `${bestLapHolder} · FASTEST EVER` : 'CIRCUIT BENCHMARK';
          bestColor = '#c084fc'; // Purple
        } else {
          bestLabel = '⚡ RACE BEST';
          bestSub = `${bestLapHolder} · SESSION BEST`;
          bestColor = '#38bdf8'; // Cyan
        }
      } else {
        bestLabel = 'BEST LAP';
        bestMain = '--.--s';
        bestSub = 'AWAITING FIRST LAP';
        bestColor = '#64748b';
      }
    }

    // 3. Top Header Data
    let topHeaderLeft = `🏎️ LEADER: ${leaderTag}`;
    let topHeaderCenter = `LAP ${currentLap} OF ${maxLaps}`;
    let topHeaderRight = isCelebrating
      ? (this._recordType === 'race' ? '⚡ FASTEST LAP' : '👑 NEW RECORD')
      : (isFinal ? '🏁 CHEQUERED' : '● LIVE TIMING');

    if (simTime < startDelay) {
      topHeaderLeft = '🏁 FORMATION';
      topHeaderCenter = `GRID READY · ${maxLaps} LAPS`;
      topHeaderRight = '🔴 COUNTDOWN';
    } else if (simTime < startDelay + 2.8) {
      topHeaderLeft = '🟢 GREEN LIGHTS';
      topHeaderCenter = `RACE ON · LAP 1/${maxLaps}`;
      topHeaderRight = '⚡ LAUNCH';
    }

    const accentColor = isCelebrating
      ? (this._recordType === 'race' ? '#38bdf8' : '#c084fc')
      : (isFinal ? '#fbbf24' : (simTime < startDelay ? '#ef4444' : (lapsColor || '#38bdf8')));

    // The glow animates through the material above. Only repaint and upload the
    // scoreboard texture when its actual text or styling changes.
    const stateKey = `${lapsMain}|${lapsSub}|${lapsLabel}|${lapsColor}|${bestMain}|${bestSub}|${bestLabel}|${bestColor}|${topHeaderLeft}|${topHeaderCenter}|${topHeaderRight}|${accentColor}|${isFinal}|${isCelebrating}`;

    if (stateKey !== this._lastLapPlateKey) {
      this._lastLapPlateKey = stateKey;
      this.updateLapPlateTexture({
        lapsMain,
        lapsSub,
        lapsLabel,
        lapsColor,
        bestMain,
        bestSub,
        bestLabel,
        bestColor,
        topHeaderLeft,
        topHeaderCenter,
        topHeaderRight,
        accentColor,
        isFinal,
        isCelebrating,
      });
    }
  }

  triggerRecordCelebration(lapDuration, car, recordType = 'overall') {
    if (!Number.isFinite(lapDuration) || lapDuration <= 0) return;
    this._recordCelebrationUntil = performance.now() + (recordType === 'race' ? 6500 : 8500);
    this._recordLapDuration = lapDuration;
    const num = car ? (car.manual ? 7 : (car.carNumber || (typeof car.idx === 'number' ? car.idx + 1 : 1))) : 1;
    this._recordCarName = car ? (car.manual ? 'PLAYER' : `CAR #${num}`) : 'P1';
    this._recordType = recordType;
    this._lastLapPlateKey = '';
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
    const teamIdx = isPlayer ? 1 : (Math.floor(carIdx / 2) % TEAM_PALETTE.length);
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
    this.f1Loaded = false;

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
      const carNumber = getCarNumber(i, false);
      const carMesh = this.createCarMesh(null, false, i, carNumber);
      carMesh.visible = false;
      const badge = this.createBadgeSprite();
      carMesh.userData.badgeSprite = badge;
      carMesh.add(badge);
      this.carPool.push(carMesh);
      this.scene.add(carMesh);
    }

    // Setup Circuit Record Ghost car
    this.setupRecordGhostMesh(null);

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
        this.f1Loaded = true;
        carSideviewRenderer.init([
          { teamIdx: 1, isPlayer: true, carNumber: 7, mesh: this.playerCar.children[0] },
          ...this.carPool.map((car, i) => ({
            teamIdx: Math.floor(i / 2) % TEAM_PALETTE.length,
            isPlayer: false, carNumber: getCarNumber(i, false), mesh: car.children[0],
          })),
        ]);
      },
      undefined,
      (err) => {
        console.warn('Could not load full 2022 F1 3D model, using procedural race car mesh:', err);
        this.f1Loaded = true;
      }
    );
  }

  initF1DecalGeometries(template) {
    this.f1DecalGeometries = {};
    this.f1MergedDecalGeometry?.dispose();
    this.f1MergedDecalGeometry = null;
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
      const carNumber = getCarNumber(i, false);
      this.swapCarMesh(this.carPool[i], template, null, false, i, carNumber);
    }

    this.setupRecordGhostMesh(template);
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

  updateRecordGhost(sim, opts) {
    const mesh = this.recordGhostMesh;
    if (!mesh) return;
    const hasRecord = Number.isFinite(sim?.raceGhostLap) && sim.raceGhostLap > 5 && sim.raceGhostLap < 60;
    this.recordGhostStatus = opts.recordGhost === false ? 'off' : hasRecord ? 'ready' : 'waiting';
    mesh.visible = false;
    if (this.recordGhostStatus !== 'ready') return;
    const pose = sim.getRecordGhostRenderState?.(opts.renderAlpha);
    if (!pose || !Number.isFinite(pose.x) || !Number.isFinite(pose.y) || !Number.isFinite(pose.angle)) {
      this.recordGhostStatus = 'waiting';
      return;
    }
    mesh.visible = true;
    mesh.position.set(pose.x, -pose.y, 0.12);
    mesh.rotation.order = 'ZYX';
    mesh.rotation.set(0, 0, -pose.angle);
    const source = sim.raceGhostSource;
    const carLabel = Number.isFinite(source?.carNumber) ? ` #${source.carNumber}` : '';
    this.updateRecordGhostBadgeText(`⚡ GHOST${carLabel} · ${sim.raceGhostLap.toFixed(2)}s`);
    if (mesh.userData.badgeSprite) mesh.userData.badgeSprite.visible = true;
    if (!this._ghostNdc) this._ghostNdc = new THREE.Vector3();
    this._ghostNdc.set(pose.x, -pose.y, 2).project(this.camera);
    this.recordGhostStatus = Math.abs(this._ghostNdc.x) <= 1.1 && Math.abs(this._ghostNdc.y) <= 1.1 &&
      this._ghostNdc.z >= -1 && this._ghostNdc.z <= 1 ? 'visible' : 'outside-view';
  }

  createRecordGhostBadgeSprite(text = '⚡ RACE GHOST') {
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext('2d');

    // Glass pill background
    ctx.fillStyle = 'rgba(15, 23, 42, 0.70)';
    ctx.beginPath();
    ctx.roundRect(8, 8, 240, 48, 24);
    ctx.fill();

    // Neon cyan glow border
    ctx.strokeStyle = 'rgba(0, 229, 255, 0.80)';
    ctx.lineWidth = 2.5;
    ctx.stroke();

    // Text
    ctx.fillStyle = '#00e5ff';
    ctx.font = 'bold 20px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, 128, 32);

    const tex = new THREE.CanvasTexture(canvas);
    tex.needsUpdate = true;
    const mat = new THREE.SpriteMaterial({
      map: tex,
      depthTest: false,
      depthWrite: false,
      transparent: true,
      opacity: 0.85,
    });
    const sprite = new THREE.Sprite(mat);
    sprite.renderOrder = 1000;
    sprite.scale.set(28, 7, 1);
    sprite.position.set(0, 0, 10);
    return sprite;
  }

  updateRecordGhostBadgeText(text) {
    if (!this.recordGhostMesh) return;
    if (this._lastGhostBadgeText === text) return;
    this._lastGhostBadgeText = text;
    const oldBadge = this.recordGhostMesh.userData.badgeSprite;
    if (oldBadge) {
      this.recordGhostMesh.remove(oldBadge);
      if (oldBadge.material && oldBadge.material.map) oldBadge.material.map.dispose();
      if (oldBadge.material) oldBadge.material.dispose();
    }
    const newBadge = this.createRecordGhostBadgeSprite(text);
    this.recordGhostMesh.userData.badgeSprite = newBadge;
    this.recordGhostMesh.add(newBadge);
  }

  setupRecordGhostMesh(template) {
    this._lastGhostBadgeText = null;
    if (!this.recordGhostMesh) {
      this.recordGhostMesh = new THREE.Group();
      this.recordGhostMesh.visible = false;
      this.scene.add(this.recordGhostMesh);
    }
    while (this.recordGhostMesh.children.length > 0) {
      this.recordGhostMesh.remove(this.recordGhostMesh.children[0]);
    }

    if (!template) {
      const proceduralGhost = this.createCarMesh('#00e5ff', false, 99, 0);
      proceduralGhost.traverse((child) => {
        if (child.isMesh && child.material) {
          const mat = child.material.clone();
          mat.transparent = true;
          mat.opacity = 0.45;
          mat.color?.set(0x00e5ff);
          mat.emissive?.set(0x0099cc);
          mat.emissiveIntensity = 0.65;
          mat.depthWrite = false;
          mat.depthTest = true;
          child.material = mat;
          child.renderOrder = 400; // After road skid ribbons (350), before airborne smoke (450).
        }
      });
      this.recordGhostMesh.add(proceduralGhost);
    } else {
      const cloned = template.clone(true);
      const s = 6.0;
      cloned.scale.set(s, s, s);
      cloned.rotation.set(Math.PI / 2, 0, 0);
      cloned.position.set(0, 0, 0);

      const ghostMat = new THREE.MeshStandardMaterial({
        color: 0x00e5ff,
        emissive: 0x0099cc,
        emissiveIntensity: 0.65,
        transparent: true,
        opacity: 0.45,
        roughness: 0.30,
        metalness: 0.50,
        depthWrite: false,
        depthTest: true,
      });

      cloned.traverse((child) => {
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
          child.material = ghostMat;
          child.renderOrder = 400; // Transparent body must composite over skidmarks on the road.
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });

      const ghostSub = new THREE.Group();
      ghostSub.add(cloned);
      ghostSub.rotation.z = Math.PI;
      this.recordGhostMesh.add(ghostSub);
    }

    const badge = this.createRecordGhostBadgeSprite('⚡ RACE GHOST');
    this.recordGhostMesh.userData.badgeSprite = badge;
    this.recordGhostMesh.add(badge);
  }

  createF1CarMesh(template, color, isPlayer = false, carIdx = 0, carNumber = 1) {
    const teamIdx = isPlayer ? 1 : (Math.floor(carIdx / 2) % TEAM_PALETTE.length);
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
    // Livery is a vertex attribute; identical body shaders can share one material.
    if (!this.f1BodyMaterials) this.f1BodyMaterials = new Map();
    const bodyGeometries = [];

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
        child.castShadow = false;
        child.receiveShadow = false;

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

        bodyGeometries.push(geo);
        const materialKey = `${origMap?.uuid || ''}_${origRoughness}_${origMetalness}`;
        const sharedMaterial = this.f1BodyMaterials.get(materialKey);
        if (sharedMaterial) {
          child.material = sharedMaterial;
          return;
        }

        const mat = new THREE.MeshStandardMaterial({
          map: origMap,
          roughness: origRoughness,
          metalness: origMetalness,
        });

        mat.customProgramCacheKey = () => 'f1_ground_effect_body_v1';

        mat.onBeforeCompile = (shader) => {
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
        this.f1BodyMaterials.set(materialKey, mat);
      }
    });

    // Body and wheel parts have identical shading; retain every triangle in one draw.
    batchStaticMeshes(model);
    const retainedGeometries = new Set();
    model.traverse((child) => { if (child.isMesh) retainedGeometries.add(child.geometry); });
    for (const geometry of bodyGeometries) {
      if (!retainedGeometries.has(geometry)) geometry.dispose();
    }
    carSubGroup.add(model);

    // Apply calibrated 3D wrapped number decals (Front, Top, Rear, Left, Right)
    if (this.f1DecalGeometries) {
      const decalMat = new THREE.MeshBasicMaterial({
        map: numTex,
        transparent: true,
        side: THREE.FrontSide,
        depthTest: true,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -4,
        polygonOffsetUnits: -4,
      });

      // All five wrapped decals use the same texture and local coordinate space.
      if (!this.f1MergedDecalGeometry) {
        this.f1MergedDecalGeometry = mergeGeometries(Object.values(this.f1DecalGeometries).filter(Boolean), false);
      }
      if (this.f1MergedDecalGeometry) {
        const decalMesh = new THREE.Mesh(this.f1MergedDecalGeometry, decalMat);
        decalMesh.renderOrder = 999;
        carSubGroup.add(decalMesh);
      }
    }

    // Yaw 180Â° so the car's nose points forward along velocity vector +X
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
    const numClusters = 42 + Math.floor(rand() * 12);
    const clusterCenters = [];
    for (let c = 0; c < numClusters; c++) {
      // Each grove has a dominant tree species archetype (0: Pine, 1: Oak, 2: Cypress, 3: Birch)
      const groveType = Math.floor(rand() * 4);
      clusterCenters.push({
        cx: minX + rand() * (maxX - minX),
        cy: minY + rand() * (maxY - minY),
        radius: 50 + rand() * 140,
        count: 14 + Math.floor(rand() * 14),
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

    // Standalone trees for natural meadow scattering on hill slopes
    const standalone = 120 + Math.floor(rand() * 40);
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
      const groundZ = this.getExactMeshHeight(x, -y);

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
        if (d2 < (ex.r * 0.45 + 5.5) ** 2) {
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

    this.placedTreePositions = allPlaced;

    const dummy = new THREE.Object3D();
    const color = new THREE.Color();
    const darkWoodMat = new THREE.MeshLambertMaterial({ color: 0x4e3827, flatShading: true });
    const paleWoodMat = new THREE.MeshLambertMaterial({ color: 0xded9cb, flatShading: true });
    const leafMat = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });

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
        const rootSink = Math.min(1.4, Math.max(0.6, trunkR * 0.45));

        // Trunk
        dummy.position.set(x, -y, groundZ - rootSink + (trunkH + rootSink) / 2);
        dummy.scale.set(trunkR, trunkR, trunkH + rootSink);
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
      pineTrunkInst.castShadow = false; pineTrunkInst.receiveShadow = false;
      tier1Inst.castShadow = false; tier1Inst.receiveShadow = false;
      tier2Inst.castShadow = false; tier2Inst.receiveShadow = false;
      tier3Inst.castShadow = false; tier3Inst.receiveShadow = false;
      tier4Inst.castShadow = false; tier4Inst.receiveShadow = false;

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
        const rootSink = Math.min(1.6, Math.max(0.7, trunkR * 0.45));

        // Trunk
        dummy.position.set(x, -y, groundZ - rootSink + (trunkH + rootSink) / 2);
        dummy.scale.set(trunkR, trunkR, trunkH + rootSink);
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
      oakTrunkInst.castShadow = false; oakTrunkInst.receiveShadow = false;
      oakMainInst.castShadow = false; oakMainInst.receiveShadow = false;
      oakLeftInst.castShadow = false; oakLeftInst.receiveShadow = false;
      oakRightInst.castShadow = false; oakRightInst.receiveShadow = false;
      oakTopInst.castShadow = false; oakTopInst.receiveShadow = false;

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
        const rootSink = Math.min(1.5, Math.max(0.6, trunkR * 0.45));

        // Sturdy Cedar Trunk
        dummy.position.set(x, -y, groundZ - rootSink + (trunkH + rootSink) / 2);
        dummy.scale.set(trunkR, trunkR, trunkH + rootSink);
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
      cedarTrunkInst.castShadow = false; cedarTrunkInst.receiveShadow = false;
      tier1Inst.castShadow = false; tier1Inst.receiveShadow = false;
      tier2Inst.castShadow = false; tier2Inst.receiveShadow = false;
      tier3Inst.castShadow = false; tier3Inst.receiveShadow = false;

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
        const rootSink = Math.min(1.2, Math.max(0.5, trunkR * 0.40));

        // Trunk
        dummy.position.set(x, -y, groundZ - rootSink + (trunkH + rootSink) / 2);
        dummy.scale.set(trunkR, trunkR, trunkH + rootSink);
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
      birchTrunkInst.castShadow = false; birchTrunkInst.receiveShadow = false;
      birchCrown1Inst.castShadow = false; birchCrown1Inst.receiveShadow = false;
      birchCrown2Inst.castShadow = false; birchCrown2Inst.receiveShadow = false;
      birchCrown3Inst.castShadow = false; birchCrown3Inst.receiveShadow = false;

      this.treeGroup.add(birchTrunkInst, birchCrown1Inst, birchCrown2Inst, birchCrown3Inst);
    }

    this.scene.add(this.treeGroup);

    if (this.allExternalTreeTemplates && this.allExternalTreeTemplates.length > 0) {
      this.populateExternalTrees();
    } else {
      this.loadExternalTreeModels();
    }
  }

  createTreeLabel(number, color = '#facc15') {
    this._treeLabelCache = this._treeLabelCache || {};
    if (this._treeLabelCache[number]) {
      return this._treeLabelCache[number].clone();
    }

    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d');

    // Outer dark circle
    ctx.beginPath();
    ctx.arc(128, 128, 118, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.94)';
    ctx.fill();

    // Vibrant thick circular ring
    ctx.strokeStyle = color;
    ctx.lineWidth = 14;
    ctx.stroke();

    // Inner subtle guide ring
    ctx.beginPath();
    ctx.arc(128, 128, 102, 0, Math.PI * 2);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.30)';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Big bold unique number
    ctx.fillStyle = '#ffffff';
    const numStr = String(number);
    const fontSize = numStr.length <= 2 ? 118 : (numStr.length === 3 ? 94 : 76);
    ctx.font = `900 ${fontSize}px "Segoe UI", system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(numStr, 128, 130);

    const texture = new THREE.CanvasTexture(canvas);
    texture.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true, opacity: 0.98 });
    const sprite = new THREE.Sprite(mat);
    sprite.scale.set(16, 16, 1);
    this._treeLabelCache[number] = sprite;
    return sprite.clone();
  }

  normalizeTreeTemplate(object, targetHeight = 24, forcedRot = null, meta = {}) {
    const wrapper = new THREE.Group();
    wrapper.userData = {
      typeId: meta.typeId || 1,
      label: meta.label || 'tree',
      pack: meta.pack || 'unknown',
      color: meta.color || '#facc15',
      targetHeight: targetHeight,
      ...meta,
    };
    const cloned = object.clone(true);

    cloned.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = false;
        child.receiveShadow = false;
        if (child.material) {
          const mats = Array.isArray(child.material) ? child.material : [child.material];
          const clonedMats = mats.map((m) => {
            const cm = m.clone();
            const matName = (cm.name || child.name || '').toLowerCase();
            const isTrunk = matName.includes('bark') || matName.includes('tran') || matName.includes('trunk');
            if (!isTrunk && meta.foliageTint) {
              cm.color.copy(meta.foliageTint);
              cm.roughness = 0.98;
              cm.metalness = 0.0;
              if ('specularIntensity' in cm) cm.specularIntensity = 0.0;
              if ('envMapIntensity' in cm) cm.envMapIntensity = 0.35;
            } else if (!isTrunk) {
              cm.roughness = 0.92;
            }
            return cm;
          });
          child.material = Array.isArray(child.material) ? clonedMats : clonedMats[0];
        }
      }
    });

    if (forcedRot) {
      if (forcedRot.x !== undefined) cloned.rotation.x = forcedRot.x;
      if (forcedRot.y !== undefined) cloned.rotation.y = forcedRot.y;
      if (forcedRot.z !== undefined) cloned.rotation.z = forcedRot.z;
    }

    cloned.position.set(0, 0, 0);
    cloned.scale.set(1, 1, 1);
    cloned.updateMatrixWorld(true);

    // Measure raw bounding box after applying explicit rotation
    let box = new THREE.Box3().setFromObject(cloned);
    const size = new THREE.Vector3();
    box.getSize(size);

    const currentHeight = size.z > 0.001 ? size.z : 1;
    const s = targetHeight / currentHeight;
    cloned.scale.set(s, s, s);
    cloned.updateMatrixWorld(true);

    // Recompute box after scaling to accurately center and anchor base
    box = new THREE.Box3().setFromObject(cloned);
    const center = new THREE.Vector3();
    box.getCenter(center);

    // Center horizontally so trunk is at (0, 0), and place ground contact at Z = 0
    cloned.position.x = -center.x;
    cloned.position.y = -center.y;
    cloned.position.z = -box.min.z;
    cloned.updateMatrixWorld(true);

    wrapper.add(cloned);
    wrapper.updateMatrixWorld(true);


    // Bake child mesh transforms relative to wrapper origin into geometry for high-performance InstancedMesh
    const parts = [];
    cloned.traverse((child) => {
      if (child.isMesh && child.geometry) {
        const bakedGeo = child.geometry.clone();
        bakedGeo.applyMatrix4(child.matrixWorld);
        parts.push({
          geometry: bakedGeo,
          material: child.material,
          name: child.name,
        });
      }
    });
    wrapper.userData.parts = parts;

    return wrapper;
  }

  loadExternalTreeModels() {
    if (this._loadingTrees) return;
    this._loadingTrees = true;

    this.externalTreeTemplatesBySpecies = { 0: [], 1: [], 2: [], 3: [] };
    this.allExternalTreeTemplates = [];

    const loader = new GLTFLoader();

    const addTemplate = (template, speciesList = [], triggerPopulate = true) => {
      if (!template) return;
      this.allExternalTreeTemplates.push(template);
      speciesList.forEach((sp) => {
        if (!this.externalTreeTemplatesBySpecies[sp]) {
          this.externalTreeTemplatesBySpecies[sp] = [];
        }
        this.externalTreeTemplatesBySpecies[sp].push(template);
      });
      if (triggerPopulate) {
        this.populateExternalTrees();
      }
    };

    // 1. Alpine Pine Tree (Type 1: User favorite, dark muted alpine needle green)
    loader.load(
      './pine_tree/scene.gltf',
      (gltf) => {
        const template = this.normalizeTreeTemplate(gltf.scene, 72, { x: Math.PI / 2, y: 0, z: 0 }, {
          typeId: 1,
          label: 'pine_tree',
          pack: 'pine',
          color: '#10b981',
          foliageTint: new THREE.Color(0.38, 0.43, 0.36),
        });
        addTemplate(template, [0, 1, 2, 3], true);
      },
      undefined,
      (err) => console.warn('Could not load pine_tree model:', err)
    );

    // 2. Low Poly Trees Free (Types 2, 3, 4: Deep, dark, desaturated woodland tones)
    loader.load(
      './low_poly_trees_free/scene.gltf',
      (gltf) => {
        const found = [];
        gltf.scene.traverse((child) => {
          if (child.name && child.name.startsWith('Tree') && child.children && child.children.length > 0) {
            found.push(child);
          }
        });
        if (found.length > 0) {
          const typeConfigs = [
            { typeId: 2, label: 'low_poly_Oak', height: 65, color: '#a855f7', species: [1], tint: new THREE.Color(0.18, 0.20, 0.15) },
            { typeId: 3, label: 'low_poly_Conifer', height: 75, color: '#3b82f6', species: [0, 2], tint: new THREE.Color(0.14, 0.17, 0.14) },
            { typeId: 4, label: 'low_poly_Birch', height: 60, color: '#eab308', species: [3], tint: new THREE.Color(0.19, 0.20, 0.15) },
          ];
          found.forEach((c, idx) => {
            const cfg = typeConfigs[idx] || { typeId: 2 + idx, label: `low_poly_${idx}`, height: 65, color: '#a855f7', species: [2, 3], tint: new THREE.Color(0.17, 0.19, 0.15) };
            const tmpl = this.normalizeTreeTemplate(c, cfg.height, { x: Math.PI, y: 0, z: 0 }, {
              typeId: cfg.typeId,
              label: cfg.label,
              pack: 'low_poly',
              color: cfg.color,
              foliageTint: cfg.tint,
            });
            addTemplate(tmpl, cfg.species, false);
          });
          this.populateExternalTrees();
        }
      },
      undefined,
      (err) => console.warn('Could not load low_poly_trees_free model:', err)
    );

    // 3. Shapespark Exterior Plants Kit (Types 5-21: Tree-01, Tree-02, Tree-03, and Bushes)
    loader.load(
      './shapespark_low_poly_exterior_plants_kit/scene.gltf',
      (gltf) => {
        const found = [];
        gltf.scene.traverse((child) => {
          if (child.name && (child.name.startsWith('Tree-') || child.name.startsWith('Bush-'))) {
            found.push(child);
          }
        });

        // Exact mapping keeping Types 11, 13, 14, 15 consistent with user badges
        const shapesparkMap = {
          'Tree-01-1_0': { typeId: 5, height: 70, color: '#06b6d4', isFamily: false },
          'Tree-01-2_1': { typeId: 6, height: 70, color: '#06b6d4', isFamily: false },
          'Tree-01-3_2': { typeId: 7, height: 68, color: '#06b6d4', isFamily: false },
          'Tree-01-4_3': { typeId: 8, height: 68, color: '#06b6d4', isFamily: false },
          'Tree-02-1_4': { typeId: 9, height: 65, color: '#f59e0b', isFamily: true },
          'Tree-02-2_5': { typeId: 10, height: 65, color: '#f59e0b', isFamily: true },
          'Tree-02-3_6': { typeId: 11, height: 65, color: '#f59e0b', isFamily: true },
          'Tree-02-4_7': { typeId: 12, height: 65, color: '#f59e0b', isFamily: true },
          'Tree-03-1_8': { typeId: 13, height: 62, color: '#14b8a6', isFamily: true },
          'Tree-03-2_9': { typeId: 14, height: 62, color: '#14b8a6', isFamily: true },
          'Tree-03-3_10': { typeId: 15, height: 62, color: '#14b8a6', isFamily: true },
          'Tree-03-4_11': { typeId: 16, height: 62, color: '#14b8a6', isFamily: true },
          'Bush-01_13': { typeId: 17, height: 26, color: '#ec4899', isFamily: false },
          'Bush-02_14': { typeId: 18, height: 26, color: '#f43f5e', isFamily: false },
          'Bush-03_15': { typeId: 19, height: 26, color: '#d946ef', isFamily: false },
          'Bush-04_16': { typeId: 20, height: 26, color: '#8b5cf6', isFamily: false },
          'Bush-05_17': { typeId: 21, height: 26, color: '#6366f1', isFamily: false },
        };

        let fallbackId = 22;
        found.forEach((c) => {
          const isBush = c.name.startsWith('Bush');
          const cleanName = c.name.replace(/_[0-9]+$/, '');
          const info = shapesparkMap[c.name] || {
            typeId: fallbackId++,
            height: isBush ? 26 : 65,
            color: isBush ? '#ec4899' : '#06b6d4',
            isFamily: c.name.startsWith('Tree-02') || c.name.startsWith('Tree-03'),
          };

          const tmpl = this.normalizeTreeTemplate(c, info.height, { x: Math.PI / 2, y: 0, z: 0 }, {
            typeId: info.typeId,
            label: cleanName,
            pack: 'shapespark',
            color: info.color,
          });
          tmpl.userData.isFavoriteFamily = info.isFamily;

          const targetSpecies = info.isFamily ? [0, 1, 2, 3] : (c.name.startsWith('Tree-01') ? [0, 2] : (isBush ? [0, 1, 2, 3] : [2, 3]));
          addTemplate(tmpl, targetSpecies, false);
        });
        this.populateExternalTrees();
      },
      undefined,
      (err) => console.warn('Could not load shapespark_low_poly_exterior_plants_kit model:', err)
    );
  }

  populateExternalTrees() {
    if (!this.treeGroup || !this.placedTreePositions || this.placedTreePositions.length === 0) return;
    if (!this.allExternalTreeTemplates || this.allExternalTreeTemplates.length === 0) return;

    // Clear placeholder / previous trees, protecting shared template geometries
    while (this.treeGroup.children.length > 0) {
      const child = this.treeGroup.children[0];
      this.treeGroup.remove(child);
      if (child.isInstancedMesh || child.isBatchedMesh) child.dispose();
      if (!child.userData || !child.userData.isSharedTemplate) {
        child.traverse((c) => {
          if (c.geometry) c.geometry.dispose();
        });
      }
    }

    // Categorize templates for custom frequency distribution
    const pineTemplates = this.allExternalTreeTemplates.filter(
      (t) => t.userData && t.userData.pack === 'pine'
    );
    const familyTemplates = this.allExternalTreeTemplates.filter(
      (t) => t.userData && t.userData.isFavoriteFamily
    );
    const lowPolyTemplates = this.allExternalTreeTemplates.filter(
      (t) => t.userData && t.userData.pack === 'low_poly'
    );
    const otherShapesparkTemplates = this.allExternalTreeTemplates.filter(
      (t) => t.userData && t.userData.pack === 'shapespark' && !t.userData.isFavoriteFamily
    );

    const templateAssignments = new Map();
    this.allExternalTreeTemplates.forEach((t) => templateAssignments.set(t, []));

    const catalog = [];
    const n = this.placedTreePositions.length;
    const tempPos = new THREE.Vector3();
    const tempEuler = new THREE.Euler();
    const tempQuat = new THREE.Quaternion();
    const tempScale = new THREE.Vector3();

    for (let i = 0; i < n; i++) {
      const tree = this.placedTreePositions[i];
      const speciesPool = this.externalTreeTemplatesBySpecies[tree.species];

      // Frequency distribution prioritizing user favorites:
      // ~45% Pine (Type 1: tall evergreen forest foundation)
      // ~38% Favorite Family (Types 11, 13, 14, 15...: beloved Tree-02 & Tree-03 family)
      // ~10% Shapespark Bushes & Plants (Types 5-8, 17-21: understory vegetation)
      // ~7%  Low-Poly Trees Free (Types 2, 3, 4: rare accents, dark & desaturated)
      const roll = Math.random();
      let template = null;
      if (roll < 0.45 && pineTemplates.length > 0) {
        template = pineTemplates[Math.floor(Math.random() * pineTemplates.length)];
      } else if (roll < 0.83 && familyTemplates.length > 0) {
        const matching = familyTemplates.filter((t) => speciesPool && speciesPool.includes(t));
        const pool = matching.length > 0 ? matching : familyTemplates;
        template = pool[Math.floor(Math.random() * pool.length)];
      } else if (roll < 0.93 && otherShapesparkTemplates.length > 0) {
        const matching = otherShapesparkTemplates.filter((t) => speciesPool && speciesPool.includes(t));
        const pool = matching.length > 0 ? matching : otherShapesparkTemplates;
        template = pool[Math.floor(Math.random() * pool.length)];
      } else if (lowPolyTemplates.length > 0) {
        const matching = lowPolyTemplates.filter((t) => speciesPool && speciesPool.includes(t));
        const pool = matching.length > 0 ? matching : lowPolyTemplates;
        template = pool[Math.floor(Math.random() * pool.length)];
      }

      if (!template) {
        const pool = (speciesPool && speciesPool.length > 0)
          ? speciesPool
          : this.allExternalTreeTemplates;
        template = pool[Math.floor(Math.random() * pool.length)];
      }
      if (!template) continue;

      // Normalized scale multiplier so trees match car (26 units) and track (84 units) scale
      const rFactor = 0.85 + (Math.min(26, tree.r) / 26) * 0.35;
      const scaleMult = rFactor * (0.95 + (Math.random() - 0.5) * 0.15);

      tempPos.set(tree.x, -tree.y, tree.groundZ - 0.6 * scaleMult);
      tempEuler.set(0, 0, tree.yaw + (Math.random() - 0.5) * 0.3);
      tempQuat.setFromEuler(tempEuler);
      tempScale.set(scaleMult, scaleMult, scaleMult);

      const mat = new THREE.Matrix4().compose(tempPos, tempQuat, tempScale);
      if (!templateAssignments.has(template)) {
        templateAssignments.set(template, []);
      }
      templateAssignments.get(template).push(mat);

      const meta = template.userData || {};
      const typeNumber = meta.typeId || 1;
      const renderedHeight = (meta.targetHeight || 65) * scaleMult;

      catalog.push({
        instanceId: i + 1,
        typeId: typeNumber,
        label: meta.label || 'tree',
        pack: meta.pack || 'unknown',
        height: renderedHeight.toFixed(1) + 'm',
        x: tree.x.toFixed(1),
        y: (-tree.y).toFixed(1),
        z: tree.groundZ.toFixed(1),
      });
    }

    // Group identical foliage materials across species, then batch the geometry
    // with per-tree culling rather than issuing a draw for every part and cell.
    const sceneryParts = [];
    const sharedMaterials = new Map();
    templateAssignments.forEach((matrices, tmpl) => {
      if (!matrices || matrices.length === 0) return;
      const parts = (tmpl.userData && tmpl.userData.parts) || [];
      const count = matrices.length;

      if (parts.length > 0) {
        parts.forEach((part) => {
          let instMat = part.instancedMaterial || part.material;
          if (instMat && instMat.isMeshStandardMaterial) {
            instMat = new THREE.MeshLambertMaterial({
              color: instMat.color,
              map: instMat.map,
              transparent: instMat.transparent,
              opacity: instMat.opacity,
              alphaTest: instMat.alphaTest,
              side: THREE.FrontSide,
            });
            part.instancedMaterial = instMat;
          }
          if (instMat?.isMeshLambertMaterial) {
            const key = [instMat.color.getHex(), instMat.map?.uuid, instMat.transparent,
              instMat.opacity, instMat.alphaTest, instMat.side].join('|');
            if (!sharedMaterials.has(key)) sharedMaterials.set(key, instMat);
            instMat = sharedMaterials.get(key);
          }
          sceneryParts.push({ geometry: part.geometry, material: instMat, matrices });
        });
      } else {
        for (let k = 0; k < count; k++) {
          const clone = tmpl.clone(true);
          clone.applyMatrix4(matrices[k]);
          clone.userData = { isSharedTemplate: true };
          this.treeGroup.add(clone);
        }
      }
    });

    for (const batch of batchSceneryInstances(sceneryParts)) this.treeGroup.add(batch);

    this.treeGroup.matrixAutoUpdate = false;
    this.treeGroup.updateMatrix();

    window.treeTypes = {
      1: { name: 'pine_tree', pack: 'pine', desc: 'Alpine Pine Conifer' },
      2: { name: 'Tree_0', pack: 'low_poly', desc: 'Deciduous Oak / Maple' },
      3: { name: 'Tree-1_1', pack: 'low_poly', desc: 'Tall Low-Poly Conifer' },
      4: { name: 'Tree-2_2', pack: 'low_poly', desc: 'Rounded Birch / Blossom' },
      5: { name: 'Tree-01', pack: 'shapespark', desc: 'Cypress Pine' },
      6: { name: 'Tree-02', pack: 'shapespark', desc: 'Round Leafy Oak' },
      7: { name: 'Tree-03', pack: 'shapespark', desc: 'Slender Birch' },
      8: { name: 'Bush-01', pack: 'shapespark', desc: 'Dense Shrub' },
      9: { name: 'Bush-02', pack: 'shapespark', desc: 'Hedge Bush' },
      10: { name: 'Bush-03', pack: 'shapespark', desc: 'Flowering Bush' },
      11: { name: 'Bush-04', pack: 'shapespark', desc: 'Wild Shrub' },
      12: { name: 'Bush-05', pack: 'shapespark', desc: 'Low Green Bush' },
    };
    window.treeCatalog = catalog;
    console.log(`[Trees] Instanced ${catalog.length} trees across ${this.treeGroup.children.length} batches with individual culling.`);
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
      const groundZ = this.getExactMeshHeight(x, -y);
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
        mat: new THREE.MeshLambertMaterial({
          color: 0x6e6659, // Weathered Sandstone / Limestone
          flatShading: true,
        }),
      },
      {
        list: placedType2,
        mat: new THREE.MeshLambertMaterial({
          color: 0x3a4034, // Mossy Basalt / Dark Shale
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
      instMesh.castShadow = false;
      instMesh.receiveShadow = false;
      instMesh.matrixAutoUpdate = false;
      instMesh.updateMatrix();

      this.rockGroup.add(instMesh);
    }

    this.rockGroup.matrixAutoUpdate = false;
    this.rockGroup.updateMatrix();
    this.scene.add(this.rockGroup);
  }

  setupTireBarriers(sim = null) {
    if (this.tireGroup) {
      this.scene.remove(this.tireGroup);
      for (const batch of this.tireBatches || []) batch.dispose();
      this.tireGeometry?.dispose();
      this.tireMaterial?.dispose();
    }

    this.tireGroup = new THREE.Group();
    this.tireDummy = new THREE.Object3D();
    this.tireColor = new THREE.Color();
    this.tireBatches = [];
    this.tireInstances = [];

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

    const tireMat = new THREE.MeshLambertMaterial({
      color: 0xffffff,
      side: THREE.FrontSide,
    });

    const tires = sim?.tireBarriers?.tires || (this.track ? this.generateTiresForTrack(this.track) : []);
    this.tireCount = tires.length;
    this.tireGeometry = tireGeo;
    this.tireMaterial = tireMat;
    const cells = new Map();
    tires.forEach((t, index) => {
      const key = `${Math.floor(t.x / 256)},${Math.floor(t.y / 256)}`;
      if (!cells.has(key)) cells.set(key, []);
      cells.get(key).push(index);
    });
    for (const indices of cells.values()) {
      const batch = new THREE.InstancedMesh(tireGeo, tireMat, indices.length);
      batch.name = 'Local tire barrier batch';
      batch.castShadow = false;
      batch.receiveShadow = false;
      batch.matrixAutoUpdate = false;
      batch.updateMatrix();
      batch.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
      for (let slot = 0; slot < indices.length; slot++) {
        const index = indices[slot], t = tires[index];
        this.tireDummy.position.set(t.x, -t.y, t.z);
        this.tireDummy.rotation.set(t.pitch || 0, t.roll || 0, -(t.yaw || 0));
        this.tireDummy.scale.setScalar(t.scale ?? 1);
        this.tireDummy.updateMatrix();
        batch.setMatrixAt(slot, this.tireDummy.matrix);

        this.tireColor.setRGB(t.color.r, t.color.g, t.color.b);
        batch.setColorAt(slot, this.tireColor);
        this.tireInstances[index] = { batch, slot };
      }

      batch.instanceMatrix.needsUpdate = true;
      if (batch.instanceColor) batch.instanceColor.needsUpdate = true;
      batch.computeBoundingSphere();
      this.tireBatches.push(batch);
      this.tireGroup.add(batch);
    }

    this.tireGroup.matrixAutoUpdate = false;
    this.tireGroup.updateMatrix();
    this.scene.add(this.tireGroup);
  }

  generateTiresForTrack(track) {
    if (!track) return [];
    const system = new TireBarrierSystem(track);
    return system.tires;
  }

  updateTireBarriers(sim) {
    if (!sim?.tireBarriers?.tires || !this.tireInstances) return;
    const tires = sim.tireBarriers.tires;
    if (tires.length !== this.tireCount) {
      this.setupTireBarriers(sim);
      return;
    }

    const updated = new Set();
    for (let i = 0; i < tires.length; i++) {
      const t = tires[i];
      if (!t.sleeping || t.needsRenderUpdate) {
        this.tireDummy.position.set(t.x, -t.y, t.z);
        this.tireDummy.rotation.set(t.pitch || 0, t.roll || 0, -(t.yaw || 0));
        const s = t.scale !== undefined ? t.scale : 1;
        this.tireDummy.scale.set(s, s, s);
        this.tireDummy.updateMatrix();
        const { batch, slot } = this.tireInstances[i];
        batch.setMatrixAt(slot, this.tireDummy.matrix);
        t.needsRenderUpdate = false;
        updated.add(batch);
      }
    }

    for (const batch of updated) {
      batch.instanceMatrix.needsUpdate = true;
      // A struck tire can leave its initial cell; keep bounds correct without rebuilding batches.
      batch.computeBoundingSphere();
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
      this.treeGroup.traverse(child => {
        if (child.isBatchedMesh || child.isInstancedMesh) child.dispose();
      });
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
    const size = 512;
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, size, size);

    const half = size / 2; // 256

    // Multi-octave fractal noise generator
    function fbm(x, y, seed = 0) {
      let val = 0;
      let amp = 0.5;
      let freq = 1.0;
      for (let o = 0; o < 4; o++) {
        const nx = x * freq + seed * 17.13 + o * 5.71;
        const ny = y * freq + seed * 31.41 + o * 9.17;
        const s0 = Math.sin(nx * 1.8 + Math.cos(ny * 2.3));
        const s1 = Math.cos(ny * 1.7 + Math.sin(nx * 2.1));
        val += ((s0 + s1) * 0.5 + 0.5) * amp;
        amp *= 0.5;
        freq *= 2.1;
      }
      return val;
    }

    // 2x2 Atlas: 4 completely unique organic fractal smoke patterns
    const imgData = ctx.createImageData(size, size);
    const data = imgData.data;

    for (let qy = 0; qy < 2; qy++) {
      for (let qx = 0; qx < 2; qx++) {
        const qIdx = qy * 2 + qx;
        const ox = qx * half;
        const oy = qy * half;

        for (let py = 0; py < half; py++) {
          for (let px = 0; px < half; px++) {
            const nx = (px / half) * 2 - 1; // -1 to 1
            const ny = (py / half) * 2 - 1; // -1 to 1
            const r = Math.hypot(nx, ny);

            if (r >= 0.96) continue;

            const angle = Math.atan2(ny, nx);
            let noiseVal = 0;

            if (qIdx === 0) {
              // 1. Shredded wispy filament with turbulent curl
              const swirl = angle + r * 3.8;
              const n = fbm(Math.cos(swirl) * r * 3.4, Math.sin(swirl) * r * 3.4, 2.3);
              noiseVal = Math.pow(n, 1.2) * Math.pow(Math.max(0, 0.95 - r), 1.1);
            } else if (qIdx === 1) {
              // 2. Asymmetric swirling vortex with ragged voids
              const swirl = angle - r * 4.5;
              const n = fbm(nx * 3.6 + Math.sin(swirl) * 0.9, ny * 3.6 + Math.cos(swirl) * 0.9, 5.7);
              noiseVal = Math.pow(n, 1.35) * Math.pow(Math.max(0, 0.95 - r), 1.2);
            } else if (qIdx === 2) {
              // 3. Dense billowing plume with multi-frequency fractal clusters
              const nR = r + (fbm(nx * 4.0, ny * 4.0, 8.1) - 0.5) * 0.40;
              const n = fbm(nx * 2.8, ny * 2.8, 11.4);
              noiseVal = Math.pow(n, 1.1) * Math.pow(Math.max(0, 0.95 - nR), 1.0);
            } else {
              // 4. Soft elongated dynamic dissipation mist
              const n1 = fbm(nx * 2.2, ny * 2.2, 14.8);
              const n2 = fbm(nx * 4.8, ny * 4.8, 17.2);
              noiseVal = (n1 * 0.65 + n2 * 0.35) * Math.pow(Math.max(0, 0.95 - r), 1.5);
            }

            const alpha = Math.min(1.0, Math.max(0, noiseVal * 1.75));
            if (alpha <= 0.005) continue;

            const globalX = ox + px;
            const globalY = oy + py;
            const pIdx = (globalY * size + globalX) * 4;

            data[pIdx] = 255;
            data[pIdx + 1] = 255;
            data[pIdx + 2] = 255;
            data[pIdx + 3] = Math.round(alpha * 255);
          }
        }
      }
    }

    ctx.putImageData(imgData, 0, 0);

    // Blur the atlas once at creation, rather than adding a per-frame blur pass.
    const softened = document.createElement('canvas');
    softened.width = size;
    softened.height = size;
    const softCtx = softened.getContext('2d');
    softCtx.filter = 'blur(4px)';
    softCtx.drawImage(canvas, 0, 0);
    softCtx.filter = 'none';

    const tex = new THREE.CanvasTexture(softened);
    tex.generateMipmaps = true;
    tex.minFilter = THREE.LinearMipmapLinearFilter;
    tex.magFilter = THREE.LinearFilter;
    return tex;
  }

  setupTireSmoke() {
    this.maxSmokeParticles = 900;
    this.smokeParticles = [];
    this.smokePosArr = new Float32Array(this.maxSmokeParticles * 3);
    this.smokeSizeArr = new Float32Array(this.maxSmokeParticles);
    this.smokeAlphaArr = new Float32Array(this.maxSmokeParticles);
    this.smokeCosSinArr = new Float32Array(this.maxSmokeParticles * 2);
    this.smokeAtlasIdxArr = new Float32Array(this.maxSmokeParticles);

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(this.smokePosArr, 3));
    geo.setAttribute('size', new THREE.BufferAttribute(this.smokeSizeArr, 1));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.smokeAlphaArr, 1));
    geo.setAttribute('cosSin', new THREE.BufferAttribute(this.smokeCosSinArr, 2));
    geo.setAttribute('atlasIdx', new THREE.BufferAttribute(this.smokeAtlasIdxArr, 1));
    geo.setDrawRange(0, 0);

    const smokeTex = this.createSmokeTexture();

    const vertShader = `
      attribute float size;
      attribute float alpha;
      attribute vec2 cosSin;
      attribute float atlasIdx;
      varying float vAlpha;
      varying vec2 vCosSin;
      varying float vAtlasIdx;

      void main() {
        vAlpha = alpha;
        vCosSin = cosSin;
        vAtlasIdx = atlasIdx;
        vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
        gl_PointSize = clamp(size * (950.0 / -mvPosition.z), 2.0, 160.0);
        gl_Position = projectionMatrix * mvPosition;
      }
    `;

    const fragShader = `
      uniform sampler2D uSmokeTexture;
      varying float vAlpha;
      varying vec2 vCosSin;
      varying float vAtlasIdx;

      void main() {
        vec2 p = gl_PointCoord - vec2(0.5);
        float dist = length(p);
        if (dist > 0.49) discard;

        // Smooth circular boundary feathering
        float feather = 1.0 - smoothstep(0.10, 0.49, dist);

        // Individual particle random rotation
        vec2 pRot = vec2(
          p.x * vCosSin.x - p.y * vCosSin.y,
          p.x * vCosSin.y + p.y * vCosSin.x
        );

        // Map into 2x2 atlas quadrant (0: top-left, 1: top-right, 2: bottom-left, 3: bottom-right)
        vec2 quadOffset = vec2(0.0);
        if (vAtlasIdx > 2.5) {
          quadOffset = vec2(0.5, 0.5);
        } else if (vAtlasIdx > 1.5) {
          quadOffset = vec2(0.0, 0.5);
        } else if (vAtlasIdx > 0.5) {
          quadOffset = vec2(0.5, 0.0);
        }

        vec2 quadUv = (pRot * 0.94) + vec2(0.25, 0.25);
        quadUv = clamp(quadUv, vec2(0.01), vec2(0.49));
        vec2 finalUv = quadOffset + quadUv;

        vec4 texColor = texture2D(uSmokeTexture, finalUv);
        float alpha = texColor.a * feather * vAlpha * 0.68;
        if (alpha < 0.003) discard;

        // Subtle realistic color gradation (warm vapor core to cool atmospheric haze)
        vec3 smokeColor = mix(vec3(0.96, 0.95, 0.93), vec3(0.88, 0.90, 0.93), dist * 1.4);
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

  addTireSmokePuff(x, y, z, carVx, carVy, intensity, extraSpread = 0, puffType = 'auto') {
    const angle = Math.random() * Math.PI * 2;
    const spread = (0.35 + extraSpread) * (0.8 + Math.random() * 0.5);

    // Highly varied particle scales for realistic multi-frequency smoke
    let baseSize, growth, decayRate;
    const typeRoll = puffType === 'auto' ? Math.random() : (puffType === 'wisp' ? 0.1 : (puffType === 'billow' ? 0.9 : 0.5));

    if (typeRoll < 0.35) {
      // 1. Fine wisps & filaments (rapid expansion, quick dissipation)
      baseSize = 1.8 + Math.random() * 1.6;
      growth = 2.8 + Math.random() * 3.2;
      decayRate = 0.75 + Math.random() * 0.45; // ~0.8s to 1.2s
    } else if (typeRoll < 0.80) {
      // 2. Medium turbulent eddies
      baseSize = 3.8 + Math.random() * 2.8;
      growth = 4.5 + Math.random() * 4.0;
      decayRate = 0.50 + Math.random() * 0.25; // ~1.3s to 1.8s
    } else {
      // 3. Dense billowing plume core
      baseSize = 6.5 + Math.random() * 4.0;
      growth = 7.0 + Math.random() * 5.5;
      decayRate = 0.40 + Math.random() * 0.18; // ~1.8s to 2.4s
    }

    // More visible plumes without increasing the capped particle pool or lifetime.
    baseSize *= 1.50;
    growth *= 1.15;
    const atlasVariant = Math.floor(Math.random() * 4);
    const alphaVal = Math.min(0.46, 0.10 + intensity * 0.36);
    const px = x + (Math.random() - 0.5) * spread;
    const py = y + (Math.random() - 0.5) * spread;
    const pz = z + Math.random() * 0.06;
    const pvx = (carVx * (0.05 + Math.random() * 0.12)) + (Math.random() - 0.5) * 2.4;
    const pvy = (carVy * (0.05 + Math.random() * 0.12)) + (Math.random() - 0.5) * 2.4;
    const pvz = 0.4 + Math.random() * 1.4; // Natural thermal updraft
    const pvRot = (Math.random() - 0.5) * 2.2;

    // Fast zero-allocation buffer recycling when at capacity (avoids O(N) shift())
    if (this.smokeParticles.length >= this.maxSmokeParticles) {
      const p = this.smokeParticles[0];
      p.x = px;
      p.y = py;
      p.z = pz;
      p.vx = pvx;
      p.vy = pvy;
      p.vz = pvz;
      p.size = baseSize;
      p.growthRate = growth;
      p.rot = angle;
      p.vRot = pvRot;
      p.atlasIdx = atlasVariant;
      p.alpha = alphaVal;
      p.life = 1.0;
      p.decay = decayRate;
      return;
    }

    this.smokeParticles.push({
      x: px,
      y: py,
      z: pz,
      vx: pvx,
      vy: pvy,
      vz: pvz,
      size: baseSize,
      growthRate: growth,
      rot: angle,
      vRot: pvRot,
      atlasIdx: atlasVariant,
      alpha: alphaVal,
      life: 1.0,
      decay: decayRate,
    });
  }

  updateTireSmoke() {
    if (!this.smokeParticles || this.smokeParticles.length === 0) {
      if (this.smokeMesh) this.smokeMesh.geometry.setDrawRange(0, 0);
      return;
    }

    const dt = 1 / 60;
    let writeIdx = 0;
    let aliveCount = 0;
    const particles = this.smokeParticles;
    const total = particles.length;

    // Single-pass forward in-place compaction: eliminates splice() heap churn and GC spikes completely
    for (let i = 0; i < total; i++) {
      const p = particles[i];
      p.life -= p.decay * dt;
      if (p.life <= 0) {
        continue;
      }

      particles[aliveCount] = p;
      aliveCount++;

      // Physics: chaotic drag deceleration, aerodynamic draft, and thermal rise
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      p.vx *= 0.93;
      p.vy *= 0.93;
      p.vz *= 0.94;
      p.size += p.growthRate * dt;
      p.rot += p.vRot * dt;

      const idx = writeIdx * 3;
      this.smokePosArr[idx] = p.x;
      this.smokePosArr[idx + 1] = p.y;
      this.smokePosArr[idx + 2] = p.z;

      this.smokeSizeArr[writeIdx] = p.size;
      // Exponential fade tail creates an organic wisp dissipation
      this.smokeAlphaArr[writeIdx] = p.alpha * Math.pow(p.life, 1.6);

      const rIdx = writeIdx * 2;
      this.smokeCosSinArr[rIdx] = Math.cos(p.rot);
      this.smokeCosSinArr[rIdx + 1] = Math.sin(p.rot);

      this.smokeAtlasIdxArr[writeIdx] = p.atlasIdx;

      writeIdx++;
    }

    // Direct length truncation is O(1) in V8
    particles.length = aliveCount;

    this.smokeMesh.geometry.attributes.position.needsUpdate = true;
    this.smokeMesh.geometry.attributes.size.needsUpdate = true;
    this.smokeMesh.geometry.attributes.alpha.needsUpdate = true;
    this.smokeMesh.geometry.attributes.cosSin.needsUpdate = true;
    this.smokeMesh.geometry.attributes.atlasIdx.needsUpdate = true;
    this.smokeMesh.geometry.setDrawRange(0, writeIdx);
  }

  setupSkidmarks() {
    this.maxSkidQuads = 128000; // 128k persistent quads: permanent skid marks throughout the entire race across all laps
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
    geo.setAttribute('position', new THREE.BufferAttribute(this.skidPosArr, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.skidAlphaArr, 1).setUsage(THREE.DynamicDrawUsage));
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
        // Authentic motorsport dark graphite rubber compound (natural charcoal, not harsh black ink)
        vec3 rubber = vec3(0.045, 0.048, 0.056);
        // Soft lateral tire feathering with solid dark center contact patch
        float edge = smoothstep(0.0, 0.20, vUv.x) * smoothstep(1.0, 0.80, vUv.x);
        float lateral = 0.50 + 0.50 * edge;
        // Subtle, natural rubber that builds up naturally and remains clearly visible across all lighting
        float alpha = clamp(vAlpha * lateral, 0.0, 0.60);
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
      side: THREE.DoubleSide, // Essential for dynamic ribbon quads across winding turns
      forceSinglePass: true, // Flat ribbons need both sides, but not two transparency passes.
      blending: THREE.NormalBlending,
      polygonOffset: true,
      polygonOffsetFactor: -6.0,
      polygonOffsetUnits: -6.0,
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
    const SKID_THRESH = 0.12; // Clean grip driving leaves ZERO marks; only dynamic loss of grip triggers
    const startHead = this.skidHead;
    this._frameSkidQuadsAdded = 0;

    for (let i = 0; i < candidateCars.length; i++) {
      const car = candidateCars[i];
      if (!car || !car.alive || car.finished) {
        if (this.carPrevTires.has(car)) this.carPrevTires.delete(car);
        continue;
      }

      // Exact physical loss-of-grip models (authentic F1 dynamics):
      // 1. Oversteer (Rear lateral breakaway / power slide / drift):
      const slipMag = Math.abs(car.slipAngle || 0);
      const steerMag = Math.abs(car.steer || 0);
      let oversteerNorm = 0;
      if (car.speed > 25) {
        if (steerMag > 0.12 && slipMag > 0.08) {
          oversteerNorm = Math.min(1.0, (slipMag - 0.08) / 0.12);
        } else if (slipMag > 0.22) {
          oversteerNorm = Math.min(1.0, (slipMag - 0.22) / 0.20);
        }
      }
      const oversteerInt = oversteerNorm > 0 ? Math.pow(oversteerNorm, 1.1) : 0;

      // 2. Understeer (Front tire scrub / push wide):
      let understeerNorm = 0;
      if (steerMag > 0.60 && car.speed > 55 && !car.crashed) {
        const steerPush = (steerMag - 0.60) / 0.28;
        const speedPush = Math.min(1.0, (car.speed - 55) / 45);
        understeerNorm = Math.min(1.0, steerPush * speedPush);
      }
      const understeerInt = understeerNorm > 0 ? Math.pow(understeerNorm, 1.1) : 0;

      // 3. Brake Locks (Threshold braking lockup & front/rear scrub):
      const rawBrakeLock = (car.throttle < -0.60 && car.speed > 25) ? Math.min(1.0, (-car.throttle - 0.60) / 0.35) : 0;
      const brakeLockInt = Math.max(car.brakeLock || 0, rawBrakeLock);

      // 4. Launch Wheelspin (Standing starts & hard acceleration wheelspin):
      const rawLaunchSpin = (car.throttle > 0.65 && car.speed < 60) ? Math.min(1.0, ((60 - car.speed) / 45) * car.throttle) : 0;
      const launchSpinInt = Math.max(car.wheelSpin || 0, rawLaunchSpin);

      // Rear tires mark on oversteer slides, standing-start wheelspin, and heavy brake lockups:
      const targetRearInt = Math.min(1.0, Math.max(oversteerInt, launchSpinInt * 0.95, brakeLockInt * 0.85));
      // Front tires mark on understeer scrub and brake lockups:
      const targetFrontInt = Math.min(1.0, Math.max(understeerInt, brakeLockInt));

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
          oversteerSmokeDist: 0,
          // Front axle
          flx: 0, fly: 0, frx: 0, fry: 0,
          fl0x: 0, fl0y: 0, fl1x: 0, fl1y: 0,
          fr0x: 0, fr0y: 0, fr1x: 0, fr1y: 0,
          smoothFrontInt: 0,
          prevFrontAlpha: 0,
          frontActive: false,
          understeerSmokeDist: 0,
          initialized: false,
        };
        this.carPrevTires.set(car, track);
      }

      // Steering demand and brake input can saturate even with good grip. Smoke
      // requires sustained, substantial sideways travel, not a saturated score.
      const hardSkid = car.speed >= 80 && slipMag >= 0.22 &&
        Math.abs(car.speed * Math.sin(slipMag)) >= 25;
      if (!hardSkid) track.hardSkidSince = null;
      else if (track.hardSkidSince == null || car.time < track.hardSkidSince) track.hardSkidSince = car.time;
      const emitSkidSmoke = hardSkid && car.time - track.hardSkidSince >= 0.08;

      // Smooth attack/decay with fast recovery when grip is restored
      const prevRInt = track.smoothRearInt || 0;
      const rRate = targetRearInt > prevRInt ? 0.85 : 0.45;
      const curRearInt = prevRInt + (targetRearInt - prevRInt) * rRate;
      track.smoothRearInt = curRearInt;

      const prevFInt = track.smoothFrontInt || 0;
      const fRate = targetFrontInt > prevFInt ? 0.85 : 0.45;
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

      // Subtle, translucent rubber alpha (gentle deposit that naturally accumulates without turning harsh or opaque)
      const isRearMarking = curRearInt > SKID_THRESH;
      const curRearAlpha = isRearMarking ? (0.08 + curRearInt * 0.22) : 0.0;

      const isFrontMarking = curFrontInt > SKID_THRESH;
      const curFrontAlpha = isFrontMarking ? (0.06 + curFrontInt * 0.18) : 0.0;

      if (track.initialized) {
        // --- 1. REAR TIRES (Oversteer, Wheelspin, Brake Locks, Crash) ---
        if (isRearMarking || track.rearActive) {
          const dLR = Math.hypot(rlx - track.rlx, rly - track.rly);
          const minStepR = (Math.abs(car.steer || 0) > 0.35 || oversteerInt > 0.4) ? 1.6 : 2.8;
          if (dLR > minStepR && dLR < 45) {
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

            // Dense smoke only during a sustained heavy sideways skid.
            const rearSmokeInt = targetRearInt;
            if (emitSkidSmoke && rearSmokeInt > SKID_THRESH) {
              const camDist = Math.hypot(car.x - this.camera.position.x, -car.y - this.camera.position.y);
              if (camDist < 500) {
                track.oversteerSmokeDist = (track.oversteerSmokeDist || 0) + dLR;
                const smokeThresh = track.oversteerNextPuff || 0.90;
                if (track.oversteerSmokeDist >= smokeThresh) {
                  track.oversteerSmokeDist = 0;
                  track.oversteerNextPuff = 0.70 + Math.random() * 0.80;
                  const carVx = car.vx || 0;
                  const carVy = -(car.vy || 0);

                  // Staggered asymmetrical emission:
                  if (Math.random() < 0.85) {
                    this.addTireSmokePuff(rlx, rly, 0.18, carVx, carVy, rearSmokeInt, 0.4, Math.random() < 0.3 ? 'wisp' : 'auto');
                  }
                  if (Math.random() < 0.85) {
                    this.addTireSmokePuff(rrx, rry, 0.18, carVx, carVy, rearSmokeInt, 0.4, Math.random() < 0.3 ? 'wisp' : 'auto');
                  }
                  if (rearSmokeInt > 0.45 && Math.random() < 0.70) {
                    const rcx = (rlx + rrx) * 0.5 + (Math.random() - 0.5) * 1.2;
                    const rcy = (rly + rry) * 0.5 + (Math.random() - 0.5) * 1.2;
                    this.addTireSmokePuff(rcx, rcy, 0.22, carVx, carVy, rearSmokeInt, 0.9, 'billow');
                  }
                }
              }
            } else {
              track.oversteerSmokeDist = 0;
            }

            track.prevRearAlpha = isRearMarking ? curRearAlpha : 0.0;
            track.rearActive = isRearMarking;
            added = true;
          }
        } else {
          track.rearActive = false;
          track.prevRearAlpha = 0;
          track.oversteerSmokeDist = 0;
        }

        // --- 2. FRONT TIRES (Understeer, Brake Locks, Crash) ---
        if (isFrontMarking || track.frontActive) {
          const dLF = Math.hypot(flx - track.flx, fly - track.fly);
          const minStepF = (Math.abs(car.steer || 0) > 0.35 || understeerInt > 0.4) ? 1.6 : 2.8;
          if (dLF > minStepF && dLF < 45) {
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

            // Steering/braking demand alone must not produce front smoke.
            const frontSmokeInt = targetFrontInt;
            if (emitSkidSmoke && frontSmokeInt > SKID_THRESH) {
              const camDist = Math.hypot(car.x - this.camera.position.x, -car.y - this.camera.position.y);
              if (camDist < 500) {
                track.understeerSmokeDist = (track.understeerSmokeDist || 0) + dLF;
                const smokeThresh = track.understeerNextPuff || 0.90;
                if (track.understeerSmokeDist >= smokeThresh) {
                  track.understeerSmokeDist = 0;
                  track.understeerNextPuff = 0.70 + Math.random() * 0.80;
                  const carVx = car.vx || 0;
                  const carVy = -(car.vy || 0);
                  if (Math.random() < 0.85) {
                    this.addTireSmokePuff(flx, fly, 0.18, carVx, carVy, frontSmokeInt, 0.3, 'auto');
                  }
                  if (Math.random() < 0.85) {
                    this.addTireSmokePuff(frx, fry, 0.18, carVx, carVy, frontSmokeInt, 0.3, 'auto');
                  }
                  if (frontSmokeInt > 0.45 && Math.random() < 0.60) {
                    const fcx = (flx + frx) * 0.5 + (Math.random() - 0.5) * 1.0;
                    const fcy = (fly + fry) * 0.5 + (Math.random() - 0.5) * 1.0;
                    this.addTireSmokePuff(fcx, fcy, 0.20, carVx, carVy, frontSmokeInt, 0.8, 'wisp');
                  }
                }
              }
            } else {
              track.understeerSmokeDist = 0;
            }

            track.prevFrontAlpha = isFrontMarking ? curFrontAlpha : 0.0;
            track.frontActive = isFrontMarking;
            added = true;
          }
        } else {
          track.frontActive = false;
          track.prevFrontAlpha = 0;
          track.understeerSmokeDist = 0;
        }
      } else {
        track.rearActive = false;
        track.prevRearAlpha = 0;
        track.oversteerSmokeDist = 0;
        track.frontActive = false;
        track.prevFrontAlpha = 0;
        track.understeerSmokeDist = 0;
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
      // Keep pending ranges until Three.js uploads them, including across skipped renders.
      if (quadsAdded > 0 && quadsAdded < this.maxSkidQuads) {
        const tailCount = Math.min(quadsAdded, this.maxSkidQuads - startHead);
        posAttr.addUpdateRange(startHead * 12, tailCount * 12);
        alphaAttr.addUpdateRange(startHead * 4, tailCount * 4);
        const wrappedCount = quadsAdded - tailCount;
        if (wrappedCount > 0) {
          posAttr.addUpdateRange(0, wrappedCount * 12);
          alphaAttr.addUpdateRange(0, wrappedCount * 4);
        }
      } else {
        posAttr.addUpdateRange(0, this.skidPosArr.length);
        alphaAttr.addUpdateRange(0, this.skidAlphaArr.length);
      }
      posAttr.needsUpdate = true;
      alphaAttr.needsUpdate = true;
      this.skidMesh.geometry.setDrawRange(0, this.skidCount * 6);
    }
  }

  resetCamera(followMode = true) {
    this._chaseAngle = null;
    this._chaseTargetX = null;
    this._chaseTargetY = null;
    this._lastFocusCar = null;
    this._actionAngle = null;
    this._lastActionFocus = null;
    this._actionRearAngle = null;
    this._lastActionRearFocus = null;
    this._heliAngle = null;
    this._lastHeliFocus = null;
    this._autoPreset = 'follow';
    this._lastPresetSwitchTime = performance.now();
    this._autoNextSwitch = performance.now() + 36000;
    this._lastGantryCutTime = null;
    this._lastGantryCutLap = null;
    this._gantryEntryLap = null;
    this._gantryCrossedLineTime = null;
    this._lastActivePreset = 'follow';
    this._camTransition = null;
    this._currentActionPair = null;
    this._dynamicZoomOutFov = 0;
    this._dynamicZoomOutDist = 0;
    const t = this.track;
    const startX = t.cx ? t.cx[0] : 0;
    const startY = t.cy ? -t.cy[0] : 0;
    const tx = t.tx ? t.tx[0] : 1;
    const ty = t.ty ? -t.ty[0] : 0;

    if (followMode) {
      // True Chase Camera perspective directly behind the start grid looking down the straight at P1
      this.controls.target.set(startX + tx * 12.0, startY + ty * 12.0, 2.4);
      const camX = startX - tx * 72.0;
      const camY = startY - ty * 72.0;
      const camZ = 24.0;
      this.camera.position.set(camX, camY, camZ);
      this.camera.fov = 58;
      this.camera.updateProjectionMatrix();
      this.controls.autoRotate = false;
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

  setAdaptivePixelRatio(dpr) {
    // Keep canvas pixel ratio locked to eliminate GPU backbuffer reallocations and full-screen flickers
    return;
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
      const pair = { carA: pool[0], carB: null };
      this._currentActionPair = pair;
      return pair;
    }

    // 1. Explicit user-selected car (Arrow keys or Leaderboard click)
    const userCar = opts && opts.manualFocusCar;
    if (userCar && (userCar.alive || userCar.finished) && !userCar.crashed) {
      let closestOpponent = null;
      let closestDist = Infinity;
      for (let i = 0; i < pool.length; i++) {
        const c = pool[i];
        if (c !== userCar && (c.alive || c.finished) && !c.crashed) {
          const d = Math.hypot(userCar.x - c.x, -userCar.y - (-c.y));
          if (d < closestDist) {
            closestDist = d;
            closestOpponent = c;
          }
        }
      }
      const pair = { carA: userCar, carB: closestOpponent };
      this._currentActionPair = pair;
      return pair;
    }

    // 2. CORE REQUIREMENT: Camera ALWAYS focuses on P1 (Race Leader), keeping P2 in the viewport!
    // P1 is the race leader from sim.leader or rankedCars[0]
    let p1 = null;
    if (sim && sim.leader && (sim.leader.alive || sim.leader.finished) && !sim.leader.crashed) {
      p1 = sim.leader;
    }
    if (!p1 && rankedCars && rankedCars.length > 0) {
      for (let i = 0; i < rankedCars.length; i++) {
        const c = rankedCars[i];
        if (c && (c.alive || c.finished) && !c.crashed) {
          p1 = c;
          break;
        }
      }
    }
    if (!p1) {
      p1 = focusCar || (sim?.cars && sim.cars[0]) || pool[0] || null;
    }

    // P2 is the 2nd place car / closest active competitor behind P1
    let p2 = null;
    if (rankedCars && rankedCars.length > 1) {
      for (let i = 0; i < rankedCars.length; i++) {
        const c = rankedCars[i];
        if (c && c !== p1 && (c.alive || c.finished) && !c.crashed) {
          p2 = c;
          break;
        }
      }
    }
    if (!p2 && p1) {
      let closestDist = Infinity;
      for (let i = 0; i < pool.length; i++) {
        const c = pool[i];
        if (c !== p1 && (c.alive || c.finished) && !c.crashed) {
          const d = Math.hypot(p1.x - c.x, -p1.y - (-c.y));
          if (d < closestDist) {
            closestDist = d;
            p2 = c;
          }
        }
      }
    }

    const pair = { carA: p1, carB: p2 };
    this._currentActionPair = pair;
    return pair;
  }

  render(sim, opts, leader) {
    const cameraNow = performance.now();
    const cameraDt = opts.renderDt ?? (this._cameraFrameTime === undefined ? 1 / 60 : (cameraNow - this._cameraFrameTime) / 1000);
    this._cameraFrameTime = cameraNow;
    const frameScale = Math.max(0, Math.min(0.1, cameraDt)) * 60;
    const cameraBlend = factor => 1 - Math.pow(1 - factor, frameScale);
    const isNewStart = (sim && (this.lastGen !== sim.generation || (sim.time < 0.15 && (this.lastSimTime || 0) > 1.0)));
    if (isNewStart && sim) {
      this.lastGen = sim.generation;
      this._autoPreset = 'follow';
      this._lastPresetSwitchTime = performance.now();
      this._lastGantryCutTime = null;
      this._lastGantryCutLap = null;
      this._gantryEntryLap = null;
      this._gantryEntryIdx = null;
      this._gantryTargetCar = null;
      this._gantryCrossedLineTime = null;
      this._autoNextSwitch = performance.now() + 24000;
      this._lastActionPairTime = performance.now();
      const p1Start = (sim && sim.leader) || (sim?.cars && sim.cars[0]) || null;
      this._currentActionPair = p1Start ? { carA: p1Start, carB: null } : null;
      this.focusedCar = p1Start;
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
      const canSwitchPreset = (now - this._lastPresetSwitchTime) >= 18000;
      const p1 = (opts.manual && sim.player && (sim.player.alive || sim.player.finished)) ? sim.player : (rankedCars[0] || leader || focusCar);

      const isStartLaunchPhase = Boolean(sim && sim.time !== undefined && sim.time < 8.5);

      // START OF GAME / RACE LAUNCH: Use Broadcast Follow directly tracking P1 and the grid
      if (isStartLaunchPhase) {
        if (this._autoPreset !== 'follow') {
          this._autoPreset = 'follow';
          this._lastPresetSwitchTime = now;
          this._autoNextSwitch = now + 34000;
        }
      }

      // Check if P1 (or tracked car) is approaching the Start/Finish line to complete a lap
      const t = this.track;
      let p1ApproachingGantry = false;

      if (p1 && t && t.N && t.spacing && (p1.alive || p1.finished) && !isStartLaunchPhase) {
        const p1Idx = ((p1.idx % t.N) + t.N) % t.N;
        // Distance remaining along track forward direction to index 0 (Start/Finish Line)
        const samplesToLine = (t.N - p1Idx) % t.N;
        const distToLine = samplesToLine * t.spacing;
        const p1Speed = p1.speed || 0;

        // Approaching line at speed: trigger window when car is within the final straight sector
        if (p1Speed > 8) {
          const timeToLine = distToLine / p1Speed;
          if (timeToLine >= 0.1 && timeToLine <= 3.8 && samplesToLine <= t.N * 0.35) {
            p1ApproachingGantry = true;
          }
        } else if (samplesToLine < 15 && distToLine < 50) {
          p1ApproachingGantry = true;
        }
      }

      const p1Lap = p1 ? (p1.laps || 0) : 0;
      const isNewLapToGantry = this._lastGantryCutLap !== p1Lap;

      // 40-50% probability to cut to TV Gantry when completing a lap (instead of every single lap)
      if (!isStartLaunchPhase && p1ApproachingGantry && isNewLapToGantry) {
        this._lastGantryCutLap = p1Lap; // Ensure this lap end is evaluated once
        const shouldSelectGantry = Math.random() < 0.45; // 45% chance
        if (shouldSelectGantry && this._autoPreset !== 'broadcast') {
          this._autoPreset = 'broadcast';
          this._lastPresetSwitchTime = now;
          this._lastGantryCutTime = now;
          this._gantryEntryLap = p1Lap;
          this._gantryEntryIdx = (p1 && t && t.N) ? (((p1.idx % t.N) + t.N) % t.N) : 0;
          this._gantryTargetCar = p1;
          this._gantryCrossedLineTime = null;
          this._autoNextSwitch = now + 45000; // Generous guard timeout
        }
      }

      // When TV Gantry camera is active: WAIT until the target car passes the finish line before switching to another cam!
      if (this._autoPreset === 'broadcast') {
        const targetCar = (this._gantryTargetCar && (this._gantryTargetCar.alive || this._gantryTargetCar.finished))
          ? this._gantryTargetCar
          : p1;

        if (this._gantryEntryLap === null || this._gantryEntryLap === undefined) {
          this._gantryEntryLap = targetCar ? (targetCar.laps || 0) : 0;
          this._gantryEntryIdx = (targetCar && t && t.N) ? (((targetCar.idx % t.N) + t.N) % t.N) : 0;
          this._gantryTargetCar = targetCar;
          this._lastGantryCutTime = now;
          this._gantryCrossedLineTime = null;
        }

        const carLap = targetCar ? (targetCar.laps || 0) : 0;
        const carIdx = (targetCar && t && t.N) ? (((targetCar.idx % t.N) + t.N) % t.N) : 0;
        const crossedLap = typeof this._gantryEntryLap === 'number' && carLap > this._gantryEntryLap;
        const pastStartLine = (typeof this._gantryEntryIdx === 'number' && this._gantryEntryIdx > (t ? t.N * 0.4 : 50) && carIdx >= 4 && carIdx <= 90);
        const carFinished = Boolean(targetCar && targetCar.finished);

        // Detect the exact moment the target car crosses the start/finish line
        if ((crossedLap || pastStartLine || carFinished) && !this._gantryCrossedLineTime) {
          this._gantryCrossedLineTime = now;
        }

        // Must hold until target car has crossed the finish line AND a celebration follow-through (2.2s) has passed
        const hasCrossedLineAndHeld = Boolean(this._gantryCrossedLineTime && (now >= this._gantryCrossedLineTime + 2200));
        const carCrashed = Boolean(targetCar && targetCar.crashed);
        const emergencyFallback = (now - (this._lastGantryCutTime || now)) >= 35000 || (carCrashed && (now - (this._lastGantryCutTime || now)) >= 4000);

        if (hasCrossedLineAndHeld || emergencyFallback) {
          // Transition from start/finish gantry back to Broadcast Follow (70%) or Heli/Chase
          const postGantryPool = [
            { preset: 'follow', weight: 70 },
            { preset: 'heli', weight: 12 },
            { preset: 'chase', weight: 10 },
            { preset: 'action_rear', weight: 8 },
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
          const postDuration = chosen === 'follow'
            ? Math.max(30000, 36000 + Math.random() * 12000)
            : (chosen === 'heli' ? 18000 + Math.random() * 6000 : 20000 + Math.random() * 6000);
          this._autoNextSwitch = now + postDuration;
          this._gantryCrossedLineTime = null;
          this._gantryEntryLap = null;
          this._gantryEntryIdx = null;
          this._gantryTargetCar = null;
        }
      } else if (!this._autoPreset || !this._autoNextSwitch || now >= this._autoNextSwitch) {
        if (!canSwitchPreset) {
          // Retain current camera preset until shot duration has passed
        } else if (!this._autoPreset || isStartLaunchPhase) {
          this._autoPreset = 'follow';
          this._lastPresetSwitchTime = now;
          this._autoNextSwitch = now + 34000;
        } else {
          // Dynamic cinematic preset sequencing calibrated for:
          // - Broadcast Follow >= 60% of total airtime
          // - Helicopter Chase ~10% of total airtime
          // - The rest (~30%) split amongst other cameras (Chase, Action Rear, Action Front, Onboard)
          let chosen = 'follow';
          if (this._autoPreset !== 'follow') {
            // Cut back to Broadcast Follow 80% of the time from any specialty shot
            if (Math.random() < 0.80) {
              chosen = 'follow';
            } else {
              const specialtyPool = [
                { preset: 'heli', weight: 30 },
                { preset: 'chase', weight: 32 },
                { preset: 'action_rear', weight: 22 },
                { preset: 'action', weight: 10 },
                { preset: 'onboard', weight: 6 },
              ].filter((item) => item.preset !== this._autoPreset);
              const totalWeight = specialtyPool.reduce((sum, item) => sum + item.weight, 0);
              let rnd = Math.random() * totalWeight;
              chosen = specialtyPool[0]?.preset || 'follow';
              for (const item of specialtyPool) {
                if (rnd < item.weight) {
                  chosen = item.preset;
                  break;
                }
                rnd -= item.weight;
              }
            }
          } else {
            // Currently in 'follow' (Broadcast Follow).
            // Cut to a specialty camera:
            // Helicopter takes ~26% of specialty cuts (giving ~10% of overall airtime)
            // The rest are split across chase, action_rear, action, onboard.
            const specialtyPool = [
              { preset: 'heli', weight: 26 },        // ~10% overall airtime
              { preset: 'chase', weight: 28 },       // ~10-11% overall airtime
              { preset: 'action_rear', weight: 22 }, // ~8-9% overall airtime
              { preset: 'action', weight: 14 },      // ~5-6% overall airtime
              { preset: 'onboard', weight: 10 },     // ~4% overall airtime
            ];
            let rnd = Math.random() * 100;
            chosen = specialtyPool[0].preset;
            for (const item of specialtyPool) {
              if (rnd < item.weight) {
                chosen = item.preset;
                break;
              }
              rnd -= item.weight;
            }
          }

          this._autoPreset = chosen;
          this._lastPresetSwitchTime = now;

          // Dynamic shot duration per camera archetype:
          // Broadcast Follow gets expansive, relaxed TV pacing (36s - 48s)
          // Specialty shots get punchy, exciting pacing (18s - 26s)
          let duration;
          if (this._autoPreset === 'follow') {
            duration = Math.max(32000, 36000 + Math.random() * 12000); // 36s - 48s (ensures >= 60% total airtime)
          } else if (this._autoPreset === 'heli') {
            duration = Math.max(16000, 18000 + Math.random() * 6000);  // 18s - 24s (cinematic aerial pursuit)
          } else if (this._autoPreset === 'onboard') {
            duration = Math.max(14000, 16000 + Math.random() * 4000);  // 16s - 20s
          } else if (this._autoPreset === 'action_rear') {
            duration = Math.max(18000, 20000 + Math.random() * 6000);  // 20s - 26s
          } else {
            duration = Math.max(18000, 20000 + Math.random() * 6000);  // 20s - 26s
          }
          this._autoNextSwitch = now + duration;
        }
      }
      cameraPreset = this._autoPreset;
    }
    this.activeCameraPreset = cameraPreset;

    // Dynamic Action Tracker (Focus where the live battle and action is across the grid)
    let actionPair = this.findActionFocusPair(sim, rankedCars, focusCar, opts);
    if (cameraPreset === 'onboard') {
      const requestedCar = opts.manual && sim.player ? sim.player : opts.manualFocusCar;
      const attached = this._onboardCar;
      const attachedIsActive = attached && !attached.crashed && (attached.alive || attached.finished) &&
        (sim.cars.includes(attached) || sim.player === attached);
      if (isNewStart || !attachedIsActive || (requestedCar && requestedCar !== attached)) {
        this._onboardCar = requestedCar || actionPair.carA || focusCar;
      }
      // A mounted view cannot hop between cars whenever quantized race progress
      // swaps P1/P2 during braking or a side-by-side corner. Keep the chassis.
      actionPair = { carA: this._onboardCar,
        carB: rankedCars.find(car => car !== this._onboardCar) || null };
    } else {
      this._onboardCar = null;
    }
    this.focusedCar = actionPair.carA || focusCar;
    const p1 = getRenderPose(this.focusedCar, opts.renderAlpha);
    const p2 = getRenderPose(actionPair.carB, opts.renderAlpha);

    const p1X = p1 ? p1.x : 0;
    const p1Y = p1 ? -p1.y : 0;
    const p1Angle = p1 ? -p1.angle : 0;

    // Carry close tracking cameras with the same displayed translation as the
    // chassis. Smoothing then affects framing, rather than accumulating speed-
    // and frame-rate-dependent lag behind a moving car.
    const closeTracking = ['chase', 'action', 'action_rear'].includes(cameraPreset) &&
      !(cameraPreset === 'chase' && hasFinisher && !opts.manual && p1?.finished);
    const anchor = this._cameraTrackingAnchor;
    if (closeTracking && !isNewStart && anchor?.car === this.focusedCar &&
      anchor.preset === cameraPreset && !this._camTransition?.active) {
      const dx = p1X - anchor.x, dy = p1Y - anchor.y;
      if (Math.hypot(dx, dy) < 60) {
        this.camera.position.x += dx;
        this.camera.position.y += dy;
        this.controls.target.x += dx;
        this.controls.target.y += dy;
        if (typeof this._chaseTargetX === 'number') this._chaseTargetX += dx;
        if (typeof this._chaseTargetY === 'number') this._chaseTargetY += dy;
      }
    }
    this._cameraTrackingAnchor = { car: this.focusedCar, preset: cameraPreset, x: p1X, y: p1Y };

    const p2Alive = p2 && (p2.alive || p2.finished) && !p2.crashed;
    const p2X = p2Alive ? p2.x : (p1X - Math.cos(p1Angle) * 22.0);
    const p2Y = p2Alive ? -p2.y : (p1Y - Math.sin(p1Angle) * 22.0);

    const p1p2Dist = p2Alive ? Math.hypot(p1X - p2X, p1Y - p2Y) : 22.0;

    // Terrain elevation at P1 and battle midpoint (active on-track cars are flat at Z=0)
    const p1Elev = (p1 && !p1.crashed && p1.alive) ? 0 : this.getExactMeshHeight(p1X, p1Y);
    const p2Elev = (p2Alive && !p2.crashed) ? 0 : (p2Alive ? this.getExactMeshHeight(p2X, p2Y) : p1Elev);
    const battleElev = p2Alive ? (p1Elev + p2Elev) * 0.5 : p1Elev;

    // Smooth track corridor reference angle (never twitches on car steering or drifts)
    let refAngle = p1Angle;
    const t = this.track;
    if (t && t.tx && t.ty && t.N && p1 && p1.idx !== undefined) {
      const p1Idx = ((Math.floor(p1.idx) % t.N) + t.N) % t.N;
      if (typeof t.tx[p1Idx] === 'number' && typeof t.ty[p1Idx] === 'number') {
        refAngle = Math.atan2(-t.ty[p1Idx], t.tx[p1Idx]);
      }
    }

    // Blend tracking angle with vector from P2 to P1 to keep P2 framed within the viewport
    let battleAngle = refAngle;
    if (p2Alive && p1p2Dist > 8.0) {
      const directAngle = Math.atan2(p1Y - p2Y, p1X - p2X);
      let diffDirect = directAngle - refAngle;
      while (diffDirect > Math.PI) diffDirect -= Math.PI * 2;
      while (diffDirect < -Math.PI) diffDirect += Math.PI * 2;
      const angleWeight = Math.max(0, 1.0 - Math.abs(diffDirect) / (Math.PI * 0.5));
      battleAngle = refAngle + diffDirect * (0.30 * angleWeight);
    }

    // Destination camera pose & glide defaults computed by active preset
    let destCamX = this.camera.position.x;
    let destCamY = this.camera.position.y;
    let destCamZ = this.camera.position.z;
    let destTargetX = this.controls.target.x;
    let destTargetY = this.controls.target.y;
    let destTargetZ = this.controls.target.z;
    let targetFov = 42;
    let camGlide = 0.035;
    let targetGlide = 0.040;

    // 2. Camera View & Preset Positioning
    if (cameraPreset === 'orbit' || !opts.follow || !focusCar) {
      destTargetX = p1X;
      destTargetY = p1Y;
      destTargetZ = 2.5 + p1Elev;
      // High cinematic orbit perspective framing both cars
      const orbitDist = Math.max(110.0, Math.min(230.0, 110.0 + p1p2Dist * 0.45));
      const altitude = Math.max(48.0, Math.min(140.0, 48.0 + p1p2Dist * 0.35)) + battleElev;
      destCamX = p1X + orbitDist * 0.8;
      destCamY = p1Y - orbitDist * 0.6;
      destCamZ = altitude;
      targetFov = Math.max(42, Math.min(66, 42 + (p1p2Dist / 100.0) * 16));
      camGlide = 0.035;
      targetGlide = 0.040;
    } else if (cameraPreset === 'action' && focusCar) {
      // ACTION FRONT CAM: Reverse camera floating AHEAD of P1, looking back at P1's nose & P2 behind
      if (typeof this._actionAngle !== 'number' || this._lastActionFocus !== p1 || this._lastActivePreset !== 'action') {
        this._actionAngle = refAngle;
      } else {
        let diffAngle = refAngle - this._actionAngle;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        this._actionAngle += diffAngle * cameraBlend(0.032);
      }
      this._lastActionFocus = p1;

      const cosA = Math.cos(this._actionAngle);
      const sinA = Math.sin(this._actionAngle);
      const nx = -sinA;
      const ny = cosA;

      // Position camera decisively AHEAD of P1 looking back at P1's nose and front wing
      // Generous distance and height for authentic F1 broadcast framing
      const speedLead = Math.max(0, (p1.speed || 0) * 0.16);
      const leadDist = Math.max(56.0, Math.min(135.0, 56.0 + speedLead + p1p2Dist * 0.22));

      // Gentle lateral offset framing P2 over P1's shoulder
      const lateralSign = (p2Alive && ((p2X - p1X) * nx + (p2Y - p1Y) * ny < 0)) ? 1 : -1;
      const lateralOff = lateralSign * Math.min(7.0, 3.0 + p1p2Dist * 0.04);

      destCamX = p1X + cosA * leadDist + nx * lateralOff;
      destCamY = p1Y + sinA * leadDist + ny * lateralOff;
      destCamZ = Math.max(10.5, Math.min(26.0, 10.5 + p1p2Dist * 0.12)) + battleElev;

      // Look target centered smoothly on P1
      destTargetX = p1X;
      destTargetY = p1Y;
      destTargetZ = 1.8 + p1Elev;

      targetFov = Math.max(38, Math.min(54, 38 + (p1p2Dist / 100.0) * 14));
      camGlide = 0.045;
      targetGlide = 0.055;
    } else if (cameraPreset === 'action_rear' && focusCar) {
      // ACTION REAR CAM: Low-angle battle pursuit behind the pack, framing P2 & P1
      if (typeof this._actionRearAngle !== 'number' || this._lastActionRearFocus !== p1 || this._lastActivePreset !== 'action_rear') {
        this._actionRearAngle = battleAngle;
      } else {
        let diffAngle = battleAngle - this._actionRearAngle;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        this._actionRearAngle += diffAngle * cameraBlend(0.032);
      }
      this._lastActionRearFocus = p1;

      const cosA = Math.cos(this._actionRearAngle);
      const sinA = Math.sin(this._actionRearAngle);
      const nx = -sinA;
      const ny = cosA;

      // Position camera BEHIND P2 looking forward at P1
      const trailDist = Math.max(30.0, Math.min(180.0, p1p2Dist + 26.0));
      const heightAbove = Math.max(5.8, Math.min(32.0, 5.8 + p1p2Dist * 0.14));
      const rearOriginX = p2Alive ? p2X : p1X;
      const rearOriginY = p2Alive ? p2Y : p1Y;
      destCamX = rearOriginX - cosA * trailDist + nx * 2.0;
      destCamY = rearOriginY - sinA * trailDist + ny * 2.0;
      destCamZ = heightAbove + battleElev;

      destTargetX = p1X + cosA * 5.0;
      destTargetY = p1Y + sinA * 5.0;
      destTargetZ = 1.8 + p1Elev;

      targetFov = Math.max(42, Math.min(66, 42 + (p1p2Dist / 100.0) * 18));
      camGlide = 0.042;
      targetGlide = 0.050;
    } else if (cameraPreset === 'follow' && focusCar) {
      // CLASSIC BROADCAST FOLLOW CAM: Smooth high-altitude TV tracking focused on P1 with P2 in view
      destTargetX = p1X;
      destTargetY = p1Y;
      destTargetZ = 3.0 + p1Elev;

      const altitude = Math.max(90.0, Math.min(220.0, 90.0 + p1p2Dist * 0.50)) + battleElev;
      destCamX = p1X - 110.0 - Math.min(60.0, p1p2Dist * 0.25);
      destCamY = p1Y + 60.0 + Math.min(40.0, p1p2Dist * 0.20);
      destCamZ = altitude;

      targetFov = Math.max(44, Math.min(68, 44 + (p1p2Dist / 90.0) * 16));
      camGlide = 0.038;
      targetGlide = 0.045;
    } else if (cameraPreset === 'onboard' && p1) {
      // ONBOARD T-CAM on P1 (Roll-hoop periscope camera elevated above cockpit & halo)
      const targetCar = p1;
      const cosA = Math.cos(targetCar.angle);
      const sinA = Math.sin(targetCar.angle);
      const targetElev = p1Elev;

      destCamX = targetCar.x - cosA * 2.0;
      destCamY = -targetCar.y + sinA * 2.0;
      destCamZ = 5.8 + targetElev;

      destTargetX = targetCar.x + cosA * 52;
      destTargetY = -targetCar.y - sinA * 52;
      destTargetZ = 2.6 + targetElev;

      targetFov = 44;
    } else if (cameraPreset === 'heli' && focusCar) {
      // CINEMATIC AERIAL PURSUIT HELICOPTER: High aerial sky tracker framing P1 and P2
      if (typeof this._heliAngle !== 'number' || typeof this._heliTargetX !== 'number') {
        this._heliAngle = battleAngle;
        this._heliTargetX = p1X;
        this._heliTargetY = p1Y;
      } else {
        let diffAngle = battleAngle - this._heliAngle;
        while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
        while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;
        this._heliAngle += diffAngle * cameraBlend(0.020);

        this._heliTargetX += (p1X - this._heliTargetX) * cameraBlend(0.040);
        this._heliTargetY += (p1Y - this._heliTargetY) * cameraBlend(0.040);
      }
      this._lastHeliFocus = p1;

      const cosA = Math.cos(this._heliAngle);
      const sinA = Math.sin(this._heliAngle);
      const nx = -sinA;
      const ny = cosA;

      const trailDist = Math.max(60.0, Math.min(220.0, p1p2Dist + 48.0));
      const lateralDist = 32.0 + Math.min(36.0, p1p2Dist * 0.16);
      const altitude = Math.max(65.0, Math.min(180.0, 65.0 + p1p2Dist * 0.45)) + battleElev;

      destCamX = this._heliTargetX - cosA * trailDist + nx * lateralDist;
      destCamY = this._heliTargetY - sinA * trailDist + ny * lateralDist;
      destCamZ = altitude;

      destTargetX = p1X;
      destTargetY = p1Y;
      destTargetZ = 2.0 + p1Elev;

      targetFov = Math.max(42, Math.min(68, 42 + (p1p2Dist / 100.0) * 16));
      camGlide = 0.038;
      targetGlide = 0.045;
    } else if (cameraPreset === 'broadcast') {
      // TV GANTRY CAMERA (Fixed Start / Finish Gantry view)
      const cx = t.cx[0];
      const cy = -t.cy[0];
      const tx = t.tx[0];
      const ty = -t.ty[0];
      const nx = -ty;
      const ny = tx;

      destCamX = cx + tx * 80 + nx * 28;
      destCamY = cy + ty * 80 + ny * 28;
      destCamZ = 48.0;

      const incomingCar = (p1 && (p1.alive || p1.finished) && !p1.crashed)
        ? p1
        : ((this._gantryTargetCar && (this._gantryTargetCar.alive || this._gantryTargetCar.finished) && !this._gantryTargetCar.crashed)
          ? this._gantryTargetCar
          : (leader && leader.alive ? leader : null));
      const incoming = incomingCar === p1 ? p1 : getRenderPose(incomingCar, opts.renderAlpha);
      destTargetX = incoming ? incoming.x : cx - tx * 35;
      destTargetY = incoming ? -incoming.y : cy - ty * 35;
      destTargetZ = 3.2;

      targetFov = Math.max(42, Math.min(62, 42 + (p1p2Dist / 80.0) * 14));
      camGlide = 0.040;
      targetGlide = 0.050;
    } else {
      // DEFAULT: 'chase' preset (Dynamic 3rd-person follow tracking P1)
      if (hasFinisher && !opts.manual && p1 && p1.finished) {
        const cx = t.cx[0];
        const cy = -t.cy[0];
        const tx = t.tx[0];
        const ty = -t.ty[0];
        const nx = -ty;
        const ny = tx;

        destCamX = cx + tx * 80 + nx * 28;
        destCamY = cy + ty * 80 + ny * 28;
        destCamZ = 48.0;

        destTargetX = p1.x;
        destTargetY = -p1.y;
        destTargetZ = 3.2;

        targetFov = 42;
        camGlide = 0.040;
        targetGlide = 0.050;
      } else if (p1) {
        const carAngle3D = -p1.angle;
        // Blend actual car heading with smooth corridor tangent so it tracks the car's true heading smoothly
        let targetChaseHeading = carAngle3D;
        if (p1.speed > 10 && t && t.tx && t.ty && t.N && p1.idx !== undefined) {
          const p1Idx = ((Math.floor(p1.idx) % t.N) + t.N) % t.N;
          if (typeof t.tx[p1Idx] === 'number' && typeof t.ty[p1Idx] === 'number') {
            const trackHeading = Math.atan2(-t.ty[p1Idx], t.tx[p1Idx]);
            let diffH = trackHeading - carAngle3D;
            while (diffH > Math.PI) diffH -= Math.PI * 2;
            while (diffH < -Math.PI) diffH += Math.PI * 2;
            targetChaseHeading = carAngle3D + diffH * 0.25;
          }
        }

        if (typeof this._chaseAngle !== 'number' || typeof this._chaseTargetX !== 'number') {
          this._chaseAngle = targetChaseHeading;
          this._chaseTargetX = p1X;
          this._chaseTargetY = p1Y;
        } else {
          // Dynamic adaptive position following: smoothly scales with lag distance so the car never outruns the camera
          const posDist = Math.hypot(p1X - this._chaseTargetX, p1Y - this._chaseTargetY);
          const posFollowK = Math.min(0.25, 0.090 + Math.max(0, posDist - 5.0) * 0.008);
          this._chaseTargetX += (p1X - this._chaseTargetX) * cameraBlend(posFollowK);
          this._chaseTargetY += (p1Y - this._chaseTargetY) * cameraBlend(posFollowK);

          let diffAngle = targetChaseHeading - this._chaseAngle;
          while (diffAngle > Math.PI) diffAngle -= Math.PI * 2;
          while (diffAngle < -Math.PI) diffAngle += Math.PI * 2;

          // Adaptive angular tracking: turns smoothly with the car, accelerating through sharp bends without sudden jerks
          const angleK = Math.min(0.20, 0.085 + Math.abs(diffAngle) * 0.065);
          this._chaseAngle += diffAngle * cameraBlend(angleK);
        }
        this._lastFocusCar = p1;

        const cosA = Math.cos(this._chaseAngle);
        const sinA = Math.sin(this._chaseAngle);

        // Generous, breathable chase camera distance and elevated vantage point
        const speedBonus = Math.min(18.0, (p1.speed || 0) * 0.12);
        const distBehind = Math.max(68.0, Math.min(210.0, 66.0 + speedBonus + p1p2Dist * 0.45));
        const heightAbove = Math.max(22.0, Math.min(56.0, 22.0 + speedBonus * 0.35 + p1p2Dist * 0.15));
        destCamX = this._chaseTargetX - cosA * distBehind;
        destCamY = this._chaseTargetY - sinA * distBehind;
        destCamZ = heightAbove + battleElev;

        // Look-ahead framing: look ahead of P1 along travel direction so car is positioned in lower-center third of screen
        const lookAhead = 14.0;
        destTargetX = p1X + cosA * lookAhead;
        destTargetY = p1Y + sinA * lookAhead;
        destTargetZ = 2.4 + p1Elev;

        // Wide, cinematic FOV: prevents claustrophobic framing and gives ample screen margins
        targetFov = Math.max(54, Math.min(74, 54 + (p1p2Dist / 80.0) * 16));
        camGlide = 0.085;
        targetGlide = 0.095;
      }
    }

    // -------------------------------------------------------------
    // DYNAMIC VIEWPORT SAFETY GUARD & SMOOTH AUTO-ZOOM COMPENSATION
    // If the tracked car (or P2 battle car) drifts toward or outside
    // the screen boundaries, smoothly and temporarily zoom out (expanding
    // FOV & easing camera distance pullback) while smoothly panning to
    // re-center the car. When the car returns safely into the central
    // viewing zone, zoom-out decays gracefully back to baseline.
    // -------------------------------------------------------------
    const isOrbitActive = (cameraPreset === 'orbit' || !opts.follow || !focusCar);
    const isOnboardActive = cameraPreset === 'onboard' && !!p1 && !isOrbitActive;
    const nearPlane = isOnboardActive ? 0.2 : 5;
    if (this.camera.near !== nearPlane) {
      this.camera.near = nearPlane;
      this.camera.updateProjectionMatrix();
    }
    if (focusCar && !isOrbitActive && !isOnboardActive) {
      this.camera.updateMatrixWorld();
      if (!this._tempNdcVec) this._tempNdcVec = new THREE.Vector3();
      const carZ = (focusCar.crashed && focusCar.alive) ? this.getTerrainHeight(p1X, p1Y) : (1.0 + p1Elev);
      this._tempNdcVec.set(p1X, p1Y, carZ).project(this.camera);

      // Safe viewport margin: central 65% of screen
      let p1Exit = Math.max(Math.abs(this._tempNdcVec.x) / 0.65, Math.abs(this._tempNdcVec.y) / 0.65);
      if (this._tempNdcVec.z > 1.0 || this._tempNdcVec.z < -1.0) {
        // Behind camera or clipped
        p1Exit = Math.max(p1Exit, 2.0);
      }

      let p2Exit = 0;
      if (p2Alive) {
        if (!this._tempNdcVecP2) this._tempNdcVecP2 = new THREE.Vector3();
        this._tempNdcVecP2.set(p2X, p2Y, 1.0 + p2Elev).project(this.camera);
        p2Exit = Math.max(Math.abs(this._tempNdcVecP2.x) / 0.72, Math.abs(this._tempNdcVecP2.y) / 0.72);
        if (this._tempNdcVecP2.z > 1.0 || this._tempNdcVecP2.z < -1.0) {
          p2Exit = Math.max(p2Exit, 1.6);
        }
      }

      const maxExit = Math.max(p1Exit, p2Exit * 0.82);
      const excess = Math.max(0, maxExit - 1.0);

      // Desired temporary zoom-out compensation
      const targetExtraFov = Math.min(26.0, excess * 20.0);
      const targetExtraDist = Math.min(45.0, excess * 35.0);

      if (typeof this._dynamicZoomOutFov !== 'number') {
        this._dynamicZoomOutFov = 0;
        this._dynamicZoomOutDist = 0;
      }

      // Responsive zoom-out expansion (k=0.075), ultra-smooth gentle recovery (k=0.020)
      const kFov = (targetExtraFov > this._dynamicZoomOutFov) ? 0.075 : 0.020;
      this._dynamicZoomOutFov += (targetExtraFov - this._dynamicZoomOutFov) * cameraBlend(kFov);
      this._dynamicZoomOutDist += (targetExtraDist - this._dynamicZoomOutDist) * cameraBlend(kFov);

      // Apply temporary smooth zoom-out to FOV
      targetFov += this._dynamicZoomOutFov;

      // Smooth pan assistance when car is drifting out: gently nudge look target toward car
      if (excess > 0) {
        const panAssist = Math.min(0.35, excess * 0.20);
        destTargetX += (p1X - destTargetX) * panAssist;
        destTargetY += (p1Y - destTargetY) * panAssist;
      }

      // Smooth camera distance pullback
      if (this._dynamicZoomOutDist > 0.05) {
        const pdx = destCamX - destTargetX;
        const pdy = destCamY - destTargetY;
        const pdz = destCamZ - destTargetZ;
        const plen = Math.hypot(pdx, pdy, pdz);
        if (plen > 0.1) {
          destCamX += (pdx / plen) * this._dynamicZoomOutDist;
          destCamY += (pdy / plen) * this._dynamicZoomOutDist;
          destCamZ += (pdz / plen) * (this._dynamicZoomOutDist * 0.60);
        }
      }
    }

    // -------------------------------------------------------------
    // FLAWLESS CINEMATIC CAMERA TRANSITION & MOTION ENGINE
    // Synchronizes camera position, target, FOV, and terrain elevation
    // with smooth quintic easing and a parabolic altitude arc.
    // -------------------------------------------------------------
    const now = performance.now();

    if (isOnboardActive) {
      // A mounted camera cannot glide independently of its chassis or frame a trailing P2.
      this._camTransition = null;
      this._dynamicZoomOutFov = 0;
      this._dynamicZoomOutDist = 0;
    }
    if (!isOnboardActive && this._lastActivePreset && cameraPreset !== this._lastActivePreset) {
      // Capture departing target and camera position
      const startCamPos = this.camera.position.clone();
      const startTarget = this.controls.target.clone();
      const startOffset = new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
      const startFov = this.camera.fov;

      const liveDestOffset = new THREE.Vector3(
        destCamX - destTargetX,
        destCamY - destTargetY,
        destCamZ - destTargetZ
      );

      const r0 = Math.hypot(startOffset.x, startOffset.y);
      const r1 = Math.hypot(liveDestOffset.x, liveDestOffset.y);

      // When switching to/from fixed TV Gantry or across large spatial offsets,
      // use direct Cartesian linear glide to prevent the camera from flying far outside the track.
      const isDirectMode = cameraPreset === 'broadcast' || this._lastActivePreset === 'broadcast' ||
                           cameraPreset === 'orbit' || this._lastActivePreset === 'orbit' ||
                           cameraPreset === 'action' || this._lastActivePreset === 'action' ||
                           cameraPreset === 'action_rear' || this._lastActivePreset === 'action_rear' ||
                           r0 > 75 || r1 > 75;

      if (isDirectMode) {
        this._camTransition = {
          active: true,
          type: 'direct',
          startTime: now,
          duration: (cameraPreset === 'broadcast') ? 1400 : 1800,
          startCamPos,
          startTarget,
          startFov,
        };
      } else {
        let phi0 = r0 > 0.5 ? Math.atan2(startOffset.y, startOffset.x) : 0;
        let phi1 = r1 > 0.5 ? Math.atan2(liveDestOffset.y, liveDestOffset.x) : phi0;
        if (r0 <= 0.5) phi0 = phi1;

        let diffPhi = phi1 - phi0;
        while (diffPhi > Math.PI) diffPhi -= Math.PI * 2;
        while (diffPhi < -Math.PI) diffPhi += Math.PI * 2;

        const z0 = startOffset.z;
        const z1 = liveDestOffset.z;
        const duration = 2000;
        const peakArcHeight = Math.min(8.0, Math.max(2.5, Math.abs(diffPhi) * 2.0));

        this._camTransition = {
          active: true,
          type: 'orbital',
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
    }
    this._lastActivePreset = cameraPreset;

    if (this._camTransition && this._camTransition.active) {
      const elapsed = now - this._camTransition.startTime;
      const progress = Math.min(1.0, elapsed / this._camTransition.duration);

      // Quintic SmootherStep curve: s'(0)=0, s''(0)=0, s'(1)=0, s''(1)=0 (infinite smoothness)
      // s(t) = t^3 * (t * (6t - 15) + 10)
      const s = progress * progress * progress * (progress * (progress * 6 - 15) + 10);

      let curX, curY, curZ, curTargetX, curTargetY, curTargetZ;

      if (this._camTransition.type === 'direct') {
        // Direct world-space Cartesian glide straight to the destination
        curX = this._camTransition.startCamPos.x + (destCamX - this._camTransition.startCamPos.x) * s;
        curY = this._camTransition.startCamPos.y + (destCamY - this._camTransition.startCamPos.y) * s;
        curZ = this._camTransition.startCamPos.z + (destCamZ - this._camTransition.startCamPos.z) * s;

        curTargetX = this._camTransition.startTarget.x + (destTargetX - this._camTransition.startTarget.x) * s;
        curTargetY = this._camTransition.startTarget.y + (destTargetY - this._camTransition.startTarget.y) * s;
        curTargetZ = this._camTransition.startTarget.z + (destTargetZ - this._camTransition.startTarget.z) * s;
      } else {
        // Orbital cylindrical sweep around the target
        curTargetX = this._camTransition.startTarget.x + (destTargetX - this._camTransition.startTarget.x) * s;
        curTargetY = this._camTransition.startTarget.y + (destTargetY - this._camTransition.startTarget.y) * s;
        curTargetZ = this._camTransition.startTarget.z + (destTargetZ - this._camTransition.startTarget.z) * s;

        const curPhi = this._camTransition.phi0 + this._camTransition.diffPhi * s;
        const curRadius = this._camTransition.r0 + (this._camTransition.r1 - this._camTransition.r0) * s;
        const arcZ = Math.sin(Math.PI * s) * this._camTransition.peakArcHeight;
        const curZOffset = this._camTransition.z0 + (this._camTransition.z1 - this._camTransition.z0) * s + arcZ;

        const curOffsetX = Math.cos(curPhi) * curRadius;
        const curOffsetY = Math.sin(curPhi) * curRadius;

        curX = curTargetX + curOffsetX;
        curY = curTargetY + curOffsetY;
        curZ = curTargetZ + curZOffset;
      }

      // Strict terrain elevation guard: camera never clips through hills or mounds
      const groundElev = this.getExactMeshHeight(curX, curY);
      if (curZ < groundElev + 2.5) {
        curZ = groundElev + 2.5;
      }

      const curFov = this._camTransition.startFov + (targetFov - this._camTransition.startFov) * s;

      this.camera.position.set(curX, curY, curZ);
      this.controls.target.set(curTargetX, curTargetY, curTargetZ);
      this.camera.lookAt(curTargetX, curTargetY, curTargetZ);
      this.camera.fov = curFov;
      this.camera.updateProjectionMatrix();

      if (progress >= 1.0) {
        this._camTransition.active = false;
      }
    } else if (isOrbitActive) {
      // In steady-state orbit mode, OrbitControls auto-rotates around target ONLY if follow is OFF
      this.controls.autoRotate = !opts.follow;
      this.controls.autoRotateSpeed = 0.55;
      this.controls.target.x += (destTargetX - this.controls.target.x) * cameraBlend(0.050);
      this.controls.target.y += (destTargetY - this.controls.target.y) * cameraBlend(0.050);
      this.controls.target.z += (destTargetZ - this.controls.target.z) * cameraBlend(0.050);

      if (Math.abs(this.camera.fov - targetFov) > 0.05) {
        this.camera.fov += (targetFov - this.camera.fov) * cameraBlend(0.035);
        this.camera.updateProjectionMatrix();
      }
    } else if (isOnboardActive) {
      this.controls.autoRotate = false;
      this.camera.position.set(destCamX, destCamY, destCamZ);
      this.controls.target.set(destTargetX, destTargetY, destTargetZ);
      this.camera.lookAt(this.controls.target);
      if (this.camera.fov !== targetFov) {
        this.camera.fov = targetFov;
        this.camera.updateProjectionMatrix();
      }
    } else {
      // Normal steady-state smooth tracking
      this.controls.autoRotate = false;
      this.camera.position.x += (destCamX - this.camera.position.x) * cameraBlend(camGlide);
      this.camera.position.y += (destCamY - this.camera.position.y) * cameraBlend(camGlide);
      this.camera.position.z += (destCamZ - this.camera.position.z) * cameraBlend(camGlide);

      this.controls.target.x += (destTargetX - this.controls.target.x) * cameraBlend(targetGlide);
      this.controls.target.y += (destTargetY - this.controls.target.y) * cameraBlend(targetGlide);
      this.controls.target.z += (destTargetZ - this.controls.target.z) * cameraBlend(targetGlide);

      if (Math.abs(this.camera.fov - targetFov) > 0.02) {
        const fovLerp = (targetFov > this.camera.fov) ? 0.065 : 0.035;
        this.camera.fov += (targetFov - this.camera.fov) * cameraBlend(fovLerp);
        this.camera.updateProjectionMatrix();
      }

      // Strict forward distance guard for Action Front camera: camera must maintain generous lead ahead of P1
      if (cameraPreset === 'action' && p1) {
        const pCos = Math.cos(this._actionAngle || refAngle);
        const pSin = Math.sin(this._actionAngle || refAngle);
        const forwardDist = (this.camera.position.x - p1X) * pCos + (this.camera.position.y - p1Y) * pSin;
        if (forwardDist < 46.0) {
          const push = 46.0 - forwardDist;
          this.camera.position.x += pCos * push;
          this.camera.position.y += pSin * push;
        }
        const minZ = 8.5 + p1Elev;
        if (this.camera.position.z < minZ) {
          this.camera.position.z = minZ;
        }
      }
      // Aim after the front-camera clearance guard has finalized its position.
      this.camera.lookAt(this.controls.target);
    }
    if (isOrbitActive) {
      this.controls.update();
    }
    if (this.skyMesh) {
      this.skyMesh.position.copy(this.camera.position);
      if (this.skyMat && this.skyMat.uniforms && this.skyMat.uniforms.uTime) {
        this.skyMat.uniforms.uTime.value = performance.now() * 0.001;
      }
    }

    // Smart Viewport Frustum Visibility & Auto-Recovery Guard
    // When the tracked car leaves the screen viewport for >3500ms during dynamic pursuit,
    // automatically recover camera angle / switch to Helicopter or Chase perspective.
    // Dynamic smooth zoom-out handles temporary drifts smoothly before any preset switch!
    const checkedCar = (this.focusedCar && (this.focusedCar.alive || this.focusedCar.finished))
      ? this.focusedCar
      : (focusCar && (focusCar.alive || focusCar.finished) ? focusCar : (leader || (rankedCars && rankedCars[0])));
    const checkCar = getRenderPose(checkedCar, opts.renderAlpha);

    const isBroadcastPreset = this.activeCameraPreset === 'broadcast';
    const isStartPhase = Boolean(sim && sim.time !== undefined && sim.time < 8.5);
    const inSwitchGrace = (now - (this._lastPresetSwitchTime || 0)) < 7000;

    if (this.isAutoDirector && checkCar && !isOrbitActive && !isOnboardActive && !isBroadcastPreset && !isStartPhase && !inSwitchGrace) {
      if (!this._tempNdcVec) this._tempNdcVec = new THREE.Vector3();
      const carZ = (checkCar.crashed && checkCar.alive) ? this.getExactMeshHeight(checkCar.x, -checkCar.y) : 0.8;
      this._tempNdcVec.set(checkCar.x, -checkCar.y, carZ).project(this.camera);

      const isBehindCam = this._tempNdcVec.z > 1.0 || this._tempNdcVec.z < -1.0;
      const isOffScreenX = Math.abs(this._tempNdcVec.x) > 0.95;
      const isOffScreenY = Math.abs(this._tempNdcVec.y) > 0.93;
      const isOutViewport = isBehindCam || isOffScreenX || isOffScreenY;

      if (isOutViewport) {
        if (!this._outOfViewportStart) {
          this._outOfViewportStart = now;
        } else if (now - this._outOfViewportStart > 3500) {
          const recoveryPreset = (this.activeCameraPreset === 'heli') ? 'chase' : 'heli';
          this._autoPreset = recoveryPreset;
          this.activeCameraPreset = recoveryPreset;
          this._lastPresetSwitchTime = now;
          this._autoNextSwitch = now + 24000;
          this._outOfViewportStart = null;

          if (typeof this._heliAngle === 'number') this._heliAngle = refAngle;
          if (typeof this._chaseAngle === 'number') this._chaseAngle = refAngle;
          if (typeof this._actionRearAngle === 'number') this._actionRearAngle = refAngle;
          if (typeof this._actionAngle === 'number') this._actionAngle = refAngle;
        }
      } else {
        this._outOfViewportStart = null;
      }
    } else {
      this._outOfViewportStart = null;
    }

    // Identify Top 10 positions on track for selective billboard position badges
    const top10 = rankedCars.slice(0, 10);
    const visibleSet = new Set(top10);
    if (sim && sim.player && sim.player.alive) visibleSet.add(sim.player);
    if (focusCar && focusCar.alive) visibleSet.add(focusCar);

    // Update Simulation Fleet (All active cars visible; P.x badges shown selectively for Top 10)
    for (let i = 0; i < this.carPool.length; i++) {
      const mesh = this.carPool[i];
      const car = sim.cars[i];
      const shouldShow = this.f1Loaded && car && (car.alive || car.finished);
      if (shouldShow) {
        mesh.visible = true;

        const pose = getRenderPose(car, opts.renderAlpha);
        const targetX = pose.x;
        const targetY = -pose.y;
        const targetAngle = -pose.angle;

        const targetZ = (car.crashed && car.alive) ? this.getExactMeshHeight(targetX, targetY) : 0;

        if (typeof mesh.userData.curX !== 'number' || Math.hypot(targetX - mesh.userData.curX, targetY - mesh.userData.curY) > 60) {
          mesh.userData.curX = targetX;
          mesh.userData.curY = targetY;
          mesh.userData.curZ = targetZ;
          mesh.userData.curAngle = targetAngle;
          mesh.userData.curPitch = 0;
          mesh.userData.curRoll = 0;
        } else {
          mesh.userData.curZ += (targetZ - mesh.userData.curZ) * 0.60;

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

        // Camera and body share the interpolated pose; a second easing filter adds jitter and lag.
        mesh.userData.curX = targetX;
        mesh.userData.curY = targetY;
        mesh.userData.curAngle = targetAngle;
        mesh.position.set(targetX, targetY, mesh.userData.curZ);
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
      this.updateRays(getRenderPose(leader, opts.renderAlpha));
    } else {
      this.rayGroup.visible = false;
    }

    // Update Player Car (Manual drive mode)
    if (this.f1Loaded && sim.player && sim.player.alive) {
      this.playerCar.visible = true;
      const playerPose = getRenderPose(sim.player, opts.renderAlpha);
      const targetX = playerPose.x;
      const targetY = -playerPose.y;
      const targetZ = (sim.player.crashed) ? this.getExactMeshHeight(targetX, targetY) : 0;
      const targetAngle = -playerPose.angle;

      if (typeof this.playerCar.userData.curX !== 'number' || Math.hypot(targetX - this.playerCar.userData.curX, targetY - this.playerCar.userData.curY) > 60) {
        this.playerCar.userData.curX = targetX;
        this.playerCar.userData.curY = targetY;
        this.playerCar.userData.curZ = targetZ;
        this.playerCar.userData.curAngle = targetAngle;
        this.playerCar.userData.curPitch = 0;
        this.playerCar.userData.curRoll = 0;
      } else {
        this.playerCar.userData.curZ += (targetZ - this.playerCar.userData.curZ) * 0.65;

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

      this.playerCar.userData.curX = targetX;
      this.playerCar.userData.curY = targetY;
      this.playerCar.userData.curAngle = targetAngle;
      this.playerCar.position.set(targetX, targetY, this.playerCar.userData.curZ);
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

    // Update Holographic Record Ghost Car
    this.updateRecordGhost(sim, opts);

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
    if (opts.motionDebug && isOnboardActive) {
      const debug = this._motionDebug || (this._motionDebug = { since: cameraNow, switches: 0, peakCorrection: 0, worstFrame: 0 });
      if (debug.focus && debug.focus !== this.focusedCar) debug.switches++;
      debug.focus = this.focusedCar;
      debug.worstFrame = Math.max(debug.worstFrame, cameraDt * 1000);
      for (const car of rankedCars) debug.peakCorrection = Math.max(debug.peakCorrection, car.motionCorrection || 0);
      if (cameraNow - debug.since >= 1000) {
        const near = rankedCars.filter(car => car !== this.focusedCar && Math.hypot(car.x - p1X, -car.y - p1Y) < 180)
          .map(car => ({ car: car.carNumber, idx: car.idx, speed: +car.speed.toFixed(1),
            correction: +(car.motionCorrection || 0).toFixed(2), steer: +car.steer.toFixed(2),
            throttle: +car.throttle.toFixed(2), heading: +(car.headingDiff || 0).toFixed(2) }));
        console.info('[MOTION] ' + JSON.stringify({ focus: this.focusedCar?.carNumber, idx: p1?.idx,
          switches: debug.switches, correction: +debug.peakCorrection.toFixed(2), gap: +debug.worstFrame.toFixed(1), near }));
        debug.since = cameraNow; debug.switches = 0; debug.peakCorrection = 0; debug.worstFrame = 0;
      }
    }
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
