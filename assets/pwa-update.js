(function () {
  if (!('serviceWorker' in navigator)) return;

  function createToast(registration) {
    if (document.getElementById('pwaUpdateToast')) return;
    const toast = document.createElement('div');
    toast.id = 'pwaUpdateToast';
    toast.className = 'update-toast is-visible';
    toast.setAttribute('role', 'status');
    toast.setAttribute('aria-live', 'polite');
    toast.innerHTML = `
      <div class="update-toast__text">🔄 Ny version af OverblikDK er klar</div>
      <div class="update-toast__actions">
        <button class="update-toast__dismiss" type="button">Senere</button>
        <button class="update-toast__refresh" type="button">Opdater nu</button>
      </div>
    `;
    document.body.appendChild(toast);
    toast.querySelector('.update-toast__dismiss').addEventListener('click', () => toast.classList.remove('is-visible'));
    toast.querySelector('.update-toast__refresh').addEventListener('click', () => {
      if (registration.waiting) registration.waiting.postMessage({ type: 'SKIP_WAITING' });
      else window.location.reload();
    });
  }

  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener('load', async () => {
    try {
      const registration = await navigator.serviceWorker.register('service-worker.js');
      if (registration.waiting && navigator.serviceWorker.controller) createToast(registration);
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) createToast(registration);
        });
      });
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) registration.update();
      });
    } catch (err) {
      console.warn('OverblikDK: service worker kunne ikke registreres', err);
    }
  });
})();
