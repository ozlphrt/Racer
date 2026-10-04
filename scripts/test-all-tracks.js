import { CONFIG } from '../js/config.js';
import { Track, TRACK_PRESETS } from '../js/track.js';

for (const [key, preset] of Object.entries(TRACK_PRESETS)) {
  const track = new Track(preset.points, CONFIG.track.width, CONFIG.track.samples);
  let maxK = 0;
  for (const k of track.curvature) maxK = Math.max(maxK, Math.abs(k));
  const minR = 1 / maxK;
  console.log(`[${key}] "${preset.name}": length=${track.length.toFixed(0)}, minRadius=${minR.toFixed(1)} (halfWidth=${track.half})`);
  if (minR <= track.half) {
    console.warn(`  WARNING: inner wall touches/crosses at tightest point!`);
  } else {
    console.log(`  PASSED: curvature clean`);
  }
}
