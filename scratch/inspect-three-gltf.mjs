import fs from 'fs';

const gltf = JSON.parse(fs.readFileSync('full_f1_2022/scene.gltf', 'utf8'));
console.log('Nodes in GLTF:');
gltf.nodes.forEach((n, idx) => {
  console.log(`Node ${idx}: name="${n.name}", meshIndex=${n.mesh}`);
});
