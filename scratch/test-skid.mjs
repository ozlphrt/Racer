import * as THREE from 'three';

console.log('Testing 3D skidmark buffer geometry...');

const maxQuads = 80000;
const maxVerts = maxQuads * 4;
const maxIndices = maxQuads * 6;

const posArr = new Float32Array(maxVerts * 3);
const alphaArr = new Float32Array(maxVerts);
const indices = new Uint32Array(maxIndices);

for (let i = 0; i < maxQuads; i++) {
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
geo.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
geo.setAttribute('alpha', new THREE.BufferAttribute(alphaArr, 1));
geo.setIndex(new THREE.BufferAttribute(indices, 1));

console.log('Geometry created successfully with', maxQuads, 'quad capacity.');
