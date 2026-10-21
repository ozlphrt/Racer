import { CONFIG } from './config.js';
import { CUSTOM_TRACKS_KEY, DRAWING_SIZE, inspectCustomTrack, readCustomTracks, saveCustomTrack, simplifyStroke } from './customTracks.js';

const $ = id => document.getElementById(id);
const drawing = $('track-drawing'), nameInput = $('track-name');
const DRAFT_KEY = 'ai-racer:track-draft:v1';
const ns = 'http://www.w3.org/2000/svg';
const make = (tag, attributes) => {
  const element = document.createElementNS(ns, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, value);
  return element;
};
let points = [], editingId = null, selected = -1, undo = [], gesture = null, inspection = null;
let cursor = { x: 300, y: 500 }, pendingFrame = false;
const copy = list => list.map(p => ({ ...p }));
function checkpoint() { undo.push({ points: copy(points), selected }); if (undo.length > 50) undo.shift(); }
function saveDraft() {
  try { localStorage.setItem(DRAFT_KEY, JSON.stringify({ points, name: nameInput.value, editingId })); } catch {}
}
function status(message) { $('save-status').textContent = message; }
function refreshLibrary() {
  const tracks = readCustomTracks(localStorage, CONFIG.track.width);
  $('saved-count').textContent = `${tracks.length} / 12`;
  $('saved-tracks').replaceChildren();
  if (!tracks.length) {
    const empty = document.createElement('p'); empty.className = 'empty-library';
    empty.textContent = 'Your saved circuits will appear here.'; $('saved-tracks').append(empty);
  }
  for (const track of tracks) {
    const row = document.createElement('div'); row.className = `saved-row${track.id === editingId ? ' active' : ''}`;
    const load = document.createElement('button'); load.type = 'button'; load.className = 'button quiet load-track';
    load.textContent = track.name; load.title = `Edit ${track.name}`;
    load.addEventListener('click', () => {
      points = copy(track.points); editingId = track.id; nameInput.value = track.name; selected = -1; undo = [];
      status('Editing a saved circuit. Save to apply your changes.'); refreshLibrary(); render();
    });
    const remove = document.createElement('button'); remove.type = 'button'; remove.className = 'button quiet';
    remove.textContent = '×'; remove.setAttribute('aria-label', `Remove ${track.name} from library`);
    remove.addEventListener('click', () => {
      try {
        localStorage.setItem(CUSTOM_TRACKS_KEY, JSON.stringify(tracks.filter(t => t.id !== track.id)));
        // Keep the removed layout on the canvas, so it can immediately be saved again.
        if (editingId === track.id) editingId = null;
        refreshLibrary(); render(); status('Removed from the library. The open drawing is still here.');
      } catch { status('Could not update the library. Your saved circuits are unchanged.'); }
    });
    row.append(load, remove); $('saved-tracks').append(row);
  }
}
function render() {
  inspection = inspectCustomTrack(points, CONFIG.track.width);
  $('empty-hint').setAttribute('visibility', points.length || gesture?.stroke?.length ? 'hidden' : 'visible');
  $('point-count').textContent = `${points.length} / 80`;
  $('track-length').textContent = inspection.track ? `${Math.round(inspection.track.length).toLocaleString()} units` : '—';
  $('track-status').textContent = inspection.message;
  $('track-status').classList.toggle('ready', inspection.valid);
  $('save-race').disabled = $('save-track').disabled = !inspection.valid || !nameInput.value.trim();
  $('undo').disabled = !undo.length;
  $('clear').disabled = $('reverse').disabled = points.length === 0;
  $('set-start').disabled = selected < 0 || selected === 0;
  $('remove-point').disabled = selected < 0;
  $('draft-label').textContent = editingId ? 'EDITING SAVED CIRCUIT' : 'NEW CIRCUIT';
  const road = $('road-preview'); road.replaceChildren();
  const track = inspection.track;
  if (track) {
    const path = Array.from({ length: track.N }, (_, i) => `${i ? 'L' : 'M'}${track.cx[i].toFixed(1)},${track.cy[i].toFixed(1)}`).join(' ') + ' Z';
    for (const attrs of [
      { stroke: '#d8e5e5', 'stroke-width': track.width + 12 },
      { stroke: '#e76668', 'stroke-width': track.width + 12, 'stroke-dasharray': '28 28' },
      { stroke: '#263741', 'stroke-width': track.width },
      { stroke: '#80909b', 'stroke-width': 2, 'stroke-dasharray': '15 18' },
    ]) road.append(make('path', { d: path, fill: 'none', 'stroke-linejoin': 'round', ...attrs }));
    const x = track.cx[0], y = track.cy[0], nx = -track.ty[0], ny = track.tx[0];
    road.append(make('line', { x1: x - nx * track.half, y1: y - ny * track.half,
      x2: x + nx * track.half, y2: y + ny * track.half, stroke: '#f8faff', 'stroke-width': 8 }));
    road.append(make('line', { x1: x + track.tx[0] * 50, y1: y + track.ty[0] * 50,
      x2: x + track.tx[0] * 110, y2: y + track.ty[0] * 110,
      stroke: '#4ce6b0', 'stroke-width': 4, 'marker-end': 'url(#direction-arrow)' }));
  }
  const handles = $('control-points'); handles.replaceChildren();
  points.forEach((p, i) => {
    const handle = make('circle', { cx: p.x, cy: p.y, r: i === selected ? 13 : 9,
      fill: i === 0 ? '#4ce6b0' : '#55c4f0', stroke: '#0b1923', 'stroke-width': 4 });
    const title = make('title', {}); title.textContent = i === 0 ? 'Start / finish' : `Corner ${i}`;
    handle.append(title); handles.append(handle);
  });
  $('draft-stroke').setAttribute('d', gesture?.stroke ? gesture.stroke.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') :
    !track && points.length ? points.map((p, i) => `${i ? 'L' : 'M'}${p.x},${p.y}`).join(' ') : '');
  $('keyboard-cursor').setAttribute('transform', `translate(${cursor.x} ${cursor.y})`);
  saveDraft();
}
function scheduleRender() {
  if (pendingFrame) return;
  pendingFrame = true; requestAnimationFrame(() => { pendingFrame = false; render(); });
}
function location(event) {
  const p = drawing.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
  const local = p.matrixTransform(drawing.getScreenCTM().inverse());
  return { x: Math.round(Math.max(60, Math.min(DRAWING_SIZE.width - 60, local.x))),
    y: Math.round(Math.max(60, Math.min(DRAWING_SIZE.height - 60, local.y))) };
}
drawing.addEventListener('pointerdown', event => {
  if (event.button !== 0 || gesture) return;
  event.preventDefault(); drawing.focus(); drawing.setPointerCapture(event.pointerId);
  const p = location(event), at = points.findIndex(q => Math.hypot(p.x - q.x, p.y - q.y) < 24);
  checkpoint(); selected = at;
  gesture = { pointerId: event.pointerId, before: copy(points), at, stroke: at < 0 ? [p] : null };
  render();
});
drawing.addEventListener('pointermove', event => {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const p = location(event);
  if (gesture.at >= 0) points[gesture.at] = p;
  else if (Math.hypot(p.x - gesture.stroke.at(-1).x, p.y - gesture.stroke.at(-1).y) > 10 && gesture.stroke.length < 2000) gesture.stroke.push(p);
  scheduleRender();
});
function finishGesture(event) {
  if (!gesture || event.pointerId !== gesture.pointerId) return;
  const lastGesture = gesture; gesture = null;
  if (event.type === 'pointercancel') { points = lastGesture.before; undo.pop(); }
  else if (lastGesture.stroke) {
    const addition = lastGesture.stroke.length > 2 ? simplifyStroke(lastGesture.stroke) : [lastGesture.stroke[0]];
    points = [...points, ...addition];
    if (points.length > 3 && Math.hypot(points[0].x - points.at(-1).x, points[0].y - points.at(-1).y) < 45) points.pop();
    if (points.length > 80) { points = lastGesture.before; undo.pop(); status('Use fewer than 80 control points. Try a simpler outline.'); }
  }
  if (drawing.hasPointerCapture(event.pointerId)) drawing.releasePointerCapture(event.pointerId);
  render();
}
drawing.addEventListener('pointerup', finishGesture);
drawing.addEventListener('pointercancel', finishGesture);
drawing.addEventListener('lostpointercapture', event => { if (gesture) finishGesture({ pointerId: event.pointerId, type: 'pointercancel' }); });
drawing.addEventListener('keydown', event => {
  const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
  if (directions[event.key]) {
    event.preventDefault(); const [dx, dy] = directions[event.key], step = event.shiftKey ? 10 : 50;
    cursor = { x: Math.max(100, Math.min(1500, cursor.x + dx * step)), y: Math.max(100, Math.min(900, cursor.y + dy * step)) };
    $('keyboard-cursor').setAttribute('visibility', 'visible'); render();
  } else if (event.code === 'Space' || event.key === 'Enter') {
    event.preventDefault();
    if (points.length < 80) { checkpoint(); points.push({ ...cursor }); selected = points.length - 1; render(); }
  } else if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); $('undo').click(); }
  else if (event.key === 'Delete' || event.key === 'Backspace') { event.preventDefault(); $('remove-point').click(); }
});
$('undo').addEventListener('click', () => { const previous = undo.pop(); if (previous) { points = previous.points; selected = previous.selected; render(); } });
$('clear').addEventListener('click', () => { checkpoint(); points = []; selected = -1; render(); });
$('reverse').addEventListener('click', () => { checkpoint(); points = [points[0], ...points.slice(1).reverse()]; selected = -1; render(); });
$('set-start').addEventListener('click', () => { if (selected < 0) return; checkpoint(); points = [...points.slice(selected), ...points.slice(0, selected)]; selected = 0; render(); });
$('remove-point').addEventListener('click', () => { if (selected < 0) return; checkpoint(); points.splice(selected, 1); selected = -1; render(); });
$('new-track').addEventListener('click', () => {
  points = []; selected = -1; editingId = null; undo = []; nameInput.value = '';
  refreshLibrary(); render(); status('New blank circuit. Draw your own layout.');
});
nameInput.addEventListener('input', () => render());
function save(race) {
  try {
    const id = editingId || `custom-${crypto.randomUUID()}`;
    const track = saveCustomTrack({ id, name: nameInput.value, points }, localStorage, CONFIG.track.width);
    editingId = track.id; refreshLibrary(); render(); status(`Saved “${track.name}” in this browser.`);
    if (race) window.location.href = `./?track=${encodeURIComponent(track.id)}`;
  } catch (error) { status(error.message || 'Could not save this circuit.'); }
}
$('save-track').addEventListener('click', () => save(false));
$('save-race').addEventListener('click', () => save(true));
try {
  const draft = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
  if (draft && Array.isArray(draft.points) && draft.points.length <= 80 && draft.points.every(p =>
    p && Number.isFinite(p.x) && Number.isFinite(p.y) && p.x >= 0 && p.x <= 1600 && p.y >= 0 && p.y <= 1000)) {
    points = copy(draft.points); nameInput.value = typeof draft.name === 'string' ? draft.name.slice(0, 40) : '';
    editingId = readCustomTracks().some(t => t.id === draft.editingId) ? draft.editingId : null;
  }
} catch {}
refreshLibrary(); render();
