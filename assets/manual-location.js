window.OverblikDKManualLocation = (function () {
  const KEY = 'overblikdk_manual_current_location';

  function read() {
    try { return JSON.parse(sessionStorage.getItem(KEY)); } catch { return null; }
  }

  function clear() {
    sessionStorage.removeItem(KEY);
  }

  function write(value) {
    sessionStorage.setItem(KEY, JSON.stringify(value));
  }

  async function fromSuggestion(item) {
    if (!item?.data?.id) throw new Error('Vælg en adresse fra forslagene.');
    const detail = await window.OverblikDKAddressProvider.getAddress(item.data.id);
    const area = window.OverblikDKAddressProvider.addressContext(detail);
    const coords = window.OverblikDKAddressProvider.addressCoordinates(detail);
    if (!coords) throw new Error('Adressen havde ingen brugbare koordinater.');

    const value = {
      id: item.data.id,
      tekst: item.tekst || item.forslagstekst || '',
      kommune: area.kommune || '',
      region: area.region || '',
      latitude: coords.latitude,
      longitude: coords.longitude,
      source: 'manual-nearby-address',
      updated: new Date().toISOString()
    };
    write(value);

    // Use the address as current local context for regional sorting too.
    localStorage.setItem('overblikdk_local_context', JSON.stringify({
      kommune: value.kommune,
      region: value.region,
      accuracy: null,
      source: value.source,
      updated: value.updated
    }));

    return value;
  }

  function mount({ inputId, suggestionsId, statusId, containerId, onSelected }) {
    const input = document.getElementById(inputId);
    const suggestions = document.getElementById(suggestionsId);
    const status = document.getElementById(statusId);
    const container = document.getElementById(containerId);
    if (!input || !suggestions || !status || !container) return;

    let timer = null;

    function clearSuggestions() {
      suggestions.innerHTML = '';
      suggestions.hidden = true;
    }

    async function choose(item) {
      input.value = item.tekst || item.forslagstekst || '';
      clearSuggestions();
      try {
        status.textContent = 'Henter adressens position…';
        const value = await fromSuggestion(item);
        status.textContent = `Bruger nu: ${value.tekst}${value.kommune ? ' · ' + value.kommune : ''}`;
        container.hidden = false;
        await onSelected?.(value);
      } catch (error) {
        status.textContent = String(error?.message || 'Kunne ikke bruge adressen.');
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

    const stored = read();
    if (stored?.tekst) {
      input.value = stored.tekst;
      status.textContent = `Bruger nu: ${stored.tekst}`;
    }
  }

  function asPosition() {
    const value = read();
    if (!value || !Number.isFinite(Number(value.latitude)) || !Number.isFinite(Number(value.longitude))) return null;
    return {
      coords: {
        latitude: Number(value.latitude),
        longitude: Number(value.longitude),
        accuracy: null
      },
      manual: true,
      address: value
    };
  }

  return { read, clear, write, fromSuggestion, mount, asPosition };
})();
