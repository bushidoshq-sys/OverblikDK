window.OverblikDKLocalHelper = (function () {
  const SORT_KEY = 'overblikdk_regional_sort';
  const CONTEXT_KEY = 'overblikdk_local_context';

  function normalize(value) {
    return String(value || '').trim().toLocaleLowerCase('da-DK');
  }

  function enabled() {
    return localStorage.getItem(SORT_KEY) === 'true';
  }

  function context() {
    try { return JSON.parse(localStorage.getItem(CONTEXT_KEY)) || {}; }
    catch { return {}; }
  }

  function asArray(value) {
    if (!value) return [];
    return Array.isArray(value) ? value : [value];
  }

  function municipalityMatches(item, ctx) {
    const own = normalize(ctx.kommune);
    return !!own && asArray(item.kommune).some(x => normalize(x) === own);
  }

  function regionMatches(item, ctx) {
    const own = normalize(ctx.region);
    return !!own && asArray(item.region).some(x => normalize(x) === own);
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
    if (!enabled()) return groups.slice();
    const ctx = context();
    const ownRegion = normalize(ctx.region);
    return groups.map((group, index) => ({group, index}))
      .sort((a, b) => {
        const ar = normalize(a.group.region);
        const br = normalize(b.group.region);
        const score = r => r === ownRegion ? 0 : (r === 'officielle oversigter' ? 1 : 2);
        const d = score(ar) - score(br);
        if (d) return d;
        return a.index - b.index;
      }).map(x => x.group);
  }

  return { enabled, context, rank, sortLinks, sortRegionGroups };
})();
