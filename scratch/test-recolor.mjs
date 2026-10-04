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
const raw = zlib.inflateSync(Buffer.concat(idats));

// Test recoloring red pixels to Cyan (0, 220, 240), Yellow (250, 210, 20), Blue (30, 100, 240), etc.
let redCount = 0;
let blackCount = 0;
let whiteCount = 0;

for (let y = 0; y < 1024; y++) {
  const lineStart = y * (1 + 1024 * 3) + 1;
  for (let x = 0; x < 1024; x++) {
    const p = lineStart + x * 3;
    const r = raw[p], g = raw[p+1], b = raw[p+2];
    if (r > 120 && r - Math.max(g, b) > 40) {
      redCount++;
    } else if (r < 50 && g < 50 && b < 50) {
      blackCount++;
    } else if (r > 180 && g > 180 && b > 180) {
      whiteCount++;
    }
  }
}
console.log({ redCount, blackCount, whiteCount });
