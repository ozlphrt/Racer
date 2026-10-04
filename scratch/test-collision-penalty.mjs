import { CONFIG } from '../js/config.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { Simulation } from '../js/simulation.js';

const track = new Track(TRACK_PRESETS['grand-prix'].points, CONFIG.track.width, CONFIG.track.samples);
const sim = new Simulation(track, CONFIG);

while (sim.generation < 5) {
  sim.step();
}

console.log('Generations reached:', sim.generation);
console.log('History length:', sim.history.length);
console.log('All time best fitness:', sim.allTimeBest?.fitness);
console.assert(sim.history.length >= 4, 'Expected at least 4 history generations');
console.log('Test completed successfully!');
