import { Track, TRACK_PRESETS } from '../js/track.js';
import { CONFIG } from '../js/config.js';

const dt = 1/60;
const c = CONFIG.car;

let vx = 0, vy = 0, angle = 0;
let x = 0, y = 0;

for (let step = 0; step < 10; step++) {
  const throttle = 1.0;
  const steer = 0.5;

  // 1. Decompose current velocity into body frame
  let cos = Math.cos(angle);
  let sin = Math.sin(angle);
  let vFwd = vx * cos + vy * sin;
  let vLat = -vx * sin + vy * cos;

  // 2. Longitudinal acceleration & drag
  const aLong = throttle * (throttle >= 0 ? c.accel : c.brake);
  vFwd += aLong * dt;
  vFwd -= vFwd * c.drag * dt;
  vFwd = Math.max(0, Math.min(c.maxSpeed, vFwd));

  // 3. Cornering yaw rate with high-speed understeer
  const gripLimit = 1.0 / Math.max(1.0, vFwd * c.understeerFactor);
  const turnAuthority = Math.max(0.40, Math.min(1.0, gripLimit)) * Math.min(1.0, vFwd / c.minTurnSpeed);
  const dAngle = steer * c.turnRate * turnAuthority * dt;
  angle += dAngle;

  // 4. Rotate velocity vector into new body orientation
  const cosD = Math.cos(dAngle);
  const sinD = Math.sin(dAngle);
  const vFwdRot = vFwd * cosD + vLat * sinD;
  const vLatRot = -vFwd * sinD + vLat * cosD;

  // 5. Tire lateral grip friction & oversteer
  const traction = c.tireGrip * (1.0 - c.oversteerFactor * Math.abs(throttle) * Math.abs(steer));
  const vLatFinal = vLatRot - vLatRot * traction * dt;

  // 6. Reconstruct world velocity
  cos = Math.cos(angle);
  sin = Math.sin(angle);
  vx = vFwdRot * cos - vLatFinal * sin;
  vy = vFwdRot * sin + vLatFinal * cos;
  const speed = Math.hypot(vx, vy);

  x += vx * dt;
  y += vy * dt;

  console.log(`Step ${step}: speed=${speed.toFixed(1)}, vFwd=${vFwdRot.toFixed(1)}, vLat=${vLatFinal.toFixed(2)}, angle=${(angle*180/Math.PI).toFixed(1)}°, x=${x.toFixed(1)}, y=${y.toFixed(1)}`);
}
