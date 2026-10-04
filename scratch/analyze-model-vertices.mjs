import fs from 'fs';

const gltf = JSON.parse(fs.readFileSync('full_f1_2022/scene.gltf', 'utf8'));
const bin = fs.readFileSync('full_f1_2022/scene.bin');

// In GLTF:
// Mesh 1 (Object_6): 16432 verts
// Mesh 2 (Object_8): 1688 verts (Front wing + front wheels)
// Mesh 3 (Object_10): 1896 verts (Rear wing + rear wheels)

// Let's inspect coordinates of:
// - Helmet (inside cockpit, ~x in [-0.2, 0.4], y in [0.4, 0.7], z in [-0.15, 0.15])
// - Underbody floor (lowest Y in Mesh 1, y < 0.16)
// - Wheels (large radius cylinders in Mesh 2 and Mesh 3, |z| > 0.6)
// - Suspension arms (thin diagonal tubes in Mesh 2 and Mesh 3)
// - Snorkel camera pod (highest Y, y > 0.82)
// - Rear wing strut

console.log('Analyzing geometry topology...');
