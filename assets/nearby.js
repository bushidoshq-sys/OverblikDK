(function () {
  const buttons = document.querySelectorAll('[data-nearby]');
  const status = document.getElementById('nearbyStatus');
  const results = document.getElementById('nearbyResults');
  if (!buttons.length) return;

  const labels = {
    atm: 'hæveautomat',
    fuel: 'tankstation',
    pharmacy: 'apotek',
    police: 'politistation',
    toilet: 'offentligt toilet',
    charging: 'ladestander'
  };

  buttons.forEach(btn => {
    btn.addEventListener('click', async () => {
      const type = btn.dataset.nearby;
      const label = labels[type] || type;
      if (status) status.textContent = 'Finder din position…';
      if (results) results.innerHTML = '';
      try {
        let pos = window.OverblikDKLocation.readSessionPosition?.();
        try {
          if (!pos) pos = await window.OverblikDKLocation.getPosition({ fresh: true, timeout: 15000, targetAccuracy: 12, progressTimeout: 15000 });
        } catch (error) {
          pos = window.OverblikDKManualLocation?.asPosition?.();
          if (!pos) throw error;
        }
        const { latitude, longitude } = pos.coords;
        const query = `${label} near ${latitude},${longitude}`;
        const url = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`;
        const reused = pos?.source === 'native' || pos?.source === 'web' || pos?.source === 'session';
        if (status) status.textContent = reused
          ? `Bruger din senest fundne position og åbner Google Maps for ${label}.`
          : `Åbner Google Maps for ${label}.`;
        // Brug samme almindelige navigation som den tidligere røde Maps-knap.
        // På Android overdrages Google Maps-linket dermed mere pålideligt til Maps-appen.
        location.href = url;
      } catch (err) {
        if (status) status.textContent = 'Kunne ikke hente position. Brug feltet “Adresse i nærheden” nedenfor.';
        document.getElementById('nearbyAddressFallback')?.removeAttribute('hidden');
      }
    });
  });
})();
