window.OverblikDKAddressProvider = (function () {
  const PROVIDER = 'DAWA';
  const RETIREMENT_DATE = '2026-10-01';

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
    reverseAdministrativeContext
  };
})();
