/** Minimum separating axis for two oriented chassis rectangles; null means no physical contact. */
export function getCarContact(a, b, length, width) {
  const halfLength = length * 0.5, halfWidth = width * 0.5;
  const ac = Math.cos(a.angle), as = Math.sin(a.angle);
  const bc = Math.cos(b.angle), bs = Math.sin(b.angle);
  const dx = b.x - a.x, dy = b.y - a.y;
  let depth = Infinity, nx = 0, ny = 0;
  for (let axis = 0; axis < 4; axis++) {
    const x = axis === 0 ? ac : axis === 1 ? -as : axis === 2 ? bc : -bs;
    const y = axis === 0 ? as : axis === 1 ? ac : axis === 2 ? bs : bc;
    const radiusA = halfLength * Math.abs(ac * x + as * y) + halfWidth * Math.abs(-as * x + ac * y);
    const radiusB = halfLength * Math.abs(bc * x + bs * y) + halfWidth * Math.abs(-bs * x + bc * y);
    const distance = dx * x + dy * y;
    const overlap = radiusA + radiusB - Math.abs(distance);
    if (overlap <= 0) return null;
    if (overlap < depth) {
      depth = overlap;
      const sign = distance < 0 ? -1 : 1;
      nx = x * sign; ny = y * sign;
    }
  }
  return { nx, ny, depth };
}

/** Apply a rigid-body impulse using contact velocity and both bodies' rotational inertia. */
export function resolveCarContact(a, b, contact, { inertia = 72, restitution = 0.45, friction = 0.42, scrub = 0.04,
  bounceThreshold = 15 } = {}) {
  const { nx, ny } = contact;
  const tx = -ny, ty = nx;
  // The midpoint is shared by the two bodies, so impulses conserve angular momentum too.
  const r1x = (b.x - a.x) * 0.5, r1y = (b.y - a.y) * 0.5;
  const r2x = -r1x, r2y = -r1y;
  const w1 = a.yawRate || 0, w2 = b.yawRate || 0;
  const rvx = (b.vx - w2 * r2y) - (a.vx - w1 * r1y);
  const rvy = (b.vy + w2 * r2x) - (a.vy + w1 * r1x);
  const normalVelocity = rvx * nx + rvy * ny;
  if (normalVelocity >= 0) return null;
  const tangentVelocity = rvx * tx + rvy * ty;
  const rn1 = r1x * ny - r1y * nx, rn2 = r2x * ny - r2y * nx;
  const rt1 = r1x * ty - r1y * tx, rt2 = r2x * ty - r2y * tx;
  const normalMass = 2 + (rn1 * rn1 + rn2 * rn2) / inertia;
  const tangentMass = 2 + (rt1 * rt1 + rt2 * rt2) / inertia;
  // Scrub dissipates collision energy through restitution, not by scaling both
  // world velocities. Scaling them brakes the entire convoy at every tiny rub.
  // Gentle sustained contact should settle rather than bouncing every tick.
  const damping = Math.max(0, Math.min(1, scrub));
  const bounce = restitution < 1 && -normalVelocity < bounceThreshold ? 0 : restitution * (1 - damping);
  const normalImpulse = -(1 + bounce) * normalVelocity / normalMass;
  const frictionLimit = normalImpulse * friction;
  // Coupled angular response can make a separate friction solve add energy at oblique contacts.
  // Choose the dissipative tangential impulse after accounting for the normal impulse.
  const coupling = (rn1 * rt1 + rn2 * rt2) / inertia;
  const tangentAfterNormal = tangentVelocity + coupling * normalImpulse;
  const tangentImpulse = Math.max(-frictionLimit, Math.min(frictionLimit, -tangentAfterNormal / tangentMass));
  const jx = nx * normalImpulse + tx * tangentImpulse;
  const jy = ny * normalImpulse + ty * tangentImpulse;
  a.vx -= jx;
  a.vy -= jy;
  b.vx += jx;
  b.vy += jy;
  a.yawRate = w1 - (r1x * jy - r1y * jx) / inertia;
  b.yawRate = w2 + (r2x * jy - r2y * jx) / inertia;
  a.speed = Math.hypot(a.vx, a.vy);
  b.speed = Math.hypot(b.vx, b.vy);
  return { impactSpeed: -normalVelocity + Math.abs(tangentVelocity) * 0.45 };
}
