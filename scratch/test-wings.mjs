import fs from 'fs';

const gltf = JSON.parse(fs.readFileSync('full_f1_2022/scene.gltf', 'utf8'));
const bin = fs.readFileSync('full_f1_2022/scene.bin');

function inspectMesh(meshIdx, name) {
  const mesh = gltf.meshes[meshIdx];
  const posAcc = gltf.accessors[mesh.primitives[0].attributes.POSITION];
  const posBv = gltf.bufferViews[posAcc.bufferView];
  const posOff = (posBv.byteOffset || 0) + (posAcc.byteOffset || 0);

  const texAcc = gltf.accessors[mesh.primitives[0].attributes.TEXCOORD_0];
  const texBv = gltf.bufferViews[texAcc.bufferView];
  const texOff = (texBv.byteOffset || 0) + (texAcc.byteOffset || 0);

  let wheelCount = 0;
  let wingCount = 0;
  let strutCount = 0;
  let whiteRimCount = 0;

  for (let i = 0; i < posAcc.count; i++) {
    const x = bin.readFloatLE(posOff + i * 12);
    const y = bin.readFloatLE(posOff + i * 12 + 4);
    const z = bin.readFloatLE(posOff + i * 12 + 8);
    let u = bin.readFloatLE(texOff + i * 8);
    let v = bin.readFloatLE(texOff + i * 8 + 4);

    const isWheel = Math.abs(z) > 0.58;
    const isSuspension = Math.abs(z) > 0.18 && Math.abs(z) <= 0.58 && y > 0.15 && y < 0.45;
    const isWing = !isWheel && !isSuspension;

    if (isWheel) wheelCount++;
    else if (isSuspension) strutCount++;
    else wingCount++;
  }

  console.log(`${name}:`, { wheelCount, strutCount, wingCount });
}

inspectMesh(2, 'Mesh 2 (Front Wing & Wheels)');
inspectMesh(3, 'Mesh 3 (Rear Wing & Wheels)');
