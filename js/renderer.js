import { CONFIG } from './config.js';
import { RAY_ANGLES } from './car.js';
import { TEAM_PALETTE } from './renderer3d.js';

const C = {
  grassBase: '#2d5a27',
  grassLight: '#35682e',
  grassDark: '#264e21',
  sand: '#c4a46a',
  asphalt: '#252932',
  asphaltDark: '#1b1e26',
  edgeLine: 'rgba(255, 255, 255, 0.75)',
  centerLine: 'rgba(255, 255, 255, 0.35)',
  kerbRed: '#dc2626',
  kerbWhite: '#f8fafc',
  barrier: 'rgba(255, 255, 255, 0.4)',
  leader: '#ffea00', // Pure High-Vis Racing Yellow
  player: '#00e626', // Pure High-Vis Electric Lime
  ghost: '#00e5ff',  // Pure Electric Neon Cyan
};

const TRAIL_LEN = 120;

export class Renderer {
  constructor(canvas, track) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.track = track;
    this.dpr = 1;
    this.w = 1;
    this.h = 1;
    this.cam = null;
    this.trail = [];
    this.trailOwner = null;
    this.bursts = [];
    this.skidmarks = [];
    this.tireSmokes = [];
    this.carPrevTires = new Map();
    this.grassPattern = this.createGrassPattern();
    this.buildPaths();
    this.buildTrees();
    this.resize();
  }

  createGrassPattern() {
    const pCanvas = document.createElement('canvas');
    pCanvas.width = 160;
    pCanvas.height = 160;
    const pCtx = pCanvas.getContext('2d');

    // 1. Lush natural meadow green base
    pCtx.fillStyle = C.grassBase;
    pCtx.fillRect(0, 0, 160, 160);

    // 2. Soft organic patches (NO STRIPES)
    const patchColors = ['#264e21', '#33642b', '#285122', '#38692f'];
    for (let i = 0; i < 20; i++) {
      const px = ((i * 47) % 160);
      const py = ((i * 89) % 160);
      const rad = 25 + ((i * 19) % 40);
      const grad = pCtx.createRadialGradient(px, py, 2, px, py, rad);
      grad.addColorStop(0, patchColors[i % patchColors.length]);
      grad.addColorStop(1, 'transparent');
      pCtx.fillStyle = grad;
      pCtx.globalAlpha = 0.4;
      pCtx.beginPath();
      pCtx.arc(px, py, rad, 0, Math.PI * 2);
      pCtx.fill();
    }
    pCtx.globalAlpha = 1.0;

    // 3. Subtle natural grass blades / flecks
    pCtx.fillStyle = 'rgba(255, 255, 255, 0.04)';
    for (let i = 0; i < 60; i++) {
      const rx = (i * 37) % 160;
      const ry = (i * 73) % 160;
      pCtx.fillRect(rx, ry, 2, 3);
    }
    pCtx.fillStyle = 'rgba(0, 0, 0, 0.06)';
    for (let i = 0; i < 60; i++) {
      const rx = (i * 53) % 160;
      const ry = (i * 29) % 160;
      pCtx.fillRect(rx, ry, 2, 2);
    }

    return this.ctx.createPattern(pCanvas, 'repeat');
  }

  setTrack(track) {
    this.track = track;
    this.cam = null;
    this.trail = [];
    this.trailOwner = null;
    this.skidmarks = [];
    this.tireSmokes = [];
    if (this.carPrevTires) this.carPrevTires.clear();
    this.buildPaths();
    this.buildTrees();
  }

  buildPaths() {
    const t = this.track;
    const N = t.N;
    const poly = (xs, ys) => {
      const p = new Path2D();
      p.moveTo(xs[0], ys[0]);
      for (let i = 1; i < N; i++) p.lineTo(xs[i], ys[i]);
      p.closePath();
      return p;
    };
    this.wallAPath = poly(t.ox, t.oy);
    this.wallBPath = poly(t.ix, t.iy);
    this.centerPath = poly(t.cx, t.cy);
    this.surface = new Path2D();
    this.surface.addPath(this.wallAPath);
    this.surface.addPath(this.wallBPath);

    // Faint checkpoint ticks
    this.ticks = new Path2D();
    for (let k = 20; k < N; k += 20) {
      this.ticks.moveTo(t.ix[k], t.iy[k]);
      this.ticks.lineTo(t.ox[k], t.oy[k]);
    }

    // Kerbs on tight sections of both walls (alternating stripes)
    this.kerbA = new Path2D();
    this.kerbB = new Path2D();
    this.sandTraps = new Path2D();
    const inset = 0.08;
    for (let k = 0; k < N; k++) {
      if (Math.abs(t.curvature[k]) < 1 / 160) continue;
      const j = t.wrap(k + 1);
      const p = k % 2 ? this.kerbA : this.kerbB;
      for (const [xs, ys] of [
        [t.ix, t.iy],
        [t.ox, t.oy],
      ]) {
        const ax = xs[k] + (t.cx[k] - xs[k]) * inset;
        const ay = ys[k] + (t.cy[k] - ys[k]) * inset;
        const bx = xs[j] + (t.cx[j] - xs[j]) * inset;
        const by = ys[j] + (t.cy[j] - ys[j]) * inset;
        p.moveTo(ax, ay);
        p.lineTo(bx, by);
      }

      // Add sand trap runoff on outside of hard turns
      if (Math.abs(t.curvature[k]) > 1 / 100) {
        const isTurnRight = t.curvature[k] > 0;
        const outX = isTurnRight ? t.ox : t.ix;
        const outY = isTurnRight ? t.oy : t.iy;
        const nx = -(t.cy[j] - t.cy[k]);
        const ny = t.cx[j] - t.cx[k];
        const len = Math.hypot(nx, ny) || 1;
        const sx = (nx / len) * (isTurnRight ? -24 : 24);
        const sy = (ny / len) * (isTurnRight ? -24 : 24);
        this.sandTraps.moveTo(outX[k], outY[k]);
        this.sandTraps.lineTo(outX[k] + sx, outY[k] + sy);
        this.sandTraps.lineTo(outX[j] + sx, outY[j] + sy);
        this.sandTraps.lineTo(outX[j], outY[j]);
      }
    }

    // Checkered start/finish line
    const cells = 8;
    const rows = 2;
    const sq = t.width / cells;
    this.checkA = new Path2D();
    this.checkB = new Path2D();
    const [ix, iy, ox, oy, tx, ty] = [t.ix[0], t.iy[0], t.ox[0], t.oy[0], t.tx[0], t.ty[0]];
    const P = (u, v) => [ix + (ox - ix) * u + tx * v, iy + (oy - iy) * u + ty * v];
    for (let r = 0; r < rows; r++) {
      for (let k = 0; k < cells; k++) {
        const p = (r + k) % 2 ? this.checkA : this.checkB;
        const u0 = k / cells;
        const u1 = (k + 1) / cells;
        const v0 = (r - rows / 2) * sq;
        const v1 = v0 + sq;
        p.moveTo(...P(u0, v0));
        p.lineTo(...P(u1, v0));
        p.lineTo(...P(u1, v1));
        p.lineTo(...P(u0, v1));
        p.closePath();
      }
    }
  }

  buildTrees() {
    this.trees = [];
    const t = this.track;
    const b = t.bounds;
    const minSafeDist = t.half + 40;
    const minSafeDistSq = minSafeDist * minSafeDist;

    // Deterministic PRNG based on track geometry
    let s = (Math.round(b.minX + b.minY + b.w * 13 + b.h * 17) & 0x7fffffff) || 48271;
    const rand = () => {
      s = (s * 1664525 + 1013904223) >>> 0;
      return s / 4294967296;
    };

    const pad = 260;
    const minX = b.minX - pad;
    const maxX = b.maxX + pad;
    const minY = b.minY - pad;
    const maxY = b.maxY + pad;

    // 1. Organic cluster centers (groves)
    const numClusters = 9 + Math.floor(rand() * 5);
    const clusterCenters = [];
    for (let c = 0; c < numClusters; c++) {
      clusterCenters.push({
        cx: minX + rand() * (maxX - minX),
        cy: minY + rand() * (maxY - minY),
        radius: 40 + rand() * 80,
        count: 2 + Math.floor(rand() * 4),
      });
    }

    // 2. Candidate tree positions
    const candidates = [];
    for (const cl of clusterCenters) {
      for (let i = 0; i < cl.count; i++) {
        const angle = rand() * Math.PI * 2;
        const dist = Math.sqrt(rand()) * cl.radius;
        candidates.push({ x: cl.cx + Math.cos(angle) * dist, y: cl.cy + Math.sin(angle) * dist });
      }
    }

    // Standalone trees for sparse natural meadow scattering
    const standalone = 16 + Math.floor(rand() * 8);
    for (let i = 0; i < standalone; i++) {
      candidates.push({ x: minX + rand() * (maxX - minX), y: minY + rand() * (maxY - minY) });
    }

    // 3. Filter distance to track and spacing between trees
    for (const cand of candidates) {
      const { x, y } = cand;
      if (x < minX || x > maxX || y < minY || y > maxY) continue;

      const nearestIdx = t.nearestIndex(x, y, 0, t.N / 2, t.N / 2);
      if (t.lateralDistSq(x, y, nearestIdx) > minSafeDistSq) {
        let tooClose = false;
        for (const ex of this.trees) {
          const d2 = (x - ex.x) ** 2 + (y - ex.y) ** 2;
          if (d2 < (ex.r * 0.75 + 12) ** 2) {
            tooClose = true;
            break;
          }
        }
        if (!tooClose) {
          // Broad size distribution: bushes (8-13), medium (14-22), mature (22-32)
          const roll = rand();
          let r;
          if (roll < 0.25) r = 8 + rand() * 5;
          else if (roll < 0.75) r = 14 + rand() * 8;
          else r = 22 + rand() * 10;

          const species = Math.floor(rand() * 4); // 0: Pine, 1: Oak, 2: Cypress, 3: Birch
          let color, light;

          if (species === 0) {
            // Pine: Dark Nordic forest emeralds
            const hue = 135 + (rand() - 0.5) * 16;
            const sat = 52 + rand() * 16;
            const lit = 14 + rand() * 8;
            color = `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${lit.toFixed(0)}%)`;
            light = `hsl(${hue.toFixed(0)}, ${(sat + 6).toFixed(0)}%, ${(lit + 12).toFixed(0)}%)`;
          } else if (species === 1) {
            // Oak: Lush summer canopy
            const hue = 108 + (rand() - 0.5) * 20;
            const sat = 48 + rand() * 18;
            const lit = 20 + rand() * 10;
            color = `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${lit.toFixed(0)}%)`;
            light = `hsl(${hue.toFixed(0)}, ${(sat + 8).toFixed(0)}%, ${(lit + 14).toFixed(0)}%)`;
          } else if (species === 2) {
            // Cypress: Dusty Mediterranean olive & sage
            const hue = 95 + (rand() - 0.5) * 14;
            const sat = 36 + rand() * 14;
            const lit = 18 + rand() * 8;
            color = `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${lit.toFixed(0)}%)`;
            light = `hsl(${hue.toFixed(0)}, ${(sat + 6).toFixed(0)}%, ${(lit + 10).toFixed(0)}%)`;
          } else {
            // Birch / Blossom: Golden amber & autumn ochre
            const hue = 38 + rand() * 24;
            const sat = 70 + rand() * 18;
            const lit = 34 + rand() * 10;
            color = `hsl(${hue.toFixed(0)}, ${sat.toFixed(0)}%, ${lit.toFixed(0)}%)`;
            light = `hsl(${hue.toFixed(0)}, ${(sat + 8).toFixed(0)}%, ${(lit + 14).toFixed(0)}%)`;
          }

          this.trees.push({
            x,
            y,
            r,
            species,
            color,
            light,
          });
        }
      }
    }
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.w = Math.max(10, rect.width);
    this.h = Math.max(10, rect.height);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.grassPattern = this.createGrassPattern();
  }

  render(sim, opts, leader) {
    const rect = this.canvas.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0 && (Math.abs(rect.width - this.w) > 1 || Math.abs(rect.height - this.h) > 1 || this.w <= 10)) {
      this.resize();
    }

    const { ctx, dpr } = this;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Camera: fit whole track, or follow the focus car zoomed in
    const b = this.track.bounds;
    const m = CONFIG.world.margin;
    const fit = Math.min(this.w / (b.w + 2 * m), this.h / (b.h + 2 * m));
    const focus = opts.manual && sim.player ? sim.player : leader;
    const target = opts.follow && focus
      ? { x: focus.x, y: focus.y, s: Math.max(fit * 1.5, Math.min(1.4, fit * 2.5)) }
      : { x: b.cx, y: b.cy, s: fit };

    if (!this.cam || isNaN(this.cam.s) || this.cam.s < 0.0001) {
      this.cam = { ...target };
    } else {
      const k = 0.12;
      this.cam.x += (target.x - this.cam.x) * k;
      this.cam.y += (target.y - this.cam.y) * k;
      this.cam.s += (target.s - this.cam.s) * k;
    }
    const s = this.cam.s;
    ctx.setTransform(dpr * s, 0, 0, dpr * s, dpr * (this.w / 2 - s * this.cam.x), dpr * (this.h / 2 - s * this.cam.y));

    this.drawTerrain();
    this.drawTrack();
    this.drawTireBarriers(sim);

    // Draw tire skid marks on asphalt
    this.updateSkidmarks(sim);
    this.drawSkidmarks();

    // Compute Dynamic Race Positions (P.1, P.2, ...) for all active cars
    const rankedCars = [];
    if (sim && sim.cars) {
      for (let i = 0; i < sim.cars.length; i++) {
        const c = sim.cars[i];
        if (c && (c.alive || c.finished) && !c.crashed) {
          rankedCars.push(c);
        }
      }
    }
    if (sim && sim.player && (sim.player.alive || sim.player.finished) && !sim.player.crashed) {
      rankedCars.push(sim.player);
    }

    rankedCars.sort((a, b) => {
      // 1. Finished cars permanently hold the top positions
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      // 2. Between finished cars, sort by finishTime (P1 stays P1, P2 stays P2)
      if (a.finished && b.finished) {
        const tA = a.finishTime !== undefined && a.finishTime !== null ? a.finishTime : a.time;
        const tB = b.finishTime !== undefined && b.finishTime !== null ? b.finishTime : b.time;
        return tA - tB;
      }
      // 3. For active cars, sort by lap count then track progress index
      if (a.laps !== b.laps) return b.laps - a.laps;
      return b.totalIdx - a.totalIdx;
    });

    const carRankMap = new Map();
    for (let rank = 0; rank < rankedCars.length; rank++) {
      carRankMap.set(rankedCars[rank], rank + 1);
    }

    // Identify Top 10 positions on track
    const top10 = rankedCars.slice(0, 10);
    const visibleSet = new Set(top10);
    if (sim && sim.player && sim.player.alive) visibleSet.add(sim.player);
    if (leader && leader.alive) visibleSet.add(leader);

    this.drawGhosts(sim.cars, leader, carRankMap, visibleSet);

    // Draw car death burst animations
    this.processDeathEvents(sim);
    this.drawBursts();
    this.drawTireSmokes();

    if (leader) {
      if (opts.sensors) this.drawRays(leader);
      const leaderTeamIdx = sim.cars ? sim.cars.indexOf(leader) : -1;
      const leaderTeam = leaderTeamIdx >= 0 ? TEAM_PALETTE[leaderTeamIdx % TEAM_PALETTE.length] : { hex: 0xffea00, secHex: 0xfacc15, accHex: 0xffffff };
      const rank = carRankMap.get(leader) || 1;
      this.drawCar(leader, leaderTeam, true, false, 1, rank);
    }
    if (sim.player) {
      if (opts.sensors) this.drawRays(sim.player);
      const rank = carRankMap.get(sim.player);
      this.drawCar(sim.player, C.player, false, true, 7, rank);
    }
  }

  processDeathEvents(sim) {
    if (!sim.deathEvents || sim.deathEvents.length === 0) return;
    const events = sim.deathEvents;
    // Limit to max 25 bursts per frame during turbo to avoid frame drops
    const count = Math.min(events.length, 25);
    for (let i = 0; i < count; i++) {
      this.addBurst(events[i]);
    }
    sim.deathEvents.length = 0;
  }

  addBurst(evt) {
    const { x, y, reason, speed, isPlayer } = evt;
    let colors = ['#f97316', '#fbbf24', '#ef4444', '#fef08a']; // Default crash: fire/orange
    if (reason === 'finished') {
      colors = ['#38bdf8', '#fbbf24', '#a855f7', '#ffffff']; // Finish line lap complete
    } else if (reason === 'wrong-way') {
      colors = ['#ec4899', '#f43f5e', '#a855f7', '#fbcfe8']; // Magenta/purple warning
    } else if (reason === 'stalled') {
      colors = ['#94a3b8', '#64748b', '#38bdf8', '#cbd5e1']; // Cyan smoke
    }
    if (isPlayer) {
      colors = ['#a3e635', '#22c55e', '#facc15', '#ffffff'];
    }

    const count = 16;
    const particles = [];
    const baseSpeed = Math.min(180, Math.max(60, (speed || 50) * 0.8));

    for (let i = 0; i < count; i++) {
      const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * 0.4;
      const spd = baseSpeed * (0.5 + Math.random() * 0.9);
      particles.push({
        x,
        y,
        vx: Math.cos(angle) * spd,
        vy: Math.sin(angle) * spd,
        size: 2 + Math.random() * 2.5,
        color: colors[Math.floor(Math.random() * colors.length)],
      });
    }

    this.bursts.push({
      x,
      y,
      particles,
      color: colors[0],
      startTime: performance.now(),
      duration: 520, // ms
      maxRadius: 36,
    });
  }

  drawBursts() {
    if (!this.bursts || this.bursts.length === 0) return;
    const ctx = this.ctx;
    const now = performance.now();
    const dt = 1 / 60; // standard time step for particle physics

    for (let i = this.bursts.length - 1; i >= 0; i--) {
      const b = this.bursts[i];
      const elapsed = now - b.startTime;
      const t = elapsed / b.duration;

      if (t >= 1) {
        this.bursts.splice(i, 1);
        continue;
      }

      const easeOut = 1 - Math.pow(1 - t, 3);
      const alpha = 1 - t;

      // 1. Shockwave expanding ring
      const ringRadius = 4 + b.maxRadius * easeOut;
      ctx.save();
      ctx.strokeStyle = b.color;
      ctx.globalAlpha = alpha * 0.85;
      ctx.lineWidth = Math.max(1, 3.5 * (1 - t));
      ctx.beginPath();
      ctx.arc(b.x, b.y, ringRadius, 0, Math.PI * 2);
      ctx.stroke();

      // 2. Center flash at the start
      if (t < 0.25) {
        const flashAlpha = (1 - t / 0.25) * 0.6;
        ctx.fillStyle = '#ffffff';
        ctx.globalAlpha = flashAlpha;
        ctx.beginPath();
        ctx.arc(b.x, b.y, 8 * (1 - t / 0.25), 0, Math.PI * 2);
        ctx.fill();
      }

      // 3. Spark particles
      for (const p of b.particles) {
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.vx *= 0.94; // air drag
        p.vy *= 0.94;

        ctx.fillStyle = p.color;
        ctx.globalAlpha = alpha;
        ctx.beginPath();
        ctx.arc(p.x, p.y, Math.max(0.5, p.size * (1 - t * 0.6)), 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
  }

  drawTerrain() {
    const ctx = this.ctx;
    const b = this.track.bounds;
    const pad = 900;

    // 1. Lush natural grass field
    ctx.fillStyle = this.grassPattern || C.grassBase;
    ctx.fillRect(b.minX - pad, b.minY - pad, b.w + pad * 2, b.h + pad * 2);

    // 2. Sand / Gravel traps outside sharp corners
    ctx.fillStyle = C.sand;
    ctx.fill(this.sandTraps);

    // 3. Natural Trees & foliage
    if (this.trees) {
      for (const tr of this.trees) {
        const { x, y, r, species, color, light } = tr;

        // Tree shadow
        ctx.fillStyle = 'rgba(8, 20, 10, 0.38)';
        ctx.beginPath();
        if (species === 2) {
          // Cypress: Slender elongated shadow
          ctx.ellipse(x + r * 0.35, y + r * 0.45, r * 0.55, r * 1.1, 0.25, 0, Math.PI * 2);
        } else {
          ctx.ellipse(x + r * 0.3, y + r * 0.35, r * 1.05, r * 0.72, 0, 0, Math.PI * 2);
        }
        ctx.fill();

        if (species === 0) {
          // Alpine Pine: Layered 6-pointed needle star polygon
          ctx.fillStyle = color;
          ctx.beginPath();
          const pts = 6;
          for (let p = 0; p < pts * 2; p++) {
            const rad = p % 2 === 0 ? r : r * 0.65;
            const a = (p * Math.PI) / pts - Math.PI / 2;
            const px = x + Math.cos(a) * rad;
            const py = y + Math.sin(a) * rad;
            if (p === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();

          // Inner highlight star
          ctx.fillStyle = light;
          ctx.beginPath();
          for (let p = 0; p < pts * 2; p++) {
            const rad = p % 2 === 0 ? r * 0.58 : r * 0.35;
            const a = (p * Math.PI) / pts - Math.PI / 2;
            const px = x - r * 0.12 + Math.cos(a) * rad;
            const py = y - r * 0.12 + Math.sin(a) * rad;
            if (p === 0) ctx.moveTo(px, py);
            else ctx.lineTo(px, py);
          }
          ctx.closePath();
          ctx.fill();
        } else if (species === 1) {
          // Broadleaf Oak: 3 overlapping clustered organic lobes
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, r * 0.85, 0, Math.PI * 2);
          ctx.arc(x - r * 0.35, y + r * 0.2, r * 0.55, 0, Math.PI * 2);
          ctx.arc(x + r * 0.35, y - r * 0.2, r * 0.52, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = light;
          ctx.beginPath();
          ctx.arc(x - r * 0.2, y - r * 0.2, r * 0.55, 0, Math.PI * 2);
          ctx.fill();
        } else if (species === 2) {
          // Columnar Cypress: Compact sleek vertical oval
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.ellipse(x, y, r * 0.55, r * 0.95, 0, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = light;
          ctx.beginPath();
          ctx.ellipse(x - r * 0.12, y - r * 0.15, r * 0.35, r * 0.65, 0, 0, Math.PI * 2);
          ctx.fill();
        } else {
          // Golden Birch / Autumn Tree: Bright golden circle with soft inner highlight
          ctx.fillStyle = color;
          ctx.beginPath();
          ctx.arc(x, y, r, 0, Math.PI * 2);
          ctx.fill();

          ctx.fillStyle = light;
          ctx.beginPath();
          ctx.arc(x - r * 0.22, y - r * 0.22, r * 0.62, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    }
  }

  drawTrack() {
    const ctx = this.ctx;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';

    // 1. Soft asphalt road shadow onto natural grass
    ctx.shadowColor = 'rgba(0, 0, 0, 0.45)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetX = 3;
    ctx.shadowOffsetY = 4;
    ctx.fillStyle = C.asphalt;
    ctx.fill(this.surface, 'evenodd');
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;

    // 2. Solid asphalt surface
    ctx.fillStyle = C.asphalt;
    ctx.fill(this.surface, 'evenodd');

    // 3. Faint distance / checkpoint markers
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke(this.ticks);

    // 4. Centerline dashed road paint
    ctx.setLineDash([14, 18]);
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.centerLine;
    ctx.stroke(this.centerPath);
    ctx.setLineDash([]);

    // 5. Motorsport Red & White apex kerbs
    ctx.lineCap = 'butt';
    ctx.lineWidth = 6;
    ctx.strokeStyle = C.kerbRed;
    ctx.stroke(this.kerbA);
    ctx.strokeStyle = C.kerbWhite;
    ctx.stroke(this.kerbB);
    ctx.lineCap = 'round';

    // 6. White track edge boundary lines (inner & outer)
    ctx.lineWidth = 2;
    ctx.strokeStyle = C.edgeLine;
    ctx.stroke(this.wallAPath);
    ctx.stroke(this.wallBPath);

    // 7. Checkered start/finish grid
    ctx.fillStyle = 'rgba(248, 250, 252, 0.95)';
    ctx.fill(this.checkA);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.95)';
    ctx.fill(this.checkB);

    // 8. Track boundary line
    this.glowStroke(this.wallAPath, C.barrier);
    this.glowStroke(this.wallBPath, C.barrier);
  }

  glowStroke(path, color) {
    const ctx = this.ctx;
    ctx.strokeStyle = color;
    ctx.globalAlpha = 0.06;
    ctx.lineWidth = 12;
    ctx.stroke(path);
    ctx.globalAlpha = 0.15;
    ctx.lineWidth = 4;
    ctx.stroke(path);
    ctx.globalAlpha = 1;
  }

  drawTireBarriers(sim) {
    if (!sim?.tireBarriers?.tires || sim.tireBarriers.tires.length === 0) return;
    const ctx = this.ctx;
    const tires = sim.tireBarriers.tires;

    ctx.save();
    for (let i = 0; i < tires.length; i++) {
      const t = tires[i];
      // 1. Soft ground contact shadow
      ctx.fillStyle = 'rgba(0, 0, 0, 0.38)';
      ctx.beginPath();
      ctx.arc(t.x + 0.4, t.y + 0.5, t.radius * 1.05, 0, Math.PI * 2);
      ctx.fill();

      // 2. Outer Rubber Tread with FIA color coding
      const r = Math.round(t.color.r * 255);
      const g = Math.round(t.color.g * 255);
      const b = Math.round(t.color.b * 255);
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius, 0, Math.PI * 2);
      ctx.fill();

      // 3. Inner Center Void / Rim Hub
      ctx.fillStyle = '#111620';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.46, 0, Math.PI * 2);
      ctx.fill();

      // 4. Subtle Outer Bead Highlight
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.22)';
      ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.radius * 0.85, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawGhosts(cars, leader, carRankMap = null, visibleBadgeSet = null) {
    for (let i = 0; i < cars.length; i++) {
      const car = cars[i];
      if ((!car.alive && !car.finished) || car === leader) continue;
      const team = TEAM_PALETTE[i % TEAM_PALETTE.length];
      const carNum = i + 2;
      const showBadge = (visibleBadgeSet && visibleBadgeSet.has(car)) || car.crashed || car.finished;
      const rank = (showBadge && carRankMap) ? carRankMap.get(car) : null;
      this.drawCar(car, team, false, false, carNum, rank);
    }
  }

  drawCar(car, teamOrColor, isLeader = false, isPlayer = false, carNum = 1, posRank = null) {
    const ctx = this.ctx;
    const L = CONFIG.car.length;
    const W = CONFIG.car.width;

    const isTeamObj = typeof teamOrColor === 'object' && teamOrColor !== null;
    const primaryColor = isPlayer
      ? C.player
      : isTeamObj && teamOrColor.hex
        ? '#' + teamOrColor.hex.toString(16).padStart(6, '0')
        : (teamOrColor || '#e11d48');

    const secondaryColor = isPlayer
      ? '#facc15'
      : isTeamObj && teamOrColor.secHex
        ? '#' + teamOrColor.secHex.toString(16).padStart(6, '0')
        : '#ffffff';

    const accentColor = isPlayer
      ? '#ffffff'
      : isTeamObj && teamOrColor.accHex
        ? '#' + teamOrColor.accHex.toString(16).padStart(6, '0')
        : '#0f172a';

    const quadColor = isPlayer
      ? '#00e626'
      : isTeamObj && teamOrColor.quadHex
        ? '#' + teamOrColor.quadHex.toString(16).padStart(6, '0')
        : secondaryColor;

    ctx.save();
    ctx.translate(car.x, car.y);
    ctx.rotate(car.angle);

    // Front Carbon Splitter (Accent Color Highlights)
    ctx.fillStyle = accentColor === '#ffffff' ? '#0f172a' : accentColor;
    ctx.fillRect(L * 0.35, -W * 0.54, L * 0.16, W * 1.08);

    // Main sculpted chassis body (Color 1: Primary)
    if (isLeader || isPlayer) {
      ctx.shadowColor = primaryColor;
      ctx.shadowBlur = 18;
    }
    ctx.fillStyle = primaryColor;
    ctx.beginPath();
    ctx.moveTo(L * 0.48, 0); // nose tip
    ctx.lineTo(L * 0.36, -W * 0.38);
    ctx.lineTo(-L * 0.40, -W * 0.44); // left rear
    ctx.lineTo(-L * 0.46, -W * 0.35);
    ctx.lineTo(-L * 0.46, W * 0.35);
    ctx.lineTo(-L * 0.40, W * 0.44); // right rear
    ctx.lineTo(L * 0.36, W * 0.38);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;

    // Sculpted Aerodynamic Sidepods & Radiator Inlets (Color 4: Quad)
    ctx.fillStyle = quadColor;
    ctx.beginPath();
    ctx.roundRect(-L * 0.18, -W * 0.46, L * 0.40, W * 0.15, 2);
    ctx.roundRect(-L * 0.18, W * 0.31, L * 0.40, W * 0.15, 2);
    ctx.fill();

    // Dual Racing Stripes along Hood (Color 2: Secondary)
    ctx.fillStyle = secondaryColor;
    ctx.fillRect(-L * 0.38, -3.2, L * 0.76, 1.2);
    ctx.fillRect(-L * 0.38, 2.0, L * 0.76, 1.2);

    // Front Nose Cone Trim (Color 2: Secondary)
    ctx.beginPath();
    ctx.moveTo(L * 0.48, 0);
    ctx.lineTo(L * 0.32, -W * 0.22);
    ctx.lineTo(L * 0.32, W * 0.22);
    ctx.closePath();
    ctx.fill();

    // Race Number Roundel on Hood - 80% Translucent White (20% Opacity)
    ctx.fillStyle = isLeader ? '#facc15' : isPlayer ? '#a3e635' : 'rgba(255, 255, 255, 0.20)';
    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.roundRect(L * 0.08, -3.4, 6.8, 6.8, 2);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#0f172a';
    ctx.font = '900 5.5px "Outfit", Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(carNum), L * 0.08 + 3.4, 0.4);

    // Dark Tinted Cockpit Visor / Canopy
    ctx.fillStyle = '#090d16';
    ctx.beginPath();
    ctx.roundRect(-L * 0.16, -W * 0.28, L * 0.26, W * 0.56, 2);
    ctx.fill();

    // GT / Formula Rear Wing with Endplates
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(-L * 0.48, -W * 0.56, 2.5, W * 1.12);

    // Endplates (Accent Color)
    ctx.fillStyle = accentColor;
    ctx.fillRect(-L * 0.50, -W * 0.58, 3.8, 1.6);
    ctx.fillRect(-L * 0.50, W * 0.58 - 1.6, 3.8, 1.6);

    // Rear Red LED Rain Light
    ctx.fillStyle = '#ff1e1e';
    ctx.fillRect(-L * 0.48, -1.2, 1.5, 2.4);

    // Front LED Headlights
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(L * 0.36, -W * 0.34, 2.2, 2.5);
    ctx.fillRect(L * 0.36, W * 0.34 - 2.5, 2.2, 2.5);

    // Floating P.x Position Badge / ELIMINATED Badge Over Car
    if (car.crashed) {
      ctx.save();
      // Keep badge horizontally upright relative to screen orientation
      ctx.rotate(-car.angle);
      ctx.translate(0, -W * 0.9 - 10);

      ctx.fillStyle = 'rgba(220, 38, 38, 0.95)';
      ctx.strokeStyle = '#fca5a5';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(-24, -6.5, 48, 13, 6.5);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 7px "Outfit", "Arial Black", Impact, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('ELIMINATED', 0, 0.5);
      ctx.restore();
    } else if (posRank) {
      ctx.save();
      // Keep badge horizontally upright relative to screen orientation
      ctx.rotate(-car.angle);
      ctx.translate(0, -W * 0.9 - 6.5);

      let badgeBg = 'rgba(8, 14, 26, 0.45)';
      let badgeBorder = 'rgba(56, 189, 248, 0.85)';
      let textCol = '#ffffff';
      if (posRank === 1) {
        badgeBg = 'rgba(45, 30, 5, 0.52)';
        badgeBorder = '#fbbf24';
        textCol = '#fef08a';
      } else if (posRank === 2) {
        badgeBg = 'rgba(25, 30, 42, 0.48)';
        badgeBorder = '#cbd5e1';
      } else if (posRank === 3) {
        badgeBg = 'rgba(45, 22, 6, 0.52)';
        badgeBorder = '#fb923c';
        textCol = '#ffedd5';
      }

      ctx.fillStyle = badgeBg;
      ctx.strokeStyle = badgeBorder;
      ctx.lineWidth = 1.2;
      ctx.beginPath();
      ctx.arc(0, 0, 5.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = textCol;
      const fSize = posRank >= 10 ? '6.5px' : '7.5px';
      ctx.font = `900 ${fSize} "Outfit", "Arial Black", Impact, sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${posRank}`, 0, 0.5);
      ctx.restore();
    }

    ctx.restore();
  }

  drawRays(car) {
    const ctx = this.ctx;
    const Lmax = CONFIG.sensors.length;
    ctx.lineWidth = 1.2;
    for (let r = 0; r < RAY_ANGLES.length; r++) {
      const a = car.angle + RAY_ANGLES[r];
      const d = car.rayDist[r];
      const ex = car.x + Math.cos(a) * d;
      const ey = car.y + Math.sin(a) * d;
      const hue = 140 * (d / Lmax); // red (close) → green (far)
      ctx.strokeStyle = `hsla(${hue}, 90%, 60%, 0.5)`;
      ctx.beginPath();
      ctx.moveTo(car.x, car.y);
      ctx.lineTo(ex, ey);
      ctx.stroke();
      if (d < Lmax) {
        ctx.fillStyle = `hsl(${hue}, 95%, 62%)`;
        ctx.beginPath();
        ctx.arc(ex, ey, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }

  updateTrail(leader) {
    if (leader !== this.trailOwner) {
      this.trail.length = 0;
      this.trailOwner = leader;
    }
    if (!leader) return;
    this.trail.push(leader.x, leader.y);
    if (this.trail.length > TRAIL_LEN * 2) this.trail.splice(0, 2);
  }

  drawTrail() {
    const ctx = this.ctx;
    const t = this.trail;
    const n = t.length / 2;
    if (n < 2) return;
    ctx.lineWidth = 2.0;
    for (let i = 1; i < n; i++) {
      ctx.strokeStyle = `rgba(251, 191, 36, ${(i / n) * 0.25})`;
      ctx.beginPath();
      ctx.moveTo(t[(i - 1) * 2], t[(i - 1) * 2 + 1]);
      ctx.lineTo(t[i * 2], t[i * 2 + 1]);
      ctx.stroke();
    }
  }

  updateSkidmarks(sim) {
    if (!sim || !sim.cars) return;
    const allCars = sim.player && sim.player.alive ? [sim.player, ...sim.cars] : sim.cars;
    const maxSkidSegments = 60000;

    for (let i = 0; i < allCars.length; i++) {
      const car = allCars[i];
      if (!car || !car.alive || car.finished) {
        if (this.carPrevTires.has(car)) this.carPrevTires.delete(car);
        continue;
      }

      // Smooth, gradual skid intensity modeling (no harsh binary on/off)
      const slipMag = Math.abs(car.slipAngle || 0);
      const slipNorm = Math.max(0, Math.min(1.0, (slipMag - 0.025) / 0.14));
      const slipInt = Math.pow(slipNorm, 1.8) * 0.88;

      const brakeNorm = (car.throttle < -0.05 && car.speed > 20)
        ? Math.max(0, Math.min(1.0, (-car.throttle - 0.05) / 0.85))
        : 0;
      const brakeInt = Math.pow(brakeNorm, 1.9) * 0.82;

      const spinNorm = (car.throttle > 0.60 && car.speed < 90 && !car.crashed)
        ? Math.max(0, Math.min(1.0, (car.throttle - 0.60) / 0.40 * (1.0 - car.speed / 90)))
        : 0;
      const spinInt = Math.pow(spinNorm, 1.6) * 0.78;

      const crashInt = (car.crashed && car.speed > 6) ? Math.min(0.88, car.speed / 80) : 0;

      const intensity = Math.min(0.90, Math.max(slipInt, brakeInt, spinInt, crashInt));

      const cos = Math.cos(car.angle);
      const sin = Math.sin(car.angle);
      // Contact patch of Left and Right rear tires
      const lx = car.x - cos * 8.0 - sin * 5.2;
      const ly = car.y - sin * 8.0 + cos * 5.2;
      const rx = car.x - cos * 8.0 + sin * 5.2;
      const ry = car.y - sin * 8.0 - cos * 5.2;

      const prev = this.carPrevTires.get(car);
      if (prev && intensity > 0.015) {
        const dL = Math.hypot(lx - prev.lx, ly - prev.ly);
        if (dL > 0.35 && dL < 35) {
          this.skidmarks.push({
            x0: prev.lx, y0: prev.ly,
            x1: lx, y1: ly,
            alpha: intensity * 0.85
          });
          this.skidmarks.push({
            x0: prev.rx, y0: prev.ry,
            x1: rx, y1: ry,
            alpha: intensity * 0.85
          });
          if (this.skidmarks.length > maxSkidSegments) {
            this.skidmarks.splice(0, this.skidmarks.length - maxSkidSegments);
          }

          // Emit continuous ribbon quad smoke on heavier scrubbing
          if (intensity > 0.32) {
            const normX = -sin;
            const normY = -cos;
            const smokeAlpha = (intensity - 0.32) / 0.68 * 0.35;
            this.tireSmokes.push({
              p0x: prev.lx, p0y: prev.ly,
              p1x: lx, p1y: ly,
              nx: normX, ny: normY,
              w0: 1.0, w1: 1.0,
              alpha: smokeAlpha,
              life: 1.0,
              decay: 1.45 + Math.random() * 0.35,
            });
            this.tireSmokes.push({
              p0x: prev.rx, p0y: prev.ry,
              p1x: rx, p1y: ry,
              nx: normX, ny: normY,
              w0: 1.0, w1: 1.0,
              alpha: smokeAlpha,
              life: 1.0,
              decay: 1.45 + Math.random() * 0.35,
            });
            if (this.tireSmokes.length > 300) {
              this.tireSmokes.splice(0, this.tireSmokes.length - 300);
            }
          }
        }
      }
      this.carPrevTires.set(car, { lx, ly, rx, ry });
    }
  }

  drawSkidmarks() {
    if (!this.skidmarks || this.skidmarks.length === 0) return;
    const ctx = this.ctx;
    ctx.save();
    ctx.lineWidth = 1.6;
    ctx.lineCap = 'round';
    for (let i = 0; i < this.skidmarks.length; i++) {
      const s = this.skidmarks[i];
      ctx.strokeStyle = `rgba(15, 18, 24, ${s.alpha})`;
      ctx.beginPath();
      ctx.moveTo(s.x0, s.y0);
      ctx.lineTo(s.x1, s.y1);
      ctx.stroke();
    }
    ctx.restore();
  }

  drawTireSmokes() {
    if (!this.tireSmokes || this.tireSmokes.length === 0) return;
    const ctx = this.ctx;
    const dt = 1 / 60;
    ctx.save();
    for (let i = this.tireSmokes.length - 1; i >= 0; i--) {
      const s = this.tireSmokes[i];
      s.life -= s.decay * dt;
      if (s.life <= 0) {
        this.tireSmokes.splice(i, 1);
        continue;
      }
      s.w0 += 2.8 * dt;
      s.w1 += 2.8 * dt;

      const alpha = s.alpha * Math.pow(s.life, 1.25) * 0.40;

      const p0lx = s.p0x - s.nx * s.w0;
      const p0ly = s.p0y - s.ny * s.w0;
      const p0rx = s.p0x + s.nx * s.w0;
      const p0ry = s.p0y + s.ny * s.w0;

      const p1lx = s.p1x - s.nx * s.w1;
      const p1ly = s.p1y - s.ny * s.w1;
      const p1rx = s.p1x + s.nx * s.w1;
      const p1ry = s.p1y + s.ny * s.w1;

      ctx.fillStyle = `rgba(235, 240, 248, ${alpha})`;
      ctx.beginPath();
      ctx.moveTo(p0lx, p0ly);
      ctx.lineTo(p0rx, p0ry);
      ctx.lineTo(p1rx, p1ry);
      ctx.lineTo(p1lx, p1ly);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
  }
}
