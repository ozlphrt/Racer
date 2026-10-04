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
const img = zlib.inflateSync(Buffer.concat(idats));

function getPixel(u, v) {
  let x = Math.floor(u * 1024);
  let y = Math.floor(v * 1024);
  x = Math.max(0, Math.min(1023, x));
  y = Math.max(0, Math.min(1023, y));
  const lineStart = y * (1 + 1024 * 3) + 1;
  const p = lineStart + x * 3;
  return [img[p], img[p+1], img[p+2]];
}

gltf.meshes.forEach((mesh, idx) => {
  console.log('Mesh:', mesh.name);
  const posAcc = gltf.accessors[mesh.primitives[0].attributes.POSITION];
  const uvAcc = gltf.accessors[mesh.primitives[0].attributes.TEXCOORD_0];
  
  const posBv = gltf.bufferViews[posAcc.bufferView];
  const uvBv = gltf.bufferViews[uvAcc.bufferView];
  
  const uvOffset = uvBv.byteOffset || 0;
  
  const sampleColors = {};
  for (let i = 0; i < uvAcc.count; i++) {
    const u = bin.readFloatLE(uvOffset + i * 8);
    const v = bin.readFloatLE(uvOffset + i * 8 + 4);
    const [r, g, b] = getPixel(u, v);
    const k = Math.floor(r/32)*32 + ',' + Math.floor(g/32)*32 + ',' + Math.floor(b/32)*32;
    sampleColors[k] = (sampleColors[k] || 0) + 1;
  }
  console.log('Colors mapped to vertices:', sampleColors);
});
