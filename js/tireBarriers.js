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

    // 1. Detect high-risk corner zones:
    // Low-speed and gentle curves (radius > 120m) do not need tire barriers.
    // Only corners with tight radius (curvature >= 1/120) and meaningful length present crash hazard.
    const minCurv = 1 / 120;
    const isSharp = new Array(N).fill(false);
    for (let k = 0; k < N; k++) {
      isSharp[k] = Math.abs(t.curvature[k]) >= minCurv;
    }

    // Dilate by 1 sample for contiguous corner grouping
    const isCurve = new Array(N).fill(false);
    for (let k = 0; k < N; k++) {
      if (isSharp[k]) {
        for (let d = -1; d <= 1; d++) {
          isCurve[(k + d + N) % N] = true;
        }
      }
    }

    // Find all contiguous sharp curve runs
    const visited = new Uint8Array(N);
    const curveRuns = [];
    for (let k = 0; k < N; k++) {
      const prev = (k - 1 + N) % N;
      if (isCurve[k] && !isCurve[prev] && !visited[k]) {
        const runIndices = [];
        let curr = k;
        while (isCurve[curr] && !visited[curr]) {
          visited[curr] = 1;
          runIndices.push(curr);
          curr = (curr + 1) % N;
        }
        if (runIndices.length >= 5) {
          curveRuns.push(runIndices);
        }
      }
    }

    // Colors for FIA safety barriers: Alternating bold Red, White, and Graphite
    const colors = [
      { r: 0.58, g: 0.16, b: 0.18 }, // Weathered Safety Red
      { r: 0.96, g: 0.96, b: 0.98 }, // Pure White
      { r: 0.14, g: 0.16, b: 0.20 }, // Dark Graphite
    ];

    let id = 0;
    let s = (Math.round(t.bounds.minX + t.bounds.minY * 7) & 0x7fffffff) || 12345;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const outerRadius = 2.10;
    const tireDiameter = outerRadius * 2.0; // 4.20m
    const stackSpacing = tireDiameter;      // Stacks touching each other: 4.20m center-to-center
    const baseMargin = 4.8; // Runoff distance outside the track edge

    for (let c = 0; c < curveRuns.length; c++) {
      const run = curveRuns[c];
      const L = run.length;

      // Filter out low-speed curves: require peak curvature >= minCurv
      let maxCurv = 0;
      let avgCurv = 0;
      for (const idx of run) {
        const cur = Math.abs(t.curvature[idx]);
        avgCurv += t.curvature[idx];
        if (cur > maxCurv) maxCurv = cur;
      }
      avgCurv /= L;
      if (maxCurv < minCurv) continue;

      // Determine turn direction: Outside of LEFT turn is outer edge (ox, oy); Outside of RIGHT turn is inner edge (ix, iy)
      const isLeftTurn = avgCurv > 0;
      const edgeXs = isLeftTurn ? t.ox : t.ix;
      const edgeYs = isLeftTurn ? t.oy : t.iy;

      // Extract continuous centerline & edge coordinates along the outside of the curve
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

      // Compute cumulative arc length along this curve run
      const cumD = [0];
      for (let i = 1; i < rawPts.length; i++) {
        const d = Math.hypot(rawPts[i].x - rawPts[i - 1].x, rawPts[i].y - rawPts[i - 1].y);
        cumD.push(cumD[i - 1] + d);
      }
      const totalKerbLen = cumD[cumD.length - 1];

      // REAL-WORLD FIA RUNOFF PLACEMENT:
      // High-speed crashes happen at the entry/turn-in tangent into the outside runoff pocket.
      // The slow apex, inner track, and exit parts of the curve do NOT need tires.
      const trimStart = totalKerbLen * 0.05;
      const trimEnd = Math.min(totalKerbLen * 0.42, trimStart + 45.0);
      const barrierLen = trimEnd - trimStart;

      if (barrierLen < stackSpacing * 0.8) continue;

      const numStacks = Math.max(3, Math.round(barrierLen / stackSpacing));
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

      // Single crisp row of touching stacks in the impact zone (instead of heavy double rows)
      for (let sIdx = 0; sIdx < sampledStacks.length; sIdx++) {
        const st = sampledStacks[sIdx];
        const stackTiers = 3 + Math.floor(rand() * 2); // 3 to 4 tyres per stack (clean, professional barrier)
        const stackX = st.x + st.outNx * baseMargin;
        const stackY = st.y + st.outNy * baseMargin;

        const colorGroup = (sIdx + c) % 2;
        const stackBaseColor = colors[colorGroup];
        const stackId = id++;

        const stackLeanAngle = rand() * Math.PI * 2;
        const stackLeanMag = rand() * 0.40 + 0.15;
        const stackLeanX = Math.cos(stackLeanAngle) * stackLeanMag;
        const stackLeanY = Math.sin(stackLeanAngle) * stackLeanMag;

        for (let tier = 0; tier < stackTiers; tier++) {
          const tierFrac = tier / Math.max(1, stackTiers - 1);
          const tierJitterAngle = rand() * Math.PI * 2;
          const tierJitterMag = rand() * 0.40 + 0.12;
          const jitterX = stackLeanX * tierFrac + Math.cos(tierJitterAngle) * tierJitterMag;
          const jitterY = stackLeanY * tierFrac + Math.sin(tierJitterAngle) * tierJitterMag;

          const isTop = tier === stackTiers - 1;
          const tiltMax = isTop ? 0.24 : (0.08 + tierFrac * 0.12);
          const pitch = (rand() - 0.5) * tiltMax * 2.0;
          const roll = (rand() - 0.5) * tiltMax * 2.0;
          const yaw = rand() * Math.PI * 2;

          const z = 0.66 + tier * 1.25 + (rand() - 0.5) * 0.12;
          const tireColor = (isTop && rand() < 0.20) ? colors[2] : stackBaseColor;
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
            height: 1.32,
            color: tireColor,
            sleeping: true,
            needsRenderUpdate: true,
            displaced: false,
            despawnTimer: 0,
          });
        }
      }
    }

    this.buildSpatialGrid();
  }

  buildSpatialGrid() {
    this.cellSize = 24.0;
    this.grid = new Map();
    for (let i = 0; i < this.tires.length; i++) {
      const tire = this.tires[i];
      const gx = Math.floor(tire.x / this.cellSize);
      const gy = Math.floor(tire.y / this.cellSize);
      const key = `${gx},${gy}`;
      let cell = this.grid.get(key);
      if (!cell) {
        cell = [];
        this.grid.set(key, cell);
      }
      cell.push(tire);
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
    this.buildSpatialGrid();
  }

  update(dt, cars, onImpact = null) {
    if (!this.tires || this.tires.length === 0) return;
    if (!this.grid) this.buildSpatialGrid();

    const clampedDt = Math.min(dt, 0.05);

    // 1. Spatial Grid Car vs Tire collision detection & impulse transfer
    if (cars && cars.length > 0) {
      const carRadius = 3.8;
      const carRadSq = (carRadius + 1.15) * (carRadius + 1.15);
      const cellSize = this.cellSize;

      for (let c = 0; c < cars.length; c++) {
        const car = cars[c];
        if (!car || (!car.alive && !car.crashed && !car.finished)) continue;

        const carX = car.x;
        const carY = car.y;
        const carSpeed = car.speed || Math.hypot(car.vx, car.vy) || 0;

        const minGX = Math.floor((carX - 6.0) / cellSize);
        const maxGX = Math.floor((carX + 6.0) / cellSize);
        const minGY = Math.floor((carY - 6.0) / cellSize);
        const maxGY = Math.floor((carY + 6.0) / cellSize);

        for (let gx = minGX; gx <= maxGX; gx++) {
          for (let gy = minGY; gy <= maxGY; gy++) {
            const cell = this.grid.get(`${gx},${gy}`);
            if (!cell) continue;

            for (let i = 0; i < cell.length; i++) {
              const tire = cell[i];
              const dx = tire.x - carX;
              const dy = tire.y - carY;
              const distSq = dx * dx + dy * dy;

              if (distSq < carRadSq) {
                const dist = Math.sqrt(distSq) || 1;
                const nx = dx / dist;
                const ny = dy / dist;

                // Heavy tyre inertia & momentum transfer (stays grounded rather than flying into the sky)
                const impactSpeed = Math.max(18, carSpeed);
                const force = impactSpeed * 0.38 + 5.0;

                tire.vx += nx * force + (Math.random() - 0.5) * 3;
                tire.vy += ny * force + (Math.random() - 0.5) * 3;
                // Low, heavy realistic vertical hop and topple
                tire.vz += Math.min(2.4, 0.5 + Math.random() * 1.4);

                tire.vyaw += (Math.random() - 0.5) * 8;
                tire.vpitch += (Math.random() - 0.5) * 6;
                tire.vroll += (Math.random() - 0.5) * 6;
                tire.sleeping = false;
                tire.displaced = true;
                tire.despawnTimer = 3.0; // Clean up off track in exactly 3 seconds
                tire.scale = 1.0;
                tire.needsRenderUpdate = true;
                this.hasActiveTires = true;

                // Retires / crashes the car upon violent tyre barrier collision
                if (car.alive && !car.crashed) {
                  car.die('crash', 'tire-barrier');
                }

                // Car absorbs barrier impact energy and decelerates
                car.vx *= 0.65;
                car.vy *= 0.65;
                car.speed *= 0.65;

                onImpact?.(car, impactSpeed);
              }
            }
          }
        }
      }
    }

    // 2. Tire Physics Simulation (Movement, Gravity, Dynamic Ground Clearance & Bounce)
    if (!this.hasActiveTires) return;
    let anyMoving = false;

    const gravity = 95.0; // Heavy rubber mass stays grounded
    const groundLevel = 0.05; // Ground surface elevation
    const linDamping = Math.pow(0.82, clampedDt * 60);
    const rotDamping = Math.pow(0.85, clampedDt * 60);

    const activeTires = [];

    for (let i = 0; i < this.tires.length; i++) {
      const tire = this.tires[i];
      if (tire.sleeping && !tire.displaced) continue;

      // Handle 3-second crash cleanup timer for displaced tires on the track
      if (tire.displaced) {
        tire.despawnTimer -= clampedDt;
        if (tire.despawnTimer <= 0.6) {
          // Smooth shrink & sink transition as track marshals clear the tarmac
          const fadeFrac = Math.max(0, tire.despawnTimer / 0.6);
          tire.scale = fadeFrac;
          tire.needsRenderUpdate = true;
          if (tire.despawnTimer <= 0) {
            // Cleanly restore to base wall stack and sleep
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
            tire.scale = 1.0;
            tire.sleeping = true;
            tire.displaced = false;
            tire.needsRenderUpdate = true;
            continue;
          }
        }
      }

      activeTires.push(tire);

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

      // Dynamic 3D oriented ground extent (distance from tire center to lowest contact surface)
      const cosP = Math.cos(tire.pitch);
      const cosR = Math.cos(tire.roll);
      const nz = Math.abs(cosP * cosR); // Vertical alignment of tire's cylinder axis
      const r = tire.radius || 2.10;
      const h = (tire.height || 1.32) * 0.5;
      const extentZ = Math.sqrt(r * r * (1.0 - nz * nz) + h * h * (nz * nz));
      const minZ = groundLevel + extentZ;

      // Ground collision & dead-thud rubber bounce
      if (tire.z <= minZ) {
        tire.z = minZ;
        tire.vz = -tire.vz * 0.16; // Heavy rubber dead restitution
        if (Math.abs(tire.vz) < 0.4) tire.vz = 0;

        // Ground friction scrub & rotational damping
        tire.vx *= 0.86;
        tire.vy *= 0.86;
        tire.vyaw *= 0.82;
        tire.vpitch *= 0.75;
        tire.vroll *= 0.75;

        // When moving slowly, natural gravity topples and settles tilted tires flat onto the ground
        const planarSpeedSq = tire.vx * tire.vx + tire.vy * tire.vy;
        if (planarSpeedSq < 28.0) {
          tire.pitch *= 0.88;
          tire.roll *= 0.88;
        }
      }

      // Check for sleep threshold
      const speedSq = tire.vx * tire.vx + tire.vy * tire.vy + tire.vz * tire.vz;
      const rotSpeedSq = (tire.vyaw || 0) * (tire.vyaw || 0) + (tire.vpitch || 0) * (tire.vpitch || 0) + (tire.vroll || 0) * (tire.vroll || 0);
      if (speedSq < 0.06 && rotSpeedSq < 0.06 && tire.z <= minZ + 0.04) {
        tire.vx = 0;
        tire.vy = 0;
        tire.vz = 0;
        tire.vyaw = 0;
        tire.vpitch = 0;
        tire.vroll = 0;
        if (Math.abs(tire.pitch) < 0.18) tire.pitch = 0;
        if (Math.abs(tire.roll) < 0.18) tire.roll = 0;
        const finalNz = Math.abs(Math.cos(tire.pitch) * Math.cos(tire.roll));
        const finalExtent = Math.sqrt(r * r * (1.0 - finalNz * finalNz) + h * h * (finalNz * finalNz));
        tire.z = groundLevel + finalExtent;
        if (!tire.displaced) {
          tire.sleeping = true;
        } else {
          anyMoving = true;
        }
      } else {
        anyMoving = true;
      }
      tire.needsRenderUpdate = true;
    }

    // 3. Inter-Tire Collisions (High-performance spatial grid lookups)
    const minD = 2.2;
    const minDSq = minD * minD;

    for (let i = 0; i < activeTires.length; i++) {
      const t1 = activeTires[i];
      const gx = Math.floor(t1.x / this.cellSize);
      const gy = Math.floor(t1.y / this.cellSize);

      for (let nx = gx - 1; nx <= gx + 1; nx++) {
        for (let ny = gy - 1; ny <= gy + 1; ny++) {
          const cell = this.grid.get(`${nx},${ny}`);
          if (!cell) continue;

          for (let k = 0; k < cell.length; k++) {
            const t2 = cell[k];
            if (t1 === t2) continue;

            const dx = t2.x - t1.x;
            const dy = t2.y - t1.y;
            const dz = t2.z - t1.z;
            const distSq = dx * dx + dy * dy + dz * dz * 0.6;

            if (distSq < minDSq && distSq > 0.001) {
              const dist = Math.sqrt(distSq);
              const normX = dx / dist;
              const normY = dy / dist;
              const push = (minD - dist) * 0.5;

              t1.x -= normX * push;
              t1.y -= normY * push;
              t2.x += normX * push;
              t2.y += normY * push;

              // Transfer momentum
              const relVx = t1.vx - t2.vx;
              const relVy = t1.vy - t2.vy;
              const dot = relVx * normX + relVy * normY;

              if (dot > 0) {
                const imp = dot * 0.40;
                t1.vx -= normX * imp;
                t1.vy -= normY * imp;
                t2.vx += normX * imp;
                t2.vy += normY * imp;
                t2.vz += Math.min(1.2, Math.abs(imp) * 0.08);
                t2.sleeping = false;
                t2.displaced = true;
                if (!t2.despawnTimer) t2.despawnTimer = 3.0;
                t2.needsRenderUpdate = true;
                anyMoving = true;
              }
            }
          }
        }
      }
    }

    this.hasActiveTires = anyMoving;
  }
}
