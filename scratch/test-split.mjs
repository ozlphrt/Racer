import fs from 'fs';

const gltf = JSON.parse(fs.readFileSync('full_f1_2022/scene.gltf', 'utf8'));
const bin = fs.readFileSync('full_f1_2022/scene.bin');

// In GLTF, the F1 car coordinates:
// X is along car length (Front: +X ~ 2.2, Rear: -X ~ -2.1)
// Y is vertical height (Floor: 0.08, Top of snorkel: 0.90)
// Z is lateral width (Left: -0.75, Right: +0.75)

// Check Mesh 1 (Object_1 - Main Body, Floor, Cockpit, Engine cover)
const mesh1 = gltf.meshes[1];
const pos1Idx = mesh1.primitives[0].attributes.POSITION;
const pos1Acc = gltf.accessors[pos1Idx];
const pos1Bv = gltf.bufferViews[pos1Acc.bufferView];
const pos1Off = (pos1Bv.byteOffset || 0) + (pos1Acc.byteOffset || 0);

let bodyCount = 0;
let floorCount = 0;
let helmetCount = 0;
let cockpitCount = 0;

for (let i = 0; i < pos1Acc.count; i++) {
  const x = bin.readFloatLE(pos1Off + i * 12);
  const y = bin.readFloatLE(pos1Off + i * 12 + 4);
  const z = bin.readFloatLE(pos1Off + i * 12 + 8);

  // Floor / Underbody: y < 0.16
  const isFloor = y < 0.16;
  // Cockpit interior & driver helmet:
  const isCockpit = (x > -0.2 && x < 0.45 && Math.abs(z) < 0.22 && y > 0.32 && y < 0.72);
  // Snorkel intake / camera:
  const isSnorkel = (x > -0.25 && x < -0.05 && Math.abs(z) < 0.08 && y > 0.82);

  if (isFloor) floorCount++;
  else if (isCockpit) helmetCount++;
  else bodyCount++;
}

console.log('Mesh 1 breakdown:', { bodyCount, floorCount, helmetCount });
