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
  { name: 'Red', r: 255, g: 10, b: 20 },
  { name: 'Green', r: 0, g: 255, b: 30 },
  { name: 'Blue', r: 0, g: 70, b: 255 },
  { name: 'Yellow', r: 255, g: 240, b: 0 },
  { name: 'Cyan', r: 0, g: 245, b: 255 },
  { name: 'Magenta', r: 255, g: 0, b: 230 },
  { name: 'Orange', r: 255, g: 90, b: 0 },
  { name: 'Purple', r: 160, g: 0, b: 255 },
];

for (const tm of teams) {
  let modifiedCount = 0;
  let untouchedBlack = 0;
  let untouchedWhite = 0;

  for (let y = 0; y < 1024; y++) {
    const rowStart = y * (1 + 1024 * 3) + 1;
    for (let x = 0; x < 1024; x++) {
      const p = rowStart + x * 3;
      const r = raw[p], g = raw[p+1], b = raw[p+2];
      if (r > 100 && r > g + 40 && r > b + 40) {
        modifiedCount++;
      } else if (r < 50 && g < 50 && b < 50) {
        untouchedBlack++;
      } else if (r > 180 && g > 180 && b > 180) {
        untouchedWhite++;
      }
    }
  }
  console.log(`Team ${tm.name}: modified ${modifiedCount} red pixels, preserved ${untouchedBlack} black pixels, ${untouchedWhite} white rim pixels`);
}
