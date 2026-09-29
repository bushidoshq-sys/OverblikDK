(function () {
  const KEY = 'overblikdk-theme';
  const RETURN_KEY = 'overblikdk_settings_return';
  const btn = document.getElementById('themeToggle');
  const brand = document.querySelector('.brand');

  function currentInternalPath() {
    const file = location.pathname.split('/').pop() || 'index.html';
    return file + location.search + location.hash;
  }

  function buildHeaderActions() {
    if (!brand || !btn) return;
    let actions = brand.querySelector('.header-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'header-actions';
      brand.insertBefore(actions, btn);
    }

    if (!actions.querySelector('[data-header-settings]')) {
      const settings = document.createElement('a');
      settings.className = 'header-icon-btn';
      settings.href = 'indstillinger.html';
      settings.setAttribute('data-header-settings', '');
      settings.setAttribute('aria-label', 'Åbn indstillinger');
      settings.title = 'Indstillinger';
      if ((location.pathname.split('/').pop() || '') === 'indstillinger.html') {
        settings.setAttribute('aria-current', 'page');
      }
      settings.textContent = '⚙️';
      settings.addEventListener('click', () => {
        if ((location.pathname.split('/').pop() || '') !== 'indstillinger.html') {
          sessionStorage.setItem(RETURN_KEY, currentInternalPath());
        }
      });
      actions.appendChild(settings);
    }

    if (btn.parentElement !== actions) actions.appendChild(btn);
  }

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    if (!btn) return;
    const dark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    const icon = btn.querySelector('.theme-toggle__icon');
    const text = btn.querySelector('.theme-toggle__text');
    if (icon) icon.textContent = dark ? '☀️' : '🌙';
    if (text) text.textContent = dark ? 'Lys' : 'Mørk';
  }

  buildHeaderActions();

  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current);

  btn?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });
})();
