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

  async function getBestNativePosition(options = {}) {
    const fresh = options.fresh === true;
    if (!fresh) return getNativePosition(options);

    const deadline = Date.now() + (options.timeout || 30000);
    const targetAccuracy = options.targetAccuracy || 12;
    let best = null;

    while (Date.now() < deadline) {
      try {
        const remaining = Math.max(3000, deadline - Date.now());
        const position = await getNativePosition({ ...options, timeout: Math.min(8000, remaining) });
        const accuracy = Number(position?.coords?.accuracy);
        const bestAccuracy = Number(best?.coords?.accuracy);
        if (!best || (Number.isFinite(accuracy) && (!Number.isFinite(bestAccuracy) || accuracy < bestAccuracy))) {
          best = position;
        }
        if (Number.isFinite(accuracy) && accuracy <= targetAccuracy) break;
      } catch (error) {
        const denied = error?.code === 1 || /permission|denied|afvist/i.test(String(error?.message || ''));
        if (denied) { hideGpsProgress(); throw error; }
      }
      if (Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 500));
    }

    if (best) return best;
    return getNativePosition(options);
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

  const gpsMessages = [
    'Stå helt stille og sig som en trådløs banjo.',
    'Drej langsomt mod uret og sig som en aborre.',
    'Kig mod nord og tænk meget præcist på en kartoffel.',
    'Hold telefonen roligt. Satellitterne bliver let forskrækkede.',
    'Forsøg at se geografisk ud.',
    'GPS-nisserne triangulerer dig. Undgå pludselige bevægelser.',
    'Peg telefonen mod nærmeste Sverige. Det hjælper sikkert.',
    'Stå på ét ben. Det gør absolut ingen forskel.',
    'Sig “breddegrad” tre gange uden at lyde mistænkelig.',
    'Vent venligst. Vi spørger en satellit, hvor du er.',
    'Tæl langsomt tilbage fra sommerfugl uden at blinke med venstre øre.'
  ];
  let gpsOverlay = null;
  let gpsMessageTimer = null;
  let gpsProgressTimer = null;

  function showGpsProgress(timeout = 15000) {
    if (gpsOverlay) return;
    const overlay = document.createElement('div');
    overlay.id = 'overblikdkGpsProgress';
    overlay.setAttribute('role', 'status');
    overlay.setAttribute('aria-live', 'polite');
    overlay.innerHTML = '<div style="width:min(88vw,420px);background:#171a20;color:#f7f7f8;border:1px solid #343943;border-radius:18px;padding:22px;box-shadow:0 16px 50px rgba(0,0,0,.55);text-align:center"><div style="font-size:1.2rem;font-weight:700;margin-bottom:14px;color:#fff">📍 Finder din position…</div><div style="height:10px;background:#3a3f48;border-radius:999px;overflow:hidden"><div data-gps-bar style="height:100%;width:2%;background:#f7f7f8;border-radius:999px;transition:width .25s linear"></div></div><div data-gps-message style="margin-top:14px;min-height:2.6em;color:#e5e7eb;line-height:1.45"></div></div>';
    Object.assign(overlay.style,{position:'fixed',inset:'0',zIndex:'2147483000',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px',background:'rgba(0,0,0,.48)'});
    document.body.appendChild(overlay);
    gpsOverlay = overlay;
    const msg = overlay.querySelector('[data-gps-message]');
    const bar = overlay.querySelector('[data-gps-bar]');
    let messageIndex = Math.floor(Math.random() * gpsMessages.length);
    msg.textContent = gpsMessages[messageIndex];
    gpsMessageTimer = setInterval(() => {
      messageIndex = (messageIndex + 1) % gpsMessages.length;
      msg.textContent = gpsMessages[messageIndex];
    }, 2500);
    const started = Date.now();
    gpsProgressTimer = setInterval(() => {
      const pct = Math.min(96, Math.max(2, ((Date.now() - started) / timeout) * 100));
      bar.style.width = pct + '%';
    }, 250);
  }

  function hideGpsProgress() {
    clearInterval(gpsMessageTimer);
    clearInterval(gpsProgressTimer);
    gpsMessageTimer = null;
    gpsProgressTimer = null;
    gpsOverlay?.remove();
    gpsOverlay = null;
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

    if (options.fresh === true) showGpsProgress(options.progressTimeout || 15000);

    window.OverblikDKLocationDiagnostics = {
      nativePlatform: Boolean(window.Capacitor?.isNativePlatform?.()),
      nativeMarker: navigator.userAgent.includes('OverblikDKNative'),
      pluginAvailable: Boolean(window.Capacitor?.isPluginAvailable?.('Geolocation')),
      source: 'starting'
    };

    const native = getNativeGeolocation();
    if (native) {
      try {
        const position = await getBestNativePosition(options);
        window.OverblikDKLocationDiagnostics.source = 'native';
        window.OverblikDKLocationDiagnostics.accuracy = position?.coords?.accuracy ?? null;
        rememberSessionPosition(position, 'native');
        hideGpsProgress();
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
    hideGpsProgress();
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
    openLocationHelp,
    showGpsProgress,
    hideGpsProgress
  };
})();
