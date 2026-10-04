import fs from 'fs';
import zlib from 'zlib';

const gltf = JSON.parse(fs.readFileSync('full_f1_2022/scene.gltf', 'utf8'));
const bin = fs.readFileSync('full_f1_2022/scene.bin');

const buf = fs.readFileSync('full_f1_2022/textures/Material.006_baseColor.png');
let pos = 8;
const idats = [];
while (pos < buf.length) {
  const len = buf.readUInt32BE(pos);
  const type = buf.slice(pos + 4, pos + 8).toString('ascii');
  if (type === 'IDAT') idats.push(buf.slice(pos + 8, pos + 8 + len));
  pos += 8 + len + 4;
}
const uncompressed = zlib.inflateSync(Buffer.concat(idats));

// For each mesh, let's find the position bounds of vertices mapped to each texture color
for (let meshIdx = 1; meshIdx <= 3; meshIdx++) {
  const mesh = gltf.meshes[meshIdx];
  const posIdx = mesh.primitives[0].attributes.POSITION;
  const texIdx = mesh.primitives[0].attributes.TEXCOORD_0;

  const posAcc = gltf.accessors[posIdx];
  const posBv = gltf.bufferViews[posAcc.bufferView];
  const posOff = (posBv.byteOffset || 0) + (posAcc.byteOffset || 0);

  const texAcc = gltf.accessors[texIdx];
  const texBv = gltf.bufferViews[texAcc.bufferView];
  const texOff = (texBv.byteOffset || 0) + (texAcc.byteOffset || 0);

  const colorParts = {};
  for (let i = 0; i < posAcc.count; i++) {
    const x = bin.readFloatLE(posOff + i * 12);
    const y = bin.readFloatLE(posOff + i * 12 + 4);
    const z = bin.readFloatLE(posOff + i * 12 + 8);

    let u = bin.readFloatLE(texOff + i * 8);
    let v = bin.readFloatLE(texOff + i * 8 + 4);
    const px = Math.min(1023, Math.max(0, Math.floor(((u % 1 + 1) % 1) * 1024)));
    const py = Math.min(1023, Math.max(0, Math.floor(((1 - (v % 1 + 1) % 1)) * 1024)));
    const p = py * (1 + 1024 * 3) + 1 + px * 3;
    const r = uncompressed[p], g = uncompressed[p+1], b = uncompressed[p+2];

    const tag = (r > 150 && g > 150 && b > 150) ? 'WHITE/RIMS'
      : (r > 150 && g < 50 && b < 50) ? 'RED'
      : (g > 150 && r < 50 && b < 50) ? 'GREEN'
      : (b > 150 && r < 50 && g < 50) ? 'BLUE'
      : (r > 150 && g > 150 && b < 50) ? 'YELLOW'
      : (r < 50 && g > 150 && b > 150) ? 'CYAN'
      : (r > 150 && g < 50 && b > 150) ? 'MAGENTA'
      : 'BLACK/DARK';

    if (!colorParts[tag]) colorParts[tag] = { count: 0, minX: 999, maxX: -999, minY: 999, maxY: -999, minZ: 999, maxZ: -999, sampleUV: [u, v], samplePx: [px, py] };
    const cp = colorParts[tag];
    cp.count++;
    cp.minX = Math.min(cp.minX, x); cp.maxX = Math.max(cp.maxX, x);
    cp.minY = Math.min(cp.minY, y); cp.maxY = Math.max(cp.maxY, y);
    cp.minZ = Math.min(cp.minZ, z); cp.maxZ = Math.max(cp.maxZ, z);
  }
  console.log(`Mesh ${meshIdx} (${mesh.name}) Parts:`, colorParts);
}
