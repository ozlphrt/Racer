/**
 * TireBarrierSystem: Procedurally generates stacked FIA safety tire walls on the outside runoff
 * of all high-speed corners. Includes full rigid-body physics, momentum transfer, tire popping/scatter,
 * and inter-tire collision dynamics.
 */
export class TireBarrierSystem {
  constructor(track) {
    this.track = track;
    this.tires = [];
    this.hasActiveTires = false;
    this.buildBarriers();
  }

  setTrack(track) {
    this.track = track;
    this.buildBarriers();
  }

  buildBarriers() {
    this.tires = [];
    if (!this.track) return;
    const t = this.track;
    const N = t.N;

    // 1. Identify sharp outer corners (zones with significant curvature)
    const minCurv = 1 / 250;
    const rawCorner = new Array(N).fill(false);
    for (let k = 0; k < N; k++) {
      rawCorner[k] = Math.abs(t.curvature[k]) >= minCurv;
    }

    // Dilate corner zones slightly for smooth coverage
    const isCorner = new Array(N).fill(false);
    for (let k = 0; k < N; k++) {
      if (rawCorner[k]) {
        for (let d = -2; d <= 2; d++) {
          isCorner[(k + d + N) % N] = true;
        }
      }
    }

    // Colors for FIA safety barriers: Alternating bold Red, White, and Graphite
    const colors = [
      { r: 0.88, g: 0.12, b: 0.28 }, // Crimson Red
      { r: 0.95, g: 0.96, b: 0.98 }, // Pure White
      { r: 0.12, g: 0.16, b: 0.22 }, // Dark Graphite Rubber
    ];

    let id = 0;
    // Step through corner samples
    for (let k = 0; k < N; k += 2) {
      if (!isCorner[k]) continue;

      const curv = t.curvature[k];
      const isLeftTurn = curv >= 0;

      // Outer track edge point for this turn
      const edgeX = isLeftTurn ? t.ox[k] : t.ix[k];
      const edgeY = isLeftTurn ? t.oy[k] : t.iy[k];

      // Outward normal pointing away from the track centerline
      const cdx = edgeX - t.cx[k];
      const cdy = edgeY - t.cy[k];
      const cLen = Math.hypot(cdx, cdy) || 1;
      const outNx = cdx / cLen;
      const outNy = cdy / cLen;

      // Place 2 staggered depth rows (Front Row & Rear Row)
      const colorGroup = Math.floor(k / 4) % 2; // Alternating red & white segments
      const baseColor = colors[colorGroup];

      for (let row = 0; row < 2; row++) {
        // Runoff margin from edge
        const margin = 4.8 + row * 1.7;
        const stackX = edgeX + outNx * margin;
        const stackY = edgeY + outNy * margin;

        // 2-tier vertical stack (bottom tire at z=0.42, top tire at z=1.26)
        for (let tier = 0; tier < 2; tier++) {
          const z = 0.42 + tier * 0.84;
          const tireColor = tier === 1 && Math.random() < 0.3 ? colors[2] : baseColor;

          this.tires.push({
            id: id++,
            // Current physics state
            x: stackX,
            y: stackY,
            z: z,
            vx: 0,
            vy: 0,
            vz: 0,
            yaw: Math.atan2(outNy, outNx) + Math.PI / 2,
            pitch: 0,
            roll: 0,
            vyaw: 0,
            vpitch: 0,
            vroll: 0,
            // Rest configuration
            baseX: stackX,
            baseY: stackY,
            baseZ: z,
            baseYaw: Math.atan2(outNy, outNx) + Math.PI / 2,
            radius: 1.15,
            height: 0.82,
            mass: 1.0,
            color: tireColor,
            sleeping: true,
            needsRenderUpdate: true,
          });
        }
      }
    }
  }

  reset() {
    for (const tire of this.tires) {
      tire.x = tire.baseX;
      tire.y = tire.baseY;
      tire.z = tire.baseZ;
      tire.vx = 0;
      tire.vy = 0;
      tire.vz = 0;
      tire.yaw = tire.baseYaw;
      tire.pitch = 0;
      tire.roll = 0;
      tire.vyaw = 0;
      tire.vpitch = 0;
      tire.vroll = 0;
      tire.sleeping = true;
      tire.needsRenderUpdate = true;
    }
    this.hasActiveTires = false;
  }

  update(dt, cars, onImpact = null) {
    if (!this.tires || this.tires.length === 0) return;
    const clampedDt = Math.min(dt, 0.05);

    // 1. Car vs Tire collision detection & impulse transfer
    if (cars && cars.length > 0) {
      const carRadius = 3.8;
      const carRadSq = (carRadius + 1.15) * (carRadius + 1.15);

      for (let c = 0; c < cars.length; c++) {
        const car = cars[c];
        if (!car || (!car.alive && !car.crashed) || car.finished) continue;

        const carX = car.x;
        const carY = car.y;
        const carSpeed = car.speed || Math.hypot(car.vx, car.vy) || 0;

        for (let i = 0; i < this.tires.length; i++) {
          const tire = this.tires[i];
          const dx = tire.x - carX;
          const dy = tire.y - carY;
          const distSq = dx * dx + dy * dy;

          if (distSq < carRadSq) {
            const dist = Math.sqrt(distSq) || 1;
            const nx = dx / dist;
            const ny = dy / dist;

            // Momentum transfer into tire
            const impactSpeed = Math.max(18, carSpeed);
            const force = impactSpeed * 0.72 + 12;

            tire.vx += nx * force + (Math.random() - 0.5) * 6;
            tire.vy += ny * force + (Math.random() - 0.5) * 6;
            // Vertical launch: Tires pop and fly upwards upon violent impact!
            tire.vz += Math.min(32, impactSpeed * 0.28 + 5.0 + Math.random() * 6);

            tire.vyaw += (Math.random() - 0.5) * 16;
            tire.vpitch += (Math.random() - 0.5) * 12;
            tire.vroll += (Math.random() - 0.5) * 12;
            tire.sleeping = false;
            tire.needsRenderUpdate = true;
            this.hasActiveTires = true;

            // Car impact cushioning: absorbs energy and pushes car back slightly
            car.vx *= 0.82;
            car.vy *= 0.82;
            car.speed *= 0.82;

            onImpact?.(car, impactSpeed);
          }
        }
      }
    }

    // 2. Tire Physics Simulation (Movement, Gravity, Ground Bounce & Friction)
    if (!this.hasActiveTires) return;
    let anyMoving = false;

    const gravity = 48.0;
    const groundZ = 0.41;
    const linDamping = Math.pow(0.86, clampedDt * 60);
    const rotDamping = Math.pow(0.88, clampedDt * 60);

    for (let i = 0; i < this.tires.length; i++) {
      const tire = this.tires[i];
      if (tire.sleeping) continue;

      // Apply linear velocity damping
      tire.vx *= linDamping;
      tire.vy *= linDamping;
      tire.vz -= gravity * clampedDt;

      // Integrate position
      tire.x += tire.vx * clampedDt;
      tire.y += tire.vy * clampedDt;
      tire.z += tire.vz * clampedDt;

      // Integrate rotation
      tire.vyaw *= rotDamping;
      tire.vpitch *= rotDamping;
      tire.vroll *= rotDamping;
      tire.yaw += tire.vyaw * clampedDt;
      tire.pitch += tire.vpitch * clampedDt;
      tire.roll += tire.vroll * clampedDt;

      // Ground collision & bounce
      if (tire.z <= groundZ) {
        tire.z = groundZ;
        tire.vz = -tire.vz * 0.38; // Rubber bounce restitution
        if (Math.abs(tire.vz) < 0.6) tire.vz = 0;
        // Ground friction scrub
        tire.vx *= 0.94;
        tire.vy *= 0.94;
        tire.vpitch *= 0.85;
      }

      // Check for sleep threshold
      const speedSq = tire.vx * tire.vx + tire.vy * tire.vy + tire.vz * tire.vz;
      if (speedSq < 0.08 && tire.z <= groundZ + 0.02) {
        tire.vx = 0;
        tire.vy = 0;
        tire.vz = 0;
        tire.sleeping = true;
      } else {
        anyMoving = true;
      }
      tire.needsRenderUpdate = true;
    }

    // 3. Inter-Tire Collisions (Chain reaction scatter within stacks)
    for (let i = 0; i < this.tires.length; i++) {
      const t1 = this.tires[i];
      if (t1.sleeping) continue;

      for (let j = 0; j < this.tires.length; j++) {
        if (i === j) continue;
        const t2 = this.tires[j];
        const dx = t2.x - t1.x;
        const dy = t2.y - t1.y;
        const dz = t2.z - t1.z;
        const distSq = dx * dx + dy * dy + dz * dz * 0.6;
        const minD = 2.2;

        if (distSq < minD * minD && distSq > 0.001) {
          const dist = Math.sqrt(distSq);
          const nx = dx / dist;
          const ny = dy / dist;
          const push = (minD - dist) * 0.5;

          t1.x -= nx * push;
          t1.y -= ny * push;
          t2.x += nx * push;
          t2.y += ny * push;

          // Transfer momentum
          const relVx = t1.vx - t2.vx;
          const relVy = t1.vy - t2.vy;
          const dot = relVx * nx + relVy * ny;

          if (dot > 0) {
            const imp = dot * 0.45;
            t1.vx -= nx * imp;
            t1.vy -= ny * imp;
            t2.vx += nx * imp;
            t2.vy += ny * imp;
            t2.vz += Math.abs(imp) * 0.25;
            t2.sleeping = false;
            t2.needsRenderUpdate = true;
            anyMoving = true;
          }
        }
      }
    }

    this.hasActiveTires = anyMoving;
  }
}
