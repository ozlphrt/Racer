// External camera headings ease independently of chassis steering. Integrating
// in small time steps keeps acceleration and turn speed consistent at low FPS.
export function smoothCameraHeading(state, target, dt) {
  const elapsed = Math.max(0, Math.min(0.1, dt));
  const steps = Math.max(1, Math.ceil(elapsed / (1 / 240)));
  const step = elapsed / steps;
  for (let i = 0; i < steps; i++) {
    const error = Math.atan2(Math.sin(target - state.angle), Math.cos(target - state.angle));
    const desiredSpeed = Math.max(-0.65, Math.min(0.65, error * 1.8));
    state.speed += Math.max(-0.9 * step, Math.min(0.9 * step, desiredSpeed - state.speed));
    const movement = state.speed * step;
    if (movement * error >= 0 && Math.abs(movement) >= Math.abs(error)) {
      state.angle += error;
      state.speed = 0;
    } else {
      state.angle += movement;
    }
  }
  return state.angle;
}
