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

// Let's inspect where in the image are the RED pixels, BLACK pixels, WHITE pixels, etc.
// In 1024x1024 PNG:
let redBoxes = [];
let greenBoxes = [];
let blueBoxes = [];
let yellowBoxes = [];
let magentaBoxes = [];
let cyanBoxes = [];

for (let y = 0; y < 1024; y++) {
  const rowStart = y * (1 + 1024 * 3) + 1;
  for (let x = 0; x < 1024; x++) {
    const p = rowStart + x * 3;
    const r = img[p], g = img[p+1], b = img[p+2];
    if (r > 150 && g < 50 && b < 50) redBoxes.push([x, y]);
  }
}
console.log('Total RED pixels in texture:', redBoxes.length);
if (redBoxes.length > 0) {
  const xs = redBoxes.map(p => p[0]);
  const ys = redBoxes.map(p => p[1]);
  console.log(`RED pixel bounds: X in [${Math.min(...xs)}, ${Math.max(...xs)}], Y in [${Math.min(...ys)}, ${Math.max(...ys)}]`);
}
