export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Standard normal sample (Box–Muller). */
export function randn() {
  let u = 0;
  let v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Uniform Catmull-Rom spline point between p1 and p2. */
export function catmullRom(p0, p1, p2, p3, t) {
  const t2 = t * t;
  const t3 = t2 * t;
  const f = (a, b, c, d) =>
    0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
  return { x: f(p0.x, p1.x, p2.x, p3.x), y: f(p0.y, p1.y, p2.y, p3.y) };
}

/**
 * Ray (origin o, unit direction d) vs segment a→b.
 * Returns distance along the ray, or Infinity if no hit.
 */
export function raySegment(ox, oy, dx, dy, ax, ay, bx, by) {
  const ex = bx - ax;
  const ey = by - ay;
  const den = dx * ey - dy * ex;
  if (den === 0) return Infinity;
  const fx = ax - ox;
  const fy = ay - oy;
  const t = (fx * ey - fy * ex) / den;
  if (t < 0) return Infinity;
  const u = (fx * dy - fy * dx) / den;
  return u >= 0 && u <= 1 ? t : Infinity;
}

/** Squared distance from point p to segment a→b. */
export function distPointSegSq(px, py, ax, ay, bx, by) {
  const ex = bx - ax;
  const ey = by - ay;
  const len2 = ex * ex + ey * ey;
  let t = len2 > 0 ? ((px - ax) * ex + (py - ay) * ey) / len2 : 0;
  t = clamp(t, 0, 1);
  const qx = ax + ex * t - px;
  const qy = ay + ey * t - py;
  return qx * qx + qy * qy;
}
