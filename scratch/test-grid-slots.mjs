import { Track, TRACK_PRESETS } from '../js/track.js';
import { CONFIG } from '../js/config.js';

const t = new Track(TRACK_PRESETS['grand-prix'].points, CONFIG.track.width, CONFIG.track.samples);

console.log('Testing 2-by-2 F1 starting grid slots for 80 cars...');

for (let i = 0; i < 10; i++) {
  const row = Math.floor(i / 2);
  const side = (i % 2 === 0) ? 1 : -1;
  const distBack = 16 + row * 22;
  const latOffset = side * 14;

  const sampleIdx = t.wrap(Math.round(t.N - (distBack / t.spacing)));
  const tx = t.tx[sampleIdx];
  const ty = t.ty[sampleIdx];
  const nx = -ty;
  const ny = tx;

  const x = t.cx[sampleIdx] + nx * latOffset;
  const y = t.cy[sampleIdx] + ny * latOffset;
  const heading = Math.atan2(ty, tx);

  const distToCenter = Math.hypot(x - t.cx[sampleIdx], y - t.cy[sampleIdx]);
  console.log(`Slot ${i}: row=${row}, side=${side > 0 ? 'L' : 'R'}, sample=${sampleIdx}, distBack=${distBack}m, distToCenter=${distToCenter.toFixed(1)}, heading=${(heading*180/Math.PI).toFixed(1)}°`);
}
