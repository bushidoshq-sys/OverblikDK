(function () {
  const RELEASE_VERSION = '2026.09.29.50';
  const isNativeShell =
    Boolean(window.Capacitor?.isNativePlatform?.()) ||
    navigator.userAgent.includes('OverblikDKNative');

  function setVersionText() {
    const el = document.getElementById('latestVersion');
    if (el) el.textContent = RELEASE_VERSION;
  }

  async function checkForUpdates() {
    const status = document.getElementById('updateStatus');
    const button = document.getElementById('checkForUpdatesBtn');
    if (button) button.disabled = true;
    if (status) status.textContent = 'Søger efter opdatering…';

    try {
      // The native shell loads the live GitHub Pages web layer. A cache-busted
      // request verifies that the current published Settings page is reachable.
      if (isNativeShell) {
        const response = await fetch('./indstillinger.html?update-check=' + Date.now(), { cache: 'no-store' });
        if (!response.ok) throw new Error('Update check failed');
        const text = await response.text();
        const match = text.match(/assets\/pwa-update\.js\?v=(\d+)/);
        const remote = match ? Number(match[1]) : null;
        const local = Number(RELEASE_VERSION.split('.').pop());
        if (remote && remote > local) {
          if (status) status.textContent = 'Der er en nyere webversion. OverblikDK genindlæses nu…';
          location.replace('./indstillinger.html?updated=' + Date.now());
        } else {
          if (status) status.textContent = 'OverblikDK er opdateret.';
        }
        return;
      }

      if (!('serviceWorker' in navigator)) {
        if (status) status.textContent = 'Automatisk opdatering understøttes ikke i denne browser.';
        return;
      }

      const reg = await navigator.serviceWorker.getRegistration('./');
      if (!reg) {
        if (status) status.textContent = 'Opdateringsfunktionen er ikke klar endnu. Prøv igen om et øjeblik.';
        return;
      }
      await reg.update();
      if (reg.installing || reg.waiting) {
        if (status) status.textContent = 'Der er fundet en opdatering. Den gøres klar…';
      } else {
        if (status) status.textContent = 'OverblikDK er opdateret.';
      }
    } catch (error) {
      if (status) status.textContent = 'Kunne ikke søge efter opdatering. Kontroller forbindelsen og prøv igen.';
    } finally {
      if (button) button.disabled = false;
    }
  }

  window.OverblikDKCheckForUpdates = checkForUpdates;
  document.addEventListener('DOMContentLoaded', () => {
    setVersionText();
    document.getElementById('checkForUpdatesBtn')?.addEventListener('click', checkForUpdates);
  });

  if (isNativeShell) {
    window.addEventListener('load', async () => {
      try {
        if ('serviceWorker' in navigator) {
          const regs = await navigator.serviceWorker.getRegistrations();
          await Promise.all(regs.map(reg => reg.unregister()));
        }
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map(key => caches.delete(key)));
        }

        const key = 'overblikdk_native_sw_cleanup_v26';
        if (!sessionStorage.getItem(key)) {
          sessionStorage.setItem(key, 'done');
          location.reload();
        }
      } catch (error) {
        console.warn('Native cache/service-worker cleanup fejlede.', error);
      }
    });
    return;
  }

  if (!('serviceWorker' in navigator)) return;

  window.addEventListener('load', async () => {
    try {
      const reg = await navigator.serviceWorker.register('./service-worker.js');

      reg.addEventListener('updatefound', () => {
        const worker = reg.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            const shouldReload = confirm('Der findes en ny version af OverblikDK. Opdater nu?');
            if (shouldReload) worker.postMessage({ type: 'SKIP_WAITING' });
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        window.location.reload();
      });
    } catch (err) {
      console.warn('Service worker kunne ikke registreres', err);
    }
  });
})();
