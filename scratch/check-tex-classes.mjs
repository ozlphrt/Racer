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
const img = zlib.inflateSync(Buffer.concat(idats));

let redCount = 0;
let blackCount = 0;
let whiteCount = 0;
let otherCount = 0;

for (let y = 0; y < 1024; y++) {
  const rowStart = y * (1 + 1024 * 3) + 1;
  for (let x = 0; x < 1024; x++) {
    const p = rowStart + x * 3;
    const r = img[p], g = img[p+1], b = img[p+2];
    
    // Red body paint (r is dominant, g and b are low)
    if (r > 100 && r > g + 40 && r > b + 40) {
      redCount++;
    } else if (r < 50 && g < 50 && b < 50) {
      blackCount++;
    } else if (r > 180 && g > 180 && b > 180) {
      whiteCount++;
    } else {
      otherCount++;
    }
  }
}

console.log({ redCount, blackCount, whiteCount, otherCount });
