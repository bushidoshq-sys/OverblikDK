(function () {
  const SETTINGS_RETURN_KEY = 'overblikdk-settings-return';

  function currentFile() {
    const file = location.pathname.split('/').pop();
    return file || 'index.html';
  }

  function closeOpenDialog() {
    const dialog = document.querySelector('dialog[open]');
    if (!dialog) return false;
    if (typeof dialog.close === 'function') dialog.close();
    else dialog.removeAttribute('open');
    return true;
  }

  function isHome() {
    return currentFile() === 'index.html';
  }

  function safeSettingsReturnUrl() {
    const fallback = new URL('index.html', location.href).href;
    let raw = '';
    try {
      raw = sessionStorage.getItem(SETTINGS_RETURN_KEY) || '';
    } catch {
      return fallback;
    }
    if (!raw) return fallback;

    try {
      const target = new URL(raw, location.href);
      const file = target.pathname.split('/').pop() || 'index.html';
      if (target.origin !== location.origin || file === 'indstillinger.html') return fallback;
      return target.href;
    } catch {
      return fallback;
    }
  }

  function rememberSettingsReturn() {
    if (currentFile() === 'indstillinger.html') return;
    try {
      sessionStorage.setItem(SETTINGS_RETURN_KEY, location.href);
    } catch {}
  }

  window.OverblikDKCloseSettings = function () {
    const target = safeSettingsReturnUrl();
    try {
      sessionStorage.removeItem(SETTINGS_RETURN_KEY);
    } catch {}
    location.replace(target);
  };

  document.addEventListener('click', (event) => {
    const link = event.target.closest?.('a[href]');
    if (!link) return;
    const target = new URL(link.href, location.href);
    const file = target.pathname.split('/').pop() || 'index.html';
    if (file === 'indstillinger.html' && currentFile() !== 'indstillinger.html') {
      rememberSettingsReturn();
    }
  }, true);

  if (currentFile() === 'indstillinger.html') {
    const settingsAction = document.querySelector('a[href="indstillinger.html"]');
    if (settingsAction) {
      settingsAction.href = '#';
      settingsAction.setAttribute('aria-label', 'Luk indstillinger');
      settingsAction.setAttribute('title', 'Luk indstillinger');
      settingsAction.textContent = '✕';
      settingsAction.addEventListener('click', (event) => {
        event.preventDefault();
        window.OverblikDKCloseSettings();
      });
    }
  }

  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.() || !cap?.registerPlugin) return;

  const App = cap.registerPlugin('App');

  App.addListener('backButton', () => {
    if (closeOpenDialog()) return;

    if (currentFile() === 'indstillinger.html') {
      window.OverblikDKCloseSettings();
      return;
    }

    if (!isHome()) {
      const backLink = document.querySelector('a.back[href]');
      if (backLink) {
        const target = new URL(backLink.href, location.href);
        const targetFile = target.pathname.split('/').pop() || 'index.html';
        if (targetFile === 'index.html') location.replace(target.href);
        else location.assign(target.href);
      } else {
        location.replace(new URL('index.html', location.href).href);
      }
      return;
    }

    App.minimizeApp().catch((error) => {
      console.warn('Kunne ikke lægge OverblikDK i baggrunden.', error);
    });
  }).catch((error) => {
    console.warn('Android tilbage-navigation kunne ikke aktiveres.', error);
  });
})();