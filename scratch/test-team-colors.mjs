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

const teams = [
  { name: 'Red', r: 239, g: 68, b: 68 },
  { name: 'Green', r: 34, g: 197, b: 94 },
  { name: 'Blue', r: 37, g: 99, b: 235 },
  { name: 'Yellow', r: 250, g: 204, b: 21 },
  { name: 'Cyan', r: 6, g: 182, b: 212 },
  { name: 'Magenta', r: 217, g: 70, b: 239 },
  { name: 'Orange', r: 249, g: 115, b: 22 },
  { name: 'Purple', r: 139, g: 92, b: 246 }
];

console.log('Testing team color generation for', teams.length, 'teams...');
for (const tm of teams) {
  let coloredPixels = 0;
  for (let y = 0; y < 1024; y++) {
    const lineStart = y * (1 + 1024 * 3) + 1;
    for (let x = 0; x < 1024; x++) {
      const p = lineStart + x * 3;
      const r = raw[p], g = raw[p+1], b = raw[p+2];
      if (r > 120 && r - Math.max(g, b) > 40) {
        coloredPixels++;
      }
    }
  }
  console.log(`Team ${tm.name}: ${coloredPixels} pixels transformed`);
}
