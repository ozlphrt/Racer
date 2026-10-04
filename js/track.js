import { catmullRom, distPointSegSq, raySegment } from './math.js';

/** Control points of the closed centerline (world units, ~1600×1000 world). */
export const TRACK_PRESETS = {
  'grand-prix': {
    name: 'Grand Prix (Default)',
    points: [
      { x: 200, y: 500 },
      { x: 260, y: 250 },
      { x: 480, y: 140 },
      { x: 740, y: 190 },
      { x: 860, y: 320 },
      { x: 990, y: 310 },
      { x: 1100, y: 180 },
      { x: 1340, y: 160 },
      { x: 1460, y: 340 },
      { x: 1410, y: 550 },
      { x: 1250, y: 630 },
      { x: 1230, y: 760 },
      { x: 1100, y: 880 },
      { x: 760, y: 860 },
      { x: 560, y: 720 },
      { x: 380, y: 820 },
      { x: 220, y: 720 },
    ],
  },
  'speedway-oval': {
    name: 'Speedway Oval',
    points: [
      { x: 300, y: 300 },
      { x: 700, y: 200 },
      { x: 1100, y: 200 },
      { x: 1400, y: 320 },
      { x: 1450, y: 550 },
      { x: 1350, y: 780 },
      { x: 1050, y: 860 },
      { x: 650, y: 860 },
      { x: 280, y: 760 },
      { x: 180, y: 520 },
    ],
  },
  'technical-complex': {
    name: 'Technical Complex',
    points: [
      { x: 250, y: 500 },
      { x: 350, y: 250 },
      { x: 620, y: 180 },
      { x: 820, y: 300 },
      { x: 1020, y: 200 },
      { x: 1250, y: 200 },
      { x: 1450, y: 380 },
      { x: 1380, y: 580 },
      { x: 1150, y: 620 },
      { x: 960, y: 760 },
      { x: 740, y: 880 },
      { x: 500, y: 850 },
      { x: 240, y: 720 },
    ],
  },
  'simple-loop': {
    name: 'Simple Peanut Loop',
    points: [
      { x: 300, y: 500 },
      { x: 400, y: 250 },
      { x: 800, y: 350 },
      { x: 1200, y: 220 },
      { x: 1350, y: 500 },
      { x: 1200, y: 780 },
      { x: 800, y: 650 },
      { x: 400, y: 750 },
    ],
  },
};

export const TRACK_POINTS = TRACK_PRESETS['grand-prix'].points;


/**
 * A closed track built from a Catmull-Rom centerline resampled to evenly spaced points.
 * Walls are the centerline offset by ±width/2 along the normal.
 */
export class Track {
  constructor(controlPoints, width, samples) {
    this.width = width;
    this.half = width / 2;
    this.N = samples;

    // 1. Dense spline sampling
    const dense = [];
    const n = controlPoints.length;
    const per = 64;
    for (let i = 0; i < n; i++) {
      const p0 = controlPoints[(i - 1 + n) % n];
      const p1 = controlPoints[i];
      const p2 = controlPoints[(i + 1) % n];
      const p3 = controlPoints[(i + 2) % n];
      for (let s = 0; s < per; s++) dense.push(catmullRom(p0, p1, p2, p3, s / per));
    }

    // 2. Cumulative arc length (closed)
    const m = dense.length;
    const cum = new Float64Array(m + 1);
    for (let i = 1; i <= m; i++) {
      const a = dense[i - 1];
      const b = dense[i % m];
      cum[i] = cum[i - 1] + Math.hypot(b.x - a.x, b.y - a.y);
    }
    this.length = cum[m];
    this.spacing = this.length / samples;

    // 3. Resample at uniform arc length
    this.cx = new Float32Array(samples);
    this.cy = new Float32Array(samples);
    let j = 0;
    for (let k = 0; k < samples; k++) {
      const target = k * this.spacing;
      while (j < m - 1 && cum[j + 1] < target) j++;
      const a = dense[j];
      const b = dense[(j + 1) % m];
      const t = (target - cum[j]) / (cum[j + 1] - cum[j] || 1);
      this.cx[k] = a.x + (b.x - a.x) * t;
      this.cy[k] = a.y + (b.y - a.y) * t;
    }

    // 4. Tangents, normals, walls, curvature
    this.tx = new Float32Array(samples);
    this.ty = new Float32Array(samples);
    this.ix = new Float32Array(samples);
    this.iy = new Float32Array(samples);
    this.ox = new Float32Array(samples);
    this.oy = new Float32Array(samples);
    for (let k = 0; k < samples; k++) {
      const p = this.wrap(k - 1);
      const q = this.wrap(k + 1);
      let tx = this.cx[q] - this.cx[p];
      let ty = this.cy[q] - this.cy[p];
      const len = Math.hypot(tx, ty) || 1;
      tx /= len;
      ty /= len;
      this.tx[k] = tx;
      this.ty[k] = ty;
      const nx = -ty;
      const ny = tx;
      this.ix[k] = this.cx[k] + nx * this.half;
      this.iy[k] = this.cy[k] + ny * this.half;
      this.ox[k] = this.cx[k] - nx * this.half;
      this.oy[k] = this.cy[k] - ny * this.half;
    }

    // Signed heading change per sample (used for kerbs + diagnostics)
    this.curvature = new Float32Array(samples);
    for (let k = 0; k < samples; k++) {
      const p = this.wrap(k - 1);
      const q = this.wrap(k + 1);
      const cross = this.tx[p] * this.ty[q] - this.ty[p] * this.tx[q];
      const dot = this.tx[p] * this.tx[q] + this.ty[p] * this.ty[q];
      this.curvature[k] = Math.atan2(cross, dot) / (2 * this.spacing); // rad per unit length
    }

    this.heading0 = Math.atan2(this.ty[0], this.tx[0]);

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const [xs, ys] of [
      [this.ix, this.iy],
      [this.ox, this.oy],
    ]) {
      for (let k = 0; k < samples; k++) {
        minX = Math.min(minX, xs[k]);
        maxX = Math.max(maxX, xs[k]);
        minY = Math.min(minY, ys[k]);
        maxY = Math.max(maxY, ys[k]);
      }
    }
    this.bounds = {
      minX,
      minY,
      maxX,
      maxY,
      w: maxX - minX,
      h: maxY - minY,
      cx: (minX + maxX) / 2,
      cy: (minY + maxY) / 2,
    };
  }

  wrap(i) {
    const N = this.N;
    return ((i % N) + N) % N;
  }

  /** Nearest centerline index, searched locally around `hint` (O(1)). */
  nearestIndex(x, y, hint, back = 4, fwd = 16) {
    let best = hint;
    let bestD = Infinity;
    for (let o = -back; o <= fwd; o++) {
      const i = this.wrap(hint + o);
      const dx = this.cx[i] - x;
      const dy = this.cy[i] - y;
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = i;
      }
    }
    return best;
  }

  /** Squared distance from (x,y) to the centerline polyline near idx. */
  lateralDistSq(x, y, idx) {
    let best = Infinity;
    for (let o = -3; o <= 2; o++) {
      const i = this.wrap(idx + o);
      const j = i + 1 === this.N ? 0 : i + 1;
      const d = distPointSegSq(x, y, this.cx[i], this.cy[i], this.cx[j], this.cy[j]);
      if (d < best) best = d;
    }
    return best;
  }

  /** Distance along a unit ray to the nearest wall segment within ±win samples of idx. */
  castRay(x, y, dx, dy, maxLen, idx, win) {
    let best = maxLen;
    const N = this.N;
    const ix = this.ix;
    const iy = this.iy;
    const ox = this.ox;
    const oy = this.oy;

    const start = idx - win;
    const end = idx + win;

    for (let o = start; o <= end; o++) {
      let i = o % N;
      if (i < 0) i += N;
      const j = i + 1 === N ? 0 : i + 1;

      // 1. Inner wall segment
      const ax1 = ix[i], ay1 = iy[i];
      const bx1 = ix[j], by1 = iy[j];
      const ex1 = bx1 - ax1, ey1 = by1 - ay1;
      const den1 = dx * ey1 - dy * ex1;
      if (den1 !== 0) {
        const fx1 = ax1 - x, fy1 = ay1 - y;
        const t1 = (fx1 * ey1 - fy1 * ex1) / den1;
        if (t1 >= 0 && t1 < best) {
          const u1 = (fx1 * dy - fy1 * dx) / den1;
          if (u1 >= 0 && u1 <= 1) best = t1;
        }
      }

      // 2. Outer wall segment
      const ax2 = ox[i], ay2 = oy[i];
      const bx2 = ox[j], by2 = oy[j];
      const ex2 = bx2 - ax2, ey2 = by2 - ay2;
      const den2 = dx * ey2 - dy * ex2;
      if (den2 !== 0) {
        const fx2 = ax2 - x, fy2 = ay2 - y;
        const t2 = (fx2 * ey2 - fy2 * ex2) / den2;
        if (t2 >= 0 && t2 < best) {
          const u2 = (fx2 * dy - fy2 * dx) / den2;
          if (u2 >= 0 && u2 <= 1) best = t2;
        }
      }
    }
    return best;
  }
}
