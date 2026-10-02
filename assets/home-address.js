window.OverblikDKHomeAddress = (function () {
  const LOCAL_KEY = 'overblikdk_home_address';
  const SESSION_KEY = 'overblikdk_home_address_session';

  function safeParse(raw) {
    try { return raw ? JSON.parse(raw) : null; } catch { return null; }
  }

  function read() {
    const session = safeParse(sessionStorage.getItem(SESSION_KEY));
    if (session?.id && session?.tekst) return { ...session, persistent: false };
    const local = safeParse(localStorage.getItem(LOCAL_KEY));
    if (local?.id && local?.tekst) return { ...local, persistent: true };
    return null;
  }

  function clear() {
    sessionStorage.removeItem(SESSION_KEY);
    localStorage.removeItem(LOCAL_KEY);
  }

  function write(value, persistent) {
    const target = persistent ? localStorage : sessionStorage;
    const other = persistent ? sessionStorage : localStorage;
    target.setItem(persistent ? LOCAL_KEY : SESSION_KEY, JSON.stringify(value));
    other.removeItem(persistent ? SESSION_KEY : LOCAL_KEY);
  }

  async function fromSuggestion(item, persistent) {
    if (!item?.data?.id) throw new Error('Vælg en adresse fra forslagene.');
    const detail = await window.OverblikDKAddressProvider.getAddress(item.data.id);
    const coords = window.OverblikDKAddressProvider.addressCoordinates(detail);
    if (!coords) throw new Error('Adressen havde ingen brugbare koordinater.');
    const admin = await window.OverblikDKAddressProvider.reverseAdministrativeContext(
      coords.latitude,
      coords.longitude
    );
    const value = {
      id: item.data.id,
      tekst: item.tekst || item.forslagstekst || '',
      kommune: admin?.kommune?.navn || '',
      region: admin?.region?.navn || '',
      updated: new Date().toISOString()
    };
    write(value, Boolean(persistent));
    return { ...value, persistent: Boolean(persistent) };
  }

  function mount({ inputId, suggestionsId, statusId, rememberId, deleteId }) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    const status = document.getElementById(statusId);
    const remember = document.getElementById(rememberId);
    const del = document.getElementById(deleteId);
    if (!input || !suggestions || !status || !remember || !del) return;

    let timer = null;

    function clearSuggestions() {
      suggestions.innerHTML = '';
      suggestions.hidden = true;
    }

    function showStored() {
      const stored = read();
      if (!stored) {
        input.value = '';
        remember.checked = false;
        status.textContent = 'Ingen hjemmeadresse gemt.';
        return;
      }
      input.value = stored.tekst;
      remember.checked = Boolean(stored.persistent);
      status.textContent = `Min adresse: ${stored.tekst}${stored.kommune ? ' · ' + stored.kommune : ''}${stored.region ? ' · ' + stored.region : ''}`;
    }

    async function choose(item) {
      input.value = item.tekst || item.forslagstekst || '';
      clearSuggestions();
      try {
        status.textContent = 'Validerer adressen…';
        const value = await fromSuggestion(item, remember.checked);
        status.textContent = `Min adresse: ${value.tekst}${value.kommune ? ' · ' + value.kommune : ''}${value.region ? ' · ' + value.region : ''}`;
      } catch (error) {
        status.textContent = String(error?.message || 'Kunne ikke gemme adressen.');
      }
    }

    async function suggest() {
      const q = input.value.trim();
      if (q.length < 3) {
        clearSuggestions();
        return;
      }
      try {
        const items = await window.OverblikDKAddressProvider.autocompleteAddress(q);
        suggestions.innerHTML = '';
        for (const item of items) {
          const li = document.createElement('li');
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.textContent = item.forslagstekst || item.tekst || '';
          btn.addEventListener('click', () => choose(item));
          li.appendChild(btn);
          suggestions.appendChild(li);
        }
        suggestions.hidden = !items.length;
      } catch {
        clearSuggestions();
        status.textContent = 'Adresseforslag kunne ikke hentes.';
      }
    }

    input.addEventListener('input', () => {
      clearTimeout(timer);
      timer = setTimeout(suggest, 220);
    });

    remember.addEventListener('change', () => {
      const stored = read();
      if (!stored) return;
      const value = {
        id: stored.id,
        tekst: stored.tekst,
        kommune: stored.kommune || '',
        region: stored.region || '',
        updated: new Date().toISOString()
      };
      write(value, remember.checked);
      showStored();
    });

    del.addEventListener('click', () => {
      clear();
      clearSuggestions();
      showStored();
    });

    showStored();
  }

  return { read, clear, write, fromSuggestion, mount };
})();