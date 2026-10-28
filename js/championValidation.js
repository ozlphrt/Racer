import { CONFIG } from './config.js';
import { Car } from './car.js';
import { NeuralNetwork } from './neuralNetwork.js';
import { Track, TRACK_PRESETS } from './track.js';
import { TireBarrierSystem } from './tireBarriers.js';
import { physicsSignature } from './milestones.js';
import { inspectCustomTrack } from './customTracks.js';

// Runs in a dedicated worker. Each start uses a fresh car and tire barriers;
// there are no opponents, breeding, record writes, or browser saves.
export async function validateChampion(request, progress = () => {}, yieldTask = () => Promise.resolve()) {
  const { config, genome, trackKey, signature } = request;
  const custom = typeof trackKey === 'string' && trackKey.startsWith('custom-') && request.customTrack;
  const preset = TRACK_PRESETS[trackKey] || (custom && inspectCustomTrack(custom.points, config?.track?.width).valid ? custom : null);
  if (!preset || !Array.isArray(genome) || !genome.every(Number.isFinite) ||
      !config || genome.length !== NeuralNetwork.genomeSize(config.nn.layers) ||
      JSON.stringify(config.sensors.angles) !== JSON.stringify(CONFIG.sensors.angles) ||
      !(config.dt > 0 && config.dt <= 0.1) || !(config.generation.timeLimit > 0 && config.generation.timeLimit <= 3600) ||
      !Number.isInteger(config.generation.maxLaps) || config.generation.maxLaps < 1) throw new Error('Invalid champion test.');
  const track = new Track(preset.points, config.track.width, config.track.samples);
  if (physicsSignature(track, config) !== signature) throw new Error('Track or physics changed. Start a new test.');
  const results = [];
  for (let slot = 0; slot < 20; slot++) {
    const car = new Car(track, new NeuralNetwork(config.nn.layers, genome), slot, config);
    const barriers = new TireBarrierSystem(track), cars = [car];
    let assisted = false;
    for (let step = 0; step < Math.ceil(config.generation.timeLimit / config.dt) && !car.crashed && !car.finished; step++) {
      car.update(config.dt);
      if (!car.crashed && !car.finished) barriers.update(config.dt, cars);
      car.sense();
      assisted ||= car.runoffRecoveryActive || car.wrongWayRecoveryActive;
      if (step % 240 === 239) await yieldTask();
    }
    results.push({ slot, finished: car.finished, assisted, laps: car.laps,
      outcome: car.finished ? 'finished' : car.crashDiagnostic?.cause || car.deathReason || 'timed-out',
      bestLap: Number.isFinite(car.bestLap) ? car.bestLap : null });
    progress({ tested: results.length });
    await yieldTask();
  }
  return { results, tested: results.length, finished: results.filter(r => r.finished).length,
    assisted: results.filter(r => r.assisted).length, laps: config.generation.maxLaps };
}
