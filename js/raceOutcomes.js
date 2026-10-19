import { crashDiagnosticMarkup } from './crashDiagnostics.js';

const fields = ['finished', 'crashed', 'stalled', 'timedOut', 'wrongWay', 'other'];
const empty = () => Object.fromEntries(fields.map(key => [key, 0]));

/** Classify actual car states before the next generation replaces them. */
export function countRaceOutcomes(cars, endReason) {
  const counts = empty();
  const expired = endReason === 'finish-window' || endReason === 'time-limit';
  for (const car of cars) {
    if (car.finished) counts.finished++;
    else if (car.deathReason === 'stalled') counts.stalled++;
    else if (car.deathReason === 'wrong way') counts.wrongWay++;
    else if (car.crashed || car.deathReason === 'crash') counts.crashed++;
    else if (car.alive && expired) counts.timedOut++;
    else counts.other++;
  }
  return counts;
}

function observed(record) {
  const counts = record?.outcomes;
  return counts && Number.isSafeInteger(record.generation) && record.generation > 0 &&
    Number.isSafeInteger(record.population) && record.population > 0 &&
    fields.every(key => Number.isInteger(counts[key]) && counts[key] >= 0) &&
    fields.reduce((sum, key) => sum + counts[key], 0) === record.population;
}

/** Legacy records have no reasons; never backfill them with invented zeros. */
export function summarizeRaceOutcomes(history) {
  const window = history.slice(-25);
  const records = window.filter(observed);
  const totals = empty();
  for (const record of records) for (const key of fields) totals[key] += record.outcomes[key];
  const last = history.at(-1);
  return { latest: observed(last) ? last : null, totals, recorded: records.length, window: window.length };
}

export function raceOutcomeMarkup(history, track) {
  const { latest, totals, recorded, window } = summarizeRaceOutcomes(history);
  if (!latest) return '<span class="outcome-heading">Race outcomes</span><span class="outcome-note">Breakdown available after the next completed race.</span>';
  const categories = [['finished', 'Finished'], ['crashed', 'Crashed'], ['stalled', 'Stalled'], ['timedOut', 'Timed out'],
    ['wrongWay', 'Wrong way'], ['other', 'Other']].filter(([key]) => !['wrongWay', 'other'].includes(key) || latest.outcomes[key] > 0);
  const end = latest.endReason === 'finish-window' ? 'Finish window expired' : latest.endReason === 'time-limit' ? 'Race time limit expired' : 'Race concluded';
  const legend = categories.map(([key, label]) => `<span class="outcome-item outcome-${key}">${label} <b>${latest.outcomes[key]}</b></span>`).join('');
  const bar = categories.map(([key, label]) => `<span class="outcome-${key}" style="width:${100 * latest.outcomes[key] / latest.population}%" title="${label}: ${latest.outcomes[key]}"></span>`).join('');
  return `<div class="outcome-heading">Last race · Gen ${latest.generation}<span class="outcome-note">${end}</span></div>` +
    `<div class="outcome-legend">${legend}</div><div class="outcome-bar" role="img" aria-label="${categories.map(([key, label]) => `${label} ${latest.outcomes[key]}`).join(', ')}">${bar}</div>` +
    `<div class="outcome-note outcome-recent">Last ${window} races · ${recorded}/${window} with breakdown: ${totals.crashed} crashed · ${totals.stalled} stalled · ${totals.timedOut} timed out` +
    `${totals.wrongWay ? ` · ${totals.wrongWay} wrong way` : ''}${totals.other ? ` · ${totals.other} other` : ''}</div>` + crashDiagnosticMarkup(history, track);
}
