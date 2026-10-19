const validLap = (v) => Number.isFinite(v) && v > 0 && v < 999;
const median = (values) => quantile(values, 0.5);
function quantile(values, p) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p, low = Math.floor(index);
  return sorted[low] + (sorted[Math.ceil(index)] - sorted[low]) * (index - low);
}
const seconds = (v) => v === null ? '—' : `${v.toFixed(2)}s`;

/** Only observed generation results; bands describe variation across generations, not cars. */
export function buildPaceInsights(history, windowSize = 200) {
  let record = null, recordGen = null;
  const visible = [];
  const start = Math.max(0, history.length - windowSize);
  for (let index = 0; index < history.length; index++) {
    const r = history[index];
    const best = validLap(r.bestLap) ? r.bestLap : null;
    const pack = validLap(r.avgLap) ? r.avgLap : null;
    const breakthrough = best !== null && (record === null || best < record - 1e-8);
    if (breakthrough) { record = best; recordGen = r.generation; }
    if (index < start) continue;
    const population = Number.isFinite(r.population) && r.population > 0 ? r.population : null;
    const finishers = population !== null && Number.isFinite(r.finishers) && r.finishers >= 0 && r.finishers <= population ? r.finishers : null;
    visible.push({ index, generation: r.generation, best, pack, record, recordGen, breakthrough,
      gap: best !== null && pack !== null && pack >= best ? pack - best : null,
      finishers, population, finishRate: finishers !== null ? finishers / population : null });
  }
  for (let i = 0; i < visible.length; i++) {
    const tail = visible.slice(Math.max(0, i - 24), i + 1);
    const gaps = tail.map(r => r.gap).filter(v => v !== null);
    visible[i].championMedian = median(tail.map(r => r.best).filter(v => v !== null));
    visible[i].gapMedian = median(gaps);
    visible[i].gapLow = quantile(gaps, 0.25);
    visible[i].gapHigh = quantile(gaps, 0.75);
  }
  const first = visible[0], last = visible.at(-1);
  // Disjoint comparison windows avoid presenting overlapping samples as independent progress.
  const comparisonSize = Math.min(25, Math.floor(visible.length / 2));
  const early = visible.slice(0, comparisonSize).map(r => r.gap).filter(v => v !== null);
  const recent = visible.slice(-comparisonSize || visible.length).map(r => r.gap).filter(v => v !== null);
  const gapChange = early.length && recent.length ? median(recent) - median(early) : null;
  const finishes = visible.slice(-25).filter(r => r.finishers !== null);
  const finished = finishes.reduce((sum, r) => sum + r.finishers, 0);
  const starters = finishes.reduce((sum, r) => sum + r.population, 0);
  return { rows: visible, first, last, gapChange, comparisonSize,
    recordGain: first?.record !== null && last?.record !== null && first && last ? first.record - last.record : null,
    sinceRecord: last?.recordGen !== null && last ? last.generation - last.recordGen : null,
    finished, starters, finishRate: starters ? finished / starters : null, finishWindow: finishes.length };
}

export function drawPaceInsights(chart) {
  // Scale the full plot into short viewports rather than clipping its lower panels.
  const height = Math.max(240, chart.h);
  chart.ctx.save();
  chart.ctx.scale(1, chart.h / height);
  try {
    return drawPaceInsightsAtHeight(chart, height);
  } finally {
    chart.ctx.restore();
  }
}

function drawPaceInsightsAtHeight(chart, h) {
  const { ctx, w } = chart;
  const key = [chart.history, chart.history.length, chart.history[0], chart.history.at(-1), chart.windowSize, chart.bestLapEver];
  if (!chart._paceCache || key.some((value, i) => chart._paceCache.key[i] !== value)) {
    chart._paceCache = { key, model: buildPaceInsights(chart.history, chart.windowSize) };
  }
  const model = chart._paceCache.model;
  const { rows, first, last } = model;
  if (!rows.length || !rows.some(r => r.best !== null)) {
    ctx.fillStyle = '#94a3b8'; ctx.font = '12px Outfit, sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('Complete a lap to begin pace analysis', w / 2, h / 2);
    chart.updateKpiStrip([]);
    return;
  }
  const left = 52, right = 14, width = w - left - right;
  const X = (r) => left + (rows.length === 1 ? width / 2 : width * (r.index - first.index) / (rows.length - 1));
  const text = (value, x, y, color = '#94a3b8', size = 10, align = 'left') => {
    ctx.fillStyle = color; ctx.font = `${size}px "JetBrains Mono", monospace`;
    ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(value, x, y);
  };
  const line = (x1, y1, x2, y2, color) => {
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.stroke();
  };
  const gapDirection = model.gapChange === null ? 'Need more laps' : Math.abs(model.gapChange) < 0.005 ? 'Gap unchanged' :
    `Gap ${model.gapChange < 0 ? 'narrowing' : 'widening'} ${seconds(Math.abs(model.gapChange))}`;
  const cards = [
    [model.recordGain === null ? 'No record yet' : `${seconds(model.recordGain)} record gain`, `${model.sinceRecord ?? '—'} gens since last record`, '#38bdf8'],
    [gapDirection, `First vs last ${model.comparisonSize} gens · median gap`, model.gapChange > 0 ? '#fbbf24' : '#34d399'],
    [model.finishRate === null ? 'Finish rate unavailable' : `${Math.round(model.finishRate * 100)}% finish rate`,
      `${model.finished}/${model.starters} cars · last ${model.finishWindow} gens`, '#c4b5fd'],
  ];
  const portrait = w < 650;
  const cardWidth = portrait ? w - 8 : (w - 16) / 3;
  const cardHeight = portrait ? 34 : 45;
  cards.forEach(([title, subtitle, color], i) => {
    const x = portrait ? 4 : 4 + i * (cardWidth + 4);
    const y = portrait ? i * (cardHeight + 3) : 0;
    ctx.fillStyle = 'rgba(148,163,184,0.045)'; ctx.fillRect(x, y, cardWidth, cardHeight);
    ctx.fillStyle = color; ctx.fillRect(x, y, 2, cardHeight);
    text(title, x + 10, y + (portrait ? 10 : 15), color, portrait ? 10 : 12);
    text(subtitle, x + 10, y + (portrait ? 25 : 33), '#8796aa', portrait ? 8 : 9);
  });
  const usable = Math.max(50, h - (portrait ? 216 : 150));
  const champion = { top: portrait ? 138 : 72, height: usable * 0.43 };
  const pack = { top: champion.top + champion.height + 29, height: usable * 0.43 };
  const survival = { top: pack.top + pack.height + 24, height: Math.max(12, usable * 0.14) };
  const paceValues = rows.flatMap(r => [r.best, r.record]).filter(v => v !== null);
  const paceMin = Math.min(...paceValues), paceMax = Math.max(...paceValues);
  const paceMargin = Math.max(0.025, (paceMax - paceMin) * 0.12);
  const min = paceMin - paceMargin, max = paceMax + paceMargin;
  const PY = (v) => champion.top + champion.height * (v - min) / (max - min);
  const gapMax = Math.max(0.1, ...rows.map(r => r.gap ?? 0)) * 1.1;
  const GY = (v) => pack.top + pack.height * (1 - v / gapMax);
  const grid = (panel, values, format) => {
    for (let i = 0; i < 3; i++) {
      const y = panel.top + panel.height * i / 2;
      line(left, y, w - right, y, 'rgba(148,163,184,0.12)');
      text(format(values(i)), left - 7, y, '#7f90a6', 9, 'right');
    }
  };
  text('CHAMPION PACE', left, champion.top - 15, '#38bdf8', 10);
  text(w < 650 ? 'raw · 25-gen median · record' : 'Faint: each gen  /  Cyan: 25-gen median  /  Gold: record  ·  Lower is faster', w - right, champion.top - 15, '#8796aa', w < 650 ? 7 : 9, 'right');
  grid(champion, i => min + (max - min) * i / 2, v => `${v.toFixed(2)}s`);
  text('PACK GAP', left, pack.top - 15, '#34d399', 10);
  text(w < 650 ? 'mean best lap − champion' : 'Mean car best lap − champion  /  Band: middle 50% of gaps over 25 gens', w - right, pack.top - 15, '#8796aa', w < 650 ? 7 : 9, 'right');
  grid(pack, i => gapMax * (1 - i / 2), v => `+${v.toFixed(1)}s`);
  const series = (field, Y, color, weight = 1, dashed = false, stepped = false, validField = field) => {
    ctx.beginPath(); let previous = null;
    for (const r of rows) {
      if (r[field] === null || r[validField] === null) { previous = null; continue; }
      const x = X(r), y = Y(r[field]);
      if (!previous) ctx.moveTo(x, y);
      else { if (stepped) ctx.lineTo(x, previous.y); ctx.lineTo(x, y); }
      previous = { x, y };
    }
    ctx.lineWidth = weight; ctx.strokeStyle = color;
    ctx.setLineDash(dashed ? [4, 4] : []); ctx.stroke(); ctx.setLineDash([]);
  };
  series('best', PY, 'rgba(56,189,248,0.23)');
  series('championMedian', PY, '#38bdf8', 2, false, false, 'best');
  series('record', PY, '#fbbf24', 1.2, true, true);
  // Separate polygons preserve gaps instead of drawing through missing generations.
  let segment = [];
  const fillBand = () => {
    if (!segment.length) return;
    ctx.beginPath();
    segment.forEach((r, i) => i ? ctx.lineTo(X(r), GY(r.gapHigh)) : ctx.moveTo(X(r), GY(r.gapHigh)));
    [...segment].reverse().forEach(r => ctx.lineTo(X(r), GY(r.gapLow)));
    ctx.closePath(); ctx.fillStyle = 'rgba(52,211,153,0.12)'; ctx.fill(); segment = [];
  };
  for (const r of rows) { if (r.gap !== null) segment.push(r); else fillBand(); } fillBand();
  series('gap', GY, 'rgba(52,211,153,0.27)');
  // Missing measurements remain visible as gaps even when a rolling median exists.
  series('gapMedian', GY, '#34d399', 2, false, false, 'gap');
  text('FINISH RATE', left, survival.top - 10, '#c4b5fd', 9);
  text('Each bar = cars finishing / starters · blank = unavailable', w - right, survival.top - 10, '#8796aa', w < 650 ? 7 : 9, 'right');
  ctx.fillStyle = 'rgba(196,181,253,0.05)'; ctx.fillRect(left, survival.top, width, survival.height);
  const barWidth = Math.max(1, width / rows.length - 1);
  for (const r of rows) {
    if (r.finishRate === null) continue;
    ctx.fillStyle = r.finishRate >= 0.5 ? '#a78bfa' : '#a17875';
    const barHeight = Math.max(1, survival.height * r.finishRate);
    ctx.fillRect(Math.max(left, Math.min(w - right - barWidth, X(r) - barWidth / 2)), survival.top + survival.height - barHeight, barWidth, barHeight);
  }
  text('100%', left - 7, survival.top + 2, '#7f90a6', 8, 'right');
  text('0%', left - 7, survival.top + survival.height, '#7f90a6', 8, 'right');
  text(`Gen ${first.generation}`, left, h - 7, '#94a3b8', 9);
  text(`Gen ${last.generation}`, w - right, h - 7, '#94a3b8', 9, 'right');
  if (w > 550) text(`${rows.length} COMPLETED GENERATIONS · Hover to inspect`, w / 2, h - 7, '#64748b', 9, 'center');
  const selected = rows.find(r => r.index === chart.hoverIdx);
  if (selected) {
    const x = X(selected);
    ctx.setLineDash([3, 4]); line(x, champion.top, x, survival.top + survival.height, 'rgba(255,255,255,0.5)'); ctx.setLineDash([]);
    for (const [value, Y, color] of [[selected.best, PY, '#38bdf8'], [selected.gap, GY, '#34d399']]) {
      if (value === null) continue;
      ctx.beginPath(); ctx.arc(x, Y(value), 3, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    }
    const bw = Math.min(242, w - 12), bx = Math.max(6, Math.min(w - bw - 6, x + 12));
    ctx.fillStyle = '#101b2c'; ctx.fillRect(bx, champion.top + 3, bw, 84);
    ctx.strokeStyle = '#334155'; ctx.strokeRect(bx, champion.top + 3, bw, 84);
    text(`GEN ${selected.generation} · observed`, bx + 10, champion.top + 17, '#f8fafc', 10);
    text(`Champion ${seconds(selected.best)} · pack ${seconds(selected.pack)}`, bx + 10, champion.top + 36, '#38bdf8', 9);
    text(`Pack gap ${seconds(selected.gap)} · record ${seconds(selected.record)}`, bx + 10, champion.top + 54, '#34d399', 9);
    text(selected.finishers === null ? 'Finish data unavailable' : `${selected.finishers}/${selected.population} finished (${Math.round(selected.finishRate * 100)}%)`, bx + 10, champion.top + 72, '#c4b5fd', 9);
  }
  const active = selected || last;
  chart.updateKpiStrip([
    { label: selected ? `GEN ${active.generation}` : 'LATEST', val: seconds(active.best), cls: 'cyan', dot: '#38bdf8' },
    { label: 'PACK GAP', val: active.gap === null ? '—' : `+${seconds(active.gap)}`, cls: 'green' },
    { label: 'FINISHED', val: active.finishers === null ? '—' : `${active.finishers}/${active.population}`, cls: 'white' },
  ]);
  chart.canvas.setAttribute('aria-label', `Training pace analysis. ${cards.map(c => c.slice(0, 2).join('. ')).join('. ')}. Champion pace, pack gap and finish rate over ${rows.length} generations.`);
}
