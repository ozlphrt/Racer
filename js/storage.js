import { NeuralNetwork } from './neuralNetwork.js';

const KEY_BRAIN = 'ai-racer:best-brain:v1';
const KEY_STATE = 'ai-racer:training-state:v2';
const KEY_BACKUP = 'ai-racer:training-state:backup';
const KEY_ANCHOR = 'ai-racer:generation-anchor';
const KEY_GENERATION_REPAIR = 'ai-racer:generation-repair:5000:v1';
const populationSaveCache = new WeakMap();

function pack(best, layers) {
  return {
    version: 1,
    layers: [...layers],
    genome: Array.from(best.genome, (v) => +v.toFixed(5)),
    fitness: best.fitness,
    generation: best.generation,
    bestLap: Number.isFinite(best.bestLap) ? best.bestLap : null,
    savedAt: new Date().toISOString(),
  };
}

function validate(data, layers) {
  if (!data || !Array.isArray(data.genome) || !Array.isArray(data.layers)) {
    throw new Error('Not a valid AI Racer brain file');
  }
  if (data.layers.join() !== layers.join()) {
    throw new Error(`Brain is ${data.layers.join('·')}, expected ${layers.join('·')}`);
  }
  if (data.genome.length !== NeuralNetwork.genomeSize(layers) || data.genome.some((v) => !Number.isFinite(v))) {
    throw new Error('Brain weights are corrupted');
  }
  return { ...data, genome: Float32Array.from(data.genome), bestLap: data.bestLap ?? Infinity };
}

export function saveBrain(best, layers) {
  try {
    localStorage.setItem(KEY_BRAIN, JSON.stringify(pack(best, layers)));
    return true;
  } catch {
    return false;
  }
}

export function loadBrain(layers) {
  try {
    const raw = localStorage.getItem(KEY_BRAIN);
    return raw ? validate(JSON.parse(raw), layers) : null;
  } catch {
    return null;
  }
}

export function saveTrainingState(simState, layers, trackKey = 'grand-prix', isExplicitResetOrOverride = false) {
  try {
    if (!simState || typeof simState.generation !== 'number') return false;

    // Only an actual saved population/brain can protect newer progress.
    // A historical numeric anchor must neither elevate startup nor block saves.
    if (!isExplicitResetOrOverride) {
      const previous = loadTrainingState(layers);
      if (previous && previous.generation > simState.generation) return false;
    }

    // Save all genomes compactly (4 decimal places to stay lean and avoid quota limits)
    // Network weights are immutable during a generation; avoid rounding every weight on each save.
    let cachedPopulation = populationSaveCache.get(simState);
    if (isExplicitResetOrOverride || !cachedPopulation || cachedPopulation.cars !== simState.cars ||
      cachedPopulation.generation !== simState.generation) {
      cachedPopulation = { cars: simState.cars, generation: simState.generation,
        genomes: simState.cars ? simState.cars.map((c) => Array.from(c.brain.genome, (v) => +v.toFixed(4))) : [] };
      populationSaveCache.set(simState, cachedPopulation);
    }
    const currentGenomes = cachedPopulation.genomes;

    // Ensure best brain is always populated (fall back to leader or first car)
    const bestToSave = simState.allTimeBest || (simState.leader ? {
      genome: simState.leader.brain.genome,
      fitness: simState.leader.fitness,
      generation: simState.generation,
      bestLap: simState.leader.bestLap,
    } : null);

    const payload = {
      version: 4,
      populationGeneration: simState.generation,
      capturedPresets: simState.capturedPresets || [],
      captureEnabled: simState.captureEnabled === true,
      generation: simState.generation,
      history: (simState.history || []).slice(-200),
      bestLapEver: Number.isFinite(simState.bestLapEver) ? simState.bestLapEver : null,
      recordLapTelemetry: (simState.isRealCarTelemetry && Array.isArray(simState.recordLapTelemetry))
        ? simState.recordLapTelemetry.map((s) => ({
            t: +s.t.toFixed(3),
            x: +s.x.toFixed(1),
            y: +s.y.toFixed(1),
            angle: +s.angle.toFixed(3),
            speed: +s.speed.toFixed(1),
          }))
        : null,
      isRealCarTelemetry: Boolean(simState.isRealCarTelemetry),
      allTimeBest: bestToSave ? pack(bestToSave, layers) : null,
      lastRaceChampion: simState.lastRaceChampion || null,
      currentGenomes,
      mutationRate: typeof simState.mutationRate === 'number' ? simState.mutationRate : null,
      trackPreset: trackKey,
      savedAt: new Date().toISOString(),
    };

    const jsonStr = JSON.stringify(payload);
    localStorage.setItem(KEY_STATE, jsonStr);
    localStorage.setItem(KEY_BACKUP, jsonStr);
    localStorage.setItem(KEY_ANCHOR, String(simState.generation));

    if (bestToSave) {
      saveBrain(bestToSave, layers);
    }
    return true;
  } catch (err) {
    console.warn('Failed to save training state to localStorage:', err);
    return false;
  }
}

export function loadTrainingState(layers) {
  const keys = [KEY_STATE, KEY_BACKUP, 'ai-racer:training-state:v1', 'ai-racer:training-state'];
  const candidates = [];
  const size = NeuralNetwork.genomeSize(layers);
  for (const key of keys) {
    try {
      const data = JSON.parse(localStorage.getItem(key) || 'null');
      if (!data || !Number.isSafeInteger(data.generation) || data.generation < 1) continue;
      const allTimeBest = data.allTimeBest ? validate(data.allTimeBest, layers) : null;
      if (data.currentGenomes != null && (!Array.isArray(data.currentGenomes) ||
          data.currentGenomes.some(g => !Array.isArray(g) || g.length !== size || !g.every(Number.isFinite)))) continue;
      const currentGenomes = data.currentGenomes?.length ? data.currentGenomes.map(g => Float32Array.from(g)) : null;
      if (!currentGenomes && !allTimeBest) continue;
      let generation = currentGenomes ? data.generation : allTimeBest.generation;
      if (currentGenomes && data.version >= 4) {
        if (!Number.isSafeInteger(data.populationGeneration) || data.populationGeneration !== data.generation) continue;
        generation = data.populationGeneration;
      }
      // Old loaders could copy a stale anchor onto an unrelated population.
      // Repair only when the completed history proves the next generation and
      // that obsolete anchor exactly matches the inflated number. Never infer
      // a lower generation from an old champion's fitness/genome alone.
      const last = Array.isArray(data.history) ? data.history.at(-1) : null;
      const oldAnchor = Number(localStorage.getItem(KEY_ANCHOR));
      if (currentGenomes && !(data.version >= 4) && oldAnchor === generation &&
          Number.isSafeInteger(last?.generation) && last.generation > 0 && last.generation + 1 < generation) {
        generation = last.generation + 1;
      }
      if (!Number.isSafeInteger(generation) || generation < 1) continue;
      let lastRaceChampion = null;
      if (data.lastRaceChampion) {
        try { lastRaceChampion = validate({ ...data.lastRaceChampion, layers }, layers); } catch {}
      }
      const bestLapEver = Number.isFinite(data.bestLapEver) && data.bestLapEver > 0 ? data.bestLapEver : Infinity;
      const real = Boolean(data.isRealCarTelemetry && Array.isArray(data.recordLapTelemetry) &&
        data.recordLapTelemetry.length > 10 && Number.isFinite(bestLapEver));
      candidates.push({ generation, currentGenomes, allTimeBest, lastRaceChampion,
        capturedPresets: Array.isArray(data.capturedPresets) ? data.capturedPresets : [],
        captureEnabled: data.captureEnabled === true,
        history: Array.isArray(data.history) ? data.history : [], bestLapEver,
        recordLapTelemetry: real ? data.recordLapTelemetry : null, isRealCarTelemetry: real,
        mutationRate: typeof data.mutationRate === 'number' ? data.mutationRate : null,
        trackPreset: data.trackPreset || 'grand-prix', savedAt: data.savedAt || null });
    } catch { /* Invalid primary data must not hide intact backups. */ }
  }
  // Prefer the newest intact snapshot, not the largest historical counter.
  candidates.sort((a, b) => (Date.parse(b.savedAt) || 0) - (Date.parse(a.savedAt) || 0));
  if (candidates.length) return candidates[0];
  const legacy = loadBrain(layers);
  if (!legacy || !Number.isSafeInteger(legacy.generation) || legacy.generation < 1) return null;
  return { generation: legacy.generation, currentGenomes: null, allTimeBest: legacy,
    history: [], bestLapEver: legacy.bestLap, lastRaceChampion: null,
    recordLapTelemetry: null, isRealCarTelemetry: false, capturedPresets: [], captureEnabled: false,
    mutationRate: null, trackPreset: 'grand-prix', savedAt: legacy.savedAt || null };
}

/** Explicit, one-time counter repair. Keep weights; archive every original save. */
export function repairGenerationCounter(layers, generation = 5000) {
  if (generation !== 5000) throw new Error('This recovery only restarts counting from Gen 5000');
  const receipt = JSON.parse(localStorage.getItem(KEY_GENERATION_REPAIR) || 'null');
  if (receipt?.applied) return { applied: false, alreadyApplied: true };
  const state = loadTrainingState(layers);
  const keys = [KEY_STATE, KEY_BACKUP, KEY_BRAIN, KEY_ANCHOR,
    'ai-racer:training-state:v1', 'ai-racer:training-state'];
  // This archive is separate from rotating autosave backups. If quota prevents
  // it being written, abort before touching the active population or counter.
  const archive = receipt || { from: state?.generation ?? null, to: generation, applied: false,
    savedAt: new Date().toISOString(), originals: Object.fromEntries(keys.map(k => [k, localStorage.getItem(k)])) };
  localStorage.setItem(KEY_GENERATION_REPAIR, JSON.stringify(archive));
  if (!state) {
    localStorage.setItem(KEY_GENERATION_REPAIR, JSON.stringify({ ...archive, applied: true }));
    return { applied: false, empty: true };
  }
  const genomes = state.currentGenomes || [state.allTimeBest.genome];
  const savedAt = new Date().toISOString();
  const best = state.allTimeBest ? { ...state.allTimeBest, layers: [...layers],
    genome: Array.from(state.allTimeBest.genome), generation, savedAt } : null;
  const repaired = { ...state, version: 4, generation, populationGeneration: generation, savedAt,
    currentGenomes: genomes.map(genome => Array.from(genome)),
    // Keep the historical measurements in the archive, rather than attributing
    // 130K-labelled races to a newly restarted generation sequence.
    history: [], lastRaceChampion: null,
    allTimeBest: best };
  try {
    const json = JSON.stringify(repaired);
    localStorage.setItem(KEY_STATE, json);
    localStorage.setItem(KEY_BACKUP, json);
    localStorage.setItem(KEY_BRAIN, JSON.stringify(best || { layers: [...layers],
      genome: Array.from(genomes[0]), generation, fitness: null, bestLap: null, savedAt }));
    localStorage.setItem(KEY_ANCHOR, String(generation));
    localStorage.setItem(KEY_GENERATION_REPAIR, JSON.stringify({ ...archive, applied: true }));
  } catch (error) {
    // Undo partial writes. The archive remains available even if the browser
    // cannot complete the rollback (for example, storage access is revoked).
    for (const key of keys) {
      try {
        if (archive.originals[key] === null) localStorage.removeItem(key);
        else localStorage.setItem(key, archive.originals[key]);
      } catch {}
    }
    throw error;
  }
  return { applied: true, previousGeneration: state.generation, generation };
}

export function clearTrainingState() {
  localStorage.removeItem(KEY_ANCHOR);
  localStorage.removeItem(KEY_STATE);
  localStorage.removeItem(KEY_BACKUP);
  localStorage.removeItem('ai-racer:training-state:v1');
  localStorage.removeItem('ai-racer:training-state');
  localStorage.removeItem(KEY_BRAIN);
}

export function clearBrain() {
  clearTrainingState();
}

export function buildBrainExport(best, layers, { track, capturedPresets = [] } = {}) {
  return { ...pack(best, layers), track, capturedPresets };
}

export function exportBrain(best, layers, captures = {}) {
  const blob = new Blob([JSON.stringify(buildBrainExport(best, layers, captures), null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `ai-racer-brain-gen${best.generation ?? 'current'}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function importBrainFile(file, layers) {
  let data;
  try {
    data = JSON.parse(await file.text());
  } catch {
    throw new Error('File is not valid JSON');
  }
  return validate(data, layers);
}

export async function loadPretrainedBrain(trackKey = 'grand-prix', layers) {
  try {
    const urls = [`./pretrained-${trackKey}.json`, './pretrained-brain.json'];
    for (const url of urls) {
      try {
        const resp = await fetch(url);
        if (resp && resp.ok) {
          const json = await resp.json();
          return validate(json, layers);
        }
      } catch {}
    }
  } catch {}
  return null;
}

export { validate as validateBrainData };

