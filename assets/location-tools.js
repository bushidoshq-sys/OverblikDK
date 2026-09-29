window.OverblikDKLocation = (function () {
  let nativeGeolocation = null;

  function getNativeGeolocation() {
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.() || !cap?.isPluginAvailable?.('Geolocation') || !cap?.registerPlugin) return null;
    if (!nativeGeolocation) nativeGeolocation = cap.registerPlugin('Geolocation');
    return nativeGeolocation;
  }

  async function getNativePosition(options = {}) {
    const geo = getNativeGeolocation();
    if (!geo) return null;

    const permission = await geo.checkPermissions();
    if (permission.location !== 'granted') {
      const requested = await geo.requestPermissions({ permissions: ['location'] });
      if (requested.location !== 'granted') {
        const err = new Error('Lokationstilladelse blev afvist.');
        err.code = 1;
        throw err;
      }
    }

    return geo.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: options.timeout || 15000,
      maximumAge: 0,
      enableLocationFallback: true
    });
  }

  function getWebPosition(options = {}) {
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

      function onWatchError(error) {
        // PERMISSION_DENIED er endelig. POSITION_UNAVAILABLE og TIMEOUT kan være
        // midlertidige under en high-accuracy watch, så vent på næste måling
        // eller det samlede timeout-vindue.
        if (error?.code === 1) {
          fail(error);
        }
      }

      watchId = navigator.geolocation.watchPosition(
        consider,
        onWatchError,
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

  async function getPosition(options = {}) {
    const native = getNativeGeolocation();
    if (native) {
      try {
        return await getNativePosition(options);
      } catch (error) {
        const denied = error?.code === 1 || /permission|denied/i.test(error?.message || '');
        if (denied) throw error;
        console.warn('Native lokation fejlede; prøver web-lokation som fallback.', error);
      }
    }
    return getWebPosition(options);
  }

  function mapsUrl(lat, lon) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(lat + ',' + lon)}`;
  }

  async function reverseAdministrativeContext(lat, lon) {
    const provider = window.OverblikDKAddressProvider;
    if (!provider?.reverseAdministrativeContext) {
      throw new Error('Adresse-/lokationsudbyder er ikke indlæst.');
    }
    return provider.reverseAdministrativeContext(lat, lon);
  }

  // Midlertidigt alias, så eksisterende kode fortsat virker under migrationen.
  const reverseDawa = reverseAdministrativeContext;

  function openLocationHelp() {
    alert('For bedst mulig lokation: slå præcis lokation til for browseren, slå Wi-Fi til, og gå om muligt tæt på et vindue eller udenfor. OverblikDK tager flere målinger og bruger den mest præcise.');
  }

  return { getPosition, mapsUrl, reverseAdministrativeContext, reverseDawa, openLocationHelp };
})();
