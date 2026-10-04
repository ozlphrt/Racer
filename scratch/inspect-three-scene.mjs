import fs from 'fs';
import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

// Read gltf as data URL or load via fs
const gltfContent = fs.readFileSync('full_f1_2022/scene.gltf', 'utf8');
const binBuf = fs.readFileSync('full_f1_2022/scene.bin');

// Inspect mesh hierarchy in GLTF
const gltf = JSON.parse(gltfContent);
console.log('Nodes in GLTF:');
gltf.nodes.forEach((n, idx) => {
  console.log(`Node ${idx}: name="${n.name}", mesh=${n.mesh}, translation=${JSON.stringify(n.translation)}, rotation=${JSON.stringify(n.rotation)}, scale=${JSON.stringify(n.scale)}, children=${JSON.stringify(n.children)}`);
});
