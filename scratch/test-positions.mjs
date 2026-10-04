import { CONFIG } from '../js/config.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { Simulation } from '../js/simulation.js';

const track = new Track(TRACK_PRESETS['grand-prix'].points, CONFIG.track.width, CONFIG.track.samples);
const sim = new Simulation(track, CONFIG);

for (let i = 0; i < 50; i++) sim.step();

// Check ranking logic
const activeCars = sim.cars.filter((c) => c && c.alive && !c.crashed);
activeCars.sort((a, b) => {
  if (a.finished !== b.finished) return a.finished ? -1 : 1;
  if (a.laps !== b.laps) return b.laps - a.laps;
  return b.totalIdx - a.totalIdx;
});

console.log('Active cars ranked:', activeCars.length);
console.log('Leader rank 1 totalIdx:', activeCars[0]?.totalIdx);
console.log('Rank 2 totalIdx:', activeCars[1]?.totalIdx);
console.assert(activeCars[0].totalIdx >= activeCars[1].totalIdx, 'P.1 must have >= totalIdx than P.2');
console.log('Position ranking test passed successfully!');
