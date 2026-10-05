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

    // 1. Detect sharp curve zones matching track kerbs
    const minCurv = 1 / 200;
    const rawKerb = new Array(N).fill(false);
    for (let k = 0; k < N; k++) {
      rawKerb[k] = Math.abs(t.curvature[k]) >= minCurv;
    }

    // Dilate by 2 samples to match full kerb coverage
    const isKerb = new Array(N).fill(false);
    for (let k = 0; k < N; k++) {
      if (rawKerb[k]) {
        for (let d = -2; d <= 2; d++) {
          isKerb[(k + d + N) % N] = true;
        }
      }
    }

    // Find all contiguous sharp curve / kerb runs
    const visited = new Uint8Array(N);
    const kerbRuns = [];
    for (let k = 0; k < N; k++) {
      const prev = (k - 1 + N) % N;
      if (isKerb[k] && !isKerb[prev] && !visited[k]) {
        const runIndices = [];
        let curr = k;
        while (isKerb[curr] && !visited[curr]) {
          visited[curr] = 1;
          runIndices.push(curr);
          curr = (curr + 1) % N;
        }
        if (runIndices.length >= 4) {
          kerbRuns.push(runIndices);
        }
      }
    }

    // Colors for FIA safety barriers: Alternating bold Red, White, and Graphite
    const colors = [
      { r: 0.90, g: 0.12, b: 0.22 }, // Crimson Red
      { r: 0.96, g: 0.96, b: 0.98 }, // Pure White
      { r: 0.14, g: 0.16, b: 0.20 }, // Dark Graphite
    ];

    let id = 0;
    let s = (Math.round(t.bounds.minX + t.bounds.minY * 7) & 0x7fffffff) || 12345;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const outerRadius = 1.40;
    const tireDiameter = outerRadius * 2.0; // 2.80m
    const stackSpacing = tireDiameter;      // Stacks touching each other: 2.80m center-to-center
    const rowDepth = outerRadius * Math.sqrt(3); // 2.425m for close triangular packing
    const baseMargin = 4.2; // Runoff distance outside the kerb/track edge

    for (let c = 0; c < kerbRuns.length; c++) {
      const run = kerbRuns[c];
      const L = run.length;

      // Determine turn direction: Outside of LEFT turn is outer edge (ox, oy); Outside of RIGHT turn is inner edge (ix, iy)
      let avgCurv = 0;
      for (const idx of run) avgCurv += t.curvature[idx];
      avgCurv /= L;

      const isLeftTurn = avgCurv > 0;
      const edgeXs = isLeftTurn ? t.ox : t.ix;
      const edgeYs = isLeftTurn ? t.oy : t.iy;

      // Extract continuous centerline & edge coordinates along the outside of the sharp curve
      const rawPts = [];
      for (let i = 0; i < L; i++) {
        const k = run[i];
        const ex = edgeXs[k];
        const ey = edgeYs[k];
        const cdx = ex - t.cx[k];
        const cdy = ey - t.cy[k];
        const cLen = Math.hypot(cdx, cdy) || 1;
        const outNx = cdx / cLen;
        const outNy = cdy / cLen;
        rawPts.push({
          x: ex,
          y: ey,
          outNx,
          outNy,
          tx: t.tx[k],
          ty: t.ty[k],
          yaw: Math.atan2(outNy, outNx) + Math.PI / 2,
        });
      }

      if (rawPts.length < 2) continue;

      // Compute cumulative arc length along this kerb run
      const cumD = [0];
      for (let i = 1; i < rawPts.length; i++) {
        const d = Math.hypot(rawPts[i].x - rawPts[i - 1].x, rawPts[i].y - rawPts[i - 1].y);
        cumD.push(cumD[i - 1] + d);
      }
      const totalKerbLen = cumD[cumD.length - 1];

      // Trim 10% from the start and 10% from the end of the kerbs
      const trimStart = totalKerbLen * 0.10;
      const trimEnd = totalKerbLen * 0.90;
      const barrierLen = trimEnd - trimStart;

      if (barrierLen < stackSpacing * 0.8) continue;

      // Sample along trimmed range [trimStart, trimEnd] so adjacent stacks touch each other
      const numStacks = Math.max(2, Math.round(barrierLen / stackSpacing));
      const actualStep = barrierLen / numStacks;

      const sampledStacks = [];
      let pIdx = 0;

      for (let sIdx = 0; sIdx <= numStacks; sIdx++) {
        const targetDist = trimStart + sIdx * actualStep;
        while (pIdx < cumD.length - 2 && cumD[pIdx + 1] < targetDist) {
          pIdx++;
        }
        const segLen = cumD[pIdx + 1] - cumD[pIdx] || 1;
        const factor = Math.max(0, Math.min(1, (targetDist - cumD[pIdx]) / segLen));

        const p0 = rawPts[pIdx];
        const p1 = rawPts[pIdx + 1];

        const posX = p0.x + (p1.x - p0.x) * factor;
        const posY = p0.y + (p1.y - p0.y) * factor;
        const outNx = p0.outNx + (p1.outNx - p0.outNx) * factor;
        const outNy = p0.outNy + (p1.outNy - p0.outNy) * factor;
        const nLen = Math.hypot(outNx, outNy) || 1;
        const normOutNx = outNx / nLen;
        const normOutNy = outNy / nLen;

        const tx = p0.tx + (p1.tx - p0.tx) * factor;
        const ty = p0.ty + (p1.ty - p0.ty) * factor;
        const tLen = Math.hypot(tx, ty) || 1;
        const normTx = tx / tLen;
        const normTy = ty / tLen;

        sampledStacks.push({
          x: posX,
          y: posY,
          outNx: normOutNx,
          outNy: normOutNy,
          tx: normTx,
          ty: normTy,
          yaw: Math.atan2(normOutNy, normOutNx) + Math.PI / 2,
        });
      }

      // Build continuous 2-row touching barrier wall with 4-6 tyres per stack
      for (let sIdx = 0; sIdx < sampledStacks.length; sIdx++) {
        const st = sampledStacks[sIdx];

        for (let row = 0; row < 2; row++) {
          // Exactly 4, 5, or 6 tyres high per individual stack
          const stackTiers = 4 + Math.floor(rand() * 3);
          const rowOffset = row * rowDepth;
          const staggerTang = (row === 1) ? stackSpacing * 0.5 : 0;
          const stackX = st.x + st.outNx * (baseMargin + rowOffset) + st.tx * staggerTang;
          const stackY = st.y + st.outNy * (baseMargin + rowOffset) + st.ty * staggerTang;

          // Alternating FIA colors: Red / White with occasional graphite
          const colorGroup = (sIdx + row + c) % 2;
          const stackBaseColor = colors[colorGroup];
          const stackId = id++;

          for (let tier = 0; tier < stackTiers; tier++) {
            // Natural snug stacking with slight organic variations
            const jitterX = (rand() - 0.5) * 0.08;
            const jitterY = (rand() - 0.5) * 0.08;
            const pitch = (rand() - 0.5) * 0.05;
            const roll = (rand() - 0.5) * 0.05;
            const yaw = st.yaw + (rand() - 0.5) * 0.25;
            const z = 0.44 + tier * 0.88;

            const tireColor = tier === stackTiers - 1 && rand() < 0.20 ? colors[2] : stackBaseColor;
            const posX = stackX + jitterX;
            const posY = stackY + jitterY;

            this.tires.push({
              id: id++,
              stackId: stackId,
              stackBaseX: stackX,
              stackBaseY: stackY,
              x: posX,
              y: posY,
              z: z,
              vx: 0,
              vy: 0,
              vz: 0,
              yaw: yaw,
              pitch: pitch,
              roll: roll,
              vyaw: 0,
              vpitch: 0,
              vroll: 0,
              baseX: posX,
              baseY: posY,
              baseZ: z,
              baseYaw: yaw,
              basePitch: pitch,
              baseRoll: roll,
              radius: outerRadius,
              height: 0.88,
              mass: 1.0,
              color: tireColor,
              sleeping: true,
              needsRenderUpdate: true,
            });
          }
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
