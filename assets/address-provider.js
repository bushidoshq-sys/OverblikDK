window.OverblikDKAddressProvider = (function () {
  const PROVIDER = 'DAWA';
  const RETIREMENT_DATE = '2026-10-01';

  async function autocompleteAddress(query) {
    const q = String(query || '').trim();
    if (q.length < 3) return [];
    const url = `https://api.dataforsyningen.dk/autocomplete?type=adresse&q=${encodeURIComponent(q)}&fuzzy=`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Adresseforslag kunne ikke hentes.');
    const data = await res.json();
    return Array.isArray(data) ? data.slice(0, 8) : [];
  }

  async function getAddress(id) {
    if (!id) throw new Error('Adresse-id mangler.');
    const res = await fetch(`https://api.dataforsyningen.dk/adresser/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Adressen kunne ikke hentes.');
    return res.json();
  }

  function addressContext(address) {
    const access = address?.adgangsadresse || {};
    const kommune =
      access?.kommune?.navn ||
      address?.kommune?.navn ||
      address?.kommunenavn ||
      access?.kommunenavn ||
      '';
    const region =
      access?.region?.navn ||
      address?.region?.navn ||
      address?.regionsnavn ||
      access?.regionsnavn ||
      '';
    return { kommune, region };
  }

  async function reverseAdministrativeContext(lat, lon) {
    const qs = `x=${encodeURIComponent(lon)}&y=${encodeURIComponent(lat)}`;
    const [kommuneRes, regionRes] = await Promise.all([
      fetch(`https://api.dataforsyningen.dk/kommuner/reverse?${qs}`),
      fetch(`https://api.dataforsyningen.dk/regioner/reverse?${qs}`)
    ]);

    if (!kommuneRes.ok || !regionRes.ok) {
      throw new Error('Administrativt lokationsopslag fejlede.');
    }

    const [kommune, region] = await Promise.all([
      kommuneRes.json(),
      regionRes.json()
    ]);

    return { kommune, region, provider: PROVIDER };
  }

  return {
    provider: PROVIDER,
    retirementDate: RETIREMENT_DATE,
    reverseAdministrativeContext,
    autocompleteAddress,
    getAddress,
    addressContext
  };
})();
