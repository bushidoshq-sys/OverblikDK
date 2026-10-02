window.OverblikDKLocalHelper = (function () {
  const SORT_KEY = 'overblikdk_regional_sort';
  const CONTEXT_KEY = 'overblikdk_local_context';

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase('da-DK');
  }

  function normalizeMunicipality(value) {
    return normalize(value)
      .replace(/\s+regionskommune$/, '')
      .replace(/\s+kommune$/, '');
  }

  function normalizeRegion(value) {
    return normalize(value).replace(/^region\s+/, '');
  }

  function enabled() {
    return localStorage.getItem(SORT_KEY) === 'true';
  }

  function context() {
    try {
      const session = sessionStorage.getItem(CONTEXT_KEY);
      if (session) return JSON.parse(session) || {};
      return JSON.parse(localStorage.getItem(CONTEXT_KEY)) || {};
    } catch { return {}; }
  }

  function canonicalRegionFromContext(ctx) {
    const municipality = normalizeMunicipality(ctx?.kommune);
    const map = window.OverblikDKLocalData?.municipalityToRegion || {};

    if (municipality) {
      for (const [name, region] of Object.entries(map)) {
        if (normalizeMunicipality(name) === municipality) return region;
      }
    }
    return ctx?.region || '';
  }

  function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function municipalityMatches(item, ctx) {
    const own = normalizeMunicipality(ctx?.kommune);
    return !!own && asArray(item.kommune).some(x => normalizeMunicipality(x) === own);
  }

  function regionMatches(item, ctx) {
    const own = normalizeRegion(canonicalRegionFromContext(ctx));
    return !!own && asArray(item.region).some(x => normalizeRegion(x) === own);
  }

  function rank(item, ctx = context()) {
    if (!enabled()) return 0;
    if (municipalityMatches(item, ctx)) return 0;
    if (regionMatches(item, ctx)) return 1;
    if (item.national || (!item.kommune && !item.region)) return 2;
    return 3;
  }

  function sortLinks(items) {
    const ctx = context();
    return items.map((item, index) => ({item, index}))
      .sort((a, b) => {
        const ra = rank(a.item, ctx);
        const rb = rank(b.item, ctx);
        if (ra !== rb) return ra - rb;
        const byName = String(a.item.name || '').localeCompare(String(b.item.name || ''), 'da', {sensitivity:'base'});
        return byName || a.index - b.index;
      })
      .map(x => x.item);
  }

  function sortRegionGroups(groups) {
    // Regional sortering må kun ændre rækkefølgen af links inde i en
    // eksisterende gruppe. Selve gruppe-/regionshierarkiet skal være stabilt.
    return groups.slice();
  }

  return {
    enabled,
    context,
    rank,
    sortLinks,
    sortRegionGroups,
    normalizeMunicipality,
    normalizeRegion,
    canonicalRegionFromContext
  };
})();
