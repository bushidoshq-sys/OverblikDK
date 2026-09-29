(function () {
  const SORT_KEY = 'overblikdk_regional_sort';
  const CONTEXT_KEY = 'overblikdk_local_context';
  const toggle = document.getElementById('regionalSortToggle');
  const setupToggle = document.getElementById('regionalSortSetupToggle');
  const status = document.getElementById('regionalSortStatus');
  const refreshBtn = document.getElementById('refreshLocalContextBtn');

  function readContext() {
    try {
      const session = sessionStorage.getItem(CONTEXT_KEY);
      if (session) return JSON.parse(session);
      return JSON.parse(localStorage.getItem(CONTEXT_KEY));
    } catch { return null; }
  }

  function setStatus() {
    if (!status) return;
    const enabled = localStorage.getItem(SORT_KEY) === 'true';
    const ctx = readContext();
    if (!enabled) status.textContent = 'Regional sortering er slået fra.';
    else if (ctx?.kommune) status.textContent = `Regional sortering er slået til. Kommune: ${ctx.kommune}${ctx.region ? ' · ' + ctx.region : ''}${Number.isFinite(ctx.accuracy) ? ' · nøjagtighed ca. ' + ctx.accuracy + ' m' : ''}`;
    else status.textContent = 'Regional sortering er slået til. Kommune/region er ikke hentet endnu.';
  }

  async function updateContext() {
    if (status) status.textContent = 'Henter kommune/region…';
    window.OverblikDKLastLocationError = '';
    window.OverblikDKLocationStage = 'position';
    try {
      const pos = await window.OverblikDKLocation.getPosition();
      window.OverblikDKLocationStage = 'kommune/region-opslag';
      const manual = pos?.manual && pos?.address ? pos.address : null;
      const data = manual
        ? {
            kommune: { navn: manual.kommune || '' },
            region: { navn: manual.region || '' }
          }
        : await window.OverblikDKLocation.reverseAdministrativeContext(pos.coords.latitude, pos.coords.longitude);
      const ctx = {
        kommune: data?.kommune?.navn || '',
        region: data?.region?.navn || '',
        accuracy: Number.isFinite(pos.coords.accuracy) ? Math.round(pos.coords.accuracy) : null,
        updated: new Date().toISOString()
      };
      if (!ctx.kommune || !ctx.region) throw new Error('Kommune/region mangler i lokationssvaret.');
      sessionStorage.removeItem(CONTEXT_KEY);
      sessionStorage.removeItem('overblikdk_manual_current_location');
      localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
      window.OverblikDKLocationStage = 'færdig';
      setStatus();
      window.OverblikDKApplyRegionalSort?.();
      return ctx;
    } catch (err) {
      const detail = String(err?.message || '').trim();
      const stage = window.OverblikDKLocationStage || 'lokation';
      window.OverblikDKLastLocationError = detail ? `${stage}: ${detail}` : stage;
      if (status) status.textContent = detail
        ? `Kunne ikke hente kommune/region: ${detail}`
        : 'Kunne ikke hente kommune/region.';
      return null;
    }
  }

  window.OverblikDKUpdateLocalContext = updateContext;

  window.OverblikDKApplyRegionalSort = function () {
    const enabled = localStorage.getItem(SORT_KEY) === 'true';
    const grid = document.getElementById('categoryGrid');
    if (!grid || !enabled) return;
  };

  [toggle, setupToggle].forEach(el => {
    if (!el) return;
    el.checked = localStorage.getItem(SORT_KEY) === 'true';
    el.addEventListener('change', () => {
      localStorage.setItem(SORT_KEY, el.checked ? 'true' : 'false');
      if (toggle && toggle !== el) toggle.checked = el.checked;
      if (setupToggle && setupToggle !== el) setupToggle.checked = el.checked;
      setStatus();
    });
  });

  refreshBtn?.addEventListener('click', updateContext);
  setStatus();
})();
