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
 * High-performance interactive FitnessChart supporting:
 * - Best fitness curve & gradient fill (Cyan)
 * - Population Average curve (Purple dashed)
 * - Population Min-Max variance band (Purple translucent ribbon)
 * - Interactive crosshair scrubber & telemetry tooltip (Gen, Min, Max, Avg, Best, Lap Delta, Survival)
 */
export class FitnessChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.history = [];
    this.hoverIdx = null;
    this.onHover = null;

    this.bindEvents();
    this.resize();
  }

  bindEvents() {
    const handleMove = (e) => {
      if (!this.history || this.history.length === 0) return;
      const rect = this.canvas.getBoundingClientRect();
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const x = clientX - rect.left;
      const padL = 40;
      const padR = 10;
      const pw = this.w - padL - padR;
      if (pw <= 0) return;

      const normX = Math.max(0, Math.min(1, (x - padL) / pw));
      const idx = Math.round(normX * (this.history.length - 1));
      if (idx !== this.hoverIdx && idx >= 0 && idx < this.history.length) {
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

  draw(history) {
    this.history = history || [];
    const { ctx, w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 42, r: 14, t: 12, b: 20 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;

    if (this.history.length === 0) {
      ctx.fillStyle = 'rgba(139, 149, 173, 0.6)';
      ctx.font = '12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Chart appears after the first generation', w / 2, h / 2);
      return;
    }

    let maxY = 1;
    for (const r of this.history) {
      const top = Math.max(r.best || 0, r.max || 0);
      if (top > maxY) maxY = top;
    }
    maxY *= 1.12;

    const n = this.history.length;
    const X = (i) => pad.l + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
    const Y = (v) => pad.t + ph * (1 - Math.max(0, v || 0) / maxY);

    // 1. Grid lines & value labels
    ctx.font = '9.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    for (let g = 0; g <= 4; g++) {
      const v = (maxY * g) / 4;
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

    // Gen start/end footer
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Gen ${this.history[0].generation}`, pad.l, h - 5);
    ctx.textAlign = 'right';
    ctx.fillText(`Gen ${this.history[n - 1].generation}`, w - pad.r, h - 5);

    // 2. Population Min-Max Variance Band (Purple translucent ribbon)
    const hasMinMax = this.history.some((r) => r.min !== undefined || r.max !== undefined);
    if (hasMinMax && n > 1) {
      ctx.beginPath();
      // Top boundary of the band (max / best)
      this.history.forEach((r, i) => {
        const val = r.max !== undefined ? r.max : r.best;
        if (i === 0) ctx.moveTo(X(i), Y(val));
        else ctx.lineTo(X(i), Y(val));
      });
      // Bottom boundary of the band in reverse (min)
      for (let i = n - 1; i >= 0; i--) {
        const val = this.history[i].min !== undefined ? this.history[i].min : 0;
        ctx.lineTo(X(i), Y(val));
      }
      ctx.closePath();
      ctx.fillStyle = 'rgba(167, 139, 250, 0.12)';
      ctx.fill();
    }

    // Helper for lines
    const drawCurve = (key) => {
      ctx.beginPath();
      this.history.forEach((r, i) => {
        const y = Y(r[key] || 0);
        if (i === 0) ctx.moveTo(X(i), y);
        else ctx.lineTo(X(i), y);
      });
    };

    // 3. Best Fitness (Cyan): Gradient Area + Solid Stroke
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
    grad.addColorStop(0, 'rgba(34, 211, 238, 0.32)');
    grad.addColorStop(1, 'rgba(34, 211, 238, 0.01)');
    drawCurve('best');
    ctx.lineTo(X(n - 1), Y(0));
    ctx.lineTo(X(0), Y(0));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineJoin = 'round';
    drawCurve('best');
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2.2;
    ctx.stroke();

    // 4. Population Average (Purple): Dashed Stroke
    drawCurve('avg');
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1.8;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // 5. Active Hover Crosshair or Last Points Glow
    const activeIdx = this.hoverIdx !== null ? this.hoverIdx : n - 1;
    const r = this.history[activeIdx];
    const hx = X(activeIdx);

    if (this.hoverIdx !== null) {
      // Draw vertical crosshair guide
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.28)';
      ctx.lineWidth = 1;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(hx, pad.t);
      ctx.lineTo(hx, pad.t + ph);
      ctx.stroke();
      ctx.setLineDash([]);

      // Highlight best dot
      const by = Y(r.best);
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(hx, by, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Highlight avg dot
      const ay = Y(r.avg);
      ctx.fillStyle = '#a78bfa';
      ctx.shadowColor = '#a78bfa';
      ctx.shadowBlur = 8;
      ctx.beginPath();
      ctx.arc(hx, ay, 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      // Render Floating Telemetry Card
      this.drawTooltip(ctx, r, hx, w, h, pad);
    } else {
      // Latest point glow
      const lx = X(n - 1);
      const ly = Y(this.history[n - 1].best);
      ctx.fillStyle = '#22d3ee';
      ctx.shadowColor = '#22d3ee';
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;

      const lay = Y(this.history[n - 1].avg);
      ctx.fillStyle = '#a78bfa';
      ctx.beginPath();
      ctx.arc(lx, lay, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  drawTooltip(ctx, r, hx, w, h, pad) {
    const boxW = 210;
    const boxH = 92;
    let boxX = hx + 12;
    if (boxX + boxW > w - 10) boxX = hx - boxW - 12;
    if (boxX < 10) boxX = 10;
    const boxY = Math.max(10, Math.min(h - boxH - 10, pad.t + 4));

    // Box shadow & background
    ctx.save();
    ctx.fillStyle = 'rgba(10, 15, 28, 0.94)';
    ctx.strokeStyle = 'rgba(167, 139, 250, 0.4)';
    ctx.lineWidth = 1;
    ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
    ctx.shadowBlur = 14;

    // Rounded rectangle
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

    // Tooltip Typography
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';

    // Header: Generation
    ctx.font = 'bold 11px Outfit, sans-serif';
    ctx.fillStyle = '#fff';
    ctx.fillText(`Generation ${r.generation}`, boxX + 10, boxY + 14);

    // Cyan Best info
    ctx.font = '10px "JetBrains Mono", monospace';
    ctx.fillStyle = '#22d3ee';
    const bestLapStr = r.bestLap ? fmtLap(r.bestLap) : '–';
    ctx.fillText(`Best: ${compact(r.best)}  (${bestLapStr})`, boxX + 10, boxY + 31);

    // Purple Avg & Range info
    ctx.fillStyle = '#a78bfa';
    const minStr = r.min !== undefined ? compact(r.min) : '–';
    const maxStr = r.max !== undefined ? compact(r.max) : '–';
    ctx.fillText(`Pop Avg: ${compact(r.avg)} [${minStr}–${maxStr}]`, boxX + 10, boxY + 47);

    // Pace delta vs Avg Lap
    ctx.fillStyle = '#38bdf8';
    const avgLapStr = r.avgLap && Number.isFinite(r.avgLap) ? fmtLap(r.avgLap) : '–';
    const deltaStr = r.lapImprovementPct ? ` (+${r.lapImprovementPct.toFixed(1)}% pace)` : '';
    ctx.fillText(`Avg Lap: ${avgLapStr}${deltaStr}`, boxX + 10, boxY + 63);

    // Survival / Finishers
    ctx.fillStyle = '#34d399';
    const pop = r.population || 20;
    const fin = r.finishers || 0;
    const elim = r.eliminated != null ? r.eliminated : pop - fin;
    const pct = Math.round((fin / pop) * 100);
    ctx.fillText(`Grid: ${fin} Fin / ${elim} Crashed (${pct}%)`, boxX + 10, boxY + 79);

    ctx.restore();
  }
}
