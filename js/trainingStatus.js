/** Report observed pace changes and completed races, independent of old fitness scales. */
export function trainingStatus(history, bestLapEver) {
  let best = Infinity, recordGeneration = null, observedImprovement = false;
  for (const record of history) {
    if (Number.isFinite(record.bestLap) && record.bestLap > 0 && record.bestLap < 999 && record.bestLap < best - 0.005) {
      observedImprovement = Number.isFinite(best);
      best = record.bestLap;
      recordGeneration = record.generation;
    }
  }
  const latest = history.at(-1);
  const age = recordGeneration !== null && latest ? latest.generation - recordGeneration : null;
  const recent = history.slice(-25).filter(r => r.population > 0 && Number.isFinite(r.finishers) && r.finishers >= 0 && r.finishers <= r.population);
  const starters = recent.reduce((sum, r) => sum + r.population, 0);
  const finished = recent.reduce((sum, r) => sum + r.finishers, 0);
  const rate = starters ? Math.round(100 * finished / starters) : null;
  const completion = rate === null ? 'Completion data unavailable.' : `${rate}% completed the race over the last ${recent.length} races.`;
  const unchanged = age !== null && age >= 25 ? ` No observed lap improvement for ${age} generations.` : '';
  if (observedImprovement && age !== null && age <= 2 && Number.isFinite(bestLapEver) && Math.abs(best - bestLapEver) < 0.01) {
    return { statusText: 'PACE BREAKTHROUGH', statusClass: 'status-breakthrough',
      message: `New observed record: ${best.toFixed(2)}s at Gen ${recordGeneration}. ${completion}` };
  }
  if (recent.length >= 5 && rate < 70) return {
    statusText: 'COMPLETION NEEDS WORK', statusClass: 'status-plateau', message: completion + unchanged,
  };
  if (age !== null && age >= 100) return {
    statusText: 'PACE PLATEAU', statusClass: 'status-plateau', message: completion + unchanged,
  };
  if (recent.length >= 5 && rate >= 80) return {
    statusText: 'HIGH RACE COMPLETION', statusClass: 'status-stable', message: completion,
  };
  return { statusText: 'TRAINING ACTIVE', statusClass: 'status-info', message: completion };
}
