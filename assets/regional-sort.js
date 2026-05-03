(function () {
  const SORT_KEY = 'overblikdk_regional_sort';
  const CONTEXT_KEY = 'overblikdk_local_context';
  const toggle = document.getElementById('regionalSortToggle');
  const setupToggle = document.getElementById('regionalSortSetupToggle');
  const status = document.getElementById('regionalSortStatus');
  const refreshBtn = document.getElementById('refreshLocalContextBtn');

  function readContext() {
    try { return JSON.parse(localStorage.getItem(CONTEXT_KEY)); } catch { return null; }
  }

  function setStatus() {
    if (!status) return;
    const enabled = localStorage.getItem(SORT_KEY) === 'true';
    const ctx = readContext();
    if (!enabled) status.textContent = 'Regional sortering er slået fra.';
    else if (ctx?.kommune) status.textContent = `Regional sortering er slået til. Kommune: ${ctx.kommune}${ctx.region ? ' · ' + ctx.region : ''}`;
    else status.textContent = 'Regional sortering er slået til. Kommune/region er ikke hentet endnu.';
  }

  async function updateContext() {
    if (status) status.textContent = 'Henter kommune/region…';
    try {
      const pos = await window.OverblikDKLocation.getPosition();
      const data = await window.OverblikDKLocation.reverseDawa(pos.coords.latitude, pos.coords.longitude);
      const ctx = {
        kommune: data?.kommune?.navn || '',
        region: data?.region?.navn || '',
        updated: new Date().toISOString()
      };
      localStorage.setItem(CONTEXT_KEY, JSON.stringify(ctx));
      setStatus();
      window.OverblikDKApplyRegionalSort?.();
    } catch (err) {
      if (status) status.textContent = 'Kunne ikke hente kommune/region.';
    }
  }

  window.OverblikDKApplyRegionalSort = function () {
    const enabled = localStorage.getItem(SORT_KEY) === 'true';
    const grid = document.getElementById('categoryGrid');
    if (!grid || !enabled) return;
    // Placeholder for future local boost rules.
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
