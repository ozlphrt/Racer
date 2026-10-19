import { APPROACH_PATTERNS, summarizeApproaches } from './crashApproach.js';

const labels = { 'off-track': 'Off-track limit', runoff: 'Runoff >1.8s', 'tire-barrier': 'Tire barrier', unknown: 'Unknown' };
const toKmh = speed => speed * (5.63 / 26) * 3.6; // Same chassis calibration as the live speedometer.

/** Only actual recorded crash snapshots count; legacy races remain unavailable. */
export function summarizeCrashes(history) {
  const window = history.slice(-25);
  const records = window.filter(r => Array.isArray(r.crashDiagnostics));
  const crashes = records.flatMap(r => r.crashDiagnostics).filter(c =>
    c && Number.isFinite(c.x) && Number.isFinite(c.y) && Number.isFinite(c.speed) && c.speed >= 0 &&
    Number.isFinite(c.progress) && c.progress >= 0 && c.progress < 1);
  const sectors = Array.from({ length: 12 }, (_, index) => ({ index, count: 0, x: 0, y: 0, speed: 0 }));
  const causes = Object.fromEntries(Object.keys(labels).map(key => [key, 0]));
  for (const crash of crashes) {
    const sector = sectors[Math.floor(crash.progress * 12)];
    sector.count++; sector.x += crash.x; sector.y += crash.y; sector.speed += toKmh(crash.speed);
    causes[Object.hasOwn(labels, crash.cause) ? crash.cause : 'unknown']++;
  }
  for (const sector of sectors) if (sector.count) {
    sector.x /= sector.count; sector.y /= sector.count; sector.speed /= sector.count;
  }
  return { crashes, sectors, causes, recorded: records.length, window: window.length,
    recentContact: crashes.filter(c => c.recentContact === true).length,
    averageSpeed: crashes.length ? crashes.reduce((sum, c) => sum + toKmh(c.speed), 0) / crashes.length : null };
}

export function crashDiagnosticMarkup(history, track) {
  const summary = summarizeCrashes(history);
  const { crashes, sectors, causes, recorded, window, recentContact, averageSpeed } = summary;
  if (!recorded) return '<div class="crash-diagnostics outcome-note">Crash map · Available after the next completed race; older crashes have no recorded locations.</div>';
  const hot = [...sectors].sort((a, b) => b.count - a.count)[0];
  let map = '';
  if (track?.cx?.length && track?.cy?.length) {
    const minX = Math.min(...track.cx), maxX = Math.max(...track.cx);
    const minY = Math.min(...track.cy), maxY = Math.max(...track.cy);
    const scale = Math.min(184 / Math.max(1, maxX - minX), 64 / Math.max(1, maxY - minY));
    const point = (x, y) => `${(100 + (x - (minX + maxX) / 2) * scale).toFixed(1)},${(40 + (y - (minY + maxY) / 2) * scale).toFixed(1)}`;
    const points = [];
    for (let i = 0; i < track.cx.length; i += 4) points.push(point(track.cx[i], track.cy[i]));
    const dots = sectors.filter(s => s.count).map(s => {
      const [x, y] = point(s.x, s.y).split(',');
      return `<circle cx="${x}" cy="${y}" r="${(2.5 + 4 * s.count / Math.max(1, hot.count)).toFixed(1)}" fill="#fb7185" fill-opacity="0.8"><title>S${s.index + 1}: ${s.count} crashes · ${Math.round(s.speed)} km/h mean · ${Math.round(s.index / 12 * 100)}–${Math.round((s.index + 1) / 12 * 100)}% around lap</title></circle>`;
    }).join('');
    const [sx, sy] = point(track.cx[0], track.cy[0]).split(',');
    map = `<svg viewBox="0 0 200 80" role="img" aria-label="Crash locations over the last ${window} races. Larger dots indicate more crashes."><polygon points="${points.join(' ')}" fill="none" stroke="#536478" stroke-width="2"/><circle cx="${sx}" cy="${sy}" r="2.5" fill="#34d399"><title>Start / finish</title></circle>${dots}</svg>`;
  }
  const causeText = Object.entries(causes).filter(([, count]) => count).map(([cause, count]) => `${labels[cause]} <b>${count}</b>`).join(' · ');
  return `<div class="crash-diagnostics">${map}<div class="crash-detail"><strong>Crash map · ${recorded}/${window} races recorded</strong>` +
    `<span>${crashes.length ? `${causeText} · Mean <b>${Math.round(averageSpeed)} km/h</b>` : 'No crashes in recorded races.'}</span>` +
    `<span class="outcome-note">${crashes.length ? `Hotspot S${hot.index + 1}: ${hot.count}/${crashes.length} crashes · ${recentContact} within 1s of car contact (not proof of cause). ` : ''}12 equal-distance sections from start; hover dots.</span></div></div>` + approachDiagnosticMarkup(crashes);
}

export function approachDiagnosticMarkup(crashes) {
  const summary = summarizeApproaches(crashes);
  const { count, recorded, counts, dominant, latest } = summary;
  const findings = recorded >= 5 && dominant
    ? `Most observed: ${APPROACH_PATTERNS[dominant]} (${counts[dominant]}/${recorded}).`
    : recorded < 5 ? `Collecting S1 approaches: ${recorded}/5 usable traces.` : 'No flagged pattern dominates.';
  const flags = Object.entries(counts).filter(([, n]) => n).map(([key, n]) => `${APPROACH_PATTERNS[key]} ${n}`).join(' · ');
  let detail = '';
  if (latest) {
    const samples = latest.approach.filter(row => Array.isArray(row) && row.length === 8 && row.every(Number.isFinite));
    if (samples.length >= 2) {
      const metrics = [
        ['Speed', 1, toKmh, 0, 400, 'km/h', '#38bdf8'],
        ['Braking', 2, v => Math.max(0, -v) * 100, 0, 100, '%', '#fbbf24'],
        ['Steering', 3, v => v * 100, -100, 100, '%', '#c4b5fd'],
        ['Heading error', 4, v => v * 180 / Math.PI, -180, 180, '°', '#fb7185'],
        ['Sideways slip', 5, v => v * 180 / Math.PI, -180, 180, '°', '#34d399'],
      ];
      const rows = metrics.map(([label, index, convert, min, max, unit, color]) => {
        const values = samples.map(row => convert(row[index]));
        const points = samples.map((row, i) => `${(6 + Math.max(0, Math.min(2, row[0] + 2)) / 2 * 188).toFixed(1)},${(30 - Math.max(0, Math.min(1, (values[i] - min) / (max - min))) * 26).toFixed(1)}`).join(' ');
        return `<div class="approach-metric"><span>${label}<small>${Math.round(values.at(-1))}${unit} at crash · peak ${Math.round(Math.max(...values.map(Math.abs)))}${unit}</small></span>` +
          `<svg viewBox="0 0 200 36" role="img" aria-label="${label}, two seconds before crash"><path d="M6 4V30H194" fill="none" stroke="#334155"/><polyline points="${points}" fill="none" stroke="${color}" stroke-width="1.7"/></svg></div>`;
      }).join('');
      const duration = Math.max(0, samples.at(-1)[0] - samples[0][0]).toFixed(1);
      detail = `<details class="approach-inspector"><summary>Inspect latest S1 approach · ${duration}s</summary>` +
        `<div class="approach-popover"><strong>Latest S1 crash · Lap ${Number.isFinite(latest.lap) ? latest.lap : '—'}</strong>` +
        `<span class="outcome-note">${duration}s recorded at 10 Hz · Negative steering/angles indicate direction. Close this view to resume live outcome updates.</span>${rows}` +
        `<span class="approach-axis">−2s before crash <span>Crash 0s</span></span>` +
        `<span class="outcome-note">Flags: slide ≥15° for ≥0.3s; ≥3 steering reversals; recovery active; no brake in final 1s; launch within 5s of green. Flags overlap and do not prove cause.</span></div></details>`;
    }
  }
  return `<div class="approach-diagnostics"><strong>S1 approach · ${recorded}/${count} crashes with usable traces</strong>` +
    `<span>${findings}</span>${flags ? `<span class="outcome-note">${flags} · Overlapping observations.</span>` : ''}${detail}</div>`;
}
