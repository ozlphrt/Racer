import { NeuralNetwork } from './neuralNetwork.js';

const KEY_BRAIN = 'ai-racer:best-brain:v1';
const KEY_STATE = 'ai-racer:training-state:v2';
const KEY_BACKUP = 'ai-racer:training-state:backup';
const KEY_ANCHOR = 'ai-racer:generation-anchor';
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

    // Direct atomic anchor write for generation number (instant, zero overhead)
    if (isExplicitResetOrOverride) {
      localStorage.setItem(KEY_ANCHOR, String(simState.generation));
    } else {
      const curAnchor = parseInt(localStorage.getItem(KEY_ANCHOR) || '0', 10);
      if (curAnchor > simState.generation) {
        // Never overwrite higher generation with lower generation unless explicitly instructed
        return false;
      }
      localStorage.setItem(KEY_ANCHOR, String(simState.generation));
    }

    // Protection guard on full state JSON
    if (!isExplicitResetOrOverride) {
      try {
        const raw = localStorage.getItem(KEY_STATE) || localStorage.getItem(KEY_BACKUP);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed && typeof parsed.generation === 'number' && parsed.generation > simState.generation) {
            return false;
          }
        }
      } catch {}
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
      version: 3,
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
      currentGenomes,
      mutationRate: typeof simState.mutationRate === 'number' ? simState.mutationRate : null,
      trackPreset: trackKey,
      savedAt: new Date().toISOString(),
    };

    const jsonStr = JSON.stringify(payload);
    localStorage.setItem(KEY_STATE, jsonStr);
    localStorage.setItem(KEY_BACKUP, jsonStr);

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
  const anchorGen = parseInt(localStorage.getItem(KEY_ANCHOR) || '0', 10);
  const keysToTry = [KEY_STATE, KEY_BACKUP, 'ai-racer:training-state:v1', 'ai-racer:training-state'];
  let raw = null;
  let data = null;

  for (const k of keysToTry) {
    try {
      const val = localStorage.getItem(k);
      if (val && val.length > 10) {
        let candidate;
        try {
          candidate = JSON.parse(val);
        } catch {
          // Only attempt partial recovery after all intact backups have been tried.
          raw ??= val;
          continue;
        }
        if (!candidate || !Number.isInteger(candidate.generation) || candidate.generation < 1) continue;
        if (candidate.allTimeBest) {
          try { validate(candidate.allTimeBest, layers); } catch { continue; }
        }
        if (candidate.currentGenomes != null && (!Array.isArray(candidate.currentGenomes) ||
          candidate.currentGenomes.some((g) => !Array.isArray(g) ||
            g.length !== NeuralNetwork.genomeSize(layers) || g.some((v) => !Number.isFinite(v))))) continue;
        data = candidate;
        raw = val;
        break;
      }
    } catch {}
  }

  const legacy = loadBrain(layers);
  const highestGen = Math.max(1, anchorGen, legacy?.generation || 1);

  if (!raw) {
    if (legacy || anchorGen > 1) {
      return {
        generation: highestGen,
        history: legacy ? [{ generation: legacy.generation, best: legacy.fitness, avg: legacy.fitness * 0.5, bestLap: legacy.bestLap, finishers: 0 }] : [],
        bestLapEver: legacy?.bestLap ?? Infinity,
        allTimeBest: legacy,
        currentGenomes: null,
        mutationRate: null,
        trackPreset: 'grand-prix',
        savedAt: legacy?.savedAt || new Date().toISOString(),
      };
    }
    return null;
  }

  try {
    try {
      data ??= JSON.parse(raw);
    } catch (parseErr) {
      console.warn('Corrupted/truncated JSON in training state, attempting regex rescue:', parseErr);
      const genMatch = raw.match(/"generation"\s*:\s*(\d+)/);
      const lapMatch = raw.match(/"bestLapEver"\s*:\s*([\d.]+)/);
      const trackMatch = raw.match(/"trackPreset"\s*:\s*"([^"]+)"/);
      data = {
        generation: genMatch ? parseInt(genMatch[1], 10) : anchorGen || 1,
        bestLapEver: lapMatch ? parseFloat(lapMatch[1]) : Infinity,
        trackPreset: trackMatch ? trackMatch[1] : 'grand-prix',
        history: [],
        currentGenomes: null,
      };
    }

    let allTimeBest = null;
    if (data.allTimeBest) {
      try {
        allTimeBest = validate(data.allTimeBest, layers);
      } catch (e) {
        console.warn('Could not validate saved all-time best:', e);
      }
    }

    let currentGenomes = null;
    if (Array.isArray(data.currentGenomes) && data.currentGenomes.length > 0) {
      const expectedSize = NeuralNetwork.genomeSize(layers);
      const validGenomes = [];
      for (const g of data.currentGenomes) {
        if (Array.isArray(g) && g.length === expectedSize && g.every(Number.isFinite)) {
          validGenomes.push(Float32Array.from(g));
        }
      }
      if (validGenomes.length > 0) {
        currentGenomes = validGenomes;
      }
    }

    const resolvedGen = Math.max(1, data.generation || 1, anchorGen || 1);

    const loadedBestLap = Number.isFinite(data.bestLapEver) && data.bestLapEver > 0
      ? data.bestLapEver : Infinity;
    const hasRealTelemetry = Boolean(data.isRealCarTelemetry && Array.isArray(data.recordLapTelemetry) && data.recordLapTelemetry.length > 10 && loadedBestLap < Infinity);

    return {
      generation: resolvedGen,
      capturedPresets: Array.isArray(data.capturedPresets) ? data.capturedPresets : [],
      captureEnabled: data.captureEnabled === true,
      history: Array.isArray(data.history) ? data.history : [],
      bestLapEver: loadedBestLap,
      recordLapTelemetry: hasRealTelemetry ? data.recordLapTelemetry : null,
      isRealCarTelemetry: hasRealTelemetry,
      allTimeBest,
      currentGenomes,
      mutationRate: typeof data.mutationRate === 'number' ? data.mutationRate : null,
      trackPreset: data.trackPreset || 'grand-prix',
      savedAt: data.savedAt || new Date().toISOString(),
    };
  } catch (err) {
    console.warn('Failed to load training state from localStorage:', err);
    if (anchorGen > 0) {
      return {
        generation: anchorGen,
        history: [],
        bestLapEver: Infinity,
        allTimeBest: null,
        currentGenomes: null,
        mutationRate: null,
        trackPreset: 'grand-prix',
        savedAt: new Date().toISOString(),
      };
    }
    return null;
  }
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

