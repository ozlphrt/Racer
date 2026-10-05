import { TEAM_PALETTE } from './renderer3d.js';

function toHexColor(hexNum, defaultHex = '#38bdf8') {
  if (typeof hexNum === 'number') {
    return '#' + hexNum.toString(16).padStart(6, '0');
  }
  return hexNum || defaultHex;
}

export function generateCarSideviewSvg(teamIdx = 0, isPlayer = false) {
  let priColor, secColor, accColor, quadColor;

  if (isPlayer) {
    priColor = '#00e626'; // High-vis Lime
    secColor = '#facc15'; // Modena Yellow
    accColor = '#ffffff'; // White
    quadColor = '#00e626';
  } else {
    const team = TEAM_PALETTE[teamIdx % TEAM_PALETTE.length] || TEAM_PALETTE[0];
    priColor = toHexColor(team.hex, '#e11d48');
    secColor = toHexColor(team.secHex, '#facc15');
    accColor = toHexColor(team.accHex, '#ffffff');
    quadColor = toHexColor(team.quadHex || team.secHex, '#38bdf8');
  }

  const uid = `${isPlayer ? 'p' : 't' + teamIdx}_${(Math.random() * 100000 | 0)}`;

  return `
    <svg class="car-sideview-svg" viewBox="0 0 100 28" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="bodyGrad_${uid}" x1="0%" y1="0%" x2="100%" y2="40%">
          <stop offset="0%" stop-color="${priColor}" />
          <stop offset="100%" stop-color="${priColor}" stop-opacity="0.9" />
        </linearGradient>
        <linearGradient id="tireGrad_${uid}" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="60%" stop-color="#1e293b" />
          <stop offset="100%" stop-color="#0f172a" />
        </linearGradient>
      </defs>

      <!-- Rear Wing Endplate & Flap Elements -->
      <path d="M 4,4 L 17,4 L 16,16 L 6,16 Z" fill="${accColor}" />
      <rect x="2" y="2.5" width="3" height="15" rx="1" fill="${accColor}" stroke="#0f172a" stroke-width="0.5" />
      <path d="M 5,6 L 16,6" stroke="#ffffff" stroke-width="1.2" stroke-linecap="round" opacity="0.85" />
      <rect x="13" y="10" width="2" height="7" fill="#0f172a" />

      <!-- Shark Fin & Dorsal Spine -->
      <path d="M 17,6 L 38,11 L 17,16 Z" fill="${accColor}" />

      <!-- Main Monocoque Chassis -->
      <path d="M 14,14 L 32,8 L 48,9 L 70,14 L 92,18 L 95,21 L 14,21 Z" fill="url(#bodyGrad_${uid})" />

      <!-- Sidepod Aerodynamic Undercut & Intake -->
      <path d="M 36,12 Q 54,12 66,16 L 36,16 Z" fill="${secColor}" opacity="0.95" />
      <path d="M 33,10 L 37,10 L 38,15 L 34,15 Z" fill="#090d16" />

      <!-- Nosecone & Front Wing Assembly -->
      <path d="M 64,13.5 L 88,17.5 L 96,21 L 64,17.5 Z" fill="${secColor}" />
      <path d="M 86,19.5 L 98,19.5 L 97,22 L 85,22 Z" fill="${accColor}" />
      <rect x="94" y="17" width="2.5" height="6.5" rx="0.8" fill="${accColor}" stroke="#0f172a" stroke-width="0.5" />

      <!-- Cockpit & Driver Helmet with Visor -->
      <circle cx="43" cy="9.5" r="3.4" fill="#0f172a" />
      <path d="M 42,8.2 Q 46.5,8.2 45.8,10.8 Q 41.5,10.8 42,8.2 Z" fill="#38bdf8" />
      <path d="M 36,10 L 49,10 L 51,14.5 L 35,14.5 Z" fill="#070d18" />

      <!-- Titanium Halo Safety Structure -->
      <path d="M 39,6.5 Q 46,5.2 52,9.5" stroke="#f1f5f9" stroke-width="1.6" stroke-linecap="round" fill="none" />

      <!-- REAR WHEEL (Center 19, 21 - High-Contrast Pirelli Competition Rim) -->
      <circle cx="19" cy="21" r="6.8" fill="url(#tireGrad_${uid})" stroke="#64748b" stroke-width="0.8" />
      <circle cx="19" cy="21" r="5.4" fill="none" stroke="#facc15" stroke-width="0.9" stroke-dasharray="6 2" />
      <circle cx="19" cy="21" r="4.0" fill="#1e293b" stroke="#94a3b8" stroke-width="0.6" />
      <circle cx="19" cy="21" r="1.6" fill="#f59e0b" />

      <!-- FRONT WHEEL (Center 78, 21 - High-Contrast Pirelli Competition Rim) -->
      <circle cx="78" cy="21" r="6.8" fill="url(#tireGrad_${uid})" stroke="#64748b" stroke-width="0.8" />
      <circle cx="78" cy="21" r="5.4" fill="none" stroke="#facc15" stroke-width="0.9" stroke-dasharray="6 2" />
      <circle cx="78" cy="21" r="4.0" fill="#1e293b" stroke="#94a3b8" stroke-width="0.6" />
      <circle cx="78" cy="21" r="1.6" fill="#f59e0b" />
    </svg>
  `.trim();
}

export class LeaderboardTower {
  constructor(containerEl, onSelectCar = null) {
    this.container = containerEl;
    this.onSelectCar = onSelectCar;
    this.maxVisible = 6;
    this.rowHeight = 32;

    this.carMetaMap = new Map();
    this.initDom();
  }

  initDom() {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="tower-header">
        <div class="tower-title-group">
          <span class="tower-live-dot"></span>
          <span class="tower-title">LEADERBOARD</span>
        </div>
        <div class="tower-mode-badge">TOP 3 + 3</div>
      </div>
      <div class="tower-list-container">
        <div class="tower-list" id="tower-list-rows" style="height: ${this.maxVisible * this.rowHeight}px;">
        </div>
      </div>
    `;
    this.listEl = this.container.querySelector('#tower-list-rows');
  }

  getCarMeta(car, sim) {
    let meta = this.carMetaMap.get(car);
    if (!meta) {
      const isPlayer = car === sim.player || car.manual;
      const carIdx = sim.cars ? sim.cars.indexOf(car) : 0;
      const teamIdx = isPlayer ? 1 : (carIdx % TEAM_PALETTE.length);

      const carNum = isPlayer ? 7 : (carIdx + 1);
      const displayName = isPlayer ? 'YOU' : `CAR #${carNum}`;
      const svgHtml = generateCarSideviewSvg(teamIdx, isPlayer);

      // Create row DOM: [Rank] [Sideview SVG] [Name] [Status/Gap]
      const row = document.createElement('div');
      row.className = 'tower-row';
      row.style.transform = `translateY(${this.rowHeight * 15}px)`;
      row.innerHTML = `
        <div class="row-rank-badge pos-field">1</div>
        <div class="row-car-preview">${svgHtml}</div>
        <div class="row-car-title ${isPlayer ? 'is-player-text' : ''}">${displayName}</div>
        <div class="row-gap-badge">--.--s</div>
      `;

      row.addEventListener('click', () => {
        if (this.onSelectCar) this.onSelectCar(car);
      });

      this.listEl?.appendChild(row);

      meta = {
        element: row,
        rankEl: row.querySelector('.row-rank-badge'),
        gapEl: row.querySelector('.row-gap-badge'),
        prevRank: null,
        isPlayer,
        carNum,
        displayName,
      };
      this.carMetaMap.set(car, meta);
    }
    return meta;
  }

  update(sim, leaderCar) {
    if (!this.listEl || !sim) return;

    // 1. Gather all active candidate cars
    const active = [];
    if (sim.cars) {
      for (let i = 0; i < sim.cars.length; i++) {
        const c = sim.cars[i];
        if (c && (c.alive || c.finished || c.crashed)) {
          active.push(c);
        }
      }
    }
    if (sim.player && (sim.player.alive || sim.player.finished || sim.player.crashed)) {
      active.push(sim.player);
    }

    // 2. Strict Race Position Sorting (P1 at index 0, P1 stays P1 after crossing line)
    active.sort((a, b) => {
      // Finished cars first
      if (a.finished !== b.finished) return a.finished ? -1 : 1;
      // Between finished cars, sort by finishTime
      if (a.finished && b.finished) {
        const tA = a.finishTime !== undefined && a.finishTime !== null ? a.finishTime : a.time;
        const tB = b.finishTime !== undefined && b.finishTime !== null ? b.finishTime : b.time;
        return tA - tB;
      }
      // Living cars ahead of crashed cars
      if (a.crashed !== b.crashed) return a.crashed ? 1 : -1;
      // Lap count
      if (a.laps !== b.laps) return b.laps - a.laps;
      // Total track progress index
      return b.totalIdx - a.totalIdx;
    });

    const carTrueRankMap = new Map();
    for (let r = 0; r < active.length; r++) {
      carTrueRankMap.set(active[r], r + 1);
    }

    // 3. Filter to Top 3 positions and the 3 cars nearest to them
    const top3 = active.slice(0, 3);
    const chosenSet = new Set(top3);
    if (sim.player && (sim.player.alive || sim.player.finished)) chosenSet.add(sim.player);

    const remaining = active.filter((c) => !chosenSet.has(c));
    if (remaining.length > 0 && top3.length > 0) {
      remaining.sort((a, b) => {
        let minA = Infinity;
        let minB = Infinity;
        for (const t of top3) {
          const dA = Math.hypot(a.x - t.x, a.y - t.y);
          const dB = Math.hypot(b.x - t.x, b.y - t.y);
          if (dA < minA) minA = dA;
          if (dB < minB) minB = dB;
        }
        return minA - minB;
      });
      for (let k = 0; k < Math.min(3, remaining.length); k++) {
        chosenSet.add(remaining[k]);
      }
    }

    const displayCars = active.filter((c) => chosenSet.has(c)).slice(0, this.maxVisible);
    const displaySet = new Set(displayCars);

    const leader = active[0] || leaderCar;
    const leaderProgress = leader ? (leader.laps * 400 + leader.totalIdx) : 0;

    // 4. Animate each visible driver into their vertical slot
    for (let slotIdx = 0; slotIdx < displayCars.length; slotIdx++) {
      const car = displayCars[slotIdx];
      const rank = carTrueRankMap.get(car) || (slotIdx + 1);
      const meta = this.getCarMeta(car, sim);
      const row = meta.element;

      // Vertical position animation via CSS transform (Smooth 60FPS FLIP)
      row.style.transform = `translateY(${slotIdx * this.rowHeight}px)`;
      row.style.opacity = '1';
      row.style.pointerEvents = 'auto';

      // Highlight row if currently followed by camera or player
      row.classList.toggle('is-leader', car === leaderCar);
      row.classList.toggle('is-player', meta.isPlayer);
      row.classList.toggle('is-crashed', car.crashed && !car.finished);
      row.classList.toggle('is-finished', car.finished);

      // Rank Badge Styling
      if (meta.rankEl) {
        meta.rankEl.textContent = rank;
        meta.rankEl.className = `row-rank-badge ${
          rank === 1 ? 'pos-p1' : rank === 2 ? 'pos-p2' : rank === 3 ? 'pos-p3' : 'pos-field'
        }`;
      }

      // Overtake flash
      if (meta.prevRank !== null && meta.prevRank !== rank) {
        const delta = meta.prevRank - rank;
        if (delta > 0) {
          row.classList.add('overtake-flash-green');
          setTimeout(() => row.classList.remove('overtake-flash-green'), 500);
        } else if (delta < 0) {
          row.classList.add('overtake-flash-red');
          setTimeout(() => row.classList.remove('overtake-flash-red'), 500);
        }
      }
      meta.prevRank = rank;

      // Gap / Status Badge
      if (meta.gapEl) {
        if (car.finished) {
          meta.gapEl.textContent = 'FINISH';
          meta.gapEl.className = 'row-gap-badge finish';
        } else if (car.crashed) {
          meta.gapEl.textContent = 'OUT';
          meta.gapEl.className = 'row-gap-badge out';
        } else if (rank === 1) {
          if (car.bestLap && Number.isFinite(car.bestLap) && car.bestLap < 9999) {
            meta.gapEl.textContent = `${car.bestLap.toFixed(2)}s`;
          } else {
            const curLap = Math.max(0, car.time - (car.lapStart || 0));
            meta.gapEl.textContent = `${curLap.toFixed(1)}s`;
          }
          meta.gapEl.className = 'row-gap-badge leader';
        } else {
          // Interval gap estimation
          const carProg = car.laps * 400 + car.totalIdx;
          const distBehind = Math.max(0, leaderProgress - carProg);
          const gapSec = (distBehind / Math.max(80, car.speed || 200)).toFixed(1);
          meta.gapEl.textContent = `+${gapSec}s`;
          meta.gapEl.className = 'row-gap-badge gap';
        }
      }
    }

    // Hide cars not in the display set
    for (const [car, meta] of this.carMetaMap) {
      if (!displaySet.has(car)) {
        meta.element.style.opacity = '0';
        meta.element.style.pointerEvents = 'none';
        meta.element.style.transform = `translateY(${this.maxVisible * this.rowHeight + 20}px)`;
      }
    }
  }

  reset() {
    this.carMetaMap.forEach((meta) => {
      meta.element?.remove();
    });
    this.carMetaMap.clear();
  }
}
