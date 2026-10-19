/** Accumulate wall time while keeping physics on a fixed timestep. */
export class FixedStepClock {
  constructor(dt, maxSteps = 720) {
    this.dt = dt;
    this.maxSteps = maxSteps;
    this.accumulator = 0;
  }

  reset() {
    this.accumulator = 0;
  }

  get alpha() {
    return this.accumulator / this.dt;
  }

  advance(elapsed, speed, step) {
    // Bound catch-up after a suspended tab or a long frame.
    this.accumulator += Math.max(0, Math.min(0.25, elapsed)) * speed;
    let steps = 0;
    while (this.accumulator + 1e-10 >= this.dt && steps < this.maxSteps) {
      step(this.dt);
      this.accumulator = Math.max(0, this.accumulator - this.dt);
      steps++;
    }
    if (steps === this.maxSteps) this.accumulator %= this.dt;
    return steps;
  }
}
