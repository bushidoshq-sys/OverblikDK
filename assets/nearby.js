(() => {
  const statusEl = document.getElementById('nearbyStatus');
  const resultsEl = document.getElementById('nearbyResults');
  const buttons = Array.from(document.querySelectorAll('[data-nearby]'));
  if (!statusEl || !resultsEl || buttons.length === 0) return;

  const TYPES = {
    atm: { label: 'hæveautomater', singular: 'hæveautomat', radius: 5000, icon: '🏧', query: 'node["amenity"="atm"](around:RADIUS,LAT,LON);way["amenity"="atm"](around:RADIUS,LAT,LON);relation["amenity"="atm"](around:RADIUS,LAT,LON);' },
    library: { label: 'biblioteker', singular: 'bibliotek', radius: 12000, icon: '📚', query: 'node["amenity"="library"](around:RADIUS,LAT,LON);way["amenity"="library"](around:RADIUS,LAT,LON);relation["amenity"="library"](around:RADIUS,LAT,LON);' },
    fuel: { label: 'tankstationer', singular: 'tankstation', icon: '⛽', mapsQuery: 'tankstation nær mig' },
    bus_stop: { label: 'busstoppesteder', singular: 'busstoppested', radius: 2500, icon: '🚌', routeToDepartures: true }
  };
  function setStatus(message) { statusEl.textContent = message; }
  function clearResults() { resultsEl.innerHTML = ''; }
  function setBusy(active) { buttons.forEach(btn => { btn.disabled = active; btn.setAttribute('aria-busy', active ? 'true' : 'false'); }); }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!('geolocation' in navigator)) { reject(new Error('Din browser understøtter ikke placering.')); return; }
      navigator.geolocation.getCurrentPosition(
        pos => resolve({ lat: pos.coords.latitude, lon: pos.coords.longitude, accuracy: pos.coords.accuracy }),
        err => {
          if (err.code === err.PERMISSION_DENIED) reject(new Error('Placering blev ikke tilladt.'));
          else if (err.code === err.POSITION_UNAVAILABLE) reject(new Error('Placering kunne ikke findes.'));
          else if (err.code === err.TIMEOUT) reject(new Error('Placering tog for lang tid. Prøv igen.'));
          else reject(new Error('Placering kunne ikke hentes.'));
        },
        { enableHighAccuracy: false, timeout: 12000, maximumAge: 60000 }
      );
    });
  }

  function haversineKm(aLat, aLon, bLat, bLon) {
    const R = 6371;
    const dLat = (bLat - aLat) * Math.PI / 180;
    const dLon = (bLon - aLon) * Math.PI / 180;
    const lat1 = aLat * Math.PI / 180;
    const lat2 = bLat * Math.PI / 180;
    const x = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
    return 2 * R * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
  }

  function formatDistance(km) { return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0).replace('.', ',')} km`; }
  function escapeHtml(value) { return String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;'); }
  function getName(el, type) { const tags = el.tags || {}; return tags.name || tags.operator || tags.brand || `Ukendt ${type.singular}`; }
  function getElementLatLon(el) { if (typeof el.lat === 'number' && typeof el.lon === 'number') return { lat: el.lat, lon: el.lon }; if (el.center && typeof el.center.lat === 'number' && typeof el.center.lon === 'number') return { lat: el.center.lat, lon: el.center.lon }; return null; }

  function buildOverpassQuery(type, lat, lon) {
    const body = type.query.replaceAll('RADIUS', String(type.radius)).replaceAll('LAT', String(lat)).replaceAll('LON', String(lon));
    return `[out:json][timeout:25];(${body});out center tags 25;`;
  }

  async function fetchNearby(type, position) {
    const response = await fetch('https://overpass-api.de/api/interpreter', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
      body: new URLSearchParams({ data: buildOverpassQuery(type, position.lat, position.lon) })
    });
    if (!response.ok) throw new Error('OpenStreetMap-opslaget svarede ikke korrekt.');
    const data = await response.json();
    const seen = new Set();
    return (data.elements || []).map(el => {
      const coords = getElementLatLon(el); if (!coords) return null;
      const name = getName(el, type).trim();
      const key = `${name.toLowerCase()}|${coords.lat.toFixed(5)}|${coords.lon.toFixed(5)}`;
      if (seen.has(key)) return null; seen.add(key);
      return { name, lat: coords.lat, lon: coords.lon, distance: haversineKm(position.lat, position.lon, coords.lat, coords.lon), tags: el.tags || {} };
    }).filter(Boolean).sort((a, b) => a.distance - b.distance).slice(0, 8);
  }

  function renderResults(type, items) {
    clearResults();
    if (!items.length) { setStatus(`Jeg fandt ingen ${type.label} i nærheden. Prøv evt. igen senere.`); return; }
    setStatus(`Fandt ${items.length} nærmeste ${type.label}.`);
    items.forEach((item, index) => {
      const li = document.createElement('li');
      const mapUrl = `https://www.openstreetmap.org/?mlat=${encodeURIComponent(item.lat)}&mlon=${encodeURIComponent(item.lon)}#map=17/${encodeURIComponent(item.lat)}/${encodeURIComponent(item.lon)}`;
      const address = [item.tags['addr:street'], item.tags['addr:housenumber'], item.tags['addr:postcode'], item.tags['addr:city']].filter(Boolean).join(' ');
      li.innerHTML = `<a href="${mapUrl}" target="_blank" rel="noopener"><span class="nearby-result__main"><strong>${type.icon} ${index + 1}. ${escapeHtml(item.name)}</strong>${address ? `<small>${escapeHtml(address)}</small>` : '<small>Åbn kort for placering</small>'}</span><span class="nearby-distance">${formatDistance(item.distance)}</span></a>`;
      resultsEl.appendChild(li);
    });
  }

  async function handleClick(kind) {
    const type = TYPES[kind]; if (!type) return;

    if (type.routeToDepartures) {
      clearResults();
      setStatus('Åbner Afgangstavler, hvor du kan finde og gemme det rigtige stoppested.');
      window.location.href = 'afgangstavler.html?find=nearby';
      return;
    }

    if (type.mapsQuery) {
      clearResults();
      setStatus(`Åbner Google Maps og søger efter ${type.label}.`);
      const query = encodeURIComponent(type.mapsQuery);
      window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank', 'noopener');
      return;
    }

    clearResults(); setBusy(true); setStatus(`Finder din placering og søger efter ${type.label}...`);
    try {
      const position = await getPosition();
      setStatus(`Søger efter ${type.label} inden for ca. ${formatDistance(type.radius / 1000)}...`);
      renderResults(type, await fetchNearby(type, position));
    } catch (error) {
      clearResults(); setStatus(error.message || 'Der skete en fejl under søgningen.');
    } finally { setBusy(false); }
  }

  buttons.forEach(btn => btn.addEventListener('click', () => handleClick(btn.dataset.nearby)));
})();


// OverblikDK quick action bridge
window.findNearbyCategory = function(type) {
  const map = { atm: "atm", library: "library", fuel: "fuel", tankstation: "fuel", gas: "fuel", bus: "bus_stop", busstop: "bus_stop", bus_stop: "bus_stop" };
  const wanted = map[type] || type;
  const btn =
    document.querySelector(`[data-type="${wanted}"]`) ||
    document.querySelector(`[data-nearby="${wanted}"]`) ||
    document.querySelector(`[data-category="${wanted}"]`) ||
    Array.from(document.querySelectorAll("button")).find(b => b.textContent.toLowerCase().includes(
      wanted === "atm" ? "hæve" :
      wanted === "library" ? "bibliotek" :
      wanted === "fuel" ? "tankstation" :
      wanted === "bus_stop" ? "bus" : wanted
    ));
  if (btn) btn.click();
};
