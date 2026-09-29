window.OverblikDKLocation = (function () {
  let nativeGeolocation = null;
  const SESSION_POSITION_KEY = 'overblikdk_session_position';
  const SESSION_POSITION_MAX_AGE = 30 * 60 * 1000;

  function rememberSessionPosition(position, source = 'device') {
    const lat = Number(position?.coords?.latitude);
    const lon = Number(position?.coords?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;
    sessionStorage.setItem(SESSION_POSITION_KEY, JSON.stringify({
      latitude: lat,
      longitude: lon,
      accuracy: Number.isFinite(Number(position?.coords?.accuracy)) ? Number(position.coords.accuracy) : null,
      source,
      updated: Date.now()
    }));
  }

  function readSessionPosition(maxAge = SESSION_POSITION_MAX_AGE) {
    try {
      const saved = JSON.parse(sessionStorage.getItem(SESSION_POSITION_KEY));
      if (!saved) return null;
      if (!Number.isFinite(Number(saved.latitude)) || !Number.isFinite(Number(saved.longitude))) return null;
      if (!Number.isFinite(Number(saved.updated)) || Date.now() - Number(saved.updated) > maxAge) return null;
      return {
        coords: {
          latitude: Number(saved.latitude),
          longitude: Number(saved.longitude),
          accuracy: Number.isFinite(Number(saved.accuracy)) ? Number(saved.accuracy) : null
        },
        source: saved.source || 'session'
      };
    } catch {
      return null;
    }
  }

  function clearSessionPosition() {
    sessionStorage.removeItem(SESSION_POSITION_KEY);
  }

  function getNativeGeolocation() {
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.() || !cap?.isPluginAvailable?.('Geolocation') || !cap?.registerPlugin) return null;
    if (!nativeGeolocation) nativeGeolocation = cap.registerPlugin('Geolocation');
    return nativeGeolocation;
  }

  async function getNativePosition(options = {}) {
    const geo = getNativeGeolocation();
    if (!geo) return null;

    let permission = await geo.checkPermissions();
    let fineGranted = permission.location === 'granted';
    let coarseGranted = permission.coarseLocation === 'granted';

    if (!fineGranted && !coarseGranted) {
      permission = await geo.requestPermissions({ permissions: ['location', 'coarseLocation'] });
      fineGranted = permission.location === 'granted';
      coarseGranted = permission.coarseLocation === 'granted';

      if (!fineGranted && !coarseGranted) {
        const err = new Error('Lokationstilladelse blev afvist.');
        err.code = 1;
        throw err;
      }
    }

    const timeout = options.timeout || 25000;

    // Android may grant approximate/coarse location without fine location.
    // Do not demand high accuracy when only coarse permission exists.
    if (!fineGranted && coarseGranted) {
      return geo.getCurrentPosition({
        enableHighAccuracy: false,
        timeout,
        maximumAge: 5000,
        enableLocationFallback: true
      });
    }

    try {
      return await geo.getCurrentPosition({
        enableHighAccuracy: true,
        timeout,
        maximumAge: 0,
        enableLocationFallback: true
      });
    } catch (error) {
      // A valid fine permission can still produce a transient high-accuracy
      // failure indoors. Retry natively at normal accuracy before falling back
      // to WebView geolocation.
      const denied =
        error?.code === 1 ||
        error?.code === 'OS-PLUG-GLOC-0003' ||
        /permission|denied|afvist/i.test(String(error?.message || ''));
      if (denied) throw error;

      return geo.getCurrentPosition({
        enableHighAccuracy: false,
        timeout,
        maximumAge: 5000,
        enableLocationFallback: true
      });
    }
  }

  function getWebPosition(options = {}) {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Geolocation understøttes ikke på denne enhed.'));
        return;
      }

      const overallTimeout = options.timeout || 25000;
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
    const manual = window.OverblikDKManualLocation?.asPosition?.();
    if (manual) {
      window.OverblikDKLocationDiagnostics = {
        nativePlatform: Boolean(window.Capacitor?.isNativePlatform?.()),
        pluginAvailable: Boolean(window.Capacitor?.isPluginAvailable?.('Geolocation')),
        source: 'manual-address',
        accuracy: null
      };
      return manual;
    }

    window.OverblikDKLocationDiagnostics = {
      nativePlatform: Boolean(window.Capacitor?.isNativePlatform?.()),
      nativeMarker: navigator.userAgent.includes('OverblikDKNative'),
      pluginAvailable: Boolean(window.Capacitor?.isPluginAvailable?.('Geolocation')),
      source: 'starting'
    };

    const native = getNativeGeolocation();
    if (native) {
      try {
        const position = await getNativePosition(options);
        window.OverblikDKLocationDiagnostics.source = 'native';
        window.OverblikDKLocationDiagnostics.accuracy = position?.coords?.accuracy ?? null;
        rememberSessionPosition(position, 'native');
        return position;
      } catch (error) {
        const denied = error?.code === 1 || /permission|denied/i.test(error?.message || '');
        if (denied) throw error;
        console.warn('Native lokation fejlede; prøver web-lokation som fallback.', error);
      }
    }
    const position = await getWebPosition(options);
    window.OverblikDKLocationDiagnostics.source = 'web';
    window.OverblikDKLocationDiagnostics.accuracy = position?.coords?.accuracy ?? null;
    rememberSessionPosition(position, 'web');
    return position;
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
    alert('OverblikDK kan bruge både omtrentlig og præcis lokation. Præcis lokation giver bedre nærmeste-resultater, men kommune/region bør også virke med omtrentlig lokation. Wi-Fi og fri udsigt kan forbedre nøjagtigheden.');
  }

  return {
    getPosition,
    rememberSessionPosition,
    readSessionPosition,
    clearSessionPosition,
    mapsUrl,
    reverseAdministrativeContext,
    reverseDawa,
    openLocationHelp
  };
})();
