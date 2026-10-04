import { CONFIG } from '../js/config.js';
import { RAY_ANGLES } from '../js/car.js';

console.log('Testing car-to-car raycast intersections...');

// Car A at (100, 100), facing +X (angle = 0)
const carA = { x: 100, y: 100, angle: 0 };
// Car B ahead at (180, 105), radius R = 10
const carB = { x: 180, y: 105, radius: 10 };

const L = CONFIG.sensors.length; // 400

const rayDistances = [];

for (let r = 0; r < RAY_ANGLES.length; r++) {
  const a = carA.angle + RAY_ANGLES[r];
  const dx = Math.cos(a);
  const dy = Math.sin(a);

  // Circle intersection test against carB
  const vx = carB.x - carA.x;
  const vy = carB.y - carA.y;
  const tProj = vx * dx + vy * dy;
  let carHitDist = L;

  if (tProj > 0 && tProj < L) {
    const dPerpSq = (vx * vx + vy * vy) - (tProj * tProj);
    const radSq = carB.radius * carB.radius;
    if (dPerpSq <= radSq) {
      const dHit = tProj - Math.sqrt(radSq - dPerpSq);
      if (dHit > 0 && dHit < carHitDist) {
        carHitDist = dHit;
      }
    }
  }
  rayDistances.push({ angleDeg: (RAY_ANGLES[r] * 180 / Math.PI).toFixed(0), dist: carHitDist.toFixed(1) });
}

console.log('Ray results:', rayDistances);
