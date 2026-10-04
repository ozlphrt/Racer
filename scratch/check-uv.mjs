import fs from 'fs';
import zlib from 'zlib';

const gltf = JSON.parse(fs.readFileSync('full_f1_2022/scene.gltf', 'utf8'));
const bin = fs.readFileSync('full_f1_2022/scene.bin');
const acc = gltf.accessors[6];
const bv = gltf.bufferViews[acc.bufferView];
const offset = (bv.byteOffset || 0) + (acc.byteOffset || 0);

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

const colorCounts = {};
for (let i = 0; i < acc.count; i++) {
  let u = bin.readFloatLE(offset + i * 8);
  let v = bin.readFloatLE(offset + i * 8 + 4);
  u = (u % 1 + 1) % 1;
  v = (v % 1 + 1) % 1;
  const px = Math.min(1023, Math.max(0, Math.floor(u * 1024)));
  const py = Math.min(1023, Math.max(0, Math.floor(v * 1024)));
  const p = py * (1 + 1024 * 3) + 1 + px * 3;
  const r = uncompressed[p], g = uncompressed[p+1], b = uncompressed[p+2];
  const key = `${r},${g},${b}`;
  colorCounts[key] = (colorCounts[key] || 0) + 1;
}
console.log('Sampled vertex texture colors on Body:', Object.entries(colorCounts).sort((a,b)=>b[1]-a[1]).slice(0, 15));
