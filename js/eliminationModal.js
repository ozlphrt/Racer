export class EliminationModalManager {
  constructor(containerEl, { onSelectCar = null, onRestart = null } = {}) {
    this.container = containerEl;
    this.onSelectCar = onSelectCar;
    this.onRestart = onRestart;
    this.activeModals = new Map();
    this.maxConcurrent = 2;
  }

  show(car, sim, reason = 'crash') {
    if (!this.container || !car) return;

    if (this.activeModals.has(car)) return;

    if (this.activeModals.size >= this.maxConcurrent) {
      const oldestCar = this.activeModals.keys().next().value;
      if (oldestCar) this.dismiss(oldestCar);
    }

    const isPlayer = car === sim.player || car.manual;
    const carIdx = (sim.cars && sim.cars.indexOf(car) >= 0) ? sim.cars.indexOf(car) : (car.idx ?? 0);
    const carNum = isPlayer ? 'YOU' : `CAR #${carIdx + 1}`;

    let reasonText = 'OUT OF TRACK';
    if (reason === 'stalled') reasonText = 'STALLED';
    else if (reason === 'wrong way') reasonText = 'WRONG WAY';

    const modal = document.createElement('div');
    modal.className = `elimination-modal glass ${isPlayer ? 'is-player-eliminated' : ''}`;
    modal.setAttribute('role', 'alert');

    modal.innerHTML = `
      <span class="elim-tag">ELIMINATED</span>
      <span class="elim-car-num">${carNum}</span>
      <span class="elim-sep">•</span>
      <span class="elim-reason">${reasonText}</span>
    `;

    modal.addEventListener('click', () => {
      if (isPlayer) {
        if (this.onRestart) this.onRestart();
      } else if (this.onSelectCar) {
        this.onSelectCar(car);
      }
    });

    this.container.appendChild(modal);
    this.activeModals.set(car, modal);

    requestAnimationFrame(() => {
      modal.classList.add('is-visible');
    });

    const timeoutId = setTimeout(() => {
      this.dismiss(car);
    }, 2800);

    modal._dismissTimeout = timeoutId;
  }

  dismiss(car) {
    const modal = this.activeModals.get(car);
    if (!modal) return;

    clearTimeout(modal._dismissTimeout);
    this.activeModals.delete(car);

    modal.classList.remove('is-visible');
    modal.classList.add('is-exiting');

    setTimeout(() => {
      modal.remove();
    }, 240);
  }

  clear() {
    this.activeModals.forEach((modal) => {
      clearTimeout(modal._dismissTimeout);
      modal.remove();
    });
    this.activeModals.clear();
  }
}
