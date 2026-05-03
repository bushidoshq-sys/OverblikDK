(function () {
  const posBox = document.getElementById('positionBox');
  const contactsBox = document.getElementById('emergencyContacts');
  const KEY = 'overblikdk_emergency_contacts';

  function getContacts() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function saveContacts(c) {
    localStorage.setItem(KEY, JSON.stringify(c.slice(0, 3)));
  }
  function normalizePhone(phone) {
    return String(phone || '').replace(/[^\d+]/g, '');
  }
  async function getPositionText() {
    const pos = await window.OverblikDKLocation.getPosition();
    const lat = pos.coords.latitude.toFixed(6);
    const lon = pos.coords.longitude.toFixed(6);
    return {
      text: `Min position: ${lat}, ${lon}\nGoogle Maps: ${window.OverblikDKLocation.mapsUrl(lat, lon)}`,
      url: window.OverblikDKLocation.mapsUrl(lat, lon),
      accuracy: Math.round(pos.coords.accuracy || 0)
    };
  }
  function renderContacts() {
    if (!contactsBox) return;
    const contacts = getContacts();
    if (!contacts.length) {
      contactsBox.textContent = 'Ingen nødkontakter gemt endnu.';
      return;
    }
    contactsBox.innerHTML = contacts.map((c, i) => `
      <article class="card">
        <div class="icon">👤</div>
        <div>
          <h3>${c.name}</h3>
          <p>${c.phone}</p>
          <div class="emergency-actions">
            <a class="emergency-call" href="tel:${normalizePhone(c.phone)}">Ring</a>
            <a class="emergency-call" href="sms:${normalizePhone(c.phone)}">SMS</a>
            <button class="emergency-call" type="button" data-pos="${i}">Send position</button>
            <button class="emergency-call" type="button" data-edit="${i}">Rediger</button>
            <button class="emergency-call danger" type="button" data-del="${i}">Slet</button>
          </div>
        </div>
      </article>
    `).join('');
    contactsBox.querySelectorAll('[data-del]').forEach(btn => btn.addEventListener('click', () => {
      const contacts = getContacts();
      contacts.splice(Number(btn.dataset.del), 1);
      saveContacts(contacts);
      renderContacts();
    }));
    contactsBox.querySelectorAll('[data-edit]').forEach(btn => btn.addEventListener('click', () => {
      const contacts = getContacts();
      const i = Number(btn.dataset.edit);
      const name = prompt('Navn:', contacts[i].name);
      if (!name) return;
      const phone = prompt('Telefon:', contacts[i].phone);
      if (!phone) return;
      contacts[i] = { name, phone };
      saveContacts(contacts);
      renderContacts();
    }));
    contactsBox.querySelectorAll('[data-pos]').forEach(btn => btn.addEventListener('click', async () => {
      const contacts = getContacts();
      const c = contacts[Number(btn.dataset.pos)];
      try {
        const p = await getPositionText();
        location.href = `sms:${normalizePhone(c.phone)}?body=${encodeURIComponent(p.text)}`;
      } catch {
        alert('Kunne ikke hente position.');
      }
    }));
  }

  document.getElementById('call112Btn')?.addEventListener('click', () => {
    if (confirm('Er du sikker på, at du vil ringe 112? Misbrug kan medføre ansvar.')) {
      location.href = 'tel:112';
    }
  });

  document.getElementById('showPositionBtn')?.addEventListener('click', async () => {
    if (!posBox) return;
    posBox.hidden = false;
    posBox.textContent = 'Henter position…';
    try {
      const p = await getPositionText();
      posBox.innerHTML = `${p.text.replace(/\n/g, '<br>')}<br>Nøjagtighed ca. ${p.accuracy} meter.`;
    } catch {
      posBox.textContent = 'Kunne ikke hente position.';
    }
  });

  document.getElementById('sharePositionBtn')?.addEventListener('click', async () => {
    try {
      const p = await getPositionText();
      if (navigator.share) await navigator.share({ title: 'Min position', text: p.text, url: p.url });
      else location.href = `sms:?body=${encodeURIComponent(p.text)}`;
    } catch {
      alert('Kunne ikke hente position.');
    }
  });

  document.getElementById('sendOkayBtn')?.addEventListener('click', () => {
    location.href = 'sms:?body=' + encodeURIComponent('Jeg er okay.');
  });

  document.getElementById('addEmergencyContactBtn')?.addEventListener('click', () => {
    const contacts = getContacts();
    if (contacts.length >= 3) {
      alert('Du kan højst gemme 3 nødkontakter.');
      return;
    }
    const name = prompt('Navn på nødkontakt:');
    if (!name) return;
    const phone = prompt('Telefonnummer:');
    if (!phone) return;
    contacts.push({ name, phone });
    saveContacts(contacts);
    renderContacts();
  });

  renderContacts();
})();
