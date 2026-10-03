(function () {
  const posBox = document.getElementById('positionBox');
  const contactsBox = document.getElementById('emergencyContacts');
  const KEY = 'overblikdk_emergency_contacts';
  let sosRunning = false;
  let sosTrack = null;
  let sosStream = null;
  let sosWakeLock = null;
  let sosRunToken = 0;
  let sosMode = null;
  let sosOverlay = null;
  let sosVideo = null;
  let sosPreviousTheme = null;
  let nativeTorch = null;
  let nativeHaptics = null;
  let nativeVibration = null;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  function syncThemeButton(theme) {
    const btn = document.getElementById('themeToggle');
    if (!btn) return;
    const dark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    const icon = btn.querySelector('.theme-toggle__icon');
    const text = btn.querySelector('.theme-toggle__text');
    if (icon) icon.textContent = dark ? '☀️' : '🌙';
    if (text) text.textContent = dark ? 'Lys' : 'Mørk';
  }

  function enterSOSTheme() {
    if (sosPreviousTheme !== null) return;
    sosPreviousTheme = document.documentElement.getAttribute('data-theme') || 'light';
    document.documentElement.setAttribute('data-theme', 'dark');
    syncThemeButton('dark');
  }

  function restoreSOSTheme() {
    if (sosPreviousTheme === null) return;
    const theme = sosPreviousTheme;
    sosPreviousTheme = null;
    document.documentElement.setAttribute('data-theme', theme);
    syncThemeButton(theme);
  }

  function getNativeTorch() {
    const cap = window.Capacitor;
    if (!cap?.isNativePlatform?.()) return null;
    // Prefer an already registered native plugin, then fall back to Capacitor's
    // proxy registration. This covers both bundled and runtime-resolved bridges.
    if (!nativeTorch) {
      nativeTorch = cap.Plugins?.Torch || (cap.registerPlugin ? cap.registerPlugin('Torch') : null);
    }
    return nativeTorch;
  }

  async function setTorch(on) {
    if (nativeTorch) {
      if (on) await nativeTorch.enable();
      else await nativeTorch.disable();
      return;
    }
    if (!sosTrack) throw new Error('Ingen kameratrack.');
    await sosTrack.applyConstraints({ advanced: [{ torch: !!on }] });
  }

  function ensureSOSOverlay() {
    if (sosOverlay) return sosOverlay;
    const overlay = document.createElement('div');
    overlay.id = 'sosScreenOverlay';
    overlay.setAttribute('aria-hidden', 'true');
    Object.assign(overlay.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483647',
      background: '#000',
      opacity: '0',
      pointerEvents: 'none',
      transition: 'none',
      display: 'grid',
      placeItems: 'center'
    });
    const stop = document.createElement('button');
    stop.type = 'button';
    stop.textContent = 'STOP';
    stop.setAttribute('aria-label', 'Stop S.O.S.-blink');
    Object.assign(stop.style, {
      border: '3px solid currentColor',
      borderRadius: '999px',
      padding: '1rem 1.6rem',
      font: '700 1.2rem system-ui, sans-serif',
      background: '#fff',
      color: '#000',
      pointerEvents: 'auto',
      minWidth: '8rem'
    });
    stop.addEventListener('click', () => stopSOS());
    overlay.appendChild(stop);
    document.body.appendChild(overlay);
    sosOverlay = overlay;
    return overlay;
  }

  function setScreenFlash(on) {
    const overlay = ensureSOSOverlay();
    const stop = overlay.querySelector('button');
    overlay.style.opacity = '1';
    overlay.style.pointerEvents = 'auto';
    overlay.style.background = on ? '#fff' : '#000';
    if (stop) {
      stop.style.background = on ? '#000' : '#fff';
      stop.style.color = on ? '#fff' : '#000';
    }
  }

  function hideSOSOverlay() {
    if (!sosOverlay) return;
    sosOverlay.style.opacity = '0';
    sosOverlay.style.pointerEvents = 'none';
  }

  async function vibrateFor(ms) {
    try {
      const cap = window.Capacitor;
      if (cap?.isNativePlatform?.()) {
        if (!nativeVibration && cap.registerPlugin) {
          nativeVibration = cap.registerPlugin('OverblikVibration');
        }
        if (nativeVibration?.vibrate) {
          await nativeVibration.vibrate({ duration: ms });
          return;
        }
        if (!nativeHaptics) {
          nativeHaptics = cap.Plugins?.Haptics || (cap.registerPlugin ? cap.registerPlugin('Haptics') : null);
        }
        if (nativeHaptics?.vibrate) {
          await nativeHaptics.vibrate({ duration: ms });
          return;
        }
      }
    } catch {}
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch {}
  }

  async function openRearCamera() {
    const attempts = [
      { video: { facingMode: { exact: 'environment' } }, audio: false },
      { video: { facingMode: { ideal: 'environment' } }, audio: false },
      { video: true, audio: false }
    ];
    let lastError = null;
    for (const constraints of attempts) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia(constraints);
        const track = stream.getVideoTracks()[0];
        if (!track) {
          stream.getTracks().forEach(t => t.stop());
          continue;
        }
        return { stream, track };
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Kunne ikke åbne kamera.');
  }

  async function prepareTorch() {
    const native = getNativeTorch();
    if (native) {
      let available = true;
      try {
        const availability = await native.isAvailable();
        if (typeof availability?.available === 'boolean') available = availability.available;
      } catch {}
      if (!available) throw new Error('Native torch er ikke tilgængelig.');
      nativeTorch = native;
      await setTorch(true);
      await sleep(80);
      await setTorch(false);
      return true;
    }

    const camera = await openRearCamera();
    sosStream = camera.stream;
    sosTrack = camera.track;

    sosVideo = document.createElement('video');
    sosVideo.muted = true;
    sosVideo.playsInline = true;
    sosVideo.autoplay = true;
    sosVideo.style.position = 'fixed';
    sosVideo.style.width = '1px';
    sosVideo.style.height = '1px';
    sosVideo.style.opacity = '0';
    sosVideo.style.pointerEvents = 'none';
    sosVideo.srcObject = sosStream;
    document.body.appendChild(sosVideo);
    try { await sosVideo.play(); } catch {}

    const caps = sosTrack.getCapabilities?.() || {};
    if (caps.torch === false) throw new Error('Torch-capability mangler.');

    // Nogle telefoner rapporterer ikke torch korrekt; prøv derfor faktisk at tænde kort.
    await setTorch(true);
    await sleep(80);
    await setTorch(false);
    return true;
  }

  async function stopSOS() {
    sosRunning = false;
    sosRunToken++;
    try { await setTorch(false); } catch {}
    try { sosTrack?.stop(); } catch {}
    try { sosStream?.getTracks().forEach(track => track.stop()); } catch {}
    sosTrack = null;
    sosStream = null;
    if (sosVideo) {
      try { sosVideo.pause(); } catch {}
      sosVideo.srcObject = null;
      sosVideo.remove();
      sosVideo = null;
    }
    hideSOSOverlay();
    try { if (navigator.vibrate) navigator.vibrate(0); } catch {}
    sosMode = null;
    nativeTorch = null;
    restoreSOSTheme();
    try { await sosWakeLock?.release(); } catch {}
    sosWakeLock = null;
    const btn = document.getElementById('sosTorchBtn');
    if (btn) {
      btn.textContent = '🔦 Start S.O.S.-blink';
      btn.classList.remove('danger');
      btn.setAttribute('aria-pressed', 'false');
    }
    const status = document.getElementById('sosTorchStatus');
    if (status) status.textContent = 'S.O.S.-blink er stoppet.';
  }

  async function startSOS() {
    const btn = document.getElementById('sosTorchBtn');
    const status = document.getElementById('sosTorchStatus');
    if (sosRunning) {
      await stopSOS();
      return;
    }

    enterSOSTheme();

    try {
      if ('wakeLock' in navigator) sosWakeLock = await navigator.wakeLock.request('screen');
    } catch {}

    let torchReady = false;
    if (getNativeTorch() || navigator.mediaDevices?.getUserMedia) {
      try {
        if (status) status.textContent = getNativeTorch() ? 'Forbinder til telefonens lommelygte…' : 'Prøver telefonens kamerablitz…';
        torchReady = await prepareTorch();
      } catch {
        try { sosTrack?.stop(); } catch {}
        try { sosStream?.getTracks().forEach(track => track.stop()); } catch {}
        sosTrack = null;
        sosStream = null;
        if (sosVideo) {
          sosVideo.remove();
          sosVideo = null;
        }
      }
    }

    sosMode = torchReady ? 'torch' : 'screen';
    sosRunning = true;
    const token = ++sosRunToken;

    if (btn) {
      btn.textContent = '⏹ Stop S.O.S.-blink';
      btn.classList.add('danger');
      btn.setAttribute('aria-pressed', 'true');
    }
    if (status) {
      status.textContent = torchReady
        ? 'S.O.S.: lommelygte + skærm + vibration: ··· ——— ···'
        : 'Lommelygten kan ikke styres på denne telefon. Bruger skærmblink + vibration: ··· ——— ···';
    }

    const unit = 180;
    const signal = [
      1,1,1,1,1,3,
      3,1,3,1,3,3,
      1,1,1,1,1,7
    ];

    while (sosRunning && token === sosRunToken) {
      for (let i = 0; i < signal.length && sosRunning && token === sosRunToken; i += 2) {
        const onMs = signal[i] * unit;
        const offMs = signal[i + 1] * unit;

        setScreenFlash(true);
        await vibrateFor(onMs);
        if (!sosRunning || token !== sosRunToken) break;

        if (sosMode === 'torch') {
          try {
            await setTorch(true);
          } catch {
            sosMode = 'screen';
            nativeTorch = null;
            if (status) status.textContent = 'Lommelygten mistede adgang. Skærmblink + vibration fortsætter: ··· ——— ···';
          }
        }

        await sleep(onMs);
        if (!sosRunning || token !== sosRunToken) break;

        setScreenFlash(false);
        if (sosMode === 'torch') {
          try {
            await setTorch(false);
          } catch {
            sosMode = 'screen';
            nativeTorch = null;
          }
        }

        await sleep(offMs);
        if (!sosRunning || token !== sosRunToken) break;
      }
    }
  }

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
    const pos = await window.OverblikDKLocation.getPosition({ fresh: true, timeout: 30000, targetAccuracy: 12 });
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

  document.getElementById('sosTorchBtn')?.addEventListener('click', startSOS);

  window.addEventListener('pagehide', () => {
    if (sosRunning) stopSOS();
  });

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
      // Samme direkte Maps-adfærd som "Find nærmeste": hent position og åbn den med det samme.
      location.href = p.url;
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
