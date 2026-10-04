/** Live drawing of a network: edges colored by weight sign, brightness by |weight| × source activation. */
export class NetworkViz {
  constructor(canvas, layers, inLabels, outLabels) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.layers = layers;
    this.inLabels = inLabels;
    this.outLabels = outLabels;
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(1, rect.width);
    this.h = Math.max(1, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
  }

  draw(net) {
    const { ctx, w, h, layers } = this;
    ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    if (!net) {
      ctx.fillStyle = 'rgba(139, 149, 173, 0.6)';
      ctx.font = '12px Outfit, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Waiting for a living car…', w / 2, h / 2);
      return;
    }

    const padL = 38;
    const padR = 78;
    const padY = 12;
    const nL = layers.length;
    const pos = layers.map((n, l) => {
      const x = padL + ((w - padL - padR) * l) / (nL - 1);
      return Array.from({ length: n }, (_, i) => [x, n === 1 ? h / 2 : padY + ((h - 2 * padY) * (i + 0.5)) / n]);
    });
    const act = net.activations;

    // Edges
    for (let l = 0; l < nL - 1; l++) {
      for (let j = 0; j < layers[l + 1]; j++) {
        const [x2, y2] = pos[l + 1][j];
        for (let i = 0; i < layers[l]; i++) {
          const wgt = net.weight(l, i, j);
          const strength = Math.min(1, Math.abs(wgt) / 2.5);
          const alpha = 0.03 + 0.55 * strength * (0.25 + 0.75 * Math.abs(act[l][i]));
          ctx.strokeStyle = wgt > 0 ? `rgba(34, 211, 238, ${alpha})` : `rgba(244, 114, 182, ${alpha})`;
          ctx.lineWidth = 0.5 + strength * 1.6;
          const [x1, y1] = pos[l][i];
          ctx.beginPath();
          ctx.moveTo(x1, y1);
          ctx.lineTo(x2, y2);
          ctx.stroke();
        }
      }
    }

    // Nodes
    for (let l = 0; l < nL; l++) {
      const edge = l === 0 || l === nL - 1;
      const r = edge ? 5.5 : 4.5;
      for (let i = 0; i < layers[l]; i++) {
        const [x, y] = pos[l][i];
        const a = act[l][i];
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = '#0a0f1f';
        ctx.fill();
        ctx.fillStyle = a >= 0 ? `rgba(34, 211, 238, ${Math.abs(a)})` : `rgba(244, 114, 182, ${Math.abs(a)})`;
        ctx.shadowColor = ctx.fillStyle;
        ctx.shadowBlur = Math.abs(a) > 0.6 ? 10 : 0;
        ctx.fill();
        ctx.shadowBlur = 0;
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(226, 232, 240, 0.25)';
        ctx.stroke();
      }
    }

    // Labels
    ctx.font = '9.5px "JetBrains Mono", monospace';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(139, 149, 173, 0.9)';
    pos[0].forEach(([x, y], i) => ctx.fillText(this.inLabels[i] ?? '', x - 10, y));
    ctx.textAlign = 'left';
    pos[nL - 1].forEach(([x, y], i) => {
      const v = act[nL - 1][i];
      ctx.fillStyle = 'rgba(226, 232, 240, 0.9)';
      ctx.fillText(this.outLabels[i] ?? '', x + 10, y - 6);
      ctx.fillStyle = v >= 0 ? '#22d3ee' : '#f472b6';
      ctx.fillText((v >= 0 ? '+' : '') + v.toFixed(2), x + 10, y + 7);
    });
  }
}
