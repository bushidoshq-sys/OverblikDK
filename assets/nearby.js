(function () {
  const buttons = document.querySelectorAll('[data-nearby]');
  const status = document.getElementById('nearbyStatus');
  const results = document.getElementById('nearbyResults');
  if (!buttons.length) return;

  const labels = {
    atm: 'hæveautomat',
    fuel: 'tankstation'
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.nearby;
      const label = labels[type] || type;
      if (status) status.textContent = 'Finder din position…';
      if (results) results.innerHTML = '';
      try {
        const pos = await window.OverblikDKLocation.getPosition();
        const { latitude, longitude } = pos.coords;
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(label + ' nær mig')}`;
        if (status) status.textContent = `Åbner Google Maps for ${label}.`;
        window.open(url, '_blank', 'noopener');
        if (results) {
          results.innerHTML = `<li><a class="store-action" href="${url}" target="_blank" rel="noopener">Åbn ${label} i Google Maps</a></li>`;
        }
      } catch (err) {
        if (status) status.textContent = 'Kunne ikke hente position. Tjek lokationstilladelse og prøv igen.';
      }
    });
  });
})();
