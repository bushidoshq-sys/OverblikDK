(() => {
  const STORAGE_KEY = "overblikdk_emergency_contacts";

  const contactsEl = document.getElementById("emergencyContacts");
  const addBtn = document.getElementById("addEmergencyContactBtn");
  const posBtn = document.getElementById("showPositionBtn");
  const sharePosBtn = document.getElementById("sharePositionBtn");
  const posBox = document.getElementById("positionBox");
  const call112Btn = document.getElementById("call112Btn");
  const sendOkayBtn = document.getElementById("sendOkayBtn");

  if (!contactsEl || !addBtn || !posBtn || !posBox) return;

  let lastPosition = null;

  function loadContacts() {
    try {
      const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveContacts(contacts) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(contacts.slice(0, 3)));
  }

  function cleanPhone(phone) {
    return String(phone || "").replace(/[^\d+]/g, "");
  }

  function mapsLink(lat, lon) {
    return `https://www.google.com/maps?q=${lat},${lon}`;
  }

  function smsHref(phone, body) {
    const encoded = encodeURIComponent(body);
    return `sms:${cleanPhone(phone)}?body=${encoded}`;
  }

  function setPositionStatus(message, tone = "") {
    posBox.hidden = false;
    posBox.className = `position-box${tone ? " " + tone : ""}`;
    posBox.innerHTML = message;
  }

  function askContact(existing = {}) {
    const name = prompt("Navn på nødkontakt:", existing.name || "");
    if (!name || !name.trim()) return null;

    const phone = prompt("Telefonnummer:", existing.phone || "");
    if (!phone || !phone.trim()) return null;

    return {
      name: name.trim(),
      phone: phone.trim()
    };
  }

  function editContact(index) {
    const contacts = loadContacts();
    const current = contacts[index];
    if (!current) return;

    const updatedContact = askContact(current);
    if (!updatedContact) return;

    contacts[index] = updatedContact;
    saveContacts(contacts);
    renderContacts();
  }

  function removeContact(index) {
    const contacts = loadContacts();
    const current = contacts[index];
    if (!current) return;

    const ok = confirm(`Fjern ${current.name} som nødkontakt?`);
    if (!ok) return;

    contacts.splice(index, 1);
    saveContacts(contacts);
    renderContacts();
  }

  function renderContacts() {
    const contacts = loadContacts();
    contactsEl.innerHTML = "";

    if (!contacts.length) {
      contactsEl.innerHTML = `
        <div class="empty-emergency">
          Ingen nødkontakter gemt endnu. Tilføj fx en pårørende, nabo eller ven.
        </div>`;
      return;
    }

    contacts.forEach((contact, index) => {
      const card = document.createElement("article");
      card.className = "emergency-card";

      const name = document.createElement("h3");
      name.textContent = contact.name;

      const phone = document.createElement("p");
      phone.textContent = contact.phone;

      const actions = document.createElement("div");
      actions.className = "emergency-card-actions";

      const call = document.createElement("a");
      call.href = `tel:${cleanPhone(contact.phone)}`;
      call.className = "mini-action";
      call.textContent = "📞 Ring";

      const sms = document.createElement("a");
      sms.href = smsHref(contact.phone, "Jeg har brug for hjælp. Ring til mig hurtigst muligt.");
      sms.className = "mini-action";
      sms.textContent = "💬 SMS";

      const locate = document.createElement("button");
      locate.type = "button";
      locate.className = "mini-action";
      locate.textContent = "📍 Send position";
      locate.addEventListener("click", () => sendPosition(contact.phone));

      const edit = document.createElement("button");
      edit.type = "button";
      edit.className = "mini-action";
      edit.textContent = "✏️ Rediger";
      edit.addEventListener("click", () => editContact(index));

      const remove = document.createElement("button");
      remove.type = "button";
      remove.className = "mini-action remove";
      remove.textContent = "Slet";
      remove.addEventListener("click", () => removeContact(index));

      actions.append(call, sms, locate, edit, remove);
      card.append(name, phone, actions);
      contactsEl.appendChild(card);
    });
  }

  function requestPosition(callback) {
    if (!navigator.geolocation) {
      alert("Din browser understøtter ikke placering.");
      return;
    }

    const maxWaitMs = 30000;
    const preferredAccuracyM = 50;
    const warnAccuracyM = 100;
    const hardLimitAccuracyM = 250;

    let bestPosition = null;
    let finished = false;
    let watchId = null;
    let firstReadingShown = false;
    const started = Date.now();

    setPositionStatus(
      `<strong>Finder din position…</strong><br>` +
      `Første måling kan være upræcis. Vent et øjeblik, så telefonen kan hente en bedre GPS-position.`
    );

    function qualityText(accuracy) {
      if (accuracy <= 50) return "God nødposition";
      if (accuracy <= 100) return "Brugbar, men ikke perfekt";
      if (accuracy <= 250) return "Upræcis — venter på bedre data";
      return "For upræcis til nødposition";
    }

    function updateStatus(pos) {
      const accuracy = Math.round(pos.coords.accuracy || 0);
      const bestAccuracy = Math.round(bestPosition?.coords?.accuracy || accuracy);
      const secondsLeft = Math.max(0, Math.ceil((maxWaitMs - (Date.now() - started)) / 1000));

      if (!firstReadingShown) {
        firstReadingShown = true;
        setPositionStatus(
          `<strong>Første lokationsdata modtaget</strong><br>` +
          `Første måling er ca. ±${accuracy} meter. Det kan være meget upræcist, især indendørs.<br>` +
          `Venter på bedre data… bedste måling indtil nu: ±${bestAccuracy} meter.`
        );
        return;
      }

      setPositionStatus(
        `<strong>Forbedrer GPS-præcision…</strong><br>` +
        `Aktuel måling: ±${accuracy} meter<br>` +
        `Bedste måling: ±${bestAccuracy} meter<br>` +
        `${qualityText(bestAccuracy)}<br>` +
        `Bruger automatisk positionen når den er god nok — eller efter ${secondsLeft} sekunder med bedste fundne måling.`
      );
    }

    function finish(pos, reason) {
      if (finished) return;
      finished = true;
      if (watchId !== null) navigator.geolocation.clearWatch(watchId);

      lastPosition = pos;
      const accuracy = Math.round(pos.coords.accuracy || 0);

      if (accuracy > hardLimitAccuracyM) {
        setPositionStatus(
          `<strong>Placeringen er for upræcis</strong><br>` +
          `Telefonen melder kun ca. ±${accuracy} meter. Det er for usikkert som nødposition.<br>` +
          `Gå tættere på et vindue eller udendørs, vent et øjeblik, og prøv igen.`,
          "warning"
        );
        return;
      }

      if (reason === "fallback" && accuracy > warnAccuracyM) {
        const ok = confirm(
          "Placeringen er stadig lidt upræcis\n\n" +
          `Telefonen melder ca. ${accuracy} meters nøjagtighed.\n\n` +
          "Det kan stadig være brugbart, men er ikke perfekt. Vil du bruge positionen alligevel?"
        );
        if (!ok) {
          setPositionStatus(
            `<strong>Afsendelse annulleret</strong><br>` +
            `Bedste position var ca. ±${accuracy} meter.`,
            "warning"
          );
          return;
        }
      }

      setPositionStatus(
        `<strong>Position klar</strong><br>` +
        `Bedste måling: ca. ±${accuracy} meter.`
      );
      callback(pos);
    }

    function consider(pos) {
      if (finished) return;

      if (!bestPosition || pos.coords.accuracy < bestPosition.coords.accuracy) {
        bestPosition = pos;
      }

      updateStatus(pos);

      const bestAccuracy = bestPosition.coords.accuracy || 99999;
      const waited = Date.now() - started;

      if (bestAccuracy <= preferredAccuracyM || waited >= maxWaitMs) {
        finish(bestPosition, bestAccuracy <= preferredAccuracyM ? "accurate" : "fallback");
      }
    }

    function fail(err) {
      if (finished) return;
      if (bestPosition) {
        finish(bestPosition, "fallback");
        return;
      }

      let msg = "Kunne ikke hente placering.";
      if (err.code === err.PERMISSION_DENIED) msg = "Placering blev afvist.";
      if (err.code === err.POSITION_UNAVAILABLE) msg = "Placering er ikke tilgængelig lige nu.";
      if (err.code === err.TIMEOUT) msg = "Placering tog for lang tid.";
      setPositionStatus(`<strong>${msg}</strong>`, "warning");
    }

    watchId = navigator.geolocation.watchPosition(
      consider,
      fail,
      {
        enableHighAccuracy: true,
        timeout: maxWaitMs,
        maximumAge: 0
      }
    );

    setTimeout(() => {
      if (!finished && bestPosition) finish(bestPosition, "fallback");
      if (!finished && !bestPosition) fail({ code: 3 });
    }, maxWaitMs + 500);
  }

  function showPosition() {
    requestPosition(pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lon = pos.coords.longitude.toFixed(6);
      const accuracy = Math.round(pos.coords.accuracy || 0);
      const link = mapsLink(lat, lon);

      setPositionStatus(`
        <strong>Din position:</strong><br>
        Breddegrad: ${lat}<br>
        Længdegrad: ${lon}<br>
        Nøjagtighed: ca. ${accuracy} meter<br>
        <a href="${link}" target="_blank" rel="noopener">Åbn i kort</a>
      `);
    });
  }

  function sendPosition(phone) {
    requestPosition(pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lon = pos.coords.longitude.toFixed(6);
      const link = mapsLink(lat, lon);
      const accuracy = Math.round(pos.coords.accuracy || 0);
      const message = `Jeg har brug for hjælp. Min position er: ${link} (nøjagtighed ca. ${accuracy} meter)`;
      window.location.href = smsHref(phone, message);
    });
  }

  function sharePosition() {
    requestPosition(async pos => {
      const lat = pos.coords.latitude.toFixed(6);
      const lon = pos.coords.longitude.toFixed(6);
      const accuracy = Math.round(pos.coords.accuracy || 0);
      const link = mapsLink(lat, lon);
      const text = `Min position: ${link} (nøjagtighed ca. ${accuracy} meter)`;

      if (navigator.share) {
        try {
          await navigator.share({ title: "Min position", text, url: link });
          return;
        } catch {
          // Brugeren kan have lukket delingsmenuen. Fald tilbage til visning.
        }
      }

      setPositionStatus(`
        <strong>Del min position:</strong><br>
        ${text}<br>
        <a href="${link}" target="_blank" rel="noopener">Åbn i kort</a>
      `);
    });
  }

  function sendOkayMessage() {
    const contacts = loadContacts();
    if (!contacts.length) {
      alert("Du har ikke gemt nogen nødkontakter endnu.");
      return;
    }

    const target = contacts[0];
    const ok = confirm(
      `Send “Jeg er okay” til ${target.name}?\n\n` +
      "Beskeden åbnes som SMS, så du selv kan sende den."
    );

    if (ok) {
      window.location.href = smsHref(target.phone, "Jeg er okay. Ingen grund til bekymring.");
    }
  }

  call112Btn?.addEventListener("click", () => {
    const ok = confirm(
      "Bekræft 112-opkald\n\n" +
      "Ring kun 112 ved akut fare, alvorlig ulykke, brand, livsfare eller når politi/ambulance/brandvæsen skal rykke ud med det samme.\n\n" +
      "Misbrug af 112 kan medføre politianmeldelse og straf.\n\n" +
      "Vil du ringe 112 nu?"
    );

    if (ok) window.location.href = "tel:112";
  });

  sendOkayBtn?.addEventListener("click", sendOkayMessage);
  posBtn.addEventListener("click", showPosition);
  sharePosBtn?.addEventListener("click", sharePosition);

  addBtn.addEventListener("click", () => {
    const contacts = loadContacts();
    if (contacts.length >= 3) {
      alert("Du kan gemme op til 3 nødkontakter.");
      return;
    }

    const contact = askContact();
    if (!contact) return;

    contacts.push(contact);
    saveContacts(contacts);
    renderContacts();
  });

  renderContacts();
})();
