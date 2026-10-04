import { Track, TRACK_PRESETS } from '../js/track.js';
import { CONFIG } from '../js/config.js';
import { Simulation } from '../js/simulation.js';

const t = new Track(TRACK_PRESETS['grand-prix'].points, CONFIG.track.width, CONFIG.track.samples);
const sim = new Simulation(t, CONFIG);

console.log('Sim cars initialized:', sim.cars.length);
console.log('Car 0 pos:', sim.cars[0].x, sim.cars[0].y, 'alive:', sim.cars[0].alive);
console.log('Car 10 pos:', sim.cars[10].x, sim.cars[10].y, 'alive:', sim.cars[10].alive);

for (let step = 0; step < 120; step++) {
  sim.step(1/60);
}

const aliveRacing = sim.cars.filter(c => c.alive && !c.crashed);
console.log(`After 2s (120 steps): aliveRacing=${aliveRacing.length}, avgSpeed=${(aliveRacing.reduce((acc, c) => acc + c.speed, 0) / (aliveRacing.length || 1)).toFixed(1)}`);
for (let i = 0; i < 5; i++) {
  const c = sim.cars[i];
  console.log(`Car ${i}: alive=${c.alive}, speed=${c.speed.toFixed(1)}, x=${c.x.toFixed(1)}, y=${c.y.toFixed(1)}, stall=${c.stall.toFixed(2)}, totalIdx=${c.totalIdx}`);
}
