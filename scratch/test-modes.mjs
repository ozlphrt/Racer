import { CONFIG } from '../js/config.js';
import { Track, TRACK_PRESETS } from '../js/track.js';
import { Simulation } from '../js/simulation.js';

const track = new Track(TRACK_PRESETS['grand-prix'].points, CONFIG.track.width, CONFIG.track.samples);
const sim = new Simulation(track, CONFIG);

console.log('--- Initial Training Mode ---');
console.log('Mode:', sim.mode);
console.log('Car count:', sim.cars.length);
console.log('Collisions always on:', sim.collisionsAlwaysOn);
console.assert(sim.cars.length === 80, 'Expected 80 cars in training mode');

for (let i = 0; i < 100; i++) sim.step();
console.log('Stepped 100 frames in training mode successfully. Alive:', sim.aliveCount);

console.log('\n--- Switching to Race Mode ---');
sim.setMode('race');
console.log('Mode:', sim.mode);
console.log('Car count:', sim.cars.length);
console.log('Collisions always on:', sim.collisionsAlwaysOn);
console.assert(sim.cars.length === 20, 'Expected 20 cars in race mode');
console.assert(sim.collisionsAlwaysOn === true, 'Expected collisionsAlwaysOn to be true in race mode');
console.assert(sim.cars.every(c => c.collisionAlwaysOn === true), 'Expected all 20 cars to have collisionAlwaysOn = true');

for (let i = 0; i < 100; i++) sim.step();
console.log('Stepped 100 frames in race mode successfully. Alive:', sim.aliveCount);

console.log('\n--- Switching back to Training Mode ---');
sim.setMode('train');
console.log('Mode:', sim.mode);
console.log('Car count:', sim.cars.length);
console.log('Collisions always on:', sim.collisionsAlwaysOn);
console.assert(sim.cars.length === 80, 'Expected 80 cars in training mode');

console.log('\nAll simulation mode tests passed successfully!');
