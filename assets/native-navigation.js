(function () {
  const cap = window.Capacitor;
  if (!cap?.isNativePlatform?.() || !cap?.registerPlugin) return;

  const App = cap.registerPlugin('App');

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

  App.addListener('backButton', ({ canGoBack }) => {
    if (closeOpenDialog()) return;

    if (currentFile() === 'indstillinger' && window.OverblikDKCloseSettings) {
      window.OverblikDKCloseSettings();
      return;
    }

    if (!isHome()) {
      if (canGoBack && history.length > 1) {
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
