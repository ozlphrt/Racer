import fs from 'fs';
import zlib from 'zlib';

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

// Find bounding boxes of all non-black regions in the 1024x1024 image
const regions = [];
const colorHist = {};

for (let y = 0; y < 1024; y++) {
  const lineStart = y * (1 + 1024 * 3) + 1;
  for (let x = 0; x < 1024; x++) {
    const p = lineStart + x * 3;
    const r = uncompressed[p], g = uncompressed[p+1], b = uncompressed[p+2];
    if (r > 20 || g > 20 || b > 20) {
      const k = `${Math.floor(r/32)*32},${Math.floor(g/32)*32},${Math.floor(b/32)*32}`;
      colorHist[k] = (colorHist[k] || 0) + 1;
    }
  }
}
console.log('Color histogram of non-black pixels:', colorHist);
