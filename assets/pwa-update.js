(function () {
  const isNativeShell =
    Boolean(window.Capacitor?.isNativePlatform?.()) ||
    navigator.userAgent.includes('OverblikDKNative');

  if (isNativeShell) {
    // Native Capacitor must not be controlled by the PWA service worker.
    // Remote server.url already loads the live GitHub Pages layer, and SW
    // interception can interfere with Capacitor's native bridge/plugins.
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
