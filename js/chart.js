export const compact = (v) => {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(1) + 'k';
  return v.toFixed(0);
};

/** Best + average fitness per generation (no chart library). */
export class FitnessChart {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.history = [];
    this.resize();
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
    this.history = history;
    const { ctx, w, h } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);

    const pad = { l: 40, r: 10, t: 10, b: 20 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;

    if (history.length === 0) {
      ctx.fillStyle = 'rgba(139, 149, 173, 0.6)';
      ctx.font = '12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('Chart appears after the first generation', w / 2, h / 2);
      return;
    }

    let maxY = 1;
    for (const r of history) maxY = Math.max(maxY, r.best);
    maxY *= 1.1;
    const n = history.length;
    const X = (i) => pad.l + (n === 1 ? pw / 2 : (pw * i) / (n - 1));
    const Y = (v) => pad.t + ph * (1 - v / maxY);

    // Grid
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
      ctx.fillStyle = 'rgba(139, 149, 173, 0.8)';
      ctx.fillText(compact(v), pad.l - 6, y);
    }
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillText(`Gen ${history[0].generation}`, pad.l, h - 5);
    ctx.textAlign = 'right';
    ctx.fillText(`Gen ${history[n - 1].generation}`, w - pad.r, h - 5);

    const line = (key) => {
      ctx.beginPath();
      history.forEach((r, i) => (i ? ctx.lineTo(X(i), Y(r[key])) : ctx.moveTo(X(i), Y(r[key]))));
    };

    // Best: area + line
    const grad = ctx.createLinearGradient(0, pad.t, 0, pad.t + ph);
    grad.addColorStop(0, 'rgba(34, 211, 238, 0.35)');
    grad.addColorStop(1, 'rgba(34, 211, 238, 0)');
    line('best');
    ctx.lineTo(X(n - 1), Y(0));
    ctx.lineTo(X(0), Y(0));
    ctx.closePath();
    ctx.fillStyle = grad;
    ctx.fill();

    ctx.lineJoin = 'round';
    line('best');
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.stroke();

    line('avg');
    ctx.strokeStyle = '#a78bfa';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 3]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Last point
    const lx = X(n - 1);
    const ly = Y(history[n - 1].best);
    ctx.fillStyle = '#22d3ee';
    ctx.shadowColor = '#22d3ee';
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(lx, ly, 3.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}
