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

  const cap = window.Capacitor;

  if (cap?.isNativePlatform?.() && cap?.registerPlugin) {
    const OfflineEmergency = cap.registerPlugin('OfflineEmergency');

    // Keep the native offline fallback supplied with the latest emergency
    // contacts from any online page, not only when the emergency page is opened.
    try {
      const contacts = JSON.parse(localStorage.getItem('overblikdk_emergency_contacts') || '[]');
      OfflineEmergency.syncContacts({ contacts: Array.isArray(contacts) ? contacts.slice(0, 3) : [] }).catch(() => {});
    } catch {
      OfflineEmergency.syncContacts({ contacts: [] }).catch(() => {});
    }
    document.addEventListener('click', (event) => {
      const link = event.target.closest?.('a[href]');
      if (!link) return;
      const target = new URL(link.href, location.href);
      const file = target.pathname.split('/').pop() || 'index.html';
      if (file !== 'noedsituation.html') return;

      event.preventDefault();
      OfflineEmergency.openIfOffline()
        .then(({ opened }) => {
          if (!opened) location.href = target.href;
        })
        .catch(() => {
          location.href = target.href;
        });
    }, true);
  }
  if (!cap?.isNativePlatform?.() || !cap?.registerPlugin) return;

  const App = cap.registerPlugin('App');

  function usableInternalReferrer() {
    if (!document.referrer) return false;
    try {
      const ref = new URL(document.referrer);
      const current = new URL(location.href);
      if (ref.origin !== current.origin) return false;
      const refFile = ref.pathname.split('/').pop() || 'index.html';
      const currentName = currentFile();
      return refFile !== currentName;
    } catch {
      return false;
    }
  }

  App.addListener('backButton', ({ canGoBack }) => {
    if (closeOpenDialog()) return;

    if (currentFile() === 'indstillinger.html') {
      window.OverblikDKCloseSettings();
      return;
    }

    if (!isHome()) {
      if (canGoBack && usableInternalReferrer()) {
        history.back();
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