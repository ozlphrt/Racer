import { CONFIG } from './config.js';
import { Track, TRACK_PRESETS } from './track.js';

const previewCache = new Map();

export function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function getTrackPreviewMeta(presetKey, points, width = CONFIG.track.width) {
  const safePoints = (Array.isArray(points) && points.length >= 3)
    ? points
    : TRACK_PRESETS['grand-prix'].points;
  const sig = `${presetKey}:${width}:${JSON.stringify(safePoints)}`;
  let cached = previewCache.get(sig);
  if (cached) return cached;

  const t = new Track(safePoints, width, 120);
  const b = t.bounds;
  const w = 240, h = 130, pad = 16;
  const s = Math.min((w - pad * 2) / (b.w || 1), (h - pad * 2) / (b.h || 1));
  const ox = (w - b.w * s) / 2 - b.minX * s;
  const oy = (h - b.h * s) / 2 - b.minY * s;

  let d = '';
  for (let i = 0; i < t.N; i++) {
    const px = (t.cx[i] * s + ox).toFixed(1);
    const py = (t.cy[i] * s + oy).toFixed(1);
    d += (i === 0 ? 'M ' : ' L ') + px + ' ' + py;
  }
  d += ' Z';

  const sx = t.cx[0] * s + ox;
  const sy = t.cy[0] * s + oy;
  const nx = -t.ty[0];
  const ny = t.tx[0];
  const x1 = (sx - nx * 8).toFixed(1);
  const y1 = (sy - ny * 8).toFixed(1);
  const x2 = (sx + nx * 8).toFixed(1);
  const y2 = (sy + ny * 8).toFixed(1);
  const lengthText = t.length >= 1000
    ? `${(t.length / 1000).toFixed(2)} km`
    : `${Math.round(t.length)} m`;

  cached = { w, h, d, sx, sy, x1, y1, x2, y2, length: t.length, lengthText };
  previewCache.set(sig, cached);
  return cached;
}

export function generateTrackSvgSilhouette(presetKey, points, isActive = false, width = CONFIG.track.width) {
  const { w, h, d, sx, sy, x1, y1, x2, y2 } = getTrackPreviewMeta(presetKey, points, width);
  const primaryGlow = isActive ? 'rgba(34, 197, 94, 0.35)' : 'rgba(56, 189, 248, 0.25)';
  const primaryLine = isActive ? '#22c55e' : '#38bdf8';
  const markerColor = isActive ? '#22c55e' : '#f59e0b';

  return `
    <svg class="track-silhouette-svg" viewBox="0 0 ${w} ${h}" aria-hidden="true">
      <g stroke="rgba(255, 255, 255, 0.04)" stroke-width="1">
        <line x1="0" y1="32" x2="${w}" y2="32"/>
        <line x1="0" y1="65" x2="${w}" y2="65"/>
        <line x1="0" y1="98" x2="${w}" y2="98"/>
        <line x1="60" y1="0" x2="60" y2="${h}"/>
        <line x1="120" y1="0" x2="120" y2="${h}"/>
        <line x1="180" y1="0" x2="180" y2="${h}"/>
      </g>
      <path d="${d}" fill="none" stroke="${primaryGlow}" stroke-width="14" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="#0b1329" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="#1e293b" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="${d}" fill="none" stroke="${primaryLine}" stroke-width="1.8" stroke-dasharray="${isActive ? 'none' : '4 3'}" stroke-linecap="round" stroke-linejoin="round"/>
      <line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${markerColor}" stroke-width="3" stroke-linecap="round"/>
      <circle cx="${sx.toFixed(1)}" cy="${sy.toFixed(1)}" r="2.8" fill="${markerColor}" stroke="#0b1329" stroke-width="1"/>
    </svg>
  `;
}

