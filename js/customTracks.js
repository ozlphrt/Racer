import { Track, TRACK_PRESETS } from './track.js';
import { distPointSegSq } from './math.js';

export const CUSTOM_TRACKS_KEY = 'ai-racer:custom-tracks:v1';
export const DRAWING_SIZE = { width: 1600, height: 1000 };
const validPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
  p.x >= 0 && p.x <= DRAWING_SIZE.width && p.y >= 0 && p.y <= DRAWING_SIZE.height;

/** Validate the actual smoothed road, rather than just its control polygon. */
export function inspectCustomTrack(points, width = 84) {
  if (!Array.isArray(points) || points.length < 4) return { valid: false, message: 'Draw a loop with at least four points.' };
  if (points.length > 80 || !points.every(validPoint)) return { valid: false, message: 'Use up to 80 points inside the drawing area.' };
  if (points.some((p, i) => Math.hypot(p.x - points[(i + 1) % points.length].x,
    p.y - points[(i + 1) % points.length].y) < 15)) return { valid: false, message: 'Move neighboring points farther apart.' };
  const track = new Track(points, width, 320);
  if (!Number.isFinite(track.length) || track.length < 1000 || track.length > 6500) {
    return { valid: false, track, message: 'Make a circuit between 1,000 and 6,500 units long.' };
  }
  if (track.curvature.some(k => Math.abs(k) > 1 / (width / 2 + 8))) {
    return { valid: false, track, message: 'Open up the tightest corner so the road has room to turn.' };
  }
  const b = track.bounds, margin = 60;
  if (b.minX < margin || b.maxX > DRAWING_SIZE.width - margin ||
      b.minY < margin || b.maxY > DRAWING_SIZE.height - margin) {
    return { valid: false, track, message: 'Keep the road inside the dashed boundary.' };
  }
  // Compare nonlocal portions of the sampled spline. This also rejects road
  // overlap near a crossing, even when the input control polygon looks clear.
  const minArc = width * 2.1;
  for (let i = 0; i < track.N; i++) {
    for (let j = i + 1; j < track.N; j++) {
      if (Math.min(j - i, track.N - (j - i)) * track.spacing < minArc) continue;
      const k = (j + 1) % track.N;
      if (distPointSegSq(track.cx[i], track.cy[i], track.cx[j], track.cy[j], track.cx[k], track.cy[k]) < (width + 12) ** 2) {
        return { valid: false, track, message: 'Separate crossing or overlapping roads. Leave room between corners.' };
      }
    }
  }
  return { valid: true, track, message: 'Ready to race · closed circuit' };
}

/** Reduce a hand-drawn stroke without replacing it with a preset shape. */
export function simplifyStroke(input) {
  const points = input.filter(validPoint);
  if (points.length < 3) return points.map(p => ({ ...p }));
  function simplify(list, tolerance) {
    let best = tolerance ** 2, at = -1;
    const first = list[0], last = list.at(-1);
    for (let i = 1; i < list.length - 1; i++) {
      const distance = distPointSegSq(list[i].x, list[i].y, first.x, first.y, last.x, last.y);
      if (distance > best) { best = distance; at = i; }
    }
    if (at === -1) return [first, last];
    return [...simplify(list.slice(0, at + 1), tolerance).slice(0, -1), ...simplify(list.slice(at), tolerance)];
  }
  let result = simplify(points, 12);
  result = result.filter((p, i) => i === 0 || Math.hypot(p.x - result[i - 1].x, p.y - result[i - 1].y) >= 25);
  if (result.length > 2 && Math.hypot(result[0].x - result.at(-1).x, result[0].y - result.at(-1).y) < 45) result.pop();
  return result.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) }));
}

export function readCustomTracks(storage = localStorage, width = 84) {
  try {
    const data = JSON.parse(storage.getItem(CUSTOM_TRACKS_KEY) || '[]');
    if (!Array.isArray(data)) return [];
    const seen = new Set();
    return data.filter(t => {
      if (!t || typeof t.id !== 'string' || !/^custom-[a-z0-9-]{1,64}$/.test(t.id) || seen.has(t.id) ||
          typeof t.name !== 'string' || !t.name.trim() || t.name.length > 40 || !inspectCustomTrack(t.points, width).valid) return false;
      seen.add(t.id); return true;
    }).slice(0, 12);
  } catch { return []; }
}

export function saveCustomTrack(track, storage = localStorage, width = 84) {
  if (typeof track.id !== 'string' || !/^custom-[a-z0-9-]{1,64}$/.test(track.id) ||
      typeof track.name !== 'string' || !track.name.trim() || track.name.length > 40) throw new Error('Give your track a name of up to 40 characters.');
  const inspection = inspectCustomTrack(track.points, width);
  if (!inspection.valid) throw new Error(inspection.message);
  const tracks = readCustomTracks(storage, width), at = tracks.findIndex(t => t.id === track.id);
  if (at === -1 && tracks.length >= 12) throw new Error('Your library is full. Remove a saved track before adding another.');
  const saved = { id: track.id, name: track.name.trim(), points: track.points.map(p => ({ x: p.x, y: p.y })) };
  if (at === -1) tracks.push(saved); else tracks[at] = saved;
  storage.setItem(CUSTOM_TRACKS_KEY, JSON.stringify(tracks));
  return saved;
}

export function registerCustomTracks(storage = localStorage, width = 84) {
  const tracks = readCustomTracks(storage, width);
  for (const track of tracks) TRACK_PRESETS[track.id] = { name: track.name, points: track.points, custom: true };
  return tracks;
}

export function savedCircuitMatches(state, presets = TRACK_PRESETS) {
  if (!state?.trackPreset) return true;
  const preset = presets[state.trackPreset];
  if (!preset) return false;
  return !preset.custom || JSON.stringify(state.trackPoints) === JSON.stringify(preset.points);
}
