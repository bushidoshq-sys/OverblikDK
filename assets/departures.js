(() => {
  const btn = document.getElementById("loadDeparturesBtn");
  const statusEl = document.getElementById("departureStatus");
  const resultsEl = document.getElementById("departureResults");

  if (!btn || !statusEl || !resultsEl) return;

  const API_BASE = "https://www.rejseplanen.dk/api";

  function setStatus(message, tone = "") {
    statusEl.className = `departure-status${tone ? " " + tone : ""}`;
    statusEl.textContent = message;
  }

  function coordForApi(value) {
    // Rejseplanens API bruger WGS84-koordinater uden decimalpunktum: 12.565558 -> 12565558.
    return String(Math.round(value * 1000000));
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

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`API-kald fejlede (${res.status}).`);
    return res.json();
  }

  function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function depTime(dep) {
    const rtTime = dep.rtTime || dep.rtDateTime;
    const time = rtTime || dep.time || dep.dateTime || "";
    const date = dep.rtDate || dep.date || "";
    if (!time) return "Ukendt tid";
    return date ? `${time}` : time;
  }

  function renderDepartures(data) {
    const departures = asArray(data.Departure || data.departure || data.DepartureList?.Departure).slice(0, 20);

    resultsEl.innerHTML = "";

    if (!departures.length) {
      resultsEl.innerHTML = `<div class="empty-emergency">Ingen afgange fundet lige nu.</div>`;
      return;
    }

    const list = document.createElement("div");
    list.className = "departure-list";

    departures.forEach((dep) => {
      const item = document.createElement("article");
      item.className = "departure-card";

      const line = dep.line || dep.name || dep.Product?.line || "?";
      const direction = dep.direction || dep.dir || dep.stop || "Ukendt retning";
      const stop = dep.stop || dep.stopName || dep.station || "Stoppested";
      const time = depTime(dep);
      const cancelled = dep.cancelled === "true" || dep.cancelled === true;

      item.innerHTML = `
        <div class="departure-time">${time}</div>
        <div class="departure-main">
          <strong>${line}</strong> <span>${direction}</span>
          <small>${stop}${cancelled ? " · Aflyst" : ""}</small>
        </div>
      `;
      list.appendChild(item);
    });

    resultsEl.appendChild(list);
  }

  async function loadDepartures() {
    btn.disabled = true;
    resultsEl.innerHTML = "";
    setStatus("Finder din position…");

    try {
      const pos = await getPosition();
      const accuracy = Math.round(pos.coords.accuracy || 0);
      const x = coordForApi(pos.coords.longitude);
      const y = coordForApi(pos.coords.latitude);

      setStatus(`Position fundet (±${accuracy} m). Henter afgangstavle…`);

      // nearbyDepartureBoard finder afgange nær koordinatet. maxNo begrænser antal viste afgange.
      const url = `${API_BASE}/nearbyDepartureBoard?coordX=${encodeURIComponent(x)}&coordY=${encodeURIComponent(y)}&maxNo=20&format=json`;
      const data = await fetchJson(url);

      setStatus(`Afgange hentet. Positionens nøjagtighed: ±${accuracy} m.`);
      renderDepartures(data);
    } catch (err) {
      console.error(err);
      setStatus("Kunne ikke hente afgange. Tjek placeringstilladelse og netforbindelse.", "warning");
      resultsEl.innerHTML = `<div class="empty-emergency">Tip: Rejseplanens live-afgange kræver internet. Hvis API’et kræver adgangsnøgle i din version, skal kaldet flyttes gennem en lille backend/proxy.</div>`;
    } finally {
      btn.disabled = false;
    }
  }

  btn.addEventListener("click", loadDepartures);
})();
