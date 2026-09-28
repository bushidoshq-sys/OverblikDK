(function () {
  const ADDRESS_KEY = 'overblikdk_home_address';
  const REMEMBER_KEY = 'overblikdk_remember_address';

  const input = document.getElementById('homeAddressInput');
  const suggestions = document.getElementById('homeAddressSuggestions');
  const remember = document.getElementById('rememberHomeAddress');
  const status = document.getElementById('homeAddressStatus');
  const clearBtn = document.getElementById('clearHomeAddressBtn');

  if (!input || !suggestions || !remember || !status) return;

  let timer = null;
  let selected = null;

  function readAddress() {
    try {
      const local = localStorage.getItem(ADDRESS_KEY);
      if (local) return { value: JSON.parse(local), persistent: true };
      const session = sessionStorage.getItem(ADDRESS_KEY);
      if (session) return { value: JSON.parse(session), persistent: false };
    } catch {}
    return { value: null, persistent: false };
  }

  function writeAddress(value, persistent) {
    localStorage.removeItem(ADDRESS_KEY);
    sessionStorage.removeItem(ADDRESS_KEY);
    if (!value) return;
    const target = persistent ? localStorage : sessionStorage;
    target.setItem(ADDRESS_KEY, JSON.stringify(value));
    localStorage.setItem(REMEMBER_KEY, persistent ? 'true' : 'false');
  }

  function setStatus(value, persistent) {
    if (!value) {
      status.textContent = 'Ingen hjemmeadresse gemt.';
      return;
    }
    const where = persistent ? 'Huskes på denne enhed' : 'Slettes, når app-sessionen lukkes';
    const area = [value.kommune, value.region].filter(Boolean).join(' · ');
    status.textContent = `${value.tekst}${area ? ' · ' + area : ''} · ${where}.`;
  }

  function clearSuggestions() {
    suggestions.innerHTML = '';
    suggestions.hidden = true;
  }

  async function chooseSuggestion(item) {
    input.value = item.tekst || item.forslagstekst || '';
    clearSuggestions();

    if (item.type !== 'adresse' || !item?.data?.id) {
      input.focus();
      fetchSuggestions();
      return;
    }

    try {
      status.textContent = 'Henter adressen…';
      const detail = await window.OverblikDKAddressProvider.getAddress(item.data.id);
      const ctx = window.OverblikDKAddressProvider.addressContext(detail);
      selected = {
        id: item.data.id,
        tekst: item.tekst || item.forslagstekst || '',
        kommune: ctx.kommune || '',
        region: ctx.region || ''
      };
      writeAddress(selected, remember.checked);
      setStatus(selected, remember.checked);
    } catch {
      selected = null;
      status.textContent = 'Kunne ikke hente den valgte adresse.';
    }
  }

  async function fetchSuggestions() {
    const q = input.value.trim();
    selected = null;
    if (q.length < 3) {
      clearSuggestions();
      return;
    }
    try {
      const items = await window.OverblikDKAddressProvider.autocompleteAddress(q);
      suggestions.innerHTML = '';
      if (!items.length) {
        clearSuggestions();
        return;
      }
      items.forEach(item => {
        const li = document.createElement('li');
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.textContent = item.forslagstekst || item.tekst;
        btn.addEventListener('click', () => chooseSuggestion(item));
        li.appendChild(btn);
        suggestions.appendChild(li);
      });
      suggestions.hidden = false;
    } catch {
      clearSuggestions();
      status.textContent = 'Adresseforslag kunne ikke hentes.';
    }
  }

  input.addEventListener('input', () => {
    clearTimeout(timer);
    timer = setTimeout(fetchSuggestions, 220);
  });

  input.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') clearSuggestions();
  });

  remember.addEventListener('change', () => {
    localStorage.setItem(REMEMBER_KEY, remember.checked ? 'true' : 'false');
    const current = selected || readAddress().value;
    if (current) {
      writeAddress(current, remember.checked);
      setStatus(current, remember.checked);
    }
  });

  clearBtn?.addEventListener('click', () => {
    selected = null;
    localStorage.removeItem(ADDRESS_KEY);
    sessionStorage.removeItem(ADDRESS_KEY);
    input.value = '';
    clearSuggestions();
    setStatus(null, false);
  });

  const stored = readAddress();
  remember.checked = stored.value
    ? stored.persistent
    : localStorage.getItem(REMEMBER_KEY) === 'true';

  if (stored.value) {
    selected = stored.value;
    input.value = stored.value.tekst || '';
  }
  setStatus(stored.value, stored.persistent);
})();
