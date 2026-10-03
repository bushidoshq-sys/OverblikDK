(function () {
  const KEY = 'overblikdk-theme';
  const RETURN_KEY = 'overblikdk-settings-return';
  const SCROLL_PREFIX = 'overblikdk_scroll:';
  const btn = document.getElementById('themeToggle');
  const brand = document.querySelector('.brand');

  function currentInternalPath() {
    const file = location.pathname.split('/').pop() || 'index.html';
    return file + location.search + location.hash;
  }

  function closeSettings() {
    const fallback = new URL('index.html', location.href).href;
    const target = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);

    if (target) {
      try {
        const url = new URL(target, location.href);
        const file = url.pathname.split('/').pop() || 'index.html';
        if (url.origin === location.origin && file !== 'indstillinger.html') {
          location.replace(url.href);
          return;
        }
      } catch {}
    }

    location.replace(fallback);
  }

  window.OverblikDKCloseSettings = closeSettings;

  function scrollKey() {
    return SCROLL_PREFIX + location.pathname + location.search;
  }

  function saveScrollPosition() {
    sessionStorage.setItem(scrollKey(), String(Math.max(0, Math.round(window.scrollY || 0))));
  }

  function restoreScrollPosition() {
    const saved = Number(sessionStorage.getItem(scrollKey()));
    if (!Number.isFinite(saved) || saved <= 0) return;
    requestAnimationFrame(() => requestAnimationFrame(() => window.scrollTo(0, saved)));
  }

  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
  window.addEventListener('pagehide', saveScrollPosition);
  window.addEventListener('beforeunload', saveScrollPosition);
  window.addEventListener('pageshow', restoreScrollPosition);
  window.addEventListener('load', restoreScrollPosition);

  function buildHeaderActions() {
    if (!brand || !btn) return;
    let actions = brand.querySelector('.header-actions');
    if (!actions) {
      actions = document.createElement('div');
      actions.className = 'header-actions';
      brand.insertBefore(actions, btn);
    }

    const home = brand.querySelector('a.header-icon-btn[href="/"], a.header-icon-btn[href="./"], a.header-icon-btn[href="index.html"]');
    if (home && home.parentElement !== actions) actions.appendChild(home);

    if (btn.parentElement !== actions) actions.appendChild(btn);

    let settings = actions.querySelector('[data-header-settings]') ||
      brand.querySelector('a.header-icon-btn[href="indstillinger.html"]');

    if (!settings) {
      settings = document.createElement('a');
      settings.className = 'header-icon-btn';
      settings.href = 'indstillinger.html';
      actions.appendChild(settings);
    } else if (settings.parentElement !== actions) {
      actions.appendChild(settings);
    }

    const onSettingsPage = (location.pathname.split('/').pop() || '') === 'indstillinger.html';
    settings.setAttribute('data-header-settings', '');
    settings.href = onSettingsPage ? '#' : 'indstillinger.html';
    settings.setAttribute('aria-label', onSettingsPage ? 'Luk indstillinger' : 'Åbn indstillinger');
    settings.title = onSettingsPage ? 'Luk indstillinger' : 'Indstillinger';
    settings.textContent = onSettingsPage ? '✕' : '⚙️';

    if (!settings.dataset.headerSettingsBound) {
      settings.dataset.headerSettingsBound = 'true';
      settings.addEventListener('click', (event) => {
        const settingsPage = (location.pathname.split('/').pop() || '') === 'indstillinger.html';
        if (settingsPage) {
          event.preventDefault();
          closeSettings();
          return;
        }
        sessionStorage.setItem(RETURN_KEY, location.href);
      });
    }

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
