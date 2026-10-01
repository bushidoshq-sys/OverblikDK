window.OverblikDKAddressProvider = (function () {
  const PROVIDER = 'Adressevælger + Datafordeler DAGI v2';
  const ADDRESS_TOKEN = 'adressevaelger123';
  const WORKER_BASE = 'https://overblikdk-api.bushidoshq.workers.dev';

  function utm32ToWgs84(x, y) {
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const k0 = 0.9996;
    const e2 = f * (2 - f);
    const ep2 = e2 / (1 - e2);
    const e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    const M = Number(y) / k0;
    const mu = M / (a * (1 - e2 / 4 - 3 * e2 ** 2 / 64 - 5 * e2 ** 3 / 256));
    const phi1 =
      mu +
      (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) +
      (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) +
      (151 * e1 ** 3 / 96) * Math.sin(6 * mu) +
      (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);

    const sin1 = Math.sin(phi1);
    const cos1 = Math.cos(phi1);
    const tan1 = Math.tan(phi1);
    const N1 = a / Math.sqrt(1 - e2 * sin1 ** 2);
    const R1 = a * (1 - e2) / Math.pow(1 - e2 * sin1 ** 2, 1.5);
    const T1 = tan1 ** 2;
    const C1 = ep2 * cos1 ** 2;
    const D = (Number(x) - 500000) / (N1 * k0);

    const lat = phi1 - (N1 * tan1 / R1) * (
      D ** 2 / 2 -
      (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * ep2) * D ** 4 / 24 +
      (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * ep2 - 3 * C1 ** 2) * D ** 6 / 720
    );

    const lon = (9 * Math.PI / 180) + (
      D -
      (1 + 2 * T1 + C1) * D ** 3 / 6 +
      (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * ep2 + 24 * T1 ** 2) * D ** 5 / 120
    ) / cos1;

    return { latitude: lat * 180 / Math.PI, longitude: lon * 180 / Math.PI };
  }

  async function autocompleteAddress(query) {
    const q = String(query || '').trim();
    if (q.length < 3) return [];
    const url = new URL('https://adressevaelger.dk/husnumre/soeg');
    url.searchParams.set('tekst', q);
    url.searchParams.set('token', ADDRESS_TOKEN);
    url.searchParams.set('max', '8');
    const res = await fetch(url);
    if (!res.ok) throw new Error('Adresseforslag kunne ikke hentes.');
    const data = await res.json();
    const items = Array.isArray(data?.fund) ? data.fund : [];
    return items
      .filter(item => item?.type === 'husnummer' && item?.id)
      .slice(0, 8)
      .map(item => ({
        tekst: item.titel || '',
        forslagstekst: item.titel || '',
        data: { id: item.id },
        providerData: item
      }));
  }

  async function getAddress(id) {
    if (!id) throw new Error('Adresse-id mangler.');
    const url = new URL(`https://adressevaelger.dk/husnumre/${encodeURIComponent(id)}`);
    url.searchParams.set('token', ADDRESS_TOKEN);
    const res = await fetch(url);
    if (!res.ok) throw new Error('Adressen kunne ikke hentes.');
    const data = await res.json();
    if (!data?.husnummer) throw new Error('Adressen kunne ikke findes.');
    return data.husnummer;
  }

  function addressContext() {
    return { kommune: '', region: '' };
  }

  function addressCoordinates(address) {
    const x = Number(address?.adgangspunkt?.koordinater?.x ?? address?.adgangspunkt?.geometri?.coordinates?.[0]);
    const y = Number(address?.adgangspunkt?.koordinater?.y ?? address?.adgangspunkt?.geometri?.coordinates?.[1]);
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    return utm32ToWgs84(x, y);
  }

  async function reverseAdministrativeContext(lat, lon) {
    const url = new URL('/administrative-context', WORKER_BASE);
    url.searchParams.set('lat', String(lat));
    url.searchParams.set('lon', String(lon));
    const res = await fetch(url);
    if (!res.ok) throw new Error('Administrativt lokationsopslag fejlede.');
    const data = await res.json();
    if (!data?.kommune?.navn || !data?.region?.navn) {
      throw new Error('Kommune eller region manglede i lokationsopslaget.');
    }
    return { kommune: data.kommune, region: data.region, provider: PROVIDER };
  }

  return {
    provider: PROVIDER,
    reverseAdministrativeContext,
    autocompleteAddress,
    getAddress,
    addressContext,
    addressCoordinates
  };
})();
