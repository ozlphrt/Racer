import fs from 'fs';

const gltf = JSON.parse(fs.readFileSync('full_f1_2022/scene.gltf', 'utf8'));
const bin = fs.readFileSync('full_f1_2022/scene.bin');

for (let meshIdx = 1; meshIdx <= 3; meshIdx++) {
  const mesh = gltf.meshes[meshIdx];
  const posAcc = gltf.accessors[mesh.primitives[0].attributes.POSITION];
  const posBv = gltf.bufferViews[posAcc.bufferView];
  const posOff = (posBv.byteOffset || 0) + (posAcc.byteOffset || 0);

  const count = posAcc.count;
  const teamRGB = [1.0, 0.06, 0.12]; // Vivid Red

  let bodyCount = 0;
  let otherCount = 0;

  for (let i = 0; i < count; i++) {
    const x = bin.readFloatLE(posOff + i * 12);
    const y = bin.readFloatLE(posOff + i * 12 + 4);
    const z = bin.readFloatLE(posOff + i * 12 + 8);

    let isOther = false;
    if (meshIdx === 1) {
      const isFloor = y < 0.16;
      const isCockpit = (x > -0.2 && x < 0.45 && Math.abs(z) < 0.22 && y > 0.32 && y < 0.72);
      const isSnorkel = (x > -0.25 && x < -0.05 && Math.abs(z) < 0.08 && y > 0.82);
      isOther = isFloor || isCockpit || isSnorkel;
    } else {
      const isWheel = Math.abs(z) > 0.58;
      const isSuspension = Math.abs(z) > 0.18 && Math.abs(z) <= 0.58 && y > 0.15 && y < 0.45;
      isOther = isWheel || isSuspension;
    }

    if (isOther) otherCount++;
    else bodyCount++;
  }

  console.log(`Mesh ${meshIdx} (${mesh.name}): total=${count}, body=${bodyCount}, other=${otherCount}`);
}
