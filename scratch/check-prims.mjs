import fs from 'fs';

const gltf = JSON.parse(fs.readFileSync('full_f1_2022/scene.gltf', 'utf8'));
console.log('Materials:');
gltf.materials.forEach((m, idx) => {
  console.log(`Material ${idx}: name="${m.name}", pbr=${JSON.stringify(m.pbrMetallicRoughness)}`);
});

console.log('Meshes:');
gltf.meshes.forEach((m, idx) => {
  console.log(`Mesh ${idx}: name="${m.name}"`);
  m.primitives.forEach((p, pIdx) => {
    console.log(`  Primitive ${pIdx}: material=${p.material}, attributes=${JSON.stringify(p.attributes)}`);
  });
});
