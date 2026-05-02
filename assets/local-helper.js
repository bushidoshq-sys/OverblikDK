(() => {
  const data = window.MITDK_LOCAL_DATA;
  if (!data) return;

  const lookupBtn = document.getElementById("localLookupBtn");
  const watchBtn = document.getElementById("localWatchBtn");
  const stopBtn = document.getElementById("localStopWatchBtn");
  const statusEl = document.getElementById("localStatus");
  const resultsEl = document.getElementById("localResults");
  const quickPosBtn = document.getElementById("quickPositionBtn");
  const shortcutButtons = document.querySelectorAll("[data-nearby-shortcut]");
  const bigToggle = document.getElementById("bigModeToggle");

  let watchId = null;
  const LOCATION_PERMISSION_KEY = "overblikdk_location_permission";

  function rememberLocationPermission(value) {
    try { localStorage.setItem(LOCATION_PERMISSION_KEY, value); } catch (_) {}
  }

  async function syncLocationPermissionStatus() {
    if (!navigator.permissions || !navigator.permissions.query) return;
    try {
      const permission = await navigator.permissions.query({ name: "geolocation" });
      rememberLocationPermission(permission.state);
      permission.onchange = () => rememberLocationPermission(permission.state);
    } catch (_) {
      // Ikke alle browsere/PWA-miljøer understøtter Permissions API ens.
    }
  }


  function km(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2-lat1) * Math.PI / 180;
    const dLon = (lon2-lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat/2) ** 2 +
      Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) *
      Math.sin(dLon/2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  }

  function nearest(list, lat, lon) {
    return list
      .map(x => ({ ...x, distance: km(lat, lon, x.lat, x.lon) }))
      .sort((a,b) => a.distance - b.distance)[0];
  }

  function mapsDirections(lat, lon, label) {
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`;
  }

  function setStatus(text) {
    if (!statusEl) return;
    statusEl.hidden = false;
    statusEl.textContent = text;
  }

  function renderLocal(pos) {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    const acc = Math.round(pos.coords.accuracy || 0);

    const mun = nearest(data.municipalities, lat, lon);
    const hospital = nearest(data.hospitals, lat, lon);
    const region = data.regions.find(r => r.name === (mun && mun.region)) || nearest(data.regions, lat, lon);

    localStorage.setItem("overblikdk_last_local", JSON.stringify({
      time: Date.now(),
      municipality: mun?.name,
      region: region?.name,
      hospital: hospital?.name
    }));

    if (!resultsEl) return;
    resultsEl.innerHTML = `
      <article class="local-card">
        <h3>🏘️ Nærmeste kommune</h3>
        <p><strong>${mun.name}</strong><br>${mun.distance.toFixed(1)} km væk</p>
        <a href="${mun.url}" target="_blank" rel="noopener">Åbn kommunens hjemmeside</a>
      </article>

      <article class="local-card">
        <h3>🧭 Region og lægevagt</h3>
        <p><strong>${region.name}</strong><br>${region.doctorLabel}: <strong>${region.doctor}</strong></p>
        <div class="emergency-card-actions">
          <a class="mini-action" href="tel:${region.doctor}">📞 Ring ${region.doctor}</a>
          <a class="mini-action" href="${region.url}" target="_blank" rel="noopener">Åbn region</a>
        </div>
      </article>

      <article class="local-card">
        <h3>🏥 Nærmeste hospital</h3>
        <p><strong>${hospital.name}</strong><br>${hospital.distance.toFixed(1)} km væk</p>
        <div class="emergency-card-actions">
          <a class="mini-action" href="${hospital.url}" target="_blank" rel="noopener">Åbn hospital</a>
          <a class="mini-action" href="${mapsDirections(hospital.lat, hospital.lon, hospital.name)}" target="_blank" rel="noopener">🧭 Find vej</a>
        </div>
      </article>

      <article class="local-card">
        <h3>📍 Aktuel position</h3>
        <p>Nøjagtighed: ca. ${acc} meter</p>
        <a href="https://www.google.com/maps?q=${lat.toFixed(6)},${lon.toFixed(6)}" target="_blank" rel="noopener">Åbn position i kort</a>
      </article>
    `;
  }

  function requestPosition(cb) {
    if (!navigator.geolocation) {
      alert("Placering understøttes ikke i denne browser.");
      return;
    }

    setStatus("Henter placering…");
    navigator.geolocation.getCurrentPosition(
      pos => {
        rememberLocationPermission("granted");
        setStatus("Placering fundet. GPS gemmes ikke.");
        cb(pos);
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) rememberLocationPermission("denied");
        const msg = err.code === err.PERMISSION_DENIED
          ? "Placering blev afvist. Du kan ændre tilladelsen i browserens/appens indstillinger."
          : err.code === err.TIMEOUT
            ? "Placering tog for lang tid."
            : "Placering kunne ikke hentes.";
        setStatus(msg);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 60000 }
    );
  }

  function openNearby(type) {
    if (typeof window.findNearbyCategory === "function") {
      window.findNearbyCategory(type);
      return;
    }
    // fallback: scroll to nearby if function name differs
    document.querySelector(".nearby-panel, #nearbyResults")?.scrollIntoView({ behavior: "smooth" });
  }

  lookupBtn?.addEventListener("click", () => requestPosition(renderLocal));

  watchBtn?.addEventListener("click", () => {
    if (!navigator.geolocation) return;
    if (watchId !== null) return;

    setStatus("Opdaterer placering mens appen er åben…");
    watchId = navigator.geolocation.watchPosition(
      pos => {
        rememberLocationPermission("granted");
        setStatus("Opdaterer lokalt overblik. GPS gemmes ikke.");
        renderLocal(pos);
      },
      err => {
        if (err.code === err.PERMISSION_DENIED) rememberLocationPermission("denied");
        setStatus(err.code === err.PERMISSION_DENIED ? "Placering blev afvist. Du kan ændre tilladelsen i browserens/appens indstillinger." : "Kunne ikke opdatere placering.");
      },
      { enableHighAccuracy: true, maximumAge: 30000, timeout: 15000 }
    );
    watchBtn.hidden = true;
    stopBtn.hidden = false;
  });

  stopBtn?.addEventListener("click", () => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
    watchId = null;
    setStatus("Automatisk opdatering stoppet.");
    watchBtn.hidden = false;
    stopBtn.hidden = true;
  });

  quickPosBtn?.addEventListener("click", () => requestPosition(renderLocal));

  shortcutButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const type = btn.getAttribute("data-nearby-shortcut");
      openNearby(type);
      document.getElementById("nearbyResults")?.scrollIntoView({ behavior: "smooth" });
    });
  });

  function applyBigMode() {
    const enabled = localStorage.getItem("overblikdk_big_mode") === "true";
    document.body.classList.toggle("big-mode", enabled);
    if (bigToggle) bigToggle.textContent = enabled ? "✅ Nem visning" : "🔘 Nem visning";
  }

  bigToggle?.addEventListener("click", () => {
    const next = localStorage.getItem("overblikdk_big_mode") !== "true";
    localStorage.setItem("overblikdk_big_mode", String(next));
    applyBigMode();
  });

  syncLocationPermissionStatus();
  applyBigMode();
})();