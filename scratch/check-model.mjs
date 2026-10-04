import fs from 'fs';
import path from 'path';

// Let's decode PNG basic palette or read raw chunks
const buf = fs.readFileSync('full_f1_2022/textures/Material.006_baseColor.png');
console.log('PNG size:', buf.length);

// Also let's check scene.gltf material references
const gltf = JSON.parse(fs.readFileSync('full_f1_2022/scene.gltf', 'utf8'));
console.log('Materials in GLTF:', JSON.stringify(gltf.materials, null, 2));
console.log('Meshes in GLTF:', gltf.meshes.length);
