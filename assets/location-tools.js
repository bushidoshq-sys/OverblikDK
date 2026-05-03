window.OverblikDKLocation = (function () {
  function getPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation understøttes ikke på denne enhed.'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: options.timeout || 12000,
        maximumAge: 0
      });
    });
  }

  function mapsUrl(lat, lon) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat + ',' + lon)}`;
  }

  async function reverseDawa(lat, lon) {
    const url = `https://api.dataforsyningen.dk/reverse?x=${encodeURIComponent(lon)}&y=${encodeURIComponent(lat)}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('DAWA-opslag fejlede.');
    return res.json();
  }

  function openLocationHelp() {
    alert('For bedre lokation: gå udenfor eller tæt på et vindue, vent få sekunder og prøv igen. Indendørs GPS kan være upræcis.');
  }

  return { getPosition, mapsUrl, reverseDawa, openLocationHelp };
})();
