import { Track, TRACK_PRESETS } from './track.js';
import { compatibleCaptures } from './milestones.js';

export const DEFAULT_START_GENERATION = 250;

/** Select the startup checkpoint without modifying browser saves or inventing history. */
export function resolveStartupState(localState, config, bundled) {
  const size = config.nn.layers.slice(1).reduce((sum, n, i) => sum + (config.nn.layers[i] + 1) * n, 0);
  const validGenome = g => (Array.isArray(g) || ArrayBuffer.isView(g)) && g.length === size && g.every(Number.isFinite);
  const hasPopulation = Array.isArray(localState?.currentGenomes) && localState.currentGenomes.length > 0 &&
    localState.currentGenomes.every(validGenome);
  const hasBrain = validGenome(localState?.allTimeBest?.genome);
  // Preserve the complete local population, records and settings at the floor
  // too, so refreshing a newly started Gen 5K run does not replace its progress.
  if (localState && Number.isSafeInteger(localState.generation) && localState.generation >= DEFAULT_START_GENERATION &&
      (hasPopulation || hasBrain)) {
    return { state: localState, source: 'local' };
  }
  const trackKey = 'grand-prix';
  const track = new Track(TRACK_PRESETS[trackKey].points, config.track.width, config.track.samples);
  const checkpoint = compatibleCaptures(Object.values(bundled), track, config)
    .find(p => p.gen === DEFAULT_START_GENERATION);
  if (!checkpoint) return { state: localState, source: localState ? 'local' : 'fresh' };
  return {
    source: 'bundled',
    state: {
      generation: checkpoint.gen,
      trackPreset: trackKey,
      currentGenomes: Array.from({ length: config.ga.population }, () => Float32Array.from(checkpoint.genome)),
      allTimeBest: { genome: Float32Array.from(checkpoint.genome), generation: checkpoint.gen,
        fitness: checkpoint.fitness, bestLap: checkpoint.bestLap ?? Infinity },
      // A checkpoint supplies weights, not measured races in this browser.
      history: [], bestLapEver: Infinity, recordLapTelemetry: null, isRealCarTelemetry: false,
      lastRaceChampion: null,
      capturedPresets: compatibleCaptures(localState?.capturedPresets, track, config),
      captureEnabled: true,
      mutationRate: localState?.mutationRate ?? null,
    },
  };
}
