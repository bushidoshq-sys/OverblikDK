(function () {
  const KEY = 'overblikdk-theme';
  const RETURN_KEY = 'overblikdk_settings_return';
  const btn = document.getElementById('themeToggle');
  const brand = document.querySelector('.brand');

  function currentInternalPath() {
    const file = location.pathname.split('/').pop() || 'index.html';
    return file + location.search + location.hash;
  }

  function closeSettings() {
    const target = sessionStorage.getItem(RETURN_KEY);
    sessionStorage.removeItem(RETURN_KEY);

    if (target && !/^https?:/i.test(target) && !target.includes('indstillinger.html')) {
      location.href = new URL(target, location.href).href;
      return;
    }

    location.replace(new URL('index.html', location.href).href);
  }

  window.OverblikDKCloseSettings = closeSettings;

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
      const onSettingsPage = (location.pathname.split('/').pop() || '') === 'indstillinger.html';
      settings.href = onSettingsPage ? 'index.html' : 'indstillinger.html';
      settings.setAttribute('data-header-settings', '');
      settings.setAttribute('aria-label', onSettingsPage ? 'Luk indstillinger' : 'Åbn indstillinger');
      settings.title = onSettingsPage ? 'Luk indstillinger' : 'Indstillinger';
      settings.textContent = onSettingsPage ? '✕' : '⚙️';
      settings.addEventListener('click', (event) => {
        if (onSettingsPage) {
          event.preventDefault();
          closeSettings();
          return;
        }
        sessionStorage.setItem(RETURN_KEY, currentInternalPath());
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

  function isHomePage() {
    const file = location.pathname.split('/').pop() || 'index.html';
    return file === 'index.html' || file === '';
  }

  function closeTopDialog() {
    const dialogs = Array.from(document.querySelectorAll('dialog[open]'));
    const top = dialogs[dialogs.length - 1];
    if (!top) return false;
    if (typeof top.close === 'function') top.close();
    else top.removeAttribute('open');
    return true;
  }

  function setupNativeBackNavigation() {
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.() || !cap?.registerPlugin) return;

    const App = cap.registerPlugin('App');
    App.addListener('backButton', async ({ canGoBack }) => {
      // Android-back dismisses an open modal before navigating away.
      if (closeTopDialog()) return;

      const file = location.pathname.split('/').pop() || 'index.html';

      // Home behaves like a native Android app: background it instead of
      // walking back into browser/WebView history or hard-exiting.
      if (isHomePage()) {
        try {
          await App.minimizeApp();
          return;
        } catch (error) {
          console.warn('Kunne ikke lægge appen i baggrunden.', error);
          return;
        }
      }

      // Settings has its own controlled return target.
      if (file === 'indstillinger.html' && window.OverblikDKCloseSettings) {
        window.OverblikDKCloseSettings();
        return;
      }

      // Normal internal pages follow Android/WebView history when possible.
      if (canGoBack) {
        history.back();
        return;
      }

      // A deep-linked page with no history returns safely to OverblikDK home.
      location.replace(new URL('index.html', location.href).href);
    }).catch((error) => {
      console.warn('Android tilbage-navigation kunne ikke registreres.', error);
    });
  }

  async function installNativeBackHandling() {
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.() || !cap?.isPluginAvailable?.('App') || !cap?.registerPlugin) return;

    const App = cap.registerPlugin('App');

    await App.addListener('backButton', async ({ canGoBack }) => {
      const openDialog = document.querySelector('dialog[open]');
      if (openDialog) {
        if (typeof openDialog.close === 'function') openDialog.close();
        else openDialog.removeAttribute('open');
        return;
      }

      const file = location.pathname.split('/').pop() || 'index.html';

      if (file === 'indstillinger.html' && window.OverblikDKCloseSettings) {
        window.OverblikDKCloseSettings();
        return;
      }

      if (file === 'index.html' || file === '') {
        try {
          await App.minimizeApp();
        } catch (error) {
          console.warn('Kunne ikke minimere OverblikDK.', error);
        }
        return;
      }

      if (canGoBack) {
        history.back();
        return;
      }

      location.href = new URL('index.html', location.href).href;
    });
  }

  buildHeaderActions();
  installNativeBackHandling().catch(error => console.warn('Native navigation kunne ikke initialiseres.', error));
  setupNativeBackNavigation();

  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current);

  btn?.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });
})();
