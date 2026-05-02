(() => {
  const API_BASE = "https://www.rejseplanen.dk/api";

  // UDVIKLERNOTE:
  // Indsæt din Rejseplanen accessId her, hvis endpoints kræver den.
  // Den vises ikke i brugerfladen.
  // I en offentlig PWA kan en nøgle i frontend stadig ses i kildekoden.
  const ACCESS_ID = "";

  const KEY_FAVS = "overblikdk-departure-favorites";
  const KEY_CACHE = "overblikdk-departure-cache";
  const COOLDOWN_MS = 60 * 1000;

  const favsEl = document.getElementById("boardFavorites");
  const statusEl = document.getElementById("boardStatus");
  const stopResultsEl = document.getElementById("stopResults");
  const findNearbyBtn = document.getElementById("findNearbyStopsBtn");

  if (!favsEl || !statusEl) return;

  function setStatus(msg, tone = "") {
    statusEl.className = `departure-status${tone ? " " + tone : ""}`;
    statusEl.textContent = msg;
  }

  function readJson(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "") || fallback; }
    catch { return fallback; }
  }

  function writeJson(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function favorites() {
    return readJson(KEY_FAVS, []);
  }

  function saveFavorites(list) {
    writeJson(KEY_FAVS, list.slice(0, 20));
  }

  function cacheMap() {
    return readJson(KEY_CACHE, {});
  }

  function saveCache(map) {
    writeJson(KEY_CACHE, map);
  }

  function asArray(value) {
    return !value ? [] : Array.isArray(value) ? value : [value];
  }

  function esc(value) {
    return String(value ?? "").replace(/[&<>"]/g, c => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;"
    }[c]));
  }

  function coordForApi(value) {
    return String(Math.round(value * 1000000));
  }

  function nowLabel(ts = Date.now()) {
    return new Date(ts).toLocaleTimeString("da-DK", {
      hour: "2-digit",
      minute: "2-digit"
    });
  }

  function apiUrl(path, params) {
    const url = new URL(`${API_BASE}/${path}`);
    url.searchParams.set("format", "json");

    if (ACCESS_ID.trim()) {
      url.searchParams.set("accessId", ACCESS_ID.trim());
    }

    Object.entries(params || {}).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== "") {
        url.searchParams.set(k, String(v));
      }
    });

    return url.toString();
  }

  async function fetchJson(path, params) {
    const res = await fetch(apiUrl(path, params), { cache: "no-store" });
    if (!res.ok) {
      throw new Error(`Data kunne ikke hentes lige nu (${res.status}).`);
    }
    return res.json();
  }

  function getPosition() {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Din browser understøtter ikke placering."));
        return;
      }

      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 20000,
        maximumAge: 60000
      });
    });
  }

  function normalizeStop(raw) {
    const id = raw.id || raw.extId || raw.stopId || raw.Station?.id || "";
    const name = raw.name || raw.stop || raw.Stop?.name || raw.Station?.name || "Ukendt stoppested";
    const dist = raw.dist || raw.distance || raw.Distance || "";
    const x = raw.x || raw.lon || raw.coordX || "";
    const y = raw.y || raw.lat || raw.coordY || "";
    return { id: String(id), name: String(name), dist, x, y, raw };
  }

  function normalizeStops(data) {
    return asArray(
      data.stopLocationOrCoordLocation ||
      data.StopLocation ||
      data.stopLocation ||
      data.LocationList?.StopLocation ||
      data.LocationList?.stopLocation
    )
      .map(item => normalizeStop(item.StopLocation || item.stopLocation || item))
      .filter(s => s.id && s.name)
      .slice(0, 12);
  }

  function depTime(dep) {
    const time = dep.rtTime || dep.time || dep.dateTime || dep.rtDateTime || "Ukendt";
    return String(time).slice(0, 5) || "Ukendt";
  }

  function normalizeDepartures(data) {
    return asArray(data.Departure || data.departure || data.DepartureList?.Departure)
      .slice(0, 16)
      .map(dep => ({
        line: dep.line || dep.name || dep.Product?.line || "?",
        direction: dep.direction || dep.dir || dep.finalStop || "Ukendt retning",
        stop: dep.stop || dep.stopName || dep.station || "",
        time: depTime(dep),
        cancelled: dep.cancelled === true || dep.cancelled === "true"
      }));
  }

  function renderDepartureList(deps, fetchedAt) {
    if (!deps.length) {
      return `<div class="empty-emergency">Ingen afgange fundet lige nu.</div>`;
    }

    return `
      <div class="departure-meta">Sidst hentet: ${nowLabel(fetchedAt)}</div>
      <div class="departure-list">
        ${deps.map(dep => `
          <article class="departure-card${dep.cancelled ? " is-cancelled" : ""}">
            <div class="departure-time">${esc(dep.time)}</div>
            <div class="departure-main">
              <strong>${esc(dep.line)}</strong>
              <span>${esc(dep.direction)}</span>
              <small>${esc(dep.stop)}${dep.cancelled ? " · Aflyst" : ""}</small>
            </div>
          </article>
        `).join("")}
      </div>`;
  }

  function renderFavorites() {
    const favs = favorites();
    const caches = cacheMap();

    if (!favs.length) {
      favsEl.innerHTML = `<div class="empty-emergency">Ingen favorit-stoppesteder endnu. Find et stop nedenfor og tryk “Gem”.</div>`;
      return;
    }

    favsEl.innerHTML = favs.map(fav => {
      const cached = caches[fav.id];
      const age = cached ? Date.now() - cached.fetchedAt : Infinity;
      const cooldownLeft = Math.max(0, COOLDOWN_MS - age);

      return `
        <article class="departure-favorite" data-stop-id="${esc(fav.id)}">
          <div class="departure-favorite-head">
            <div>
              <strong>${esc(fav.label || fav.name)}</strong>
              <small>ID: ${esc(fav.id)}</small>
            </div>
            <button class="mini-action" type="button" data-remove="${esc(fav.id)}">Fjern</button>
          </div>

          <div class="departure-actions-row">
            <button class="emergency-call" type="button" data-load="${esc(fav.id)}" ${cooldownLeft ? "disabled" : ""}>Hent afgange</button>
            ${cooldownLeft ? `<small class="departure-help">Vent ${Math.ceil(cooldownLeft / 1000)} sek. Seneste data er stadig frisk.</small>` : ""}
          </div>

          <div class="favorite-departures">
            ${cached ? renderDepartureList(cached.departures, cached.fetchedAt) : `<div class="departure-meta">Ingen data hentet endnu.</div>`}
          </div>
        </article>`;
    }).join("");
  }

  function renderStops(stops) {
    if (!stops.length) {
      stopResultsEl.innerHTML = `<div class="empty-emergency">Ingen stoppesteder fundet.</div>`;
      return;
    }

    stopResultsEl.innerHTML = `
      <div class="departure-list">
        ${stops.map(stop => `
          <article class="departure-stop-card">
            <div>
              <strong>${esc(stop.name)}</strong>
              <small>ID: ${esc(stop.id)}${stop.dist ? ` · ca. ${esc(stop.dist)} m` : ""}</small>
            </div>
            <button class="emergency-call" type="button" data-save-stop="${esc(stop.id)}" data-name="${esc(stop.name)}">Gem som favorit</button>
          </article>
        `).join("")}
      </div>`;
  }

  async function findNearbyStops() {
    setStatus("Finder din position…");
    stopResultsEl.innerHTML = "";

    try {
      const pos = await getPosition();
      const accuracy = Math.round(pos.coords.accuracy || 0);
      setStatus(`Position fundet (±${accuracy} m). Henter stoppesteder…`);

      const data = await fetchJson("location.nearbystops", {
        originCoordLong: coordForApi(pos.coords.longitude),
        originCoordLat: coordForApi(pos.coords.latitude),
        maxNo: 12
      });

      const stops = normalizeStops(data);
      setStatus("Viser nærmeste stoppesteder. Vælg selv den rigtige tavle/retning.");
      renderStops(stops);
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Kunne ikke hente stoppesteder.", "warning");
    }
  }

  function saveStop(id, name) {
    const favs = favorites();

    if (favs.some(f => f.id === id)) {
      setStatus("Stoppestedet er allerede gemt.");
      return;
    }

    const label = prompt("Navn til favoritten", name) || name;
    favs.unshift({ id, name, label, createdAt: Date.now() });
    saveFavorites(favs);
    renderFavorites();
    setStatus(`Gemt: ${label}`);
  }

  async function loadDepartures(stopId) {
    const fav = favorites().find(f => f.id === stopId);
    if (!fav) return;

    const caches = cacheMap();
    const cached = caches[stopId];

    if (cached && Date.now() - cached.fetchedAt < COOLDOWN_MS) {
      renderFavorites();
      setStatus("Seneste data er stadig frisk. Vent lidt før nyt kald.");
      return;
    }

    setStatus(`Henter afgange for ${fav.label || fav.name}…`);

    try {
      const data = await fetchJson("departureBoard", {
        id: stopId,
        maxJourneys: 16,
        duration: 60
      });

      caches[stopId] = {
        fetchedAt: Date.now(),
        departures: normalizeDepartures(data)
      };

      saveCache(caches);
      renderFavorites();
      setStatus(`Afgange hentet for ${fav.label || fav.name}.`);
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Kunne ikke hente afgange.", "warning");
    }
  }

  function removeFavorite(id) {
    saveFavorites(favorites().filter(f => f.id !== id));

    const caches = cacheMap();
    delete caches[id];
    saveCache(caches);

    renderFavorites();
    setStatus("Favorit fjernet.");
  }

  findNearbyBtn?.addEventListener("click", findNearbyStops);

  stopResultsEl?.addEventListener("click", e => {
    const btn = e.target.closest("[data-save-stop]");
    if (!btn) return;
    saveStop(btn.dataset.saveStop, btn.dataset.name);
  });

  favsEl.addEventListener("click", e => {
    const load = e.target.closest("[data-load]");
    const remove = e.target.closest("[data-remove]");

    if (load) loadDepartures(load.dataset.load);
    if (remove) removeFavorite(remove.dataset.remove);
  });

  renderFavorites();

  const params = new URLSearchParams(window.location.search);
  if (params.get("find") === "nearby") {
    setTimeout(findNearbyStops, 250);
  }
})();
