import * as THREE from 'three';
import { TEAM_PALETTE, F1_DECAL_CONFIG } from './renderer3d.js';

/**
 * CarSideviewRenderer
 * Renders high-fidelity, crisp, authentic orthographic side profiles of the real 3D F1 2022 car model
 * with full team liveries, shaders, Pirelli tires, aero wings, halo, and side number decals.
 */
class CarSideviewRenderer {
  constructor() {
    this.f1Template = null;
    this.f1DecalGeometries = null;
    this.f1Texture = null;
    this.renderer = null;
    this.scene = null;
    this.camera = null;
    this.cache = new Map(); // key -> dataUrl
    this.isReady = false;
    this.listeners = [];
  }

  init(template, decalGeometries, texture) {
    if (!template) return;
    this.f1Template = template;
    this.f1DecalGeometries = decalGeometries;
    this.f1Texture = texture;

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
        preserveDrawingBuffer: true,
        powerPreference: 'low-power'
      });
      this.renderer.setSize(width, height, false);
      this.renderer.setPixelRatio(1);
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
      this.renderer.toneMappingExposure = 1.15;

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

  createRaceNumberTexture(num, isPlayer = false) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, 512, 512);

    const numStr = String(num);
    const fontSize = numStr.length >= 3 ? 200 : numStr.length === 2 ? 260 : 310;

    // Classic Motorsport White Roundel Disc
    ctx.beginPath();
    ctx.arc(256, 256, 230, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
    ctx.fill();

    // Bold Outer Border
    ctx.lineWidth = 26;
    ctx.strokeStyle = '#000000';
    ctx.stroke();

    // Crisp Bold Black Number
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

  buildCarMesh(teamIdx = 0, isPlayer = false, carNumber = 1) {
    if (!this.f1Template) return null;

    const tm = isPlayer
      ? { hex: 0x00e626, secHex: 0xfacc15, accHex: 0xffffff, quadHex: 0x00e626 }
      : (TEAM_PALETTE[teamIdx % TEAM_PALETTE.length] || TEAM_PALETTE[0]);

    const group = new THREE.Group();
    const carSubGroup = new THREE.Group();
    const model = this.f1Template.clone(true);

    const s = 6.0;
    model.scale.set(s, s, s);
    model.rotation.set(Math.PI / 2, 0, 0);
    model.position.set(0, 0, 0);

    const cPri = new THREE.Color(tm.hex);
    const cSec = new THREE.Color(tm.secHex);
    const cAcc = new THREE.Color(tm.accHex);
    const cQuad = new THREE.Color(tm.quadHex || tm.secHex);
    const numTex = this.createRaceNumberTexture(carNumber, isPlayer);

    model.traverse((child) => {
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
        const isFrontWheelsMesh = child.name === 'Object_8';
        const isRearWheelsMesh = child.name === 'Object_10';

        const origMap = child.material?.map || this.f1Texture;
        const origRoughness = child.material?.roughness ?? 0.45;
        const origMetalness = child.material?.metalness ?? 0.1;

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

          if (isFrontWheelsMesh || isRearWheelsMesh) {
            isTireArr[i] = 1.0;
            isBodyArr[i] = 0.0;
            liveryColorArr[i * 3] = 1.0;
            liveryColorArr[i * 3 + 1] = 1.0;
            liveryColorArr[i * 3 + 2] = 1.0;
          } else {
            isTireArr[i] = 0.0;

            const isUnderfloor = (y < 0.105) || (x < -1.1 && y < 0.16 && absZ < 0.40);
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
                c = cSec; // Nose Tip & Front Wing
              } else if (
                (x < -0.15 && x > -1.25 && y > 0.56 && absZ < 0.12) ||
                (x >= -0.25 && x <= 0.35 && y > 0.54 && absZ < 0.24)
              ) {
                c = cAcc; // Halo Safety Ring & Shark Fin
              } else if (absZ >= 0.22 && absZ <= 0.58 && x >= -0.45 && x <= 0.75 && y >= 0.13 && y <= 0.50) {
                c = cQuad; // Sidepod Radiator Inlets
              } else if (absZ > 0.50 && Math.abs(x - (-1.48)) < 0.50 && y >= 0.12 && y <= 0.45) {
                c = cAcc; // Rear brake duct winglets
              } else {
                c = cPri; // Main Chassis Monocoque & Engine Cover
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
                if (texColor.r > 0.45 && texColor.r > (texColor.g + texColor.b) * 1.2) {
                  diffuseColor.rgb = vec3(0.12, 0.12, 0.13);
                } else {
                  diffuseColor = texColor;
                }
              } else {
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

    // Apply 3D Decals
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

    // Orient car with nose pointing right (+X) and rear wing on left (-X)
    carSubGroup.rotation.z = Math.PI;
    group.add(carSubGroup);

    return group;
  }

  getCarSideviewDataUrl(teamIdx = 0, isPlayer = false, carNumber = 1) {
    const key = `${isPlayer ? 'p' : 'c'}_${teamIdx}_${carNumber}`;
    if (this.cache.has(key)) {
      return this.cache.get(key);
    }

    if (!this.isReady || !this.renderer || !this.scene || !this.camera) {
      return null;
    }

    try {
      const carMesh = this.buildCarMesh(teamIdx, isPlayer, carNumber);
      if (!carMesh) return null;

      this.scene.add(carMesh);
      this.renderer.render(this.scene, this.camera);
      const dataUrl = this.renderer.domElement.toDataURL('image/png');
      this.scene.remove(carMesh);

      // Clean up geometries and materials created for this snapshot
      carMesh.traverse((child) => {
        if (child.isMesh) {
          if (child.geometry && child.geometry !== this.f1DecalGeometries?.[child.name]) {
            child.geometry.dispose();
          }
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach((m) => m.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });

      this.cache.set(key, dataUrl);
      return dataUrl;
    } catch (err) {
      console.warn('Error rendering 3D car side view:', err);
      return null;
    }
  }
}

export const carSideviewRenderer = new CarSideviewRenderer();
