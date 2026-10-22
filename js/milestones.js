export const PRESET_MILESTONES = [1, 2, 5, 10, 50, 100, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000, 130000];

// Bump this version when physics, sensors, or track-generation algorithms change.
export function physicsSignature(track, config) {
  return JSON.stringify({ version: 2, dt: config.dt, car: config.car,
    sensors: config.sensors, layers: config.nn.layers, width: track.width,
    centerX: Array.from(track.cx), centerY: Array.from(track.cy) });
}

export function compatibleCaptures(captures, track, config) {
  const signature = physicsSignature(track, config);
  const size = config.nn.layers.slice(1).reduce((sum, n, i) => sum + (config.nn.layers[i] + 1) * n, 0);
  return (Array.isArray(captures) ? captures : []).filter((p) =>
    p?.source === 'organic-training' && p.physicsSignature === signature &&
    PRESET_MILESTONES.includes(p.gen) && p.layers?.join() === config.nn.layers.join() &&
    Array.isArray(p.genome) && p.genome.length === size && p.genome.every(Number.isFinite) &&
    Number.isFinite(p.fitness) && Number.isFinite(p.topSpeed) && Number.isFinite(p.laps) &&
    Number.isFinite(p.raceLaps) && p.raceLaps > 0 &&
    (p.bestLap === null || (Number.isFinite(p.bestLap) && p.bestLap > 0)));
}

/** Bundled checkpoints are available without saves; personal captures take precedence. */
export function availableCaptures(bundled, personal, track, config) {
  const byGeneration = new Map();
  for (const preset of compatibleCaptures([...bundled, ...(Array.isArray(personal) ? personal : [])], track, config)) {
    byGeneration.set(preset.gen, preset);
  }
  return [...byGeneration.values()].sort((a, b) => a.gen - b.gen);
}
