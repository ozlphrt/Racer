/** Restart a class animation across paint frames without synchronously flushing layout. */
export class ClassAnimationScheduler {
  constructor(schedule = callback => requestAnimationFrame(callback), cancel = id => cancelAnimationFrame(id)) {
    this.schedule = schedule;
    this.cancel = cancel;
    this.pending = new WeakMap();
  }

  restart(element, activeClass, classes = [activeClass]) {
    if (!element) return;
    const previous = this.pending.get(element);
    if (previous !== undefined) this.cancel(previous);
    element.classList.remove(...classes);
    this.pending.set(element, this.schedule(() => {
      this.pending.delete(element);
      element.classList.add(activeClass);
    }));
  }
}
