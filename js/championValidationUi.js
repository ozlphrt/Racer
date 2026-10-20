import { CONFIG } from './config.js';
import { TRACK_PRESETS } from './track.js';
import { physicsSignature } from './milestones.js';

export function createChampionValidationPanel(sim, getTrackKey, getLaps) {
  const button = document.getElementById('btn-validate-champion');
  const result = document.getElementById('champion-test-result');
  const detail = document.getElementById('champion-test-detail');
  let job = null, worker = null;
  const generationSettings = () => {
    const laps = getLaps();
    return { ...CONFIG.generation, maxLaps: laps, timeLimit: laps === 1 ? 26 : laps === 2 ? 50 : laps * 22 };
  };
  const settings = () => JSON.stringify({ car: CONFIG.car, sensors: CONFIG.sensors,
    generation: generationSettings(), gridBox: CONFIG.gridBox, dt: CONFIG.dt });
  const candidate = () => sim.lastRaceChampion || sim.allTimeBest;
  const current = () => job && job.track === sim.track && job.history === sim.history && job.settings === settings();
  function clear() { worker?.terminate(); worker = null; job = null; }
  function refresh() {
    if (job && !current()) clear();
    const source = candidate();
    button.disabled = !worker && !source?.genome;
    button.textContent = worker ? 'Cancel' : 'Validate';
    result.classList.toggle('validated', Boolean(job?.result?.finished === 20));
    if (!job) {
      result.textContent = 'Not tested';
      detail.textContent = source?.genome ? `Gen ${source.generation} · 20 solo starts` : 'Awaiting a saved brain';
      result.title = 'Training finish rate includes mutated offspring. Validate one frozen champion separately.';
    } else {
      result.textContent = job.result ? `${job.result.finished}/${job.result.tested}` : job.error ? 'Test failed' : `Testing ${job.tested}/20`;
      detail.textContent = `Gen ${job.generation} · ${job.laps} laps · solo`;
      result.title = job.error || `${TRACK_PRESETS[job.trackKey].name}: one frozen brain, 20 ${job.gridBox ? 'grid' : 'centerline'} starts, no opponents. ` +
        (job.result ? `${job.result.finished} finished; ${job.result.assisted} starts used recovery. Tested result belongs to Gen ${job.generation}.` : 'No completed result yet.');
    }
  }
  button.addEventListener('click', () => {
    if (worker) { clear(); refresh(); return; }
    const source = candidate();
    if (!source?.genome) return;
    const config = structuredClone(CONFIG), trackKey = getTrackKey();
    config.generation = generationSettings();
    job = { track: sim.track, history: sim.history, settings: settings(), generation: source.generation,
      laps: config.generation.maxLaps, tested: 0, trackKey, gridBox: config.gridBox };
    const startedJob = job;
    try {
      worker = new Worker(new URL('./championValidation.worker.js', import.meta.url), { type: 'module' });
      worker.onmessage = ({ data }) => {
        if (job !== startedJob) return;
        if (!current()) { clear(); refresh(); return; }
        if (data.type === 'progress') job.tested = data.tested;
        if (data.type === 'complete') { job.result = data.result; worker.terminate(); worker = null; }
        if (data.type === 'error') { job.error = data.message; worker.terminate(); worker = null; }
        refresh();
      };
      worker.onerror = () => { if (job !== startedJob) return; job.error = 'Could not run the champion test. Try again.'; worker?.terminate(); worker = null; refresh(); };
      worker.postMessage({ config, genome: Array.from(source.genome), trackKey, signature: physicsSignature(sim.track, config) });
    } catch (error) { job.error = error.message; worker?.terminate(); worker = null; }
    refresh();
  });
  refresh();
  return { refresh };
}
