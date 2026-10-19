/** Report browser-attributed long frames, including scripts and forced layout. */
export function installFrameDiagnostics() {
  if (typeof PerformanceObserver === 'undefined') return;
  const supported = PerformanceObserver.supportedEntryTypes || [];
  const type = supported.includes('long-animation-frame') ? 'long-animation-frame' :
    (supported.includes('longtask') ? 'longtask' : null);
  if (!type) return;
  let lastReport = 0;
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const now = performance.now();
      if (document.hidden || now < 5000 || now - lastReport < 1000) continue;
      lastReport = now;
      const scripts = Array.from(entry.scripts || []).sort((a, b) => b.duration - a.duration).slice(0, 3);
      const details = scripts.map((script) => `${script.sourceFunctionName || script.invoker || 'script'} ` +
        `${script.duration.toFixed(1)}ms (layout ${(script.forcedStyleAndLayoutDuration || 0).toFixed(1)}ms, ` +
        `${script.sourceURL || ''}:${script.sourceCharPosition || 0})`).join('; ');
      console.info(`[FRAME TRACE] ${type} ${entry.duration.toFixed(1)}ms | ${details || 'no attributed script'}`);
    }
  });
  observer.observe({ type, buffered: false });
  return observer;
}
