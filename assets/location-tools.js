window.OverblikDKLocation = (function () {
  function getPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation understøttes ikke på denne enhed.'));
        return;
      }

      const overallTimeout = options.timeout || 15000;
      const targetAccuracy = options.targetAccuracy || 20;
      let bestPosition = null;
      let watchId = null;
      let finished = false;
      let overallTimer = null;

      function cleanup() {
        if (watchId !== null) navigator.geolocation.clearWatch(watchId);
        clearTimeout(overallTimer);
      }

      function finish(position) {
        if (finished) return;
        finished = true;
        cleanup();
        resolve(position);
      }

      function fail(error) {
        if (finished) return;
        if (bestPosition) {
          finish(bestPosition);
          return;
        }
        finished = true;
        cleanup();
        reject(error);
      }

      function consider(position) {
        const accuracy = Number(position?.coords?.accuracy);
        const bestAccuracy = Number(bestPosition?.coords?.accuracy);
        if (!bestPosition || (Number.isFinite(accuracy) && (!Number.isFinite(bestAccuracy) || accuracy < bestAccuracy))) {
          bestPosition = position;
        }

        // En accuracy-værdi er radius i meter. Stop tidligt kun når browseren
        // allerede har leveret en meget præcis måling; ellers samler vi videre
        // og vælger den bedste måling inden for tidsvinduet.
        if (Number.isFinite(accuracy) && accuracy <= targetAccuracy) finish(position);
      }

      watchId = navigator.geolocation.watchPosition(
        consider,
        fail,
        {
          enableHighAccuracy: true,
          timeout: overallTimeout,
          maximumAge: 0
        }
      );

      overallTimer = setTimeout(() => {
        if (bestPosition) finish(bestPosition);
        else fail(new Error('Lokation tog for lang tid.'));
      }, overallTimeout);
    });
  }

  function mapsUrl(lat, lon) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat + ',' + lon)}`;
  }

  async function reverseDawa(lat, lon) {
    const qs = `x=${encodeURIComponent(lon)}&y=${encodeURIComponent(lat)}`;
    const [kommuneRes, regionRes] = await Promise.all([
      fetch(`https://api.dataforsyningen.dk/kommuner/reverse?${qs}`),
      fetch(`https://api.dataforsyningen.dk/regioner/reverse?${qs}`)
    ]);
    if (!kommuneRes.ok || !regionRes.ok) throw new Error('DAWA-opslag fejlede.');
    const [kommune, region] = await Promise.all([kommuneRes.json(), regionRes.json()]);
    return { kommune, region };
  }

  function openLocationHelp() {
    alert('For bedst mulig lokation: slå præcis lokation til for browseren, slå Wi-Fi til, og gå om muligt tæt på et vindue eller udenfor. OverblikDK tager flere målinger og bruger den mest præcise.');
  }

  return { getPosition, mapsUrl, reverseDawa, openLocationHelp };
})();
