import { CONFIG } from './config.js';
import { Car } from './car.js';
import { TireBarrierSystem } from './tireBarriers.js';
import { makeRacingLine, RacingLinePlanner } from './racingLinePlanner.js';

/** Experimental non-contact field. No genetics, storage or training records. */
export class PlannerRace {
  constructor(track, options, lineOptions, population = 20) {
    if (CONFIG.collision.enabled) throw new Error('Planner races currently support non-contact driving only.');
    if (!Number.isInteger(population) || population < 1 || population > 20) throw new Error('Use one to twenty cars.');
    this.track = track;
    this.options = { ...options };
    this.line = makeRacingLine(track, lineOptions.iterations, lineOptions.margin);
    this.population = population;
    this.generation = 0;
    this.restart();
  }
  restart() {
    this.generation++;
    this.time = 0;
    this.complete = false;
    this.player = null;
    this.deathEvents = [];
    this.checkeredFlagTimer = null;
    this.raceBestLap = Infinity;
    this.bestLapEver = Infinity;
    this.raceGhostLap = Infinity;
    this.tireBarriers = new TireBarrierSystem(this.track);
    this.cars = Array.from({ length: this.population }, (_, slot) => {
      const brain = new RacingLinePlanner(this.track, this.line, this.options);
      const car = new Car(this.track, brain, slot);
      brain.car = car;
      car.carIndex = slot;
      car.carNumber = slot + 1;
      car.teamIdx = Math.floor(slot / 2);
      car.plannerRunoffSeconds = 0;
      car.plannerAssisted = false;
      car.onLapComplete = (_, duration) => { if (duration > 0) this.raceBestLap = Math.min(this.raceBestLap, duration); };
      return car;
    });
  }
  get leader() {
    return [...this.cars].filter(c => !c.crashed && (c.alive || c.finished)).sort((a, b) => Number(b.finished) - Number(a.finished) ||
      (a.finished && b.finished ? a.finishTime - b.finishTime : b.maxIdx - a.maxIdx))[0];
  }
  step(dt = CONFIG.dt) {
    if (this.complete) return;
    for (const car of this.cars) {
      if (car.finished || car.crashed || !car.alive) continue;
      car.beforePreviousX = car.previousX; car.beforePreviousY = car.previousY; car.beforePreviousAngle = car.previousAngle;
      car.previousX = car.x; car.previousY = car.y; car.previousAngle = car.angle;
      car.update(dt);
      if (car.isOffTrack(Math.cos(car.angle), Math.sin(car.angle))) car.plannerRunoffSeconds += dt;
      car.plannerAssisted ||= car.runoffRecoveryActive || car.wrongWayRecoveryActive;
    }
    this.tireBarriers.update(dt, this.cars.filter(c => !c.finished && !c.crashed));
    for (const car of this.cars) car.sense();
    this.time += dt;
    this.complete = this.time >= CONFIG.generation.timeLimit || this.cars.every(c => c.finished || c.crashed || !c.alive);
  }
}
