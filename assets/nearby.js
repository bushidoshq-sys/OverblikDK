(function () {
  const buttons = document.querySelectorAll('[data-nearby]');
  const status = document.getElementById('nearbyStatus');
  const results = document.getElementById('nearbyResults');
  if (!buttons.length) return;

  const labels = {
    atm: 'hæveautomat',
    fuel: 'tankstation',
    pharmacy: 'apotek',
    police: 'politistation'
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.nearby;
      const label = labels[type] || type;
      if (status) status.textContent = 'Finder din position…';
      if (results) results.innerHTML = '';
      try {
        let pos;
        try {
          pos = await window.OverblikDKLocation.getPosition();
        } catch (error) {
          pos = window.OverblikDKManualLocation?.asPosition?.();
          if (!pos) throw error;
        }
        const { latitude, longitude } = pos.coords;
        const query = `${label} near ${latitude},${longitude}`;
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        if (status) status.textContent = `Åbner Google Maps for ${label}.`;
        window.open(url, '_blank', 'noopener');
        if (results) {
          results.innerHTML = `<li><a class="store-action" href="${url}" target="_blank" rel="noopener">Åbn ${label} i Google Maps</a></li>`;
        }
      } catch (err) {
        if (status) status.textContent = 'Kunne ikke hente position. Brug feltet “Adresse i nærheden” nedenfor.';
        document.getElementById('nearbyAddressFallback')?.removeAttribute('hidden');
      }
    });
  });
})();
