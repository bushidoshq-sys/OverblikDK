(function () {
  const SORT_KEY = 'overblikdk_regional_sort';

  function setStatus() {
    const enabled = localStorage.getItem(SORT_KEY) === 'true';
    const status = document.getElementById('regionalSortStatus');
    if (status) {
      status.textContent = enabled
        ? 'Regional sortering er slået til. OverblikDK bruger kun lokation, når du selv trykker.'
        : 'Regional sortering er slået fra.';
    }
  }

  window.OverblikDKApplyRegionalSort = function () {
    setStatus();
  };

  window.addEventListener('DOMContentLoaded', () => {
    const toggle = document.getElementById('regionalSortToggle');
    if (toggle) {
      toggle.checked = localStorage.getItem(SORT_KEY) === 'true';
      toggle.addEventListener('change', () => {
        localStorage.setItem(SORT_KEY, toggle.checked ? 'true' : 'false');
        setStatus();
      });
    }
    setStatus();
  });
})();
