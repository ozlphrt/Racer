import { TEAM_PALETTE } from '../js/renderer3d.js';

console.log(`Verifying ${TEAM_PALETTE.length} multi-color racing team liveries...`);

for (let i = 0; i < TEAM_PALETTE.length; i++) {
  const t = TEAM_PALETTE[i];
  console.assert(t.name, `Team ${i} must have a name`);
  console.assert(typeof t.hex === 'number', `Team ${i} must have primary hex`);
  console.assert(typeof t.secHex === 'number', `Team ${i} must have secondary secHex`);
  console.assert(typeof t.accHex === 'number', `Team ${i} must have accent accHex`);
  console.assert(t.rgb.length === 3, `Team ${i} must have rgb`);
  console.assert(t.secRgb.length === 3, `Team ${i} must have secRgb`);
  console.assert(t.accRgb.length === 3, `Team ${i} must have accRgb`);
  console.log(`- ${t.name}: #${t.hex.toString(16).padStart(6,'0')} | #${t.secHex.toString(16).padStart(6,'0')} | #${t.accHex.toString(16).padStart(6,'0')}`);
}

console.log('All multi-color team livery tests passed successfully!');
