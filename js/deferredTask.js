/** Coalesce routine work into one idle callback, with an explicit lifecycle flush. */
export class DeferredTask {
  constructor(run, schedule = (callback) => {
    if (globalThis.requestIdleCallback) {
      const id = requestIdleCallback(callback, { timeout: 1000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(callback, 0);
    return () => clearTimeout(id);
  }) {
    this.run = run;
    this.schedule = schedule;
    this.cancelPending = null;
  }

  request() {
    if (this.cancelPending) return;
    const task = this;
    this.cancelPending = this.schedule(function runDeferredTask() {
      task.cancelPending = null;
      task.run();
    });
  }

  flush() {
    this.cancelPending?.();
    this.cancelPending = null;
    this.run();
  }
}
