// Shared offline-only replay. Full vehicle physics, barriers and retirements.
import { CONFIG } from '../js/config.js';
import { Car } from '../js/car.js';
import { NeuralNetwork } from '../js/neuralNetwork.js';
import { TireBarrierSystem } from '../js/tireBarriers.js';
import { RacingLinePlanner } from './racingLinePlanner.js';

export function evaluatePlanner(track, genome, options, line, slot = 0, seed = 20261020, capture = false, perturbation = null) {
  const brain = options ? new RacingLinePlanner(track, line, options) : new NeuralNetwork(CONFIG.nn.layers, genome);
  const car = new Car(track, brain, slot), barriers = new TireBarrierSystem(track);
  if (perturbation) {
    const { lateral = 0, longitudinal = 0, heading = 0 } = perturbation;
    if (![lateral, longitudinal, heading].every(Number.isFinite)) throw new Error('Finite start perturbations required.');
    car.x += -track.ty[car.idx] * lateral + track.tx[car.idx] * longitudinal;
    car.y += track.tx[car.idx] * lateral + track.ty[car.idx] * longitudinal;
    car.angle += heading;
    car.sense();
  }
  if (options) brain.car = car;
  let assisted = false, hardBrakeSeconds = 0, brakingSeconds = 0, offTrackSeconds = 0, peakSlipDegrees = 0;
  const excursions = [], trace = [];
  let excursion = null;
  const oldRandom = Math.random;
  let replaySeed = (seed ^ Math.imul(slot + 1, 2654435761)) >>> 0;
  Math.random = () => { replaySeed = (Math.imul(replaySeed, 1664525) + 1013904223) >>> 0; return replaySeed / 4294967296; };
  try {
    for (let step = 0; step < Math.ceil(CONFIG.generation.timeLimit / CONFIG.dt) && !car.finished && !car.crashed; step++) {
      const flying = car.laps >= 1;
      car.update(CONFIG.dt);
      if (!car.crashed && !car.finished) barriers.update(CONFIG.dt, [car]);
      car.sense();
      assisted ||= car.runoffRecoveryActive || car.wrongWayRecoveryActive;
      const offTrack = car.isOffTrack(Math.cos(car.angle), Math.sin(car.angle));
      offTrackSeconds += offTrack ? CONFIG.dt : 0;
      if (offTrack) {
        if (!excursion) {
          excursion = { lap: car.laps + 1, time: car.time, progress: car.idx / track.N, x: car.x, y: car.y,
            speed: car.speed, steer: car.steer, pedal: car.throttle, seconds: 0, peakLateral: 0 };
          excursions.push(excursion);
        }
        excursion.seconds += CONFIG.dt;
        excursion.peakLateral = Math.max(excursion.peakLateral, Math.sqrt(track.lateralDistSq(car.x, car.y, car.idx)));
      } else excursion = null;
      if (capture && step % 3 === 0) trace.push({ time: car.time, x: car.x, y: car.y, index: car.idx,
        lap: car.laps + 1, angle: car.angle, speed: car.speed, steer: car.steer, pedal: car.throttle,
        offTrack, slip: car.slipAngle });
      if (flying) {
        hardBrakeSeconds += car.throttle < -0.9 ? CONFIG.dt : 0;
        brakingSeconds += car.throttle < -0.05 ? CONFIG.dt : 0;
        peakSlipDegrees = Math.max(peakSlipDegrees, Math.abs(car.slipAngle) * 180 / Math.PI);
      }
    }
  } finally { Math.random = oldRandom; }
  const flying = car.lapTimes.slice(1);
  return { slot, finished: car.finished, assisted, laps: car.laps,
    outcome: car.finished ? 'finished' : car.crashDiagnostic?.cause || car.deathReason || 'timed-out',
    raceTime: car.time, bestLap: Number.isFinite(car.bestLap) ? car.bestLap : null,
    flyingMean: flying.length ? flying.reduce((a, b) => a + b, 0) / flying.length : null,
    hardBrakeSecondsPerFlyingLap: flying.length ? hardBrakeSeconds / flying.length : null,
    brakingSecondsPerFlyingLap: flying.length ? brakingSeconds / flying.length : null,
    offTrackSeconds, peakSlipDegrees, excursions, ...(capture ? { trace } : {}) };
}
