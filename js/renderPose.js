const poses = new WeakMap();

// Match the preceding segment's velocity at the start and this segment's
// velocity at the end. Bound the tangent so collisions/stops cannot cause
// overshoot or a backwards excursion between two forward-moving endpoints.
function interpolate(start, end, before, t) {
  const delta = end - start;
  if (!Number.isFinite(before)) return start + delta * t;
  const priorDelta = start - before;
  const tangent = delta === 0 || priorDelta * delta <= 0 ? 0 :
    Math.sign(delta) * Math.min(Math.abs(priorDelta), 3 * Math.abs(delta));
  return start + delta * t + (tangent - delta) * t * (1 - t) * (1 - t);
}

/** A display-only pose between physics ticks; never changes the car's physics state. */
export function getRenderPose(car, alpha = 1) {
  if (!car || !Number.isFinite(car.previousX) || !Number.isFinite(car.previousY) ||
    !Number.isFinite(car.previousAngle)) return car;
  let pose = poses.get(car);
  if (!pose) {
    pose = Object.create(car);
    poses.set(car, pose);
  }
  const t = Math.max(0, Math.min(1, alpha));
  pose.x = interpolate(car.previousX, car.x, car.beforePreviousX, t);
  pose.y = interpolate(car.previousY, car.y, car.beforePreviousY, t);
  const angleDelta = Math.atan2(Math.sin(car.angle - car.previousAngle), Math.cos(car.angle - car.previousAngle));
  const priorAngleDelta = Math.atan2(Math.sin(car.previousAngle - car.beforePreviousAngle),
    Math.cos(car.previousAngle - car.beforePreviousAngle));
  pose.angle = car.previousAngle + interpolate(0, angleDelta, -priorAngleDelta, t);
  return pose;
}
