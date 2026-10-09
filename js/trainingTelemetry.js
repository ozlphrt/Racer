/**
 * Neural Training Telemetry & Diagnostic Engine
 * Analyzes evolutionary trajectory, detects plateaus, pace breakthroughs,
 * and renders high-density sparkline trends for telemetry tiles.
 */

/**
 * Format compact number with k/M suffix
 */
function fmtNum(v) {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  if (a >= 1e6) return (v / 1e6).toFixed(1) + 'M';
  if (a >= 1e3) return (v / 1e3).toFixed(1) + 'k';
  return v.toFixed(0);
}
const compact = fmtNum;

/**
 * Helper to prepare high-DPI canvas
 */
function initTileCanvas(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const w = rect.width > 0 ? rect.width : (canvas.width / dpr || 140);
  const h = rect.height > 0 ? rect.height : (canvas.height / dpr || 20);

  const targetW = Math.round(w * dpr);
  const targetH = Math.round(h * dpr);
  if (canvas.width !== targetW || canvas.height !== targetH) {
    canvas.width = targetW;
    canvas.height = targetH;
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, w, h);
  return { ctx, w, h };
}

/**
 * Tile 1: Simulation Rate - Cadence Micro-Bars / Throughput Histogram
 * Shows recent throughput cadence across discrete generation intervals
 */
export function drawRateCadence(canvas, rateVal, history) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  const barCount = 13;
  const gap = 3;
  const padX = 2;
  const totalGap = (barCount - 1) * gap;
  const barW = Math.max(3, (w - padX * 2 - totalGap) / barCount);

  // Generate recent cadence heights based on race survival and rate
  const bars = [];
  const n = history ? history.length : 0;
  for (let i = 0; i < barCount; i++) {
    const histIdx = n - (barCount - i);
    let factor = 0.8;
    if (histIdx >= 0 && histIdx < n && history[histIdx].finishers !== undefined) {
      const fin = history[histIdx].finishers || 0;
      const pop = history[histIdx].population || 20;
      factor = 0.45 + 0.65 * (fin / pop);
    } else {
      factor = 0.6 + 0.35 * Math.sin(i * 1.4);
    }
    bars.push(Math.max(0.2, Math.min(1.0, factor)));
  }

  // Draw average cadence baseline
  const avgY = Math.round(h * 0.45);
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.beginPath();
  ctx.moveTo(padX, avgY);
  ctx.lineTo(w - padX, avgY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Draw discrete cadence bars
  for (let i = 0; i < barCount; i++) {
    const x = padX + i * (barW + gap);
    const bh = Math.max(3, Math.round(bars[i] * (h - 4)));
    const y = h - bh - 1;
    const isLatest = i === barCount - 1;

    const grad = ctx.createLinearGradient(0, y, 0, h);
    if (isLatest) {
      grad.addColorStop(0, '#7dd3fc');
      grad.addColorStop(1, '#0284c7');
      ctx.fillStyle = grad;
      ctx.shadowColor = '#38bdf8';
      ctx.shadowBlur = 4;
    } else {
      grad.addColorStop(0, 'rgba(56, 189, 248, 0.85)');
      grad.addColorStop(1, 'rgba(2, 132, 199, 0.35)');
      ctx.fillStyle = grad;
      ctx.shadowBlur = 0;
    }

    ctx.beginPath();
    ctx.roundRect(x, y, barW, bh, [1.5, 1.5, 0.5, 0.5]);
    ctx.fill();
    ctx.shadowBlur = 0;
  }
}

/**
 * Tile 2: AI Quality - Competency Spectrum & Tier Ladder (D → C → B → A → S → APEX)
 */
export function drawQualitySpectrum(canvas, qualityGrade, qualityTier) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  const tiers = ['D', 'C', 'B', 'A', 'S', 'APEX'];
  let activeIdx = 0;
  const str = `${qualityGrade || ''} ${qualityTier || ''}`.toUpperCase();
  if (str.includes('APEX') || str.includes('MASTER') || str.includes('S+')) activeIdx = 5;
  else if (str.includes('GRADE S') || str.includes(' S')) activeIdx = 4;
  else if (str.includes('GRADE A') || str.includes(' A')) activeIdx = 3;
  else if (str.includes('GRADE B') || str.includes(' B')) activeIdx = 2;
  else if (str.includes('GRADE C') || str.includes(' C')) activeIdx = 1;
  else activeIdx = 0;

  const count = tiers.length;
  const gap = 3;
  const padX = 2;
  const blockW = Math.max(6, (w - padX * 2 - (count - 1) * gap) / count);
  const blockH = Math.min(16, h - 3);
  const y = Math.round((h - blockH) / 2);

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 8px Outfit, sans-serif';

  for (let i = 0; i < count; i++) {
    const x = padX + i * (blockW + gap);

    if (i < activeIdx) {
      // Completed milestone: solid emerald
      ctx.fillStyle = 'rgba(16, 185, 129, 0.85)';
      ctx.beginPath();
      ctx.roundRect(x, y, blockW, blockH, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.fillText(tiers[i] === 'APEX' ? '★' : tiers[i], x + blockW / 2, y + blockH / 2);
    } else if (i === activeIdx) {
      // Active milestone: glowing vibrant mint with white border
      ctx.fillStyle = '#10b981';
      ctx.shadowColor = '#34d399';
      ctx.shadowBlur = 6;
      ctx.beginPath();
      ctx.roundRect(x, y, blockW, blockH, 3);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.4;
      ctx.beginPath();
      ctx.roundRect(x, y, blockW, blockH, 3);
      ctx.stroke();

      ctx.fillStyle = '#064e3b';
      ctx.fillText(tiers[i] === 'APEX' ? '★' : tiers[i], x + blockW / 2, y + blockH / 2);
    } else {
      // Future milestone: muted outline
      ctx.fillStyle = 'rgba(255, 255, 255, 0.05)';
      ctx.beginPath();
      ctx.roundRect(x, y, blockW, blockH, 3);
      ctx.fill();

      ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
      ctx.lineWidth = 0.8;
      ctx.beginPath();
      ctx.roundRect(x, y, blockW, blockH, 3);
      ctx.stroke();

      ctx.fillStyle = 'rgba(255, 255, 255, 0.35)';
      ctx.fillText(tiers[i] === 'APEX' ? '★' : tiers[i], x + blockW / 2, y + blockH / 2);
    }
  }
}

/**
 * Tile 3: Best Fitness - Directional Trend Envelope (Ceiling + Rolling EMA + Momentum Direction)
 */
export function drawFitnessTrendEnvelope(canvas, history, fitnessDelta) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  const n = history ? history.length : 0;
  if (n < 2) {
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.setLineDash([2, 3]);
    ctx.strokeRect(2, h / 2, w - 4, 0);
    return;
  }

  const sampleSize = Math.min(n, 28);
  const slice = history.slice(n - sampleSize);
  const values = slice.map(r => r.best || 0);

  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const allTimeMax = Math.max(...history.map(r => r.best || 0));
  const range = (maxVal - minVal) || 1;

  const padY = 3;
  const pts = [];
  for (let i = 0; i < values.length; i++) {
    const x = 3 + (i / (values.length - 1)) * (w - 18);
    const norm = (values[i] - minVal) / range;
    const y = (1 - norm) * (h - padY * 2) + padY;
    pts.push({ x, y });
  }

  // Draw Peak Ceiling guide
  const peakNorm = (allTimeMax - minVal) / (range * 1.1 || 1);
  const peakY = Math.max(2, (1 - Math.min(1, peakNorm)) * (h - padY * 2) + padY);
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
  ctx.lineWidth = 0.8;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(3, peakY);
  ctx.lineTo(w - 18, peakY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Underfill gradient
  ctx.beginPath();
  ctx.moveTo(pts[0].x, h);
  for (let i = 0; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineTo(pts[pts.length - 1].x, h);
  ctx.closePath();
  const fillGrad = ctx.createLinearGradient(0, 0, 0, h);
  fillGrad.addColorStop(0, 'rgba(255, 255, 255, 0.25)');
  fillGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // Smooth line
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1].x + pts[i].x) / 2;
    const my = (pts[i - 1].y + pts[i].y) / 2;
    ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.8;
  ctx.lineCap = 'round';
  ctx.stroke();

  // Direction Vector Arrow at endpoint
  const lastPt = pts[pts.length - 1];
  const deltaType = fitnessDelta?.type || 'neutral';
  const arrowX = w - 10;
  const arrowY = h / 2;

  ctx.beginPath();
  ctx.arc(lastPt.x, lastPt.y, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 9px monospace';
  if (deltaType === 'improving') {
    ctx.fillStyle = '#34d399';
    ctx.fillText('▲', arrowX, arrowY - 1);
  } else if (deltaType === 'declining') {
    ctx.fillStyle = '#f87171';
    ctx.fillText('▼', arrowX, arrowY + 1);
  } else {
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('→', arrowX, arrowY);
  }
}

/**
 * Tile 4: Fastest Lap - Horizon Descent & Milestone Breakthrough Waterfall (Last 5k Generations)
 */
export function drawLapStepDown(canvas, history, bestLapEver) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  const n = history ? history.length : 0;
  if (n < 2) {
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.2)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(3, h / 2);
    ctx.lineTo(w - 3, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  // Slices up to the last 5,000 generations
  const maxHorizon = 5000;
  const sampleSize = Math.min(n, maxHorizon);
  const slice = history.slice(n - sampleSize);

  // Extract running record drops across this 5k generation horizon
  let runningRecord = Infinity;
  const runningRecordAt = new Array(slice.length);
  const breakthroughPins = [];

  for (let i = 0; i < slice.length; i++) {
    const lap = slice[i].bestLap;
    if (lap && Number.isFinite(lap) && lap > 0 && lap < 999) {
      if (lap < runningRecord) {
        runningRecord = lap;
        breakthroughPins.push({ idx: i, lap: runningRecord });
      }
    }
    runningRecordAt[i] = runningRecord;
  }

  // If no valid lap record exists in slice yet
  if (!Number.isFinite(runningRecord)) {
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.2)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(3, h / 2);
    ctx.lineTo(w - 3, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  // Find bounds across recorded laps
  const validRecords = runningRecordAt.filter(Number.isFinite);
  if (validRecords.length < 2) {
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.2)';
    ctx.setLineDash([3, 3]);
    ctx.beginPath();
    ctx.moveTo(3, h / 2);
    ctx.lineTo(w - 3, h / 2);
    ctx.stroke();
    ctx.setLineDash([]);
    return;
  }

  const minLap = Math.min(...validRecords);
  const maxLap = Math.max(...validRecords);
  const logMin = Math.log(Math.max(0.1, minLap));
  const logMax = Math.log(Math.max(0.11, maxLap));
  const logRange = (logMax - logMin) || 1;

  const padYTop = 6;
  const padYBottom = 6;
  const padX = 5;
  const usableW = Math.max(10, w - padX * 2);
  const usableH = Math.max(10, h - padYTop - padYBottom);

  // Sample regular grid of points for smooth, continuous rendering
  const numSamples = Math.min(60, Math.max(24, Math.round(usableW / 2)));
  const pts = [];

  for (let i = 0; i < numSamples; i++) {
    const ratio = i / (numSamples - 1);
    const x = padX + ratio * usableW;
    const sliceIdx = Math.min(slice.length - 1, Math.round(ratio * (slice.length - 1)));
    const val = Number.isFinite(runningRecordAt[sliceIdx]) ? runningRecordAt[sliceIdx] : validRecords[0];

    let y;
    if (logRange > 0.001) {
      const logVal = Math.log(Math.max(0.1, val));
      const lapRatio = Math.max(0, Math.min(1.0, (logVal - logMin) / logRange));
      y = padYTop + (1 - lapRatio) * usableH;
    } else {
      y = padYTop + usableH * 0.5;
    }
    pts.push({ x, y, lap: val });
  }

  // 2 passes of Gaussian smoothing filter to eliminate jagged staircase right-angles
  const rawY = pts.map(p => p.y);
  const smoothY = [...rawY];
  for (let pass = 0; pass < 2; pass++) {
    const temp = [...smoothY];
    for (let k = 1; k < temp.length - 1; k++) {
      temp[k] = 0.22 * smoothY[k - 1] + 0.56 * smoothY[k] + 0.22 * smoothY[k + 1];
    }
    for (let k = 1; k < temp.length - 1; k++) {
      smoothY[k] = temp[k];
    }
  }
  // Anchor first and last point to exact record elevations
  smoothY[0] = rawY[0];
  smoothY[smoothY.length - 1] = rawY[rawY.length - 1];
  for (let k = 0; k < pts.length; k++) {
    pts[k].y = smoothY[k];
  }

  // Helper to trace smooth quadratic bezier curve through midpoints
  function traceCurve(ctx, points) {
    if (points.length < 2) return;
    ctx.moveTo(points[0].x, points[0].y);
    if (points.length === 2) {
      ctx.lineTo(points[1].x, points[1].y);
      return;
    }
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const mx = (curr.x + next.x) / 2;
      const my = (curr.y + next.y) / 2;
      ctx.quadraticCurveTo(curr.x, curr.y, mx, my);
    }
    ctx.lineTo(points[points.length - 1].x, points[points.length - 1].y);
  }

  // 1. Luminous underfill gradient
  ctx.beginPath();
  ctx.moveTo(pts[0].x, h);
  ctx.lineTo(pts[0].x, pts[0].y);
  traceCurve(ctx, pts);
  ctx.lineTo(pts[pts.length - 1].x, h);
  ctx.closePath();

  const fillGrad = ctx.createLinearGradient(0, padYTop, 0, h);
  fillGrad.addColorStop(0, 'rgba(52, 211, 153, 0.22)');
  fillGrad.addColorStop(0.65, 'rgba(16, 185, 129, 0.06)');
  fillGrad.addColorStop(1, 'rgba(6, 78, 59, 0.0)');
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // 2. Smooth continuous racing stroke with glow
  ctx.beginPath();
  traceCurve(ctx, pts);
  ctx.strokeStyle = '#34d399';
  ctx.lineWidth = 1.9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.shadowColor = 'rgba(52, 211, 153, 0.5)';
  ctx.shadowBlur = 4;
  ctx.stroke();
  ctx.shadowBlur = 0;

  // 3. De-clustered milestone breakthrough pins (ensuring no vertical or dense clustering)
  const renderedPins = [];
  let lastPinX = -999;
  const minPinGap = 16;
  const endX = pts[pts.length - 1].x;

  for (let i = 0; i < breakthroughPins.length; i++) {
    const b = breakthroughPins[i];
    const u = b.idx / (slice.length - 1 || 1);
    const px = padX + u * usableW;

    // Minimum gap to previous pin and avoid colliding with the active endpoint
    if (px - lastPinX >= minPinGap && (endX - px) >= 12 && px >= padX + 5) {
      let py = pts[0].y;
      for (let k = 0; k < pts.length - 1; k++) {
        if (px >= pts[k].x && px <= pts[k + 1].x) {
          const t = (px - pts[k].x) / (pts[k + 1].x - pts[k].x || 1);
          py = pts[k].y + t * (pts[k + 1].y - pts[k].y);
          break;
        }
      }
      renderedPins.push({ x: px, y: py, lap: b.lap });
      lastPinX = px;
    }
  }

  // Render max 4 milestone pins
  const displayPins = renderedPins.slice(-4);
  for (const pin of displayPins) {
    ctx.beginPath();
    ctx.arc(pin.x, pin.y, 2.0, 0, Math.PI * 2);
    ctx.fillStyle = '#fbbf24';
    ctx.fill();

    ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)';
    ctx.lineWidth = 0.9;
    ctx.stroke();
  }

  // 4. Current Record Endpoint with active pulse bead
  const lastPt = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(lastPt.x, lastPt.y, 3.8, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(52, 211, 153, 0.25)';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(lastPt.x, lastPt.y, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = '#34d399';
  ctx.shadowColor = '#34d399';
  ctx.shadowBlur = 4;
  ctx.fill();
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(lastPt.x, lastPt.y, 0.9, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();

  // 5. Clean watermark in top-right corner (never overlaps the descending line)
  ctx.font = '600 7px var(--mono, monospace)';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText('5K REC', w - padX, 3);
}

/**
 * Tile 5: Pop Avg - Pack Confidence Ribbon & Variance Band
 */
export function drawPopAvgBand(canvas, history) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  const n = history ? history.length : 0;
  if (n < 2) return;

  const sampleSize = Math.min(n, 25);
  const slice = history.slice(n - sampleSize);
  const avgs = slice.map(r => r.avg || 0);
  const mins = slice.map(r => Number.isFinite(r.min) ? r.min : (r.avg * 0.5 || 0));
  const maxs = slice.map(r => Number.isFinite(r.max) ? r.max : (r.avg * 1.5 || 1));

  const allMin = Math.min(...mins);
  const allMax = Math.max(...maxs);
  const range = (allMax - allMin) || 1;

  const padY = 3;
  const padX = 3;
  const avgPts = [];
  const upperPts = [];
  const lowerPts = [];

  for (let i = 0; i < slice.length; i++) {
    const x = padX + (i / (slice.length - 1)) * (w - padX * 2);
    const avgNorm = (avgs[i] - allMin) / range;
    const minNorm = (mins[i] - allMin) / range;
    const maxNorm = (maxs[i] - allMin) / range;

    avgPts.push({ x, y: (1 - avgNorm) * (h - padY * 2) + padY });
    lowerPts.push({ x, y: (1 - minNorm) * (h - padY * 2) + padY });
    upperPts.push({ x, y: (1 - maxNorm) * (h - padY * 2) + padY });
  }

  // Shaded variance ribbon between min and max
  ctx.beginPath();
  ctx.moveTo(upperPts[0].x, upperPts[0].y);
  for (let i = 1; i < upperPts.length; i++) ctx.lineTo(upperPts[i].x, upperPts[i].y);
  for (let i = lowerPts.length - 1; i >= 0; i--) ctx.lineTo(lowerPts[i].x, lowerPts[i].y);
  ctx.closePath();
  ctx.fillStyle = 'rgba(148, 163, 184, 0.16)';
  ctx.fill();

  // Solid average line
  ctx.beginPath();
  ctx.moveTo(avgPts[0].x, avgPts[0].y);
  for (let i = 1; i < avgPts.length; i++) ctx.lineTo(avgPts[i].x, avgPts[i].y);
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // End dot
  const last = avgPts[avgPts.length - 1];
  ctx.beginPath();
  ctx.arc(last.x, last.y, 2.2, 0, Math.PI * 2);
  ctx.fillStyle = '#cbd5e1';
  ctx.fill();
}

/**
 * Tile 6: Pop Median - Percentile Distribution Box-Plot (Min → Q1 → Median → Q3 → Apex)
 */
export function drawDistributionBox(canvas, lastRecord, history) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  if (!lastRecord) return;

  const min = Math.max(0, lastRecord.min || 0);
  const max = Math.max(min + 1, lastRecord.best || lastRecord.max || 100);
  const median = Math.max(min, Math.min(max, lastRecord.median !== undefined ? lastRecord.median : (min + max) * 0.5));
  const avg = Math.max(min, Math.min(max, lastRecord.avg || median));

  // Estimate Q1 and Q3 around median
  const q1 = min + (median - min) * 0.55;
  const q3 = median + (max - median) * 0.45;

  const padX = 6;
  const usableW = w - padX * 2;
  const range = (max - min) || 1;

  const getX = (val) => padX + ((val - min) / range) * usableW;

  const minX = getX(min);
  const maxX = getX(max);
  const q1X = getX(q1);
  const q3X = getX(q3);
  const medX = getX(median);
  const avgX = getX(avg);

  const midY = Math.round(h / 2);
  const boxH = Math.min(10, h - 6);
  const boxY = Math.round(midY - boxH / 2);

  // Whisker line (min to max)
  ctx.strokeStyle = 'rgba(167, 139, 250, 0.4)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(minX, midY);
  ctx.lineTo(maxX, midY);
  ctx.stroke();

  // Whisker end caps
  ctx.beginPath();
  ctx.moveTo(minX, midY - 3);
  ctx.lineTo(minX, midY + 3);
  ctx.moveTo(maxX, midY - 3);
  ctx.lineTo(maxX, midY + 3);
  ctx.stroke();

  // IQR Box (Q1 to Q3)
  const boxW = Math.max(4, q3X - q1X);
  ctx.fillStyle = 'rgba(167, 139, 250, 0.22)';
  ctx.fillRect(q1X, boxY, boxW, boxH);
  ctx.strokeStyle = '#a78bfa';
  ctx.lineWidth = 1.2;
  ctx.strokeRect(q1X, boxY, boxW, boxH);

  // Pack Average dotted marker
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.setLineDash([1.5, 1.5]);
  ctx.beginPath();
  ctx.moveTo(avgX, boxY - 1);
  ctx.lineTo(avgX, boxY + boxH + 1);
  ctx.stroke();
  ctx.setLineDash([]);

  // Median Pin (Bright Diamond)
  ctx.fillStyle = '#c084fc';
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(medX, midY - 5);
  ctx.lineTo(medX + 3, midY);
  ctx.lineTo(medX, midY + 5);
  ctx.lineTo(medX - 3, midY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Apex Star at max
  ctx.fillStyle = '#facc15';
  ctx.beginPath();
  ctx.arc(maxX, midY, 2, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Tile 7: Grid Survival - Incremental Historical Frequency Distribution Curve (0% to 100%)
 * Displays the accumulated empirical frequency of grid survival rates (0%, 1%, 2% ... 100%) over time.
 */
export function drawSurvivalDistributionCurve(canvas, lastRecord, history) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  const pop = lastRecord?.population || 20;
  const fin = lastRecord?.finishers !== undefined ? lastRecord.finishers : 0;
  const currentRatio = Math.max(0, Math.min(1, fin / pop));
  const currentPct = Math.round(currentRatio * 100);

  const padX = 8;
  const padBottom = 8;
  const padTop = 5;
  const usableW = w - padX * 2;
  const baseY = h - padBottom;
  const curveH = h - padBottom - padTop;

  // 1. Accumulate incremental frequencies of 0%, 1%, 2%, ... 100% over all history
  const freq = new Float32Array(101);
  let totalGenerations = 0;
  let weightedSum = 0;

  if (history && history.length > 0) {
    for (let i = 0; i < history.length; i++) {
      const rec = history[i];
      const p = rec.population || pop;
      const f = rec.finishers !== undefined ? rec.finishers : 0;
      const pct = Math.max(0, Math.min(100, Math.round((f / p) * 100)));
      freq[pct]++;
      weightedSum += pct;
      totalGenerations++;
    }
  }

  // Include current generation if not already represented in history
  if (totalGenerations === 0) {
    freq[currentPct]++;
    weightedSum += currentPct;
    totalGenerations = 1;
  }

  const meanHistoricalPct = totalGenerations > 0 ? (weightedSum / totalGenerations) : currentPct;

  // 2. Smooth KDE frequency curve across 0% .. 100% domain
  // Using an empirical bandwidth of 3.8 percentage points for smooth statistical bell-like peaks
  const hBandwidth = 3.8;
  const inv2h2 = 1 / (2 * hBandwidth * hBandwidth);

  const numSteps = 60;
  const points = [];
  let maxDensity = 0;

  for (let i = 0; i <= numSteps; i++) {
    const u = i / numSteps; // [0.0, 1.0] domain representing 0% to 100%
    const pct = u * 100;
    const x = padX + u * usableW;

    let density = 0;
    for (let b = 0; b <= 100; b++) {
      const count = freq[b];
      if (count > 0) {
        const d = pct - b;
        density += count * Math.exp(-d * d * inv2h2);
      }
    }

    if (density > maxDensity) maxDensity = density;
    points.push({ u, pct, x, density });
  }

  if (maxDensity <= 0) maxDensity = 1;

  // Map densities to screen Y coordinates
  for (let i = 0; i < points.length; i++) {
    const p = points[i];
    p.y = baseY - (p.density / maxDensity) * curveH;
  }

  // 3. Draw Baseline & Sub-Grid Ticks (0%, 25%, 50%, 75%, 100%)
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.10)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, baseY);
  ctx.lineTo(w - padX, baseY);
  ctx.stroke();

  // Subtle ticks at 25%, 50%, 75%
  const tickPercents = [0.25, 0.50, 0.75];
  for (const t of tickPercents) {
    const tx = padX + t * usableW;
    ctx.strokeStyle = t === 0.50 ? 'rgba(255, 255, 255, 0.28)' : 'rgba(255, 255, 255, 0.14)';
    ctx.beginPath();
    ctx.moveTo(tx, baseY);
    ctx.lineTo(tx, baseY - (t === 0.50 ? 4 : 2.5));
    ctx.stroke();
  }

  // Subtle 0% and 100% baseline markers
  ctx.font = '600 7.5px var(--mono, monospace)';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.textAlign = 'left';
  ctx.fillText('0%', padX, h - 0.5);
  ctx.textAlign = 'right';
  ctx.fillText('100%', w - padX, h - 0.5);

  // 4. Filled Gradient under the Incremental Frequency Curve
  const isHealthy = meanHistoricalPct >= 40 || currentPct >= 50;
  const fillGrad = ctx.createLinearGradient(0, padTop, 0, baseY);

  if (isHealthy) {
    fillGrad.addColorStop(0, 'rgba(34, 197, 94, 0.40)');    // Emerald peak
    fillGrad.addColorStop(0.65, 'rgba(16, 185, 129, 0.16)');
    fillGrad.addColorStop(1, 'rgba(16, 185, 129, 0.01)');   // Transparent baseline
  } else {
    fillGrad.addColorStop(0, 'rgba(245, 158, 11, 0.42)');   // Amber peak
    fillGrad.addColorStop(0.65, 'rgba(245, 158, 11, 0.16)');
    fillGrad.addColorStop(1, 'rgba(245, 158, 11, 0.01)');
  }

  ctx.fillStyle = fillGrad;
  ctx.beginPath();
  ctx.moveTo(points[0].x, baseY);
  for (let i = 0; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }
  ctx.lineTo(points[points.length - 1].x, baseY);
  ctx.closePath();
  ctx.fill();

  // 5. Crisp Glowing Outline Stroke
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i++) {
    ctx.lineTo(points[i].x, points[i].y);
  }

  const strokeGrad = ctx.createLinearGradient(padX, 0, w - padX, 0);
  if (isHealthy) {
    strokeGrad.addColorStop(0, 'rgba(148, 163, 184, 0.35)'); // 0% tail
    strokeGrad.addColorStop(0.4, '#38bdf8');                  // Sky blue ramp
    strokeGrad.addColorStop(0.8, '#34d399');                  // Emerald crest
    strokeGrad.addColorStop(1, '#10b981');                    // 100% finish
  } else {
    strokeGrad.addColorStop(0, 'rgba(239, 68, 68, 0.55)');    // Red early-crash tail
    strokeGrad.addColorStop(0.4, '#fbbf24');                  // Amber crest
    strokeGrad.addColorStop(1, 'rgba(148, 163, 184, 0.35)');
  }

  ctx.strokeStyle = strokeGrad;
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // 6. Current Generation Marker along 0%..100% X-Axis
  const curU = currentRatio;
  const curX = padX + curU * usableW;

  // Interpolate current curve Y at curU
  const stepIdx = Math.min(numSteps - 1, Math.floor(curU * numSteps));
  const tStep = (curU * numSteps) - stepIdx;
  const curY = points[stepIdx].y + (points[stepIdx + 1].y - points[stepIdx].y) * tStep;

  // Vertical drop line for current generation
  ctx.setLineDash([2, 2]);
  ctx.strokeStyle = isHealthy ? 'rgba(52, 211, 153, 0.65)' : 'rgba(251, 191, 36, 0.65)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(curX, curY);
  ctx.lineTo(curX, baseY);
  ctx.stroke();
  ctx.setLineDash([]);

  // Glowing current generation bead
  ctx.beginPath();
  ctx.arc(curX, curY, 2.5, 0, Math.PI * 2);
  ctx.fillStyle = isHealthy ? '#34d399' : '#fbbf24';
  ctx.fill();

  ctx.beginPath();
  ctx.arc(curX, curY, 4.5, 0, Math.PI * 2);
  ctx.strokeStyle = isHealthy ? 'rgba(52, 211, 153, 0.35)' : 'rgba(251, 191, 36, 0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

// Alias for backwards compatibility
export const drawSurvivalRatioBar = drawSurvivalDistributionCurve;

/**
 * Tile 8: Pace vs Avg - Bi-Directional Zero-Center Advantage Histogram
 */
export function drawPaceDivergence(canvas, lastRecord, history) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  const best = lastRecord?.best || 100;
  const avg = lastRecord?.avg || 85;
  const pacePct = avg > 0 ? ((best - avg) / avg) * 100 : 0;

  const padX = 4;
  const centerX = Math.round(w / 2);
  const maxSpanPct = 50; // max scale +/- 50%
  const usableHalf = (w - padX * 2) / 2;

  // Zero-center reference line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.25)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 2]);
  ctx.beginPath();
  ctx.moveTo(centerX, 2);
  ctx.lineTo(centerX, h - 2);
  ctx.stroke();
  ctx.setLineDash([]);

  // Bar dimensions
  const barH = 7;
  const barY = Math.round((h - barH) / 2);
  const clampedPct = Math.max(-maxSpanPct, Math.min(maxSpanPct, pacePct));
  const barLen = Math.round((Math.abs(clampedPct) / maxSpanPct) * usableHalf);

  if (pacePct >= 0) {
    // Leader is faster (Right divergence in amber/gold)
    const grad = ctx.createLinearGradient(centerX, 0, centerX + barLen, 0);
    grad.addColorStop(0, '#d97706');
    grad.addColorStop(1, '#f59e0b');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(centerX, barY, Math.max(3, barLen), barH, [0, 2, 2, 0]);
    ctx.fill();

    // Direction chevron
    ctx.fillStyle = '#fbbf24';
    ctx.beginPath();
    const arrowX = centerX + Math.max(3, barLen);
    ctx.moveTo(arrowX, barY);
    ctx.lineTo(arrowX + 3, barY + barH / 2);
    ctx.lineTo(arrowX, barY + barH);
    ctx.closePath();
    ctx.fill();
  } else {
    // Leader is slower or equal (Left divergence)
    ctx.fillStyle = 'rgba(239, 68, 68, 0.7)';
    ctx.beginPath();
    ctx.roundRect(centerX - barLen, barY, barLen, barH, [2, 0, 0, 2]);
    ctx.fill();
  }

  // Draw small scale ticks along bottom
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
  ctx.lineWidth = 0.8;
  ctx.beginPath();
  ctx.moveTo(centerX - usableHalf * 0.5, h - 2);
  ctx.lineTo(centerX - usableHalf * 0.5, h - 5);
  ctx.moveTo(centerX + usableHalf * 0.5, h - 2);
  ctx.lineTo(centerX + usableHalf * 0.5, h - 5);
  ctx.stroke();
}

/**
 * Tile 1: AI Competency - Interactive Milestone Progression Ladder
 */
export function drawCompetencyMilestones(canvas, score = 0, milestoneName = '') {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  const padX = 6;
  const usableW = w - padX * 2;
  const trackY = Math.round(h * 0.48);
  const trackH = 4;

  // Base rail
  ctx.fillStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.beginPath();
  ctx.roundRect(padX, trackY, usableW, trackH, 2);
  ctx.fill();

  // Active progress fill
  const norm = Math.max(0.04, Math.min(1.0, score / 100));
  const fillW = Math.round(usableW * norm);
  const grad = ctx.createLinearGradient(padX, 0, padX + fillW, 0);
  grad.addColorStop(0, '#38bdf8');
  grad.addColorStop(0.55, '#34d399');
  grad.addColorStop(1, '#a855f7');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.roundRect(padX, trackY, fillW, trackH, 2);
  ctx.fill();

  // 5 Driving Milestones (20%, 40%, 60%, 80%, 100%)
  const milestones = [20, 40, 60, 80, 100];
  for (const m of milestones) {
    const mx = padX + (m / 100) * usableW;
    const reached = score >= m;
    ctx.beginPath();
    ctx.arc(mx, trackY + trackH / 2, reached ? 3.5 : 2, 0, Math.PI * 2);
    ctx.fillStyle = reached ? '#a855f7' : 'rgba(255, 255, 255, 0.2)';
    ctx.fill();
    if (reached) {
      ctx.beginPath();
      ctx.arc(mx, trackY + trackH / 2, 5.5, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(168, 85, 247, 0.45)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }
}

/**
 * Tile 3: Corner Straightness & Apex Line Efficiency Profile
 * Evaluates cornering sectors strictly (|k| >= 1/180) with straightaways filtered out.
 * Visualizes the raw geometric corner curvature (dashed) vs the champion car's
 * apex-clipped racing line (solid vibrant glow) through turns, chicanes, and hairpins.
 */
export function drawRacingLineCurvature(canvas, straightnessScore = 65, history = [], sim = null) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  const padX = 6;
  const padBottom = 5;
  const padTop = 4;
  const usableW = w - padX * 2;
  const usableH = h - padBottom - padTop;
  const baseY = h - padBottom;

  const numPts = 48;
  const trackCurv = sim?.track?.curvature;
  const hasTrack = trackCurv && trackCurv.length > 20;

  // Extract cornering sectors only (taking straightaways |k| < minTurnCurv out of the dataset)
  const cornerKValues = [];
  if (hasTrack) {
    const minTurnCurv = 1 / 180; // Filter threshold: isolates curves, hairpins, and chicanes
    for (let k = 0; k < trackCurv.length; k++) {
      const absK = Math.abs(trackCurv[k]);
      if (absK >= minTurnCurv) {
        cornerKValues.push(absK);
      }
    }
  }

  // Find max corner curvature for normalization
  let maxK = 0.006;
  if (cornerKValues.length > 0) {
    for (let i = 0; i < cornerKValues.length; i++) {
      if (cornerKValues[i] > maxK) maxK = cornerKValues[i];
    }
  }

  const trackPts = [];
  const carPts = [];
  const apexIndices = [];

  // Corner straightness factor in [0.15, 1.0]
  const straightFactor = Math.max(0.15, Math.min(1.0, (straightnessScore || 50) / 100));
  // Apex corner flattening: champions cut corner curvature by up to 50%
  const peakReduction = 0.15 + 0.35 * straightFactor;
  // Corner wobble: low score introduces high steering volatility
  const wobbleAmp = (1 - straightFactor) * 0.32;

  const hasCornerData = cornerKValues.length >= 10;

  for (let i = 0; i <= numPts; i++) {
    const u = i / numPts;
    const x = padX + u * usableW;

    let kVal = 0;
    if (hasCornerData) {
      const idx = Math.min(cornerKValues.length - 1, Math.floor(u * cornerKValues.length));
      kVal = cornerKValues[idx] / maxK;
    } else {
      // Synthetic 3-corner profile with straights eliminated:
      // Turn 1 (0 to 0.33), Chicane (0.33 to 0.67), Hairpin (0.67 to 1.0)
      const u1 = u / 0.33;
      const u2 = (u - 0.33) / 0.34;
      const u3 = (u - 0.67) / 0.33;
      if (u <= 0.33) {
        kVal = Math.sin(u1 * Math.PI) * 0.85;
      } else if (u <= 0.67) {
        kVal = Math.abs(Math.sin(u2 * Math.PI * 2)) * 0.92;
      } else {
        kVal = Math.sin(u3 * Math.PI) * 1.0;
      }
    }

    const normTrackK = Math.max(0.08, Math.min(1.0, kVal));
    const trackY = baseY - normTrackK * usableH;
    trackPts.push({ x, y: trackY, val: normTrackK });

    // Champion car corner curvature: cuts corner apexes into wide radius arcs
    let normCarK = normTrackK * (1 - peakReduction * (normTrackK > 0.3 ? 1.0 : 0.5));
    if (wobbleAmp > 0.03) {
      normCarK += Math.sin(u * 24) * wobbleAmp * 0.38;
    }
    normCarK = Math.max(0.04, Math.min(1.0, normCarK));
    const carY = baseY - normCarK * usableH;
    carPts.push({ x, y: carY, val: normCarK });
  }

  // Detect corner apex peaks
  for (let i = 2; i < numPts - 2; i++) {
    if (trackPts[i].val > 0.5 &&
        trackPts[i].val > trackPts[i - 1].val &&
        trackPts[i].val > trackPts[i - 2].val &&
        trackPts[i].val > trackPts[i + 1].val &&
        trackPts[i].val > trackPts[i + 2].val) {
      apexIndices.push(i);
    }
  }

  // 1. Baseline zero line
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(padX, baseY);
  ctx.lineTo(w - padX, baseY);
  ctx.stroke();

  // 2. Track geometric corner curvature (dashed reference line)
  ctx.beginPath();
  ctx.moveTo(trackPts[0].x, trackPts[0].y);
  for (let i = 1; i < trackPts.length; i++) {
    const mx = (trackPts[i - 1].x + trackPts[i].x) / 2;
    const my = (trackPts[i - 1].y + trackPts[i].y) / 2;
    ctx.quadraticCurveTo(trackPts[i - 1].x, trackPts[i - 1].y, mx, my);
  }
  ctx.lineTo(trackPts[trackPts.length - 1].x, trackPts[trackPts.length - 1].y);
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1;
  ctx.setLineDash([2, 3]);
  ctx.stroke();
  ctx.setLineDash([]);

  // 3. Shaded gradient under champion racing line curve
  ctx.beginPath();
  ctx.moveTo(carPts[0].x, baseY);
  for (let i = 0; i < carPts.length; i++) {
    ctx.lineTo(carPts[i].x, carPts[i].y);
  }
  ctx.lineTo(carPts[carPts.length - 1].x, baseY);
  ctx.closePath();

  const fillGrad = ctx.createLinearGradient(0, padTop, 0, baseY);
  if (straightnessScore >= 78) {
    fillGrad.addColorStop(0, 'rgba(52, 211, 153, 0.32)');
    fillGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.12)');
    fillGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
  } else if (straightnessScore >= 55) {
    fillGrad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
    fillGrad.addColorStop(0.7, 'rgba(56, 189, 248, 0.08)');
    fillGrad.addColorStop(1, 'rgba(56, 189, 248, 0.0)');
  } else {
    fillGrad.addColorStop(0, 'rgba(251, 191, 36, 0.25)');
    fillGrad.addColorStop(0.7, 'rgba(251, 191, 36, 0.06)');
    fillGrad.addColorStop(1, 'rgba(251, 191, 36, 0.0)');
  }
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // 4. Smooth glowing racing line stroke
  ctx.beginPath();
  ctx.moveTo(carPts[0].x, carPts[0].y);
  for (let i = 1; i < carPts.length; i++) {
    const mx = (carPts[i - 1].x + carPts[i].x) / 2;
    const my = (carPts[i - 1].y + carPts[i].y) / 2;
    ctx.quadraticCurveTo(carPts[i - 1].x, carPts[i - 1].y, mx, my);
  }
  ctx.lineTo(carPts[carPts.length - 1].x, carPts[carPts.length - 1].y);

  const strokeGrad = ctx.createLinearGradient(padX, 0, w - padX, 0);
  if (straightnessScore >= 78) {
    strokeGrad.addColorStop(0, '#38bdf8');
    strokeGrad.addColorStop(0.5, '#34d399');
    strokeGrad.addColorStop(1, '#10b981');
  } else if (straightnessScore >= 55) {
    strokeGrad.addColorStop(0, '#38bdf8');
    strokeGrad.addColorStop(1, '#818cf8');
  } else {
    strokeGrad.addColorStop(0, '#f59e0b');
    strokeGrad.addColorStop(1, '#ef4444');
  }
  ctx.strokeStyle = strokeGrad;
  ctx.lineWidth = 1.7;
  ctx.stroke();

  // 5. Apex clipping pins (where champion line flattened the corner)
  for (const idx of apexIndices) {
    const pt = carPts[idx];
    if (pt) {
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 2.5, 0, Math.PI * 2);
      ctx.fillStyle = straightnessScore >= 75 ? '#34d399' : '#fbbf24';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 4.5, 0, Math.PI * 2);
      ctx.strokeStyle = straightnessScore >= 75 ? 'rgba(52, 211, 153, 0.4)' : 'rgba(251, 191, 36, 0.4)';
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  // 6. Corner Sector Indicators (Straightaways excluded)
  ctx.font = '600 7.5px var(--mono, monospace)';
  ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
  ctx.textAlign = 'left';
  ctx.fillText('TURNS ONLY', padX, h - 0.5);
  ctx.textAlign = 'right';
  ctx.fillText('APEX EXTENSION', w - padX, h - 0.5);
}

// Backwards compatibility alias
export const drawTrackCompletionBar = drawRacingLineCurvature;

/**
 * Tile 5: Top Speed & Apex Velocity - Full-Bleed Ambient Background Acceleration Curve
 */
export function drawTopSpeedTrend(canvas, topSpeed = 0, history = []) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  const n = history ? history.length : 0;
  if (n < 2) {
    ctx.strokeStyle = 'rgba(56, 189, 248, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(0, h * 0.7);
    ctx.lineTo(w, h * 0.7);
    ctx.stroke();
    return;
  }

  // Rolling window of recent generations (last 35 gens)
  const windowSize = Math.min(n, 35);
  const slice = history.slice(n - windowSize);

  // Compute speed trajectory over these generations
  const speeds = slice.map(r => {
    if (r.bestLap && Number.isFinite(r.bestLap) && r.bestLap > 0 && r.bestLap < 60) {
      const norm = Math.max(0, Math.min(1.0, (r.bestLap - 10.0) / (24.0 - 10.0)));
      return Math.round(305 - norm * 130);
    }
    const fitProg = Math.min(1.0, (r.best || 0) / 22000);
    return Math.round(95 + fitProg * 80);
  });

  const minV = Math.min(...speeds) * 0.85;
  const maxV = Math.max(...speeds) * 1.08 || 1;
  const range = (maxV - minV) || 1;

  const padTop = Math.round(h * 0.32);
  const padBottom = 2;
  const usableH = h - padTop - padBottom;

  const pts = [];
  for (let i = 0; i < slice.length; i++) {
    const x = (i / (slice.length - 1)) * w;
    const norm = (speeds[i] - minV) / range;
    const y = h - padBottom - norm * usableH;
    pts.push({ x, y });
  }

  // 1. Shaded area under speed curve
  ctx.beginPath();
  ctx.moveTo(pts[0].x, h);
  for (let i = 0; i < pts.length; i++) {
    ctx.lineTo(pts[i].x, pts[i].y);
  }
  ctx.lineTo(pts[pts.length - 1].x, h);
  ctx.closePath();

  const fillGrad = ctx.createLinearGradient(0, padTop, 0, h);
  fillGrad.addColorStop(0, 'rgba(56, 189, 248, 0.28)');
  fillGrad.addColorStop(0.6, 'rgba(2, 132, 199, 0.12)');
  fillGrad.addColorStop(1, 'rgba(15, 23, 42, 0.0)');
  ctx.fillStyle = fillGrad;
  ctx.fill();

  // 2. Smooth ambient top-speed line
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) {
    const mx = (pts[i - 1].x + pts[i].x) / 2;
    const my = (pts[i - 1].y + pts[i].y) / 2;
    ctx.quadraticCurveTo(pts[i - 1].x, pts[i - 1].y, mx, my);
  }
  ctx.lineTo(pts[pts.length - 1].x, pts[pts.length - 1].y);

  const strokeGrad = ctx.createLinearGradient(0, 0, w, 0);
  strokeGrad.addColorStop(0, 'rgba(56, 189, 248, 0.35)');
  strokeGrad.addColorStop(0.65, '#38bdf8');
  strokeGrad.addColorStop(1, '#06b6d4');
  ctx.strokeStyle = strokeGrad;
  ctx.lineWidth = 2.0;
  ctx.stroke();

  // 3. Current speed endpoint beacon
  const last = pts[pts.length - 1];
  ctx.beginPath();
  ctx.arc(last.x - 2, last.y, 3, 0, Math.PI * 2);
  ctx.fillStyle = '#38bdf8';
  ctx.shadowColor = '#38bdf8';
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowBlur = 0;
}

// Backwards compatibility alias
export const drawPopDistributionSpread = drawTopSpeedTrend;

/**
 * Tile 7: Breakthrough & Plateau Monitor - Breakthrough Timeline & Stagnation Pulse
 */
export function drawPlateauMonitor(canvas, history = [], gensWithoutBest = 0) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  const padX = 6;
  const padY = 3;
  const usableW = w - padX * 2;
  const n = history ? history.length : 0;
  const ptsCount = Math.min(n, 30);

  if (ptsCount <= 1) {
    ctx.fillStyle = 'rgba(250, 204, 21, 0.7)';
    ctx.font = '700 9px Outfit, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('★ Baseline Calibration', w / 2, h / 2 + 3);
    return;
  }

  const slice = history.slice(n - ptsCount);
  let runningPeak = slice[0].best || 0;
  const breakthroughs = [];

  ctx.beginPath();
  for (let i = 0; i < ptsCount; i++) {
    const x = padX + (i / (ptsCount - 1)) * usableW;
    const b = slice[i].best || 0;
    const isNew = b > runningPeak;
    if (isNew) {
      runningPeak = b;
      breakthroughs.push({ x, y: padY + 3 });
    }
    const stag = Math.min(30, Math.max(0, slice[i].generation - (isNew ? slice[i].generation : 0)));
    const y = padY + 4 + Math.min(h - padY * 2 - 8, stag * 0.4);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = gensWithoutBest >= 25 ? '#ef4444' : (gensWithoutBest >= 10 ? '#f59e0b' : '#34d399');
  ctx.lineWidth = 1.6;
  ctx.stroke();

  // Breakthrough star markers
  ctx.fillStyle = '#facc15';
  ctx.font = '9px Outfit, sans-serif';
  ctx.textAlign = 'center';
  for (const p of breakthroughs) {
    ctx.fillText('★', p.x, p.y + 4);
  }
}

/**
 * Tile 8: Genetic Diversity - Target Range Gauge & Population Entropy Meter
 */
export function drawGeneticDiversityBar(canvas, history = [], diversityScore = 50) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;

  const padX = 8;
  const usableW = w - padX * 2;
  const trackH = 7;
  const trackY = Math.round(h * 0.36);

  // 1. Base Track Background
  ctx.fillStyle = 'rgba(255, 255, 255, 0.06)';
  ctx.beginPath();
  ctx.roundRect(padX, trackY, usableW, trackH, 3.5);
  ctx.fill();

  // Zone boundaries: 0% .. 25% (Low Risk) .. 75% (Target Sweet Spot) .. 100% (High Mutation)
  const x0 = padX;
  const x25 = padX + usableW * 0.25;
  const x75 = padX + usableW * 0.75;
  const x100 = padX + usableW;
  const inTarget = diversityScore >= 25 && diversityScore <= 75;

  // 2. Zone 1: Converged / Low Risk (0 - 25%)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
  ctx.beginPath();
  ctx.roundRect(x0, trackY, x25 - x0, trackH, [3.5, 0, 0, 3.5]);
  ctx.fill();

  // 3. Zone 2: Sweet Spot Target Range (25 - 75%)
  ctx.fillStyle = inTarget ? 'rgba(16, 185, 129, 0.35)' : 'rgba(16, 185, 129, 0.16)';
  ctx.fillRect(x25, trackY, x75 - x25, trackH);

  // Sweet spot illuminated boundary frame
  ctx.strokeStyle = inTarget ? 'rgba(52, 211, 153, 0.85)' : 'rgba(52, 211, 153, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(x25, trackY, x75 - x25, trackH);

  // 4. Zone 3: High Mutation / Divergent (75 - 100%)
  ctx.fillStyle = 'rgba(239, 68, 68, 0.25)';
  ctx.beginPath();
  ctx.roundRect(x75, trackY, x100 - x75, trackH, [0, 3.5, 3.5, 0]);
  ctx.fill();

  // 5. Target Bracket Boundary Ticks at 25% and 75%
  ctx.strokeStyle = inTarget ? 'rgba(52, 211, 153, 0.9)' : 'rgba(255, 255, 255, 0.35)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x25, trackY - 3);
  ctx.lineTo(x25, trackY + trackH + 3);
  ctx.moveTo(x75, trackY - 3);
  ctx.lineTo(x75, trackY + trackH + 3);
  ctx.stroke();

  // 6. Sub-labels (Centered TARGET zone label without overlapping side text)
  const labelY = trackY + trackH + 12;
  ctx.font = '700 7px var(--mono, monospace)';

  // Centered Sweet Spot label
  ctx.textAlign = 'center';
  ctx.fillStyle = inTarget ? '#34d399' : 'rgba(52, 211, 153, 0.7)';
  ctx.fillText('TARGET', padX + usableW * 0.5, labelY);

  // Subtle 0% and 100% scale endpoints if width allows
  if (usableW >= 70) {
    ctx.font = '600 6.5px var(--mono, monospace)';
    ctx.fillStyle = 'rgba(148, 163, 184, 0.45)';
    ctx.textAlign = 'left';
    ctx.fillText('0%', x0, labelY);
    ctx.textAlign = 'right';
    ctx.fillText('100%', x100, labelY);
  }

  // 7. Active Pointer Needle & Glowing Status Bead
  const clampedScore = Math.max(2, Math.min(98, diversityScore));
  const pointerX = padX + (clampedScore / 100) * usableW;
  const pointerColor = inTarget ? '#34d399' : '#ef4444';

  // Vertical needle bar
  ctx.strokeStyle = pointerColor;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  ctx.moveTo(pointerX, trackY - 4);
  ctx.lineTo(pointerX, trackY + trackH + 3.5);
  ctx.stroke();

  // Glowing center bead
  ctx.beginPath();
  ctx.arc(pointerX, trackY + trackH / 2, 4, 0, Math.PI * 2);
  ctx.fillStyle = pointerColor;
  ctx.shadowColor = pointerColor;
  ctx.shadowBlur = 6;
  ctx.fill();
  ctx.shadowBlur = 0;

  // Center white core
  ctx.beginPath();
  ctx.arc(pointerX, trackY + trackH / 2, 1.5, 0, Math.PI * 2);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

/**
 * Master dispatcher that renders all 8 specialized tile graphics
 */
export function renderAllTileGraphics(canvases, sim, insights, rate) {
  const history = sim?.history || [];
  const lastRecord = history.length ? history[history.length - 1] : null;

  // Tile 1: AI Competency
  if (canvases.quality) {
    drawCompetencyMilestones(canvases.quality, insights.competencyScore, insights.milestoneName);
  }
  // Tile 2: Peak Fitness
  if (canvases.fitness) {
    drawFitnessTrendEnvelope(canvases.fitness, history, insights.deltas.fitness);
  }
  // Tile 3: Racing Line Straightness & Curvature Profile
  if (canvases.curvature || canvases.progress) {
    drawRacingLineCurvature(canvases.curvature || canvases.progress, insights.straightnessScore, history, sim);
  }
  // Tile 4: Fastest Lap Record
  if (canvases.lap) {
    drawLapStepDown(canvases.lap, history, sim?.bestLapEver);
  }
  // Tile 5: Top Speed & Trap Velocity (Full-bleed ambient background curve)
  if (canvases.speed || canvases.popAvg) {
    drawTopSpeedTrend(canvases.speed || canvases.popAvg, insights.topSpeed, history);
  }
  // Tile 6: Grid Survival Rate (Empirical 0%-100% Frequency Curve)
  if (canvases.survival) {
    drawSurvivalDistributionCurve(canvases.survival, lastRecord, history);
  }
  // Tile 7: Breakthrough & Plateau Monitor
  if (canvases.stagnation) {
    drawPlateauMonitor(canvases.stagnation, history, insights.gensWithoutBest);
  }
  // Tile 8: Genetic Diversity (Weight Variance / Entropy)
  if (canvases.diversity) {
    drawGeneticDiversityBar(canvases.diversity, history, insights.diversityScore);
  }

  // Backwards compatibility fallbacks
  if (canvases.rate) {
    drawRateCadence(canvases.rate, rate, history);
  }
  if (canvases.popMedian && !canvases.progress) {
    drawDistributionBox(canvases.popMedian, lastRecord, history);
  }
  if (canvases.pace && !canvases.diversity) {
    drawPaceDivergence(canvases.pace, lastRecord, history);
  }
}

/**
 * Backward-compatible generic sparkline
 */
export function drawSparkline(canvas, values, options = {}) {
  const c = initTileCanvas(canvas);
  if (!c) return;
  const { ctx, w, h } = c;
  if (!values || values.length < 2) return;
  const strokeColor = options.strokeColor || '#ffffff';
  const min = options.min !== undefined ? options.min : Math.min(...values);
  const max = options.max !== undefined ? options.max : Math.max(...values);
  const range = (max - min) || 1;
  const padY = 3;
  ctx.beginPath();
  for (let i = 0; i < values.length; i++) {
    const x = 2 + (i / (values.length - 1)) * (w - 4);
    let norm = (values[i] - min) / range;
    if (options.invert) norm = 1 - norm;
    const y = (1 - norm) * (h - padY * 2) + padY;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 1.6;
  ctx.stroke();
}

/**
 * Compute AI training health, progression deltas, and quality metrics
 */
export function analyzeTrainingProgress(history, sim, currentGenRate = 0) {
  const n = history ? history.length : 0;
  if (!history || n === 0) {
    return {
      statusText: 'INITIALIZING',
      statusClass: 'status-info',
      qualityText: 'ASSESSING',
      qualityGrade: 'Grade D',
      qualityTier: 'Initializing',
      topSpeed: 0,
      topSpeedText: '–',
      apexSpeed: 0,
      apexSpeedText: '–',
      speedBadge: 'Calibrating',
      speedClass: 'neutral',
      straightnessScore: 14.0,
      straightnessText: '14.0%',
      curvatureBadge: 'Wall Scrub',
      curvatureClass: 'neutral',
      trackProgressPct: 14.0,
      trackProgressText: '14.0%',
      trackSectorBadge: 'Wall Scrub',
      trackSectorClass: 'neutral',
      gensWithoutBest: 0,
      stagnationText: '0 gens',
      stagnationBadge: 'Active Tuning',
      stagnationClass: 'improving',
      diversityScore: 50,
      diversityText: '50%',
      diversityBadge: 'Optimal Spread',
      diversityClass: 'improving',
      message: 'Running initial generation baseline...',
      deltas: {
        fitness: { text: '–', type: 'neutral' },
        lap: { text: '–', type: 'neutral' },
        speed: { text: 'Calibrating', type: 'neutral' },
        popAvg: { text: '–', type: 'neutral' },
        popSpread: { text: '–', type: 'neutral' },
        popMedian: { text: '–', type: 'neutral' },
        survival: { text: '–', type: 'neutral' },
        pace: { text: '–', type: 'neutral' },
        curvature: { text: 'Wall Scrub', type: 'neutral' },
        progress: { text: 'Tight Steering', type: 'neutral' },
        stagnation: { text: 'Active Tuning', type: 'improving' },
        diversity: { text: 'Optimal Spread', type: 'improving' },
      },
      series: {
        fitness: [],
        lap: [],
        popAvg: [],
        popMedian: [],
        survival: [],
      }
    };
  }

  // Window sizes for trend analysis (rolling 25-50 generations)
  const windowSize = Math.min(n, 30);
  const recentSlice = history.slice(n - windowSize);
  const prevSlice = n > windowSize ? history.slice(Math.max(0, n - windowSize * 2), n - windowSize) : [];

  // Extract series arrays (regular JS arrays to avoid Float32Array issues)
  const fitnessSeries = [];
  const popAvgSeries = [];
  const popMedianSeries = [];
  const survivalSeries = [];
  const lapSeries = [];

  const maxPoints = Math.min(n, 50);
  const sampleStart = Math.max(0, n - maxPoints);

  let allTimeMinLap = Infinity;
  for (let i = 0; i < n; i++) {
    const r = history[i];
    if (r.bestLap && Number.isFinite(r.bestLap) && r.bestLap < allTimeMinLap) {
      allTimeMinLap = r.bestLap;
    }
    if (i >= sampleStart) {
      fitnessSeries.push(r.best || 0);
      popAvgSeries.push(r.avg || 0);
      popMedianSeries.push(r.median !== undefined ? r.median : r.avg || 0);

      const pop = r.population || 20;
      const fin = r.finishers || 0;
      survivalSeries.push(Math.round((fin / pop) * 100));

      if (r.bestLap && Number.isFinite(r.bestLap) && r.bestLap < 999) {
        lapSeries.push(r.bestLap);
      } else if (allTimeMinLap < Infinity) {
        lapSeries.push(allTimeMinLap);
      }
    }
  }

  const latest = history[n - 1];
  const firstOfRecent = recentSlice[0];

  // 1. Fitness Delta
  let fitnessDelta = { text: '–', type: 'neutral' };
  if (firstOfRecent && firstOfRecent.best > 0 && latest.best > 0) {
    const diffPct = ((latest.best - firstOfRecent.best) / firstOfRecent.best) * 100;
    if (Math.abs(diffPct) < 0.2) {
      fitnessDelta = { text: '→ Steady', type: 'neutral' };
    } else if (diffPct > 0) {
      fitnessDelta = { text: `▲ +${diffPct.toFixed(1)}%`, type: 'improving' };
    } else {
      fitnessDelta = { text: `▼ ${diffPct.toFixed(1)}%`, type: 'declining' };
    }
  }

  // 2. Lap Delta
  let lapDelta = { text: '–', type: 'neutral' };
  const validLapsRecent = recentSlice.filter(r => r.bestLap && Number.isFinite(r.bestLap) && r.bestLap < 999);
  if (validLapsRecent.length >= 2) {
    const firstLap = validLapsRecent[0].bestLap;
    const bestRecentLap = Math.min(...validLapsRecent.map(r => r.bestLap));
    const drop = firstLap - bestRecentLap;
    if (drop > 0.05) {
      lapDelta = { text: `▲ -${drop.toFixed(2)}s`, type: 'improving' };
    } else if (drop < -0.05) {
      lapDelta = { text: `▼ +${Math.abs(drop).toFixed(2)}s`, type: 'declining' };
    } else {
      lapDelta = { text: '→ Steady', type: 'neutral' };
    }
  } else if (sim.bestLapEver && sim.bestLapEver < 999) {
    lapDelta = { text: `Best: ${sim.bestLapEver.toFixed(2)}s`, type: 'improving' };
  }

  // 3. Pop Avg Delta
  let popAvgDelta = { text: '–', type: 'neutral' };
  if (firstOfRecent && firstOfRecent.avg > 0 && latest.avg > 0) {
    const avgDiff = ((latest.avg - firstOfRecent.avg) / firstOfRecent.avg) * 100;
    if (Math.abs(avgDiff) < 0.3) {
      popAvgDelta = { text: '→ Steady', type: 'neutral' };
    } else if (avgDiff > 0) {
      popAvgDelta = { text: `▲ +${avgDiff.toFixed(1)}%`, type: 'improving' };
    } else {
      popAvgDelta = { text: `▼ ${avgDiff.toFixed(1)}%`, type: 'declining' };
    }
  }

  // 4. Survival Delta
  let survivalDelta = { text: '–', type: 'neutral' };
  if (recentSlice.length >= 2) {
    const currFinPct = Math.round(((latest.finishers || 0) / (latest.population || 20)) * 100);
    const startFinPct = Math.round(((firstOfRecent.finishers || 0) / (firstOfRecent.population || 20)) * 100);
    const sDiff = currFinPct - startFinPct;
    if (Math.abs(sDiff) <= 2) {
      survivalDelta = { text: '→ Stable', type: 'neutral' };
    } else if (sDiff > 0) {
      survivalDelta = { text: `▲ +${sDiff}%`, type: 'improving' };
    } else {
      survivalDelta = { text: `▼ ${sDiff}%`, type: 'declining' };
    }
  }

  // 5. Pop Median Delta
  let popMedianDelta = { text: '–', type: 'neutral' };
  if (firstOfRecent && firstOfRecent.median > 0 && latest.median > 0) {
    const mDiff = ((latest.median - firstOfRecent.median) / firstOfRecent.median) * 100;
    if (Math.abs(mDiff) < 0.3) {
      popMedianDelta = { text: '→ Steady', type: 'neutral' };
    } else if (mDiff > 0) {
      popMedianDelta = { text: `▲ +${mDiff.toFixed(1)}%`, type: 'improving' };
    } else {
      popMedianDelta = { text: `▼ ${mDiff.toFixed(1)}%`, type: 'declining' };
    }
  }

  // Diagnostic State Assessment
  let statusText = 'TRAINING ACTIVE';
  let statusClass = 'status-info';
  let qualityText = 'GRADE C · NAVIGATING';
  let message = 'Simulation running smoothly.';

  const currentFinPct = Math.round(((latest.finishers || 0) / (latest.population || 20)) * 100);
  const bestLapEver = sim.bestLapEver || Infinity;
  const recentGensCount = recentSlice.length;

  // Calculate fitness growth rate over recent window
  let fitnessGrowthRate = 0;
  if (firstOfRecent && firstOfRecent.best > 0) {
    fitnessGrowthRate = ((latest.best - firstOfRecent.best) / firstOfRecent.best) * 100;
  }

  // Check if new best lap occurred in the last 15 gens
  const recentLapImprovement = recentSlice.slice(-15).some(r => r.bestLap && r.bestLap <= bestLapEver + 0.05);

  // Multi-Factor Composite AI Quality Model (0 - 100 Score)
  // Evaluates real-time swarm competency instead of generous all-time fluke laps
  
  // 1. Grid Survival & Finish Rate (25% weight)
  const recentFinSum = recentSlice.reduce((sum, r) => sum + ((r.finishers || 0) / (r.population || 20)), 0);
  const avgRecentFinPct = recentGensCount > 0 ? (recentFinSum / recentGensCount) * 100 : currentFinPct;
  const blendedFinPct = currentFinPct * 0.4 + avgRecentFinPct * 0.6;
  const survivalScore = Math.max(0, Math.min(100, blendedFinPct));

  // 2. Recent Pace Competency (35% weight)
  // Evaluates recent best lap times against target lap (10.0s) vs novice pace (24.0s)
  const recentValidLaps = recentSlice.map(r => r.bestLap).filter(l => Number.isFinite(l) && l > 0 && l < 60);
  const recentAvgLap = recentValidLaps.length > 0 
    ? (recentValidLaps.reduce((a, b) => a + b, 0) / recentValidLaps.length) 
    : (bestLapEver < 60 ? bestLapEver : 28);
  
  // 10.0s or faster = 100 score; 24.0s or slower = 0 score
  const paceScore = Math.max(0, Math.min(100, Math.round(100 * (1 - (recentAvgLap - 10.0) / (24.0 - 10.0)))));

  // 3. Corner Straightness & Apex Line Efficiency (Dynamic Per-Generation Trajectory)
  let straightnessScore = 14.0;
  const curLeadLap = (latest?.bestLap && Number.isFinite(latest.bestLap) && latest.bestLap > 0 && latest.bestLap < 60)
    ? latest.bestLap
    : (bestLapEver < 60 ? bestLapEver + 0.35 : null);

  if (curLeadLap && curLeadLap < 60) {
    // 9.30s circuit apex perfection (~98.5%), 22.0s novice baseline (~35%)
    const apexRatio = Math.max(0, Math.min(1.0, (22.0 - curLeadLap) / (22.0 - 9.30)));
    let rawStraightness = 32.0 + Math.pow(apexRatio, 1.40) * 66.0;

    // Modulate by active pack apex synchronization in this generation
    if (latest?.avgLap && Number.isFinite(latest.avgLap) && latest.avgLap > 0 && latest.avgLap < 60) {
      const packSpread = Math.max(0, latest.avgLap - curLeadLap);
      const spreadAdjustment = Math.max(-2.5, Math.min(1.8, (0.55 - packSpread) * 1.8));
      rawStraightness += spreadAdjustment;
    }
    straightnessScore = Math.max(12.0, Math.min(99.4, Math.round(rawStraightness * 10) / 10));
  } else {
    const fitProgress = Math.min(1.0, (latest?.best || 0) / 25000);
    straightnessScore = Math.round((12.0 + fitProgress * 25.0) * 10) / 10;
  }
  const straightnessText = `${straightnessScore.toFixed(1)}%`;

  let curvatureBadge = 'Geometric Apex';
  let curvatureClass = 'improving';
  if (straightnessScore >= 95.0) {
    curvatureBadge = 'Apex Clipping';
    curvatureClass = 'improving';
  } else if (straightnessScore >= 88.0) {
    curvatureBadge = 'Geometric Apex';
    curvatureClass = 'improving';
  } else if (straightnessScore >= 74.0) {
    curvatureBadge = 'Smooth Turn-In';
    curvatureClass = 'improving';
  } else if (straightnessScore >= 52.0) {
    curvatureBadge = 'Centerline Arc';
    curvatureClass = 'neutral';
  } else {
    curvatureBadge = 'Wall Scrub';
    curvatureClass = 'declining';
  }

  // 4. Swarm Cohesion & Field Depth (20% weight)
  const bestFit = latest.best || 1;
  const medFit = latest.median || (latest.avg ? latest.avg * 0.75 : 0);
  const cohesionRatio = Math.max(0, Math.min(1, medFit / Math.max(1, bestFit)));
  const paceGapCohesion = (recentAvgLap && bestLapEver < 60)
    ? Math.max(0, Math.min(1, 1 - Math.max(0, recentAvgLap - bestLapEver) / 2.5))
    : cohesionRatio;
  const cohesionScore = Math.round((cohesionRatio * 0.35 + paceGapCohesion * 0.65) * 100);

  // 5. Generational Consistency & Stability (10% weight)
  let stabilityScore = 80;
  if (recentGensCount >= 5) {
    const fits = recentSlice.map(r => r.best || 0);
    const meanFit = fits.reduce((a, b) => a + b, 0) / fits.length;
    const variance = fits.reduce((sum, f) => sum + Math.pow(f - meanFit, 2), 0) / fits.length;
    const stdDev = Math.sqrt(variance);
    const cv = meanFit > 0 ? stdDev / meanFit : 0.5;
    stabilityScore = Math.max(0, Math.min(100, Math.round(100 * (1 - Math.min(1.0, cv * 2.0)))));
  }

  // Composite Quality Index Q (0 - 100)
  let peakFit = 0;
  let peakGen = 1;
  for (let i = 0; i < n; i++) {
    if ((history[i].best || 0) > peakFit) {
      peakFit = history[i].best;
      peakGen = history[i].generation;
    }
  }
  if (sim?.allTimeBest?.fitness && sim.allTimeBest.fitness > peakFit) {
    peakFit = sim.allTimeBest.fitness;
    if (sim.allTimeBest.generation) peakGen = sim.allTimeBest.generation;
  }
  const maxAllTimeFit = Math.max(peakFit, sim?.allTimeBest?.fitness || 0, latest.best || 0);
  const isMasterPolicy = maxAllTimeFit >= 80000 || (bestLapEver < 60 && bestLapEver <= 10.5);

  const isEliteMaster = (bestLapEver <= 10.5 || straightnessScore >= 88 || maxAllTimeFit >= 80000);
  const compositeQ = Math.round(
    isEliteMaster
      ? (paceScore * 0.40 + straightnessScore * 0.30 + survivalScore * 0.20 + stabilityScore * 0.10)
      : (survivalScore * 0.35 + paceScore * 0.35 + cohesionScore * 0.20 + stabilityScore * 0.10)
  );

  let qualityGrade = 'Grade C';
  let qualityTier = 'Navigating';
  let qualityClass = 'neutral';

  if (compositeQ >= 85) {
    qualityGrade = 'Grade S+';
    qualityTier = 'Apex Master';
    qualityClass = 'improving';
  } else if (compositeQ >= 75) {
    qualityGrade = 'Grade S';
    qualityTier = 'Elite Grid';
    qualityClass = 'improving';
  } else if (compositeQ >= 65) {
    qualityGrade = 'Grade A';
    qualityTier = 'Pace Setter';
    qualityClass = 'improving';
  } else if (compositeQ >= 50) {
    qualityGrade = 'Grade B+';
    qualityTier = 'Competitive';
    qualityClass = 'improving';
  } else if (compositeQ >= 35) {
    qualityGrade = 'Grade B';
    qualityTier = 'Consistent';
    qualityClass = 'improving';
  } else if (compositeQ >= 20) {
    qualityGrade = 'Grade C';
    qualityTier = 'Navigating';
    qualityClass = 'neutral';
  } else {
    qualityGrade = 'Grade D';
    qualityTier = 'Initializing';
    qualityClass = 'neutral';
  }

  qualityText = `${qualityGrade} · ${qualityTier}`;

  if (recentLapImprovement && bestLapEver < 999) {
    statusText = 'PACE BREAKTHROUGH';
    statusClass = 'status-breakthrough';
    message = `Lap record broken: ${bestLapEver.toFixed(2)}s! Racing line optimization producing faster apex speeds.`;
  } else if (fitnessGrowthRate > 12 && recentGensCount >= 10) {
    statusText = 'RAPID CONVERGENCE';
    statusClass = 'status-improving';
    message = `Fitness surged +${fitnessGrowthRate.toFixed(1)}% over last ${recentGensCount} gens at ${currentGenRate || '–'} gen/s. High training throughput.`;
  } else if (currentFinPct >= 70) {
    statusText = 'HIGH CONSISTENCY GRID';
    statusClass = 'status-stable';
    message = `${currentFinPct}% of grid completing clean laps (${latest.finishers}/${latest.population || 20} cars). Neural steering has stabilized.`;
  } else if (fitnessGrowthRate < 1.2 && recentGensCount >= 25 && n > 35) {
    if (isMasterPolicy) {
      statusText = 'MASTER RACER CONVERGED';
      statusClass = 'status-stable';
      message = `Swarm has achieved near-ceiling race fitness (${fmtNum(maxAllTimeFit)}) with ${bestLapEver < 60 ? bestLapEver.toFixed(2) + 's' : 'sub-11s'} pace. Operating at peak circuit optimization.`;
    } else {
      statusText = 'CONVERGENCE PLATEAU';
      statusClass = 'status-plateau';
      message = `Fitness growth slowed to <1.2% over last ${recentGensCount} gens. Model is fine-tuning weights and exploring mutation branches.`;
    }
  } else if (latest.generation < 15 || currentFinPct < 15) {
    statusText = 'EXPLORATORY ADAPTATION';
    statusClass = 'status-exploring';
    message = 'Discovering track boundaries, braking thresholds, and apex markers through genetic crossover.';
  } else {
    statusText = 'STEADY EVOLUTION';
    statusClass = 'status-improving';
    message = `Steady generational progression (+${latest.fitnessDeltaPct ? latest.fitnessDeltaPct.toFixed(1) : '0'}% fitness). Neural policy converging.`;
  }

  // Driving Milestones based on competency score
  let milestoneName = 'Track Discovery';
  if (compositeQ >= 85) milestoneName = 'Master Line';
  else if (compositeQ >= 72) milestoneName = 'Geometric Apex';
  else if (compositeQ >= 58) milestoneName = 'Apex Braking';
  else if (compositeQ >= 42) milestoneName = 'Cornering';
  else if (compositeQ >= 28) milestoneName = 'Throttle Feed';
  else milestoneName = 'Boundary Hunt';

  // Backward compatibility aliases
  const trackProgressPct = straightnessScore;
  const trackProgressText = straightnessText;
  const trackSectorBadge = curvatureBadge;
  const trackSectorClass = curvatureClass;

  // 7. Active Rolling Window Policy Stability (%)
  const gensWithoutBest = Math.max(0, latest.generation - peakGen);
  const validRecentLaps = recentSlice.map(r => r.bestLap).filter(l => Number.isFinite(l) && l > 0 && l < 60);
  let stabilityPct = 92;
  let stagnationBadge = 'Locked · Steady';
  let stagnationClass = 'improving';

  if (validRecentLaps.length >= 3) {
    const meanL = validRecentLaps.reduce((a, b) => a + b, 0) / validRecentLaps.length;
    const lapVariance = validRecentLaps.reduce((sum, l) => sum + Math.pow(l - meanL, 2), 0) / validRecentLaps.length;
    const lapStdDev = Math.sqrt(lapVariance);

    // stdDev of 0.04s = 98% stability, stdDev of 0.35s = 84% stability, stdDev of 0.9s = 55%
    const lapStability = Math.max(10, Math.min(99, Math.round(100 * (1 - Math.min(1.0, lapStdDev / 0.95)))));

    // Factor in survival consistency across recent window
    const finRates = recentSlice.map(r => ((r.finishers || 0) / (r.population || 20)) * 100);
    const meanFin = finRates.reduce((a, b) => a + b, 0) / finRates.length;
    const finVariance = finRates.reduce((sum, f) => sum + Math.pow(f - meanFin, 2), 0) / finRates.length;
    const finStdDev = Math.sqrt(finVariance);
    const finStability = Math.max(10, Math.min(99, Math.round(100 * (1 - Math.min(1.0, finStdDev / 30)))));

    stabilityPct = Math.round(lapStability * 0.70 + finStability * 0.30);
  } else {
    stabilityPct = 85;
  }

  const stagnationText = `${stabilityPct}%`;

  if (stabilityPct >= 92) {
    stagnationBadge = 'Locked · Steady';
    stagnationClass = 'improving';
  } else if (stabilityPct >= 80) {
    stagnationBadge = 'Fine Tuning';
    stagnationClass = 'improving';
  } else if (stabilityPct >= 65) {
    stagnationBadge = 'Exploring Lines';
    stagnationClass = 'neutral';
  } else {
    stagnationBadge = 'Mutating Swarm';
    stagnationClass = 'declining';
  }

  // 8. Genetic Diversity (Weight Variance / Population Entropy)
  // Evaluates performance spread across active survivors (excluding 0-fitness early wall crashes)
  const bestF = latest.best || 1;
  const medF = latest.median !== undefined ? latest.median : (latest.avg || bestF * 0.5);
  // Healthy GA diversity: median performance is 40% - 70% of best, leaving healthy room for exploration
  const relativeSpread = bestF > 0 ? Math.max(0, Math.min(1, (bestF - medF) / bestF)) : 0.5;
  // Map smoothly to 20% - 85% range centered around 50% target sweet spot
  const diversityScore = Math.round(Math.max(10, Math.min(95, 20 + relativeSpread * 60)));
  let diversityBadge = 'Optimal Spread';
  let diversityClass = 'improving';
  let diversityText = `${diversityScore}%`;
  if (diversityScore < 25) {
    diversityBadge = 'Converged';
    diversityClass = 'declining';
  } else if (diversityScore > 75) {
    diversityBadge = 'High Mutation';
    diversityClass = 'declining';
  } else {
    diversityBadge = 'Optimal Spread';
    diversityClass = 'improving';
  }

  // 9. Pack Pace & Gap to Leader (Current Generation Field Telemetry)
  // Evaluates current generation's average finishing lap and spread to P1
  let packPace = 0;
  let packPaceText = '–';
  let packBadge = 'Learning';
  let packClass = 'neutral';

  const curAvgLap = latest?.avgLap;
  const curBestLap = latest?.bestLap;

  if (curAvgLap && Number.isFinite(curAvgLap) && curAvgLap > 0 && curAvgLap < 60) {
    packPace = curAvgLap;
    packPaceText = `${curAvgLap.toFixed(2)}s`;

    if (curBestLap && Number.isFinite(curBestLap) && curBestLap > 0 && curBestLap < 60) {
      const gap = curAvgLap - curBestLap;
      if (gap <= 0.05) {
        packBadge = 'Tight Pack · Equal P1';
        packClass = 'improving';
      } else if (gap <= 0.35) {
        packBadge = `Tight Pack · +${gap.toFixed(2)}s`;
        packClass = 'improving';
      } else if (gap <= 0.85) {
        packBadge = `Δ +${gap.toFixed(2)}s to P1`;
        packClass = 'neutral';
      } else {
        packBadge = `Spread +${gap.toFixed(2)}s`;
        packClass = 'declining';
      }
    } else {
      packBadge = 'Valid Lap Pace';
      packClass = 'improving';
    }
  } else if (bestLapEver && Number.isFinite(bestLapEver) && bestLapEver < 999) {
    // If cars previously completed laps but all crashed early this generation
    packPaceText = `${(bestLapEver + 0.65).toFixed(2)}s`;
    packBadge = 'Pace Regrouping';
    packClass = 'neutral';
  } else {
    packPaceText = 'Learning';
    packBadge = 'In Training';
    packClass = 'neutral';
  }

  const topSpeed = packPace;
  const topSpeedText = packPaceText;
  const apexSpeed = curBestLap && Number.isFinite(curBestLap) ? curBestLap : 0;
  const apexSpeedText = curBestLap ? `${curBestLap.toFixed(2)}s` : '–';
  const speedBadge = packBadge;
  const speedClass = packClass;

  const medVal = latest.median !== undefined ? latest.median : latest.avg;
  const popSpreadDelta = {
    text: speedBadge,
    type: speedClass
  };

  // 10. Pace vs Avg Delta (kept for compatibility)
  let paceDelta = { text: '–', type: 'neutral' };
  if (latest) {
    const avgF = latest.avg || 1;
    const currentAdvPct = avgF > 0 ? ((bestF - avgF) / avgF) * 100 : 0;
    if (firstOfRecent) {
      const prevBest = firstOfRecent.best || 0;
      const prevAvg = firstOfRecent.avg || 1;
      const prevAdvPct = prevAvg > 0 ? ((prevBest - prevAvg) / prevAvg) * 100 : 0;
      const advDiff = currentAdvPct - prevAdvPct;
      if (advDiff > 1.0) {
        paceDelta = { text: `▲ +${advDiff.toFixed(1)}%`, type: 'improving' };
      } else if (advDiff < -1.0) {
        paceDelta = { text: `▼ ${advDiff.toFixed(1)}%`, type: 'declining' };
      } else {
        paceDelta = { text: '→ Stable', type: 'neutral' };
      }
    } else {
      paceDelta = { text: `+${currentAdvPct.toFixed(1)}%`, type: 'improving' };
    }
  }

  return {
    statusText,
    statusClass,
    qualityText,
    qualityGrade,
    qualityTier,
    qualityScore: compositeQ,
    qualityClass,
    competencyScore: compositeQ,
    milestoneName,
    topSpeed,
    topSpeedText,
    apexSpeed,
    apexSpeedText,
    speedBadge,
    speedClass,
    straightnessScore,
    straightnessText,
    curvatureBadge,
    curvatureClass,
    trackProgressPct,
    trackProgressText,
    trackSectorBadge,
    trackSectorClass,
    gensWithoutBest,
    stagnationText,
    stagnationBadge,
    stagnationClass,
    diversityScore,
    diversityText,
    diversityBadge,
    diversityClass,
    message,
    deltas: {
      fitness: fitnessDelta,
      lap: lapDelta,
      speed: { text: speedBadge, type: speedClass },
      popAvg: popAvgDelta,
      popSpread: popSpreadDelta,
      popMedian: popMedianDelta,
      survival: survivalDelta,
      pace: paceDelta,
      curvature: { text: curvatureBadge, type: curvatureClass },
      progress: { text: curvatureBadge, type: curvatureClass },
      stagnation: { text: stagnationBadge, type: stagnationClass },
      diversity: { text: diversityBadge, type: diversityClass },
    },
    series: {
      fitness: fitnessSeries,
      lap: lapSeries,
      popAvg: popAvgSeries,
      popMedian: popMedianSeries,
      survival: survivalSeries,
    }
  };
}
