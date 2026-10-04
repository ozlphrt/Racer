console.log('Testing full slip angle kinematics...');

let angle = 0;
let vx = 300, vy = 0;
const dt = 1/60;

const slipAngles = [];

for (let i = 0; i < 60; i++) {
  const steer = 1.0;
  const throttle = 0.8;
  
  // 1. Heading rotates based on steering and understeer factor
  const speed = Math.hypot(vx, vy);
  const gripLimit = 1.0 / Math.max(1, speed * 0.0032);
  const turnRate = 3.4 * Math.min(1, Math.max(0.40, gripLimit));
  angle += steer * turnRate * dt;
  
  // 2. Decompose world velocity into car local frame (Forward & Lateral)
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  let vFwd = vx * cos + vy * sin;
  let vLat = -vx * sin + vy * cos;
  
  // 3. Longitudinal acceleration & drag
  vFwd += throttle * 240 * dt - vFwd * 0.32 * dt;
  
  // 4. Tire lateral friction & oversteer slip
  const tireGrip = 10.5 * (1.0 - 0.25 * Math.abs(throttle) * Math.abs(steer));
  vLat -= vLat * tireGrip * dt;
  
  // 5. Reconstruct world velocity
  vx = vFwd * cos - vLat * sin;
  vy = vFwd * sin + vLat * cos;
  
  const slipDeg = Math.atan2(vLat, Math.max(10, vFwd)) * (180 / Math.PI);
  slipAngles.push(slipDeg);
}

console.log('Slip angles during cornering (deg): min=', Math.min(...slipAngles).toFixed(1), 'max=', Math.max(...slipAngles).toFixed(1));
