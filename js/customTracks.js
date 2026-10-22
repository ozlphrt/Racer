import { Track, TRACK_PRESETS } from './track.js';
import { catmullRom, distPointSegSq } from './math.js';

export const CUSTOM_TRACKS_KEY = 'ai-racer:custom-tracks:v1';
export const DRAWING_SIZE = { width: 1600, height: 1000 };
const validPoint = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) &&
  p.x >= 0 && p.x <= DRAWING_SIZE.width && p.y >= 0 && p.y <= DRAWING_SIZE.height;

/** Insert into the nearest spline span, keeping start/finish at index zero. */
export function insertTrackPoint(points, point) {
  if (points.length >= 80 || !validPoint(point)) return null;
  let index = points.length;
  if (points.length >= 4) {
    let closest = Infinity;
    const n = points.length;
    for (let i = 0; i < n; i++) {
      const p0 = points[(i - 1 + n) % n], p1 = points[i], p2 = points[(i + 1) % n], p3 = points[(i + 2) % n];
      let previous = p1;
      for (let step = 1; step <= 48; step++) {
        const next = catmullRom(p0, p1, p2, p3, step / 48);
        const distance = distPointSegSq(point.x, point.y, previous.x, previous.y, next.x, next.y);
        if (distance < closest) { closest = distance; index = i + 1; }
        previous = next;
      }
    }
  }
  const result = points.map(p => ({ ...p }));
  result.splice(index, 0, { x: point.x, y: point.y });
  return { points: result, index };
}

function findNearestControlIndex(points, x, y) {
  let best = 0, bestDistSq = Infinity;
  for (let i = 0; i < points.length; i++) {
    const dSq = (points[i].x - x) ** 2 + (points[i].y - y) ** 2;
    if (dSq < bestDistSq) { bestDistSq = dSq; best = i; }
  }
  return best;
}

function detectTightCorners(track, points, width) {
  const minRadius = width / 2 + 8;
  const maxCurvature = 1 / minRadius;
  const tightCorners = [];
  const N = track.N;
  const visited = new Uint8Array(N);

  for (let i = 0; i < N; i++) {
    const absK = Math.abs(track.curvature[i]);
    if (visited[i] || absK <= maxCurvature) continue;

    const indices = [i];
    visited[i] = 1;

    let step = 1;
    while (step < N) {
      const idx = (i + step) % N;
      if (Math.abs(track.curvature[idx]) > maxCurvature * 0.82) {
        indices.push(idx);
        visited[idx] = 1;
        step++;
      } else break;
    }

    step = 1;
    while (step < N) {
      const idx = (i - step + N) % N;
      if (visited[idx]) break;
      if (Math.abs(track.curvature[idx]) > maxCurvature * 0.82) {
        indices.unshift(idx);
        visited[idx] = 1;
        step++;
      } else break;
    }

    let apexIdx = indices[0];
    let maxClusterK = Math.abs(track.curvature[apexIdx]);
    for (const idx of indices) {
      const k = Math.abs(track.curvature[idx]);
      if (k > maxClusterK) { maxClusterK = k; apexIdx = idx; }
    }

    const radius = Math.round(1 / maxClusterK);
    const apexX = track.cx[apexIdx], apexY = track.cy[apexIdx];
    const nearestControlIndex = findNearestControlIndex(points, apexX, apexY);

    tightCorners.push({
      type: 'tight-corner',
      severity: 'error',
      apexIndex: apexIdx,
      apex: { x: apexX, y: apexY },
      radius,
      minRadius: Math.round(minRadius),
      curvature: track.curvature[apexIdx],
      sampleIndices: indices,
      nearestControlIndex,
      nearestControlPoint: points[nearestControlIndex],
      message: `Corner ${nearestControlIndex === 0 ? 'Start/Finish' : nearestControlIndex}: Turn radius ${radius}u is too tight (minimum ${Math.round(minRadius)}u).`
    });
  }

  tightCorners.sort((a, b) => a.radius - b.radius);
  return tightCorners;
}

function detectNarrowPassages(track, points, width) {
  const minArc = width * 2.1;
  const clearanceLimit = width + 12;
  const N = track.N;
  const rawOverlaps = [];

  for (let i = 0; i < N; i++) {
    for (let j = i + 1; j < N; j++) {
      if (Math.min(j - i, N - (j - i)) * track.spacing < minArc) continue;
      const k = (j + 1) % N;
      const dSq = distPointSegSq(track.cx[i], track.cy[i], track.cx[j], track.cy[j], track.cx[k], track.cy[k]);
      if (dSq < clearanceLimit ** 2) {
        rawOverlaps.push({ i, j, k, distSq: dSq, dist: Math.sqrt(dSq) });
      }
    }
  }

  if (!rawOverlaps.length) return [];

  const passages = [];
  rawOverlaps.sort((a, b) => a.distSq - b.distSq);

  for (const item of rawOverlaps) {
    const ax = track.cx[item.i], ay = track.cy[item.i];
    const exists = passages.some(p => {
      const d1 = (p.pointA.x - ax) ** 2 + (p.pointA.y - ay) ** 2;
      return d1 < (width * 1.5) ** 2;
    });
    if (exists) continue;

    const bx1 = track.cx[item.j], by1 = track.cy[item.j];
    const bx2 = track.cx[item.k], by2 = track.cy[item.k];
    const ex = bx2 - bx1, ey = by2 - by1;
    const lenSq = ex * ex + ey * ey;
    const t = lenSq > 0 ? Math.max(0, Math.min(1, ((ax - bx1) * ex + (ay - by1) * ey) / lenSq)) : 0;
    const projX = bx1 + ex * t;
    const projY = by1 + ey * t;

    const controlA = findNearestControlIndex(points, ax, ay);
    const controlB = findNearestControlIndex(points, projX, projY);

    passages.push({
      type: 'narrow-passage',
      severity: 'error',
      pointA: { x: ax, y: ay, index: item.i },
      pointB: { x: projX, y: projY, index: item.j },
      distance: Math.round(item.dist),
      clearance: Math.round(item.dist - width),
      minDistance: Math.round(clearanceLimit),
      nearestControlIndexA: controlA,
      nearestControlIndexB: controlB,
      message: `Roads too close (${Math.round(item.dist)}u apart, requires ${Math.round(clearanceLimit)}u clearance).`
    });

    if (passages.length >= 6) break;
  }

  return passages;
}

/** Validate the actual smoothed road, rather than just its control polygon. */
export function inspectCustomTrack(points, width = 84) {
  if (!Array.isArray(points) || points.length < 4) return { valid: false, message: 'Draw a loop with at least four points.', attention: { tightCorners: [], narrowPassages: [], hasIssues: false } };
  if (points.length > 80 || !points.every(validPoint)) return { valid: false, message: 'Use up to 80 points inside the drawing area.', attention: { tightCorners: [], narrowPassages: [], hasIssues: false } };
  if (points.some((p, i) => Math.hypot(p.x - points[(i + 1) % points.length].x,
    p.y - points[(i + 1) % points.length].y) < 15)) return { valid: false, message: 'Move neighboring points farther apart.', attention: { tightCorners: [], narrowPassages: [], hasIssues: false } };
  const track = new Track(points, width, 320);
  if (!Number.isFinite(track.length) || track.length < 1000 || track.length > 6500) {
    return { valid: false, track, message: 'Make a circuit between 1,000 and 6,500 units long.', attention: { tightCorners: [], narrowPassages: [], hasIssues: false } };
  }

  const tightCorners = detectTightCorners(track, points, width);
  const narrowPassages = detectNarrowPassages(track, points, width);
  const hasTight = tightCorners.length > 0;
  const hasNarrow = narrowPassages.length > 0;

  const b = track.bounds, margin = 60;
  const outOfBounds = b.minX < margin || b.maxX > DRAWING_SIZE.width - margin ||
      b.minY < margin || b.maxY > DRAWING_SIZE.height - margin;

  let valid = true;
  let message = 'Ready to race · closed circuit';

  if (hasTight) {
    valid = false;
    message = 'Open up the tightest corner so the road has room to turn.';
  } else if (outOfBounds) {
    valid = false;
    message = 'Keep the road inside the dashed boundary.';
  } else if (hasNarrow) {
    valid = false;
    message = 'Separate crossing or overlapping roads. Leave room between corners.';
  }

  return {
    valid,
    track,
    message,
    attention: {
      tightCorners,
      narrowPassages,
      hasIssues: hasTight || hasNarrow
    }
  };
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

export function deleteCustomTrack(trackId, storage = localStorage, width = 84) {
  if (typeof trackId !== 'string') return [];
  const tracks = readCustomTracks(storage, width);
  const remaining = tracks.filter(t => t.id !== trackId);
  storage.setItem(CUSTOM_TRACKS_KEY, JSON.stringify(remaining));
  delete TRACK_PRESETS[trackId];
  return remaining;
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

export function initialCircuitKey(state, requestedKey, presets = TRACK_PRESETS) {
  if (requestedKey && Object.hasOwn(presets, requestedKey)) return requestedKey;
  const saved = state?.trackPreset;
  return saved && Object.hasOwn(presets, saved) && !presets[saved].custom ? saved : 'grand-prix';
}

export function parseCustomTrackJSON(text, width = 84) {
  if (typeof text !== 'string' || text.length > 262144) throw new Error('Choose a track JSON file smaller than 256 KB.');
  let data;
  try { data = JSON.parse(text); } catch { throw new Error('This file is not valid JSON.'); }
  if (data?.kind !== 'ai-racer-track' || data.version !== 1 || typeof data.name !== 'string' ||
      !data.name.trim() || data.name.length > 40) throw new Error('Choose an AI Racer track JSON file.');
  const inspection = inspectCustomTrack(data.points, width);
  if (!inspection.valid) throw new Error(inspection.message);
  return { name: data.name.trim(), points: data.points.map(p => ({ x: p.x, y: p.y })) };
}

export function serializeCustomTrack(track, width = 84) {
  const result = { kind: 'ai-racer-track', version: 1, name: track.name, points: track.points };
  parseCustomTrackJSON(JSON.stringify(result), width);
  return JSON.stringify(result, null, 2);
}
