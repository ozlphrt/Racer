export const compact = (v) => {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(1) + 'k';
  return v.toFixed(0);
};

export const fmtLap = (v) => {
  if (!Number.isFinite(v) || v <= 0 || v > 999) return '–';
  return v.toFixed(2) + 's';
};

/**
 * Catmull-Rom to Cubic Bezier curve tracing with curvature tension.
 * Produces silky, organic curves with zero angular kinks or overshooting.
 */
function traceSmoothSpline(ctx, points, tension = 0.3) {
  const n = points.length;
  if (n <= 1) return;
  if (n === 2) {
    ctx.lineTo(points[1].x, points[1].y);
    return;
  }

  for (let i = 0; i < n - 1; i++) {
    const p0 = i > 0 ? points[i - 1] : points[i];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i < n - 2 ? points[i + 2] : p2;

    const cp1x = p1.x + (p2.x - p0.x) * (tension / 3);
    const cp1y = p1.y + (p2.y - p0.y) * (tension / 3);
    const cp2x = p2.x - (p3.x - p1.x) * (tension / 3);
    const cp2y = p2.y - (p3.y - p1.y) * (tension / 3);

    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
}

export class FitnessChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.history = [];
    this.hoverIdx = null;
    this.onHover = null;
    this.mode = 'lap'; // 'lap' (default) | 'speed' | 'survival' | 'fitness'
    this.windowSize = 200; // 200 generations rolling window

    this.bindEvents();
    this.resize();
  }

  setMode(mode) {
    if (this.mode !== mode) {
      this.mode = mode;
      this.hoverIdx = null;
      this.draw(this.history);
    }
  }

  updateKpiStrip(items) {
    const el = document.getElementById('hyper-chart-kpis');
    if (!el) return;
    if (!items || !items.length) {
      el.innerHTML = '';
      return;
    }
    el.innerHTML = items.map(it => `
      <div class="kpi-chip">
        ${it.dot ? `<span class="kpi-dot" style="background:${it.dot}"></span>` : ''}
        <span class="kpi-label">${it.label}</span>
        <span class="kpi-val ${it.cls || ''}">${it.val}</span>
      </div>
    `).join('');
  }

  bindEvents() {
    const handleMove = (e) => {
      if (!this.history || this.history.length === 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left;
      const padL = 44;
      const padR = 36;
      const pw = this.w - padL - padR;
      if (pw <= 0) return;

      const n = this.history.length;
      const windowSize = this.windowSize || 200;
      const startIdx = Math.max(0, n - windowSize);
      const visibleCount = n - startIdx;
      if (visibleCount <= 0) return;

      const normX = Math.max(0, Math.min(1, (x - padL) / pw));
      const relIdx = Math.round(normX * (visibleCount - 1));
      const idx = startIdx + relIdx;
      if (idx !== this.hoverIdx && idx >= startIdx && idx < n) {
        this.hoverIdx = idx;
        this.draw(this.history);
        this.onHover?.(this.history[idx]);
      }
    };

    const handleLeave = () => {
      if (this.hoverIdx !== null) {
        this.hoverIdx = null;
        this.draw(this.history);
        this.onHover?.(null);
      }
    };

    this.canvas.addEventListener('mousemove', handleMove);
    this.canvas.addEventListener('mouseleave', handleLeave);
    this.canvas.addEventListener('touchmove', handleMove, { passive: true });
    this.canvas.addEventListener('touchend', handleLeave, { passive: true });
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.draw(this.history);
  }

  draw(history, bestLapEver) {
    this.history = history || [];
    if (bestLapEver && Number.isFinite(bestLapEver) && bestLapEver > 0 && bestLapEver < 60) {
      this.bestLapEver = bestLapEver;
    }
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && (Math.round(rect.width) !== Math.round(this.w) || Math.round(rect.height) !== Math.round(this.h))) {
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.w = Math.max(1, rect.width);
      this.h = Math.max(1, rect.height);
      this.canvas.width = Math.round(this.w * this.dpr);
      this.canvas.height = Math.round(this.h * this.dpr);
    }
    const { ctx, w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 44, r: 36, t: 14, b: 20 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;

    if (this.history.length === 0) {
      ctx.fillStyle = 'rgba(139, 149, 173, 0.6)';
      ctx.font = '12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Telemetry chart initializes after Generation 1', w / 2, h / 2);
      return;
    }

    if (this.mode === 'speed') {
      this.drawSpeedChart(pad, pw, ph);
    } else if (this.mode === 'survival') {
      this.drawSurvivalChart(pad, pw, ph);
    } else if (this.mode === 'fitness') {
      this.drawFitnessChart(pad, pw, ph);
    } else {
      this.drawLapChart(pad, pw, ph);
    }
  }

  // -------------------------------------------------------------
  // Mode 1: Lap Times & Pace Trajectory (Primary Racing Telemetry)
  // -------------------------------------------------------------
  drawLapChart(pad, pw, ph) {
    const { ctx, w, h } = this;
    const n = this.history.length;
    const windowSize = this.windowSize || 200;
    const startIdx = Math.max(0, n - windowSize);
    const visibleCount = n - startIdx;

    let allTimeBest = (this.bestLapEver && Number.isFinite(this.bestLapEver) && this.bestLapEver > 0 && this.bestLapEver < 60)
      ? this.bestLapEver
      : Infinity;
    const lapRecords = [];
    const breakthroughPoints = [];
    let validLapCount = 0;

    for (let i = 0; i < n; i++) {
      const rec = this.history[i];
      const l = rec.bestLap;
      const isValid = l && Number.isFinite(l) && l > 0 && l < 60;
      if (isValid) {
        validLapCount++;
        if (l < allTimeBest) {
          allTimeBest = l;
          if (i > 0) breakthroughPoints.push(i);
        }
      }
      lapRecords.push({
        bestLap: isValid ? l : (allTimeBest < Infinity ? allTimeBest : null),
        avgLap: rec.avgLap && Number.isFinite(rec.avgLap) && rec.avgLap > 0 && rec.avgLap < 60 ? rec.avgLap : null,
        recordLap: allTimeBest < Infinity ? allTimeBest : null,
        isValid
      });
    }

    if (validLapCount === 0) {
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.font = '12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Cars currently learning circuit geometry · Lap times record upon first circuit completion', w / 2, h / 2 - 8);
      ctx.fillStyle = 'rgba(56, 189, 248, 0.6)';
      ctx.font = '11px "JetBrains Mono", monospace';
      ctx.fillText(`Current Generation: #${this.history[n - 1].generation}`, w / 2, h / 2 + 14);
      this.updateKpiStrip([
        { label: 'P1 PACE', val: 'LEARNING', cls: 'subtle' },
        { label: 'CIRCUIT REC', val: '–', cls: 'white' },
        { label: 'STATUS', val: 'INITIALIZING', cls: 'cyan' }
      ]);
      return;
    }

    // 1. Gather valid lap samples in the visible 200-gen window for robust percentile distribution
    const winBestLaps = [];
    const winAvgLaps = [];
    for (let i = startIdx; i < n; i++) {
      const lr = lapRecords[i];
      if (lr.bestLap && lr.bestLap > 0 && lr.bestLap < 60) winBestLaps.push(lr.bestLap);
      if (lr.avgLap && lr.avgLap > 0 && lr.avgLap < 60) winAvgLaps.push(lr.avgLap);
    }
    winBestLaps.sort((a, b) => a - b);
    winAvgLaps.sort((a, b) => a - b);

    // Robust Interquartile & Median racing pace estimator:
    // Core lead pace is median best lap; core pack pace is median avg lap.
    // 75th percentile (Q3) of pack avg comfortably encompasses 75% of pack laps without being poisoned by crashes.
    const med_best = winBestLaps.length ? winBestLaps[Math.floor(winBestLaps.length * 0.50)] : allTimeBest;
    const med_avg = winAvgLaps.length ? winAvgLaps[Math.floor(winAvgLaps.length * 0.50)] : (med_best + 0.8);
    const q3_avg = winAvgLaps.length ? winAvgLaps[Math.floor(winAvgLaps.length * 0.75)] : (med_avg + 0.3);

    // Fastest Pace (Ceiling): 0.20s above all-time best so the record line breathes gracefully below top edge
    const fastestPace = Math.max(5.0, Math.floor((allTimeBest - 0.20) * 10) / 10);

    // Slowest Pace (Floor): Focus 100% on the competitive racing pack!
    // Set floor just below the 75th percentile of pack average (q3_avg + 0.35s) or minimum 1.8s spread.
    // Outlier crash laps (> slowestPace) are cleanly clamped to the floor with incident markers!
    const targetSlowest = Math.max(fastestPace + 1.8, q3_avg + 0.35, med_avg + 0.65);
    const slowestPace = Math.ceil(targetSlowest * 10) / 10;
    const rangeLap = slowestPace - fastestPace;

    const X = (i) => pad.l + (visibleCount <= 1 ? pw / 2 : (pw * (i - startIdx)) / (visibleCount - 1));
    // Inverted Y: fastest pace at top (pad.t), slowest pace at bottom (pad.t + ph)
    const Y = (lap) => {
      const clamped = Math.max(fastestPace, Math.min(slowestPace, lap));
      return pad.t + ph * ((clamped - fastestPace) / rangeLap);
    };

    // Telemetry gridlines & labels
    ctx.font = '9px "JetBrains Mono", monospace';
    const gridStepCount = 4;
    for (let g = 0; g <= gridStepCount; g++) {
      const lapVal = fastestPace + (rangeLap * g) / gridStepCount;
      const y = pad.t + (ph * g) / gridStepCount;
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();

      // Left axis: Lap time in seconds
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = 'rgba(148, 163, 184, 0.7)';
      ctx.fillText(`${lapVal.toFixed(1)}s`, pad.l - 6, y);

      // Right axis: Delta to record
      if (allTimeBest < Infinity && lapVal > allTimeBest + 0.05) {
        ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
        ctx.fillText(`+${(lapVal - allTimeBest).toFixed(1)}s`, w - pad.r + 6, y);
      }
    }

    // Vertical decade grid lines (every 25 or 50 generations)
    const firstGen = this.history[startIdx].generation;
    const lastGen = this.history[n - 1].generation;
    const genSpan = lastGen - firstGen;
    const genStep = genSpan > 120 ? 50 : 25;
    for (let gen = Math.ceil(firstGen / genStep) * genStep; gen < lastGen; gen += genStep) {
      const relNorm = (gen - firstGen) / (genSpan || 1);
      const gx = pad.l + pw * relNorm;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
      ctx.lineWidth = 1;
      ctx.setLineDash([2, 4]);
      ctx.beginPath();
      ctx.moveTo(gx, pad.t);
      ctx.lineTo(gx, pad.t + ph);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`#${gen}`, gx, pad.t + 10);
    }

    // Generation axis footer
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(139, 149, 173, 0.75)';
    ctx.fillText(`Gen ${firstGen}`, pad.l, h - 5);
    ctx.textAlign = 'right';
    ctx.fillText(`Gen ${lastGen}`, w - pad.r, h - 5);
    if (n > windowSize) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.fillText('200-GEN ROLLING WINDOW', w / 2, h - 5);
    }

    const sampledIndices = [];
    for (let i = startIdx; i < n; i++) sampledIndices.push(i);

    const bestLapPts = [];
    const avgLapPts = [];
    const recordPts = [];
    const incidents = [];

    for (const i of sampledIndices) {
      const lr = lapRecords[i];
      if (lr.bestLap) {
        bestLapPts.push({ x: X(i), y: Y(lr.bestLap), lap: lr.bestLap, idx: i });
        if (lr.bestLap > slowestPace) {
          incidents.push({ x: X(i), y: pad.t + ph, lap: lr.bestLap, idx: i });
        }
      }
      if (lr.avgLap) avgLapPts.push({ x: X(i), y: Y(lr.avgLap), lap: lr.avgLap, idx: i });
      if (lr.recordLap) recordPts.push({ x: X(i), y: Y(lr.recordLap), lap: lr.recordLap, idx: i });
    }

    // Calculate EMA smoothed lead curve for clean racing trajectory
    const leadEmaPts = [];
    if (bestLapPts.length > 0) {
      let ema = bestLapPts[0].lap;
      const alpha = 0.20;
      for (const pt of bestLapPts) {
        ema = alpha * pt.lap + (1 - alpha) * ema;
        leadEmaPts.push({ x: pt.x, y: Y(ema), lap: ema, idx: pt.idx });
      }
    }

    // Calculate EMA smoothed pack average curve (solid, silky smooth pace trajectory)
    const smoothAvgLapPts = [];
    if (avgLapPts.length > 0) {
      let emaAvg = avgLapPts[0].lap;
      const alphaAvg = 0.18;
      for (const pt of avgLapPts) {
        emaAvg = alphaAvg * pt.lap + (1 - alphaAvg) * emaAvg;
        smoothAvgLapPts.push({ x: pt.x, y: Y(emaAvg), lap: emaAvg, idx: pt.idx });
      }
    }

    // Smooth record drop transitions (gliding aerodynamic descent instead of 90-degree cliff staircase)
    const smoothRecordPts = [];
    if (recordPts.length > 0) {
      const rawY = recordPts.map(p => p.y);
      const sy = [...rawY];
      for (let pass = 0; pass < 3; pass++) {
        const temp = [...sy];
        for (let k = 1; k < temp.length - 1; k++) {
          temp[k] = 0.25 * sy[k - 1] + 0.50 * sy[k] + 0.25 * sy[k + 1];
        }
        for (let k = 1; k < temp.length - 1; k++) {
          sy[k] = temp[k];
        }
      }
      sy[0] = rawY[0];
      sy[sy.length - 1] = rawY[rawY.length - 1];
      for (let i = 0; i < recordPts.length; i++) {
        smoothRecordPts.push({ x: recordPts[i].x, y: sy[i], lap: recordPts[i].lap });
      }
    }

    // 1. Swarm Consistency Corridor (Pace Ribbon between Lead EMA and Pack Avg)
    if (leadEmaPts.length > 1 && smoothAvgLapPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(leadEmaPts[0].x, leadEmaPts[0].y);
      traceSmoothSpline(ctx, leadEmaPts, 0.35);
      const lastAvg = smoothAvgLapPts[smoothAvgLapPts.length - 1];
      ctx.lineTo(lastAvg.x, lastAvg.y);
      for (let i = smoothAvgLapPts.length - 1; i >= 0; i--) {
        ctx.lineTo(smoothAvgLapPts[i].x, smoothAvgLapPts[i].y);
      }
      ctx.closePath();
      const gapGrad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
      gapGrad.addColorStop(0, 'rgba(56, 189, 248, 0.18)');
      gapGrad.addColorStop(0.5, 'rgba(52, 211, 153, 0.08)');
      gapGrad.addColorStop(1, 'rgba(52, 211, 153, 0.02)');
      ctx.fillStyle = gapGrad;
      ctx.fill();
    }

    // 2. Incident Drop Glyphs (for clamped spinout / crash laps beyond window)
    for (const inc of incidents) {
      ctx.fillStyle = 'rgba(244, 63, 94, 0.75)';
      ctx.beginPath();
      ctx.moveTo(inc.x, pad.t + ph - 1);
      ctx.lineTo(inc.x - 3.5, pad.t + ph - 6);
      ctx.lineTo(inc.x + 3.5, pad.t + ph - 6);
      ctx.closePath();
      ctx.fill();
    }

    // 3. Pack Average Lap Line (Emerald `#34d399`, SOLID line with subtle ambient glow)
    if (smoothAvgLapPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(smoothAvgLapPts[0].x, smoothAvgLapPts[0].y);
      traceSmoothSpline(ctx, smoothAvgLapPts, 0.35);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(52, 211, 153, 0.35)';
      ctx.shadowBlur = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 4. Lead Pace: Silky Smoothed Trend Line (Sky Blue `#38bdf8`, solid with glow)
    if (leadEmaPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(leadEmaPts[0].x, leadEmaPts[0].y);
      traceSmoothSpline(ctx, leadEmaPts, 0.35);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 5. All-Time Record Lap Line (White `#ffffff`, smoothed gliding curve)
    if (smoothRecordPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(smoothRecordPts[0].x, smoothRecordPts[0].y);
      traceSmoothSpline(ctx, smoothRecordPts, 0.25);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // 7. Breakthrough Laser Pins & Beacons
    const minPixelGap = 16;
    let lastMarkedX = -999;
    for (const bIdx of breakthroughPoints) {
      if (bIdx >= startIdx && bIdx < n) {
        const bx = X(bIdx);
        if (bx - lastMarkedX >= minPixelGap) {
          lastMarkedX = bx;
          const by = Y(lapRecords[bIdx].recordLap);
          
          // Subtle vertical milestone laser line down to floor (solid hairline gradient)
          const laserGrad = ctx.createLinearGradient(0, by, 0, pad.t + ph);
          laserGrad.addColorStop(0, 'rgba(250, 204, 21, 0.35)');
          laserGrad.addColorStop(1, 'rgba(250, 204, 21, 0.04)');
          ctx.strokeStyle = laserGrad;
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(bx, by);
          ctx.lineTo(bx, pad.t + ph);
          ctx.stroke();

          // Glowing gold halo
          ctx.beginPath();
          ctx.arc(bx, by, 5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
          ctx.fill();
          
          // Solid star beacon core
          ctx.beginPath();
          ctx.arc(bx, by, 2.5, 0, Math.PI * 2);
          ctx.fillStyle = '#facc15';
          ctx.fill();
        }
      }
    }

    // 8. Crosshair & Active Inspector
    const isHoverActive = this.hoverIdx !== null && this.hoverIdx >= startIdx && this.hoverIdx < n;
    const activeIdx = isHoverActive ? this.hoverIdx : n - 1;
    const r = this.history[activeIdx];
    const lr = lapRecords[activeIdx];
    const hx = X(activeIdx);

    if (isHoverActive) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, pad.t);
      ctx.lineTo(hx, pad.t + ph);
      ctx.stroke();
      ctx.setLineDash([]);

      // Top crosshair indicator pip
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(hx, pad.t, 2.5, 0, Math.PI * 2);
      ctx.fill();

      if (lr.recordLap) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(hx, Y(lr.recordLap), 4, 0, Math.PI * 2);
        ctx.fill();
      }
      if (lr.bestLap) {
        ctx.fillStyle = lr.bestLap > slowestPace ? '#f43f5e' : '#38bdf8';
        ctx.beginPath();
        ctx.arc(hx, Y(lr.bestLap), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      if (lr.avgLap) {
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(hx, Y(lr.avgLap), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
      this.drawLapTooltip(ctx, r, lr, hx, w, h, pad, breakthroughPoints.includes(activeIdx), slowestPace);
    } else {
      const lx = X(n - 1);
      const lastLr = lapRecords[n - 1];
      if (lastLr.avgLap) {
        ctx.fillStyle = '#34d399';
        ctx.beginPath();
        ctx.arc(lx, Y(lastLr.avgLap), 3.0, 0, Math.PI * 2);
        ctx.fill();
      }
      if (lastLr.bestLap) {
        ctx.fillStyle = '#38bdf8';
        ctx.beginPath();
        ctx.arc(lx, Y(lastLr.bestLap), 3.2, 0, Math.PI * 2);
        ctx.fill();
      }
      if (lastLr.recordLap) {
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(lx, Y(lastLr.recordLap), 3.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 9. Update Live Telemetry KPI Header Strip
    const lastLr = lapRecords[n - 1];
    const curLeadLap = lastLr.bestLap;
    const curAvgLap = lastLr.avgLap;
    const recLap = allTimeBest < Infinity ? allTimeBest : null;
    const gapToRec = (curLeadLap && recLap) ? (curLeadLap - recLap) : null;
    const packGap = (curLeadLap && curAvgLap) ? (curAvgLap - curLeadLap) : null;
    const consistencyPct = (curLeadLap && packGap !== null) 
      ? Math.max(10, Math.min(99.9, Math.round((1 - (packGap / curLeadLap)) * 100))) 
      : 85;

    this.updateKpiStrip([
      { label: 'P1', val: curLeadLap ? `${curLeadLap.toFixed(2)}s` : '–', cls: 'cyan', dot: '#38bdf8' },
      { label: 'REC', val: recLap ? `${recLap.toFixed(2)}s` : '–', cls: 'white', dot: '#ffffff' },
      { 
        label: 'GAP', 
        val: gapToRec !== null ? (gapToRec <= 0.01 ? 'REC' : `+${gapToRec.toFixed(2)}s`) : '–', 
        cls: gapToRec !== null ? (gapToRec <= 0.01 ? 'gold' : gapToRec < 0.25 ? 'green' : 'subtle') : 'subtle' 
      },
      { label: 'PACK', val: curAvgLap ? `${curAvgLap.toFixed(2)}s` : '–', cls: 'green', dot: '#34d399' },
      { label: 'STABILITY', val: `${consistencyPct}%`, cls: consistencyPct >= 90 ? 'green' : (consistencyPct >= 75 ? 'gold' : 'subtle') }
    ]);
  }

  // -------------------------------------------------------------
  // Mode 2: Top Speed Trajectory (km/h)
  // -------------------------------------------------------------
  drawSpeedChart(pad, pw, ph) {
    const { ctx, w, h } = this;
    const n = this.history.length;
    const windowSize = this.windowSize || 200;
    const startIdx = Math.max(0, n - windowSize);
    const visibleCount = n - startIdx;

    const speeds = [];
    const apexSpeeds = [];
    for (let i = 0; i < n; i++) {
      const r = this.history[i];
      let spd = 95;
      let apex = 45;
      if (r.bestLap && Number.isFinite(r.bestLap) && r.bestLap > 0 && r.bestLap < 60) {
        const norm = Math.max(0, Math.min(1.0, (r.bestLap - 10.0) / 14.0));
        spd = Math.round(305 - norm * 130);
        apex = Math.round(142 - norm * 90);
      } else {
        const fitProg = Math.min(1.0, (r.best || 0) / 22000);
        spd = Math.round(95 + fitProg * 80);
        apex = Math.round(spd * 0.36);
      }
      speeds.push(spd);
      apexSpeeds.push(apex);
    }

    const visibleApex = apexSpeeds.slice(startIdx);
    const visibleSpeeds = speeds.slice(startIdx);
    const minV = Math.min(...visibleApex) * 0.88;
    const maxV = Math.max(...visibleSpeeds) * 1.06 || 1;
    const rangeV = (maxV - minV) || 1;

    const X = (i) => pad.l + (visibleCount <= 1 ? pw / 2 : (pw * (i - startIdx)) / (visibleCount - 1));
    const Y = (v) => pad.t + ph * (1 - (v - minV) / rangeV);

    ctx.font = '9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let g = 0; g <= 4; g++) {
      const v = minV + (rangeV * g) / 4;
      const y = Y(v);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(139, 149, 173, 0.75)';
      ctx.fillText(`${Math.round(v)}kph`, pad.l - 6, y);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Gen ${this.history[startIdx].generation}`, pad.l, h - 5);
    ctx.textAlign = 'right';
    ctx.fillText(`Gen ${this.history[n - 1].generation}`, w - pad.r, h - 5);
    if (n > windowSize) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.fillText('200-GEN WINDOW', w / 2, h - 5);
    }

    const sampledIndices = [];
    for (let i = startIdx; i < n; i++) sampledIndices.push(i);

    const topPts = sampledIndices.map(i => ({ x: X(i), y: Y(speeds[i]) }));
    const apexPts = sampledIndices.map(i => ({ x: X(i), y: Y(apexSpeeds[i]) }));

    // Smooth speed trajectories with low-pass EMA for silky curves
    const smoothTopPts = [];
    const smoothApexPts = [];
    if (topPts.length > 0) {
      let tEma = topPts[0].y;
      let aEma = apexPts[0].y;
      const alphaS = 0.22;
      for (let i = 0; i < topPts.length; i++) {
        tEma = alphaS * topPts[i].y + (1 - alphaS) * tEma;
        aEma = alphaS * apexPts[i].y + (1 - alphaS) * aEma;
        smoothTopPts.push({ x: topPts[i].x, y: tEma });
        smoothApexPts.push({ x: apexPts[i].x, y: aEma });
      }
    }

    // Speed spread ribbon
    if (smoothTopPts.length > 1 && smoothApexPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(smoothTopPts[0].x, smoothTopPts[0].y);
      traceSmoothSpline(ctx, smoothTopPts, 0.35);
      const lastA = smoothApexPts[smoothApexPts.length - 1];
      ctx.lineTo(lastA.x, lastA.y);
      for (let i = smoothApexPts.length - 1; i >= 0; i--) {
        ctx.lineTo(smoothApexPts[i].x, smoothApexPts[i].y);
      }
      ctx.closePath();
      const sGrad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
      sGrad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
      sGrad.addColorStop(1, 'rgba(52, 211, 153, 0.04)');
      ctx.fillStyle = sGrad;
      ctx.fill();
    }

    // Apex velocity curve (Emerald, SOLID line with subtle ambient glow)
    if (smoothApexPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(smoothApexPts[0].x, smoothApexPts[0].y);
      traceSmoothSpline(ctx, smoothApexPts, 0.35);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(52, 211, 153, 0.35)';
      ctx.shadowBlur = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Peak speed curve (Sky Blue, solid with glow)
    if (smoothTopPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(smoothTopPts[0].x, smoothTopPts[0].y);
      traceSmoothSpline(ctx, smoothTopPts, 0.35);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Hover or Last
    const isHoverActive = this.hoverIdx !== null && this.hoverIdx >= startIdx && this.hoverIdx < n;
    const activeIdx = isHoverActive ? this.hoverIdx : n - 1;
    const r = this.history[activeIdx];
    const hx = X(activeIdx);
    const curTop = speeds[activeIdx];
    const curApex = apexSpeeds[activeIdx];

    if (isHoverActive) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, pad.t);
      ctx.lineTo(hx, pad.t + ph);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(hx, Y(curTop), 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(hx, Y(curApex), 3.5, 0, Math.PI * 2);
      ctx.fill();

      this.drawSpeedTooltip(ctx, r, curTop, curApex, hx, w, h, pad);
    } else {
      const lx = X(n - 1);
      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(lx, Y(curTop), 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(lx, Y(curApex), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const curTopSpd = speeds[n - 1] || 0;
    const curApexSpd = apexSpeeds[n - 1] || 0;
    const spdSpread = curTopSpd - curApexSpd;
    const fullThrottlePct = Math.round(Math.min(98, 55 + (curTopSpd / 320) * 40));

    this.updateKpiStrip([
      { label: 'TOP', val: `${curTopSpd} km/h`, cls: 'cyan', dot: '#38bdf8' },
      { label: 'APEX', val: `${curApexSpd} km/h`, cls: 'green', dot: '#34d399' },
      { label: 'RANGE', val: `Δ ${spdSpread} km/h`, cls: 'subtle' },
      { label: 'THROTTLE', val: `${fullThrottlePct}%`, cls: 'gold' }
    ]);
  }

  // -------------------------------------------------------------
  // Mode 3: Grid Survival (%)
  // -------------------------------------------------------------
  drawSurvivalChart(pad, pw, ph) {
    const { ctx, w, h } = this;
    const n = this.history.length;
    const windowSize = this.windowSize || 200;
    const startIdx = Math.max(0, n - windowSize);
    const visibleCount = n - startIdx;

    const survPcts = [];
    let emaSurv = 0;
    const emaSurvs = [];
    const alpha = 0.08;

    for (let i = 0; i < n; i++) {
      const r = this.history[i];
      const pop = r.population || 20;
      const fin = r.finishers !== undefined ? r.finishers : 0;
      const pct = Math.round((fin / pop) * 100);
      survPcts.push(pct);
      emaSurv = i === 0 ? pct : alpha * pct + (1 - alpha) * emaSurv;
      emaSurvs.push(emaSurv);
    }

    const X = (i) => pad.l + (visibleCount <= 1 ? pw / 2 : (pw * (i - startIdx)) / (visibleCount - 1));
    const Y = (pct) => pad.t + ph * (1 - Math.max(0, Math.min(100, pct)) / 100);

    // 0% .. 100% grid lines
    ctx.font = '9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let g = 0; g <= 4; g++) {
      const pct = g * 25;
      const y = Y(pct);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(139, 149, 173, 0.75)';
      ctx.fillText(`${pct}%`, pad.l - 6, y);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Gen ${this.history[startIdx].generation}`, pad.l, h - 5);
    ctx.textAlign = 'right';
    ctx.fillText(`Gen ${this.history[n - 1].generation}`, w - pad.r, h - 5);
    if (n > windowSize) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.fillText('200-GEN WINDOW', w / 2, h - 5);
    }

    const sampledIndices = [];
    for (let i = startIdx; i < n; i++) sampledIndices.push(i);

    const survPts = sampledIndices.map(i => ({ x: X(i), y: Y(emaSurvs[i]) }));

    // Area fill under survival curve
    if (survPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(survPts[0].x, survPts[0].y);
      traceSmoothSpline(ctx, survPts, 0.35);
      ctx.lineTo(survPts[survPts.length - 1].x, pad.t + ph);
      ctx.lineTo(survPts[0].x, pad.t + ph);
      ctx.closePath();
      const sGrad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
      sGrad.addColorStop(0, 'rgba(52, 211, 153, 0.22)');
      sGrad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
      ctx.fillStyle = sGrad;
      ctx.fill();

      // Main survival trend line (Emerald)
      ctx.beginPath();
      ctx.moveTo(survPts[0].x, survPts[0].y);
      traceSmoothSpline(ctx, survPts, 0.35);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.2;
      ctx.stroke();
    }

    const isHoverActive = this.hoverIdx !== null && this.hoverIdx >= startIdx && this.hoverIdx < n;
    const activeIdx = isHoverActive ? this.hoverIdx : n - 1;
    const r = this.history[activeIdx];
    const hx = X(activeIdx);
    const curFin = r.finishers || 0;
    const curPop = r.population || 20;
    const curPct = Math.round((curFin / curPop) * 100);

    if (isHoverActive) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, pad.t);
      ctx.lineTo(hx, pad.t + ph);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(hx, Y(curPct), 3.5, 0, Math.PI * 2);
      ctx.fill();

      this.drawSurvivalTooltip(ctx, r, curFin, curPop, curPct, hx, w, h, pad);
    } else {
      const lx = X(n - 1);
      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(lx, Y(emaSurvs[n - 1]), 3.5, 0, Math.PI * 2);
      ctx.fill();
    }

    const lastR = this.history[n - 1];
    const liveFin = lastR?.finishers || 0;
    const livePop = lastR?.population || 20;
    const livePct = Math.round((liveFin / livePop) * 100);
    const winFinSum = survPcts.slice(startIdx).reduce((a, b) => a + b, 0);
    const winMean = Math.round(winFinSum / (visibleCount || 1));
    const liveAttrition = 100 - livePct;

    this.updateKpiStrip([
      { label: 'FINISHERS', val: `${liveFin}/${livePop}`, cls: 'white' },
      { label: 'SURVIVAL', val: `${livePct}%`, cls: livePct >= 90 ? 'green' : (livePct >= 60 ? 'gold' : 'subtle'), dot: '#34d399' },
      { label: '200G MEAN', val: `${winMean}%`, cls: 'cyan' },
      { label: 'ATTRITION', val: `${liveAttrition}%`, cls: liveAttrition > 30 ? 'subtle' : 'green' }
    ]);
  }

  // -------------------------------------------------------------
  // Mode 4: Swarm Fitness & Pack Depth (Option 1)
  // -------------------------------------------------------------
  drawFitnessChart(pad, pw, ph) {
    const { ctx, w, h } = this;
    const n = this.history.length;
    const windowSize = this.windowSize || 200;
    const startIdx = Math.max(0, n - windowSize);
    const visibleCount = n - startIdx;

    const peakEnvelope = new Array(n);
    const leadEmaTrend = new Array(n);
    const packEmaTrend = new Array(n);
    const isBreakthrough = new Array(n).fill(false);
    const breakthroughPoints = [];

    let currentPeak = 0;
    let leadEma = this.history[0]?.best || 0;
    const firstMed = this.history[0]?.median !== undefined ? this.history[0].median : (this.history[0]?.avg || leadEma * 0.6);
    let packEma = firstMed;
    const alpha = n > 80 ? 0.05 : (n > 30 ? 0.07 : 0.10);

    for (let i = 0; i < n; i++) {
      const rec = this.history[i];
      const b = rec.best || 0;
      if (b > currentPeak) {
        currentPeak = b;
        if (i > 0) {
          isBreakthrough[i] = true;
          breakthroughPoints.push(i);
        }
      }
      peakEnvelope[i] = currentPeak;

      leadEma = i === 0 ? b : alpha * b + (1 - alpha) * leadEma;
      leadEmaTrend[i] = leadEma;

      const med = rec.median !== undefined ? rec.median : (rec.avg || b * 0.65);
      packEma = i === 0 ? med : alpha * med + (1 - alpha) * packEma;
      packEmaTrend[i] = packEma;
    }

    let minVal = Infinity;
    let maxVal = -Infinity;
    for (let i = startIdx; i < n; i++) {
      const b = this.history[i]?.best || 0;
      const med = this.history[i]?.median !== undefined ? this.history[i].median : (this.history[i]?.avg || b * 0.65);
      const pk = peakEnvelope[i];
      const le = leadEmaTrend[i];
      const pe = packEmaTrend[i];
      if (b > maxVal) maxVal = b;
      if (pk > maxVal) maxVal = pk;
      if (le > maxVal) maxVal = le;
      if (pe > 0 && pe < minVal) minVal = pe;
      if (med > 0 && med < minVal) minVal = med;
      if (b > 0 && b < minVal) minVal = b;
    }

    if (!Number.isFinite(minVal)) minVal = 0;
    if (maxVal <= 0) maxVal = 1;

    let spread = maxVal - minVal;
    if (spread < maxVal * 0.08) spread = Math.max(500, maxVal * 0.15);

    const padBtm = Math.max(spread * 0.15, 400);
    const padTop = Math.max(spread * 0.12, 400);

    let minY = Math.max(0, Math.floor(minVal - padBtm));
    let maxY = Math.ceil(maxVal + padTop);
    if (minVal < maxVal * 0.12) {
      minY = 0;
      maxY = Math.ceil(maxVal * 1.10);
    }
    const rangeY = (maxY - minY) || 1;

    const X = (i) => pad.l + (visibleCount <= 1 ? pw / 2 : (pw * (i - startIdx)) / (visibleCount - 1));
    const Y = (v) => pad.t + ph * (1 - Math.max(0, Math.min(rangeY, (v || 0) - minY)) / rangeY);

    ctx.font = '9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let g = 0; g <= 4; g++) {
      const v = minY + (rangeY * g) / 4;
      const y = Y(v);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(pad.l, y);
      ctx.lineTo(w - pad.r, y);
      ctx.stroke();
      ctx.fillStyle = 'rgba(139, 149, 173, 0.75)';
      ctx.fillText(compact(v), pad.l - 6, y);
    }

    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Gen ${this.history[startIdx].generation}`, pad.l, h - 5);
    ctx.textAlign = 'right';
    ctx.fillText(`Gen ${this.history[n - 1].generation}`, w - pad.r, h - 5);
    if (n > windowSize) {
      ctx.textAlign = 'center';
      ctx.fillStyle = 'rgba(56, 189, 248, 0.45)';
      ctx.fillText('200-GEN WINDOW', w / 2, h - 5);
    }

    const sampledIndices = [];
    for (let i = startIdx; i < n; i++) sampledIndices.push(i);

    const leadEmaPts = sampledIndices.map(i => ({ x: X(i), y: Y(leadEmaTrend[i]) }));
    const packEmaPts = sampledIndices.map(i => ({ x: X(i), y: Y(packEmaTrend[i]) }));
    const peakPts = sampledIndices.map(i => ({ x: X(i), y: Y(peakEnvelope[i]) }));

    // Smooth peak envelope steps into a continuous aerodynamic curve
    const smoothPeakPts = [];
    if (peakPts.length > 0) {
      const rawY = peakPts.map(p => p.y);
      const sy = [...rawY];
      for (let pass = 0; pass < 2; pass++) {
        const temp = [...sy];
        for (let k = 1; k < temp.length - 1; k++) {
          temp[k] = 0.22 * sy[k - 1] + 0.56 * sy[k] + 0.22 * sy[k + 1];
        }
        for (let k = 1; k < temp.length - 1; k++) {
          sy[k] = temp[k];
        }
      }
      sy[0] = rawY[0];
      sy[sy.length - 1] = rawY[rawY.length - 1];
      for (let i = 0; i < peakPts.length; i++) {
        smoothPeakPts.push({ x: peakPts[i].x, y: sy[i] });
      }
    }

    // Skill Gap Ribbon
    if (leadEmaPts.length > 1 && packEmaPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(leadEmaPts[0].x, leadEmaPts[0].y);
      traceSmoothSpline(ctx, leadEmaPts, 0.35);
      const lastPack = packEmaPts[packEmaPts.length - 1];
      ctx.lineTo(lastPack.x, lastPack.y);
      for (let i = packEmaPts.length - 1; i >= 0; i--) {
        ctx.lineTo(packEmaPts[i].x, packEmaPts[i].y);
      }
      ctx.closePath();
      const rGrad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
      rGrad.addColorStop(0, 'rgba(56, 189, 248, 0.16)');
      rGrad.addColorStop(0.65, 'rgba(16, 185, 129, 0.08)');
      rGrad.addColorStop(1, 'rgba(16, 185, 129, 0.02)');
      ctx.fillStyle = rGrad;
      ctx.fill();
    }

    // Pack median line (Emerald, SOLID line with subtle ambient glow)
    if (packEmaPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(packEmaPts[0].x, packEmaPts[0].y);
      traceSmoothSpline(ctx, packEmaPts, 0.35);
      ctx.strokeStyle = '#34d399';
      ctx.lineWidth = 2.0;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(52, 211, 153, 0.35)';
      ctx.shadowBlur = 3;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Lead car line (Sky blue, solid with glow)
    if (leadEmaPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(leadEmaPts[0].x, leadEmaPts[0].y);
      traceSmoothSpline(ctx, leadEmaPts, 0.35);
      ctx.strokeStyle = '#38bdf8';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(56, 189, 248, 0.45)';
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Peak line (White, smoothed gliding curve)
    if (smoothPeakPts.length > 1) {
      ctx.beginPath();
      ctx.moveTo(smoothPeakPts[0].x, smoothPeakPts[0].y);
      traceSmoothSpline(ctx, smoothPeakPts, 0.25);
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2.2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.shadowColor = 'rgba(255, 255, 255, 0.45)';
      ctx.shadowBlur = 4;
      ctx.stroke();
      ctx.shadowBlur = 0;
    }

    // Milestone pins
    const minPixelGap = 14;
    let lastMarkedX = -999;
    for (const bIdx of breakthroughPoints) {
      if (bIdx >= startIdx && bIdx < n) {
        const bx = X(bIdx);
        if (bx - lastMarkedX >= minPixelGap) {
          lastMarkedX = bx;
          const by = Y(peakEnvelope[bIdx]);
          ctx.beginPath();
          ctx.arc(bx, by, 4.5, 0, Math.PI * 2);
          ctx.fillStyle = 'rgba(250, 204, 21, 0.28)';
          ctx.fill();
          ctx.beginPath();
          ctx.arc(bx, by, 2.2, 0, Math.PI * 2);
          ctx.fillStyle = '#facc15';
          ctx.fill();
        }
      }
    }

    // Hover or Last
    const isHoverActive = this.hoverIdx !== null && this.hoverIdx >= startIdx && this.hoverIdx < n;
    const activeIdx = isHoverActive ? this.hoverIdx : n - 1;
    const r = this.history[activeIdx];
    const hx = X(activeIdx);
    const activePeak = peakEnvelope[activeIdx];
    const activeLeadTrend = leadEmaTrend[activeIdx];
    const activePackTrend = packEmaTrend[activeIdx];

    if (isHoverActive) {
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, pad.t);
      ctx.lineTo(hx, pad.t + ph);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(hx, Y(activePeak), 3.8, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(hx, Y(activeLeadTrend), 3.2, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(hx, Y(activePackTrend), 3.2, 0, Math.PI * 2);
      ctx.fill();

      this.drawFitnessTooltip(ctx, r, hx, w, h, pad, activePeak, activeLeadTrend, activePackTrend, isBreakthrough[activeIdx]);
    } else {
      const lx = X(n - 1);
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(lx, Y(peakEnvelope[n - 1]), 3.5, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(lx, Y(leadEmaTrend[n - 1]), 3.0, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = '#34d399';
      ctx.beginPath();
      ctx.arc(lx, Y(packEmaTrend[n - 1]), 3.0, 0, Math.PI * 2);
      ctx.fill();
    }

    const curPeak = peakEnvelope[n - 1] || 0;
    const curLeadEma = leadEmaTrend[n - 1] || 0;
    const curPackEma = packEmaTrend[n - 1] || 0;
    const depthPct = curLeadEma > 0 ? Math.round((curPackEma / curLeadEma) * 100) : 0;
    const windowBreakthroughs = breakthroughPoints.filter(idx => idx >= startIdx).length;

    this.updateKpiStrip([
      { label: 'PEAK', val: compact(curPeak), cls: 'white', dot: '#ffffff' },
      { label: 'LEAD', val: compact(curLeadEma), cls: 'cyan', dot: '#38bdf8' },
      { label: 'DEPTH', val: `${depthPct}%`, cls: 'green', dot: '#34d399' },
      { label: 'BREAKTHROUGHS', val: `${windowBreakthroughs}`, cls: 'gold' }
    ]);
  }

  // -------------------------------------------------------------
  // Tooltip Renderers
  // -------------------------------------------------------------
  drawLapTooltip(ctx, r, lr, hx, w, h, pad, isRecordBreak, slowestPace = 999) {
    const boxW = 236;
    const boxH = 94;
    let boxX = hx + 12;
    if (boxX + boxW > w - 10) boxX = hx - boxW - 12;
    if (boxX < 10) boxX = 10;
    const boxY = Math.max(8, Math.min(h - boxH - 8, pad.t + 2));

    ctx.save();
    ctx.fillStyle = 'rgba(11, 16, 28, 0.96)';
    ctx.strokeStyle = isRecordBreak ? 'rgba(250, 204, 21, 0.7)' : 'rgba(56, 189, 248, 0.35)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.75)';
    ctx.shadowBlur = 14;

    const radius = 6;
    ctx.beginPath();
    ctx.moveTo(boxX + radius, boxY);
    ctx.lineTo(boxX + boxW - radius, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
    ctx.lineTo(boxX + boxW, boxY + boxH - radius);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
    ctx.lineTo(boxX + radius, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
    ctx.lineTo(boxX, boxY + radius);
    ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.fillStyle = isRecordBreak ? '#facc15' : '#ffffff';
    const tag = isRecordBreak ? ' ★ RECORD BREAKTHROUGH' : '';
    ctx.fillText(`Generation ${r.generation}${tag}`, boxX + 10, boxY + 13);

    ctx.font = '9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffffff';
    const recStr = lr.recordLap ? `${lr.recordLap.toFixed(2)}s` : '–';
    ctx.fillText(`All-Time Record: ${recStr}`, boxX + 10, boxY + 29);

    const isIncident = lr.bestLap && lr.bestLap > slowestPace;
    ctx.fillStyle = isIncident ? '#f43f5e' : '#38bdf8';
    const bestStr = lr.bestLap ? `${lr.bestLap.toFixed(2)}s` : '–';
    const incidentTag = isIncident ? ' (Incident / Off-track)' : (lr.bestLap && lr.recordLap ? ` (+${(lr.bestLap - lr.recordLap).toFixed(2)}s)` : '');
    ctx.fillText(`Gen Best Lap: ${bestStr}${incidentTag}`, boxX + 10, boxY + 45);

    ctx.fillStyle = '#34d399';
    const avgStr = lr.avgLap ? `${lr.avgLap.toFixed(2)}s` : '–';
    const gapStr = (lr.avgLap && lr.bestLap) ? ` · Gap: +${(lr.avgLap - lr.bestLap).toFixed(2)}s` : '';
    ctx.fillText(`Pack Avg Lap: ${avgStr}${gapStr}`, boxX + 10, boxY + 61);

    ctx.fillStyle = '#cbd5e1';
    const pop = r.population || 20;
    const fin = r.finishers || 0;
    const pct = Math.round((fin / pop) * 100);
    ctx.fillText(`Grid Survival: ${fin}/${pop} (${pct}%)`, boxX + 10, boxY + 77);

    ctx.restore();
  }

  drawSpeedTooltip(ctx, r, curTop, curApex, hx, w, h, pad) {
    const boxW = 214;
    const boxH = 82;
    let boxX = hx + 12;
    if (boxX + boxW > w - 10) boxX = hx - boxW - 12;
    if (boxX < 10) boxX = 10;
    const boxY = Math.max(8, Math.min(h - boxH - 8, pad.t + 2));

    ctx.save();
    ctx.fillStyle = 'rgba(15, 18, 26, 0.96)';
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 14;

    const radius = 6;
    ctx.beginPath();
    ctx.moveTo(boxX + radius, boxY);
    ctx.lineTo(boxX + boxW - radius, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
    ctx.lineTo(boxX + boxW, boxY + boxH - radius);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
    ctx.lineTo(boxX + radius, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
    ctx.lineTo(boxX, boxY + radius);
    ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Generation ${r.generation}`, boxX + 10, boxY + 13);

    ctx.font = '9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#38bdf8';
    ctx.fillText(`Top Straight Speed: ${curTop} km/h`, boxX + 10, boxY + 31);

    ctx.fillStyle = '#34d399';
    ctx.fillText(`Apex Min Velocity: ${curApex} km/h`, boxX + 10, boxY + 49);

    ctx.fillStyle = '#94a3b8';
    const bestLapStr = r.bestLap && Number.isFinite(r.bestLap) && r.bestLap < 999 ? fmtLap(r.bestLap) : '–';
    ctx.fillText(`Lap Time: ${bestLapStr}`, boxX + 10, boxY + 67);

    ctx.restore();
  }

  drawSurvivalTooltip(ctx, r, curFin, curPop, curPct, hx, w, h, pad) {
    const boxW = 214;
    const boxH = 78;
    let boxX = hx + 12;
    if (boxX + boxW > w - 10) boxX = hx - boxW - 12;
    if (boxX < 10) boxX = 10;
    const boxY = Math.max(8, Math.min(h - boxH - 8, pad.t + 2));

    ctx.save();
    ctx.fillStyle = 'rgba(15, 18, 26, 0.96)';
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.4)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 14;

    const radius = 6;
    ctx.beginPath();
    ctx.moveTo(boxX + radius, boxY);
    ctx.lineTo(boxX + boxW - radius, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
    ctx.lineTo(boxX + boxW, boxY + boxH - radius);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
    ctx.lineTo(boxX + radius, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
    ctx.lineTo(boxX, boxY + radius);
    ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Generation ${r.generation}`, boxX + 10, boxY + 13);

    ctx.font = '9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#34d399';
    ctx.fillText(`Grid Survival: ${curFin}/${curPop} (${curPct}%)`, boxX + 10, boxY + 33);

    ctx.fillStyle = '#94a3b8';
    const crashed = curPop - curFin;
    ctx.fillText(`Casualties: ${crashed} cars eliminated`, boxX + 10, boxY + 53);

    ctx.restore();
  }

  drawFitnessTooltip(ctx, r, hx, w, h, pad, peakVal, leadTrendVal, packTrendVal, isRecordBreak) {
    const boxW = 224;
    const boxH = 92;
    let boxX = hx + 12;
    if (boxX + boxW > w - 10) boxX = hx - boxW - 12;
    if (boxX < 10) boxX = 10;
    const boxY = Math.max(8, Math.min(h - boxH - 8, pad.t + 2));

    ctx.save();
    ctx.fillStyle = 'rgba(15, 18, 26, 0.96)';
    ctx.strokeStyle = isRecordBreak ? 'rgba(250, 204, 21, 0.6)' : 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.7)';
    ctx.shadowBlur = 14;

    const radius = 6;
    ctx.beginPath();
    ctx.moveTo(boxX + radius, boxY);
    ctx.lineTo(boxX + boxW - radius, boxY);
    ctx.quadraticCurveTo(boxX + boxW, boxY, boxX + boxW, boxY + radius);
    ctx.lineTo(boxX + boxW, boxY + boxH - radius);
    ctx.quadraticCurveTo(boxX + boxW, boxY + boxH, boxX + boxW - radius, boxY + boxH);
    ctx.lineTo(boxX + radius, boxY + boxH);
    ctx.quadraticCurveTo(boxX, boxY + boxH, boxX, boxY + boxH - radius);
    ctx.lineTo(boxX, boxY + radius);
    ctx.quadraticCurveTo(boxX, boxY, boxX + radius, boxY);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.shadowBlur = 0;

    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.fillStyle = isRecordBreak ? '#facc15' : '#ffffff';
    const tag = isRecordBreak ? ' ★ RECORD BREAKTHROUGH' : '';
    ctx.fillText(`Generation ${r.generation}${tag}`, boxX + 10, boxY + 13);

    ctx.font = '9.5px "JetBrains Mono", monospace';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`Peak: ${compact(peakVal)}  ·  Lead Pace: ${compact(leadTrendVal)}`, boxX + 10, boxY + 29);

    ctx.fillStyle = '#38bdf8';
    const bestLapStr = r.bestLap && Number.isFinite(r.bestLap) && r.bestLap < 999 ? fmtLap(r.bestLap) : '–';
    ctx.fillText(`Lead Best: ${compact(r.best)}  (${bestLapStr})`, boxX + 10, boxY + 45);

    ctx.fillStyle = '#34d399';
    const medVal = r.median !== undefined ? r.median : r.avg;
    const gapPct = peakVal > 0 && medVal !== undefined ? Math.max(0, Math.round(((peakVal - medVal) / peakVal) * 100)) : 0;
    ctx.fillText(`Pack Core: ${compact(medVal)}  (Gap: ${gapPct}%)`, boxX + 10, boxY + 61);

    ctx.fillStyle = '#cbd5e1';
    const pop = r.population || 20;
    const fin = r.finishers || 0;
    const pct = Math.round((fin / pop) * 100);
    ctx.fillText(`Grid Survival: ${fin}/${pop} (${pct}%)`, boxX + 10, boxY + 77);

    ctx.restore();
  }
}
