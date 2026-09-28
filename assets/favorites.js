(function () {
  if (window.__OverblikDKFavoritesLoaded) return;
  window.__OverblikDKFavoritesLoaded = true;

  const KEY = 'overblikdk_favorites';
  const MAX = 20;
  const list = document.getElementById('favoritesList');

  function getFavs() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY));
      return Array.isArray(value) ? value : [];
    } catch {
      return [];
    }
  }

  function saveFavs(favs) {
    localStorage.setItem(KEY, JSON.stringify(favs.slice(0, MAX)));
  }

  function normalizeUrl(url) {
    try {
      const u = new URL(url, location.href);
      u.hash = '';
      return u.href;
    } catch {
      return url;
    }
  }

  function favoriteIndex(url, favs = getFavs()) {
    const normalized = normalizeUrl(url);
    return favs.findIndex(f => normalizeUrl(f.url) === normalized);
  }

  function cleanName(anchor) {
    const primary = anchor.querySelector('span:not(.host), h3');
    return (primary?.textContent || anchor.textContent || anchor.href).trim();
  }

  function toggleFavorite(anchor, button) {
    const url = normalizeUrl(anchor.href);
    const name = cleanName(anchor);
    const favs = getFavs();
    const index = favoriteIndex(url, favs);

    if (index >= 0) {
      favs.splice(index, 1);
    } else {
      if (favs.length >= MAX) {
        alert(`Du kan højst gemme ${MAX} favoritter.`);
        return;
      }
      favs.push({ name, url });
    }

    saveFavs(favs);
    updateButtons();
    renderHomeFavorites();
  }

  function makeButton(anchor) {
    if (anchor.dataset.favoriteWrapped === 'true') return;
    anchor.dataset.favoriteWrapped = 'true';

    const li = anchor.closest('li');
    if (!li || li.closest('#favoritesList')) return;

    li.classList.add('bookmarkable-link');

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'favorite-toggle';
    btn.dataset.favoriteUrl = normalizeUrl(anchor.href);
    btn.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      toggleFavorite(anchor, btn);
    });

    li.appendChild(btn);
  }

  function decorateLinks(root = document) {
    const selectors = [
      '.link-list li > a[href]',
      '.nearby-results li > a[href]'
    ];
    const anchors = [];
    if (root.matches?.(selectors.join(','))) anchors.push(root);
    root.querySelectorAll?.(selectors.join(',')).forEach(anchor => anchors.push(anchor));

    anchors.forEach(anchor => {
      if (!/^https?:/i.test(anchor.href)) return;
      makeButton(anchor);
    });
    updateButtons();
  }

  function updateButtons() {
    const favs = getFavs();
    document.querySelectorAll('.favorite-toggle').forEach(btn => {
      const active = favoriteIndex(btn.dataset.favoriteUrl, favs) >= 0;
      const symbol = active ? '★' : '☆';
      const pressed = String(active);
      const label = active ? 'Fjern fra Favoritter' : 'Gem i Favoritter';

      if (btn.textContent !== symbol) btn.textContent = symbol;
      if (btn.classList.contains('is-active') !== active) btn.classList.toggle('is-active', active);
      if (btn.getAttribute('aria-pressed') !== pressed) btn.setAttribute('aria-pressed', pressed);
      if (btn.getAttribute('aria-label') !== label) btn.setAttribute('aria-label', label);
      if (btn.title !== label) btn.title = label;
    });
  }

  function renderHomeFavorites() {
    if (!list) return;
    const favs = getFavs();
    if (!favs.length) {
      list.textContent = 'Ingen gemte links endnu. Tryk ☆ ved et link for at fastgøre det her.';
      return;
    }

    list.innerHTML = '<ul class="link-list">' + favs.map((f, i) =>
      `<li class="favorite-home-item">
        <a href="${f.url}" target="_blank" rel="noopener"><span>${f.name}</span></a>
        <button data-del="${i}" class="favorite-toggle is-active" type="button" aria-label="Fjern fra Favoritter" aria-pressed="true" title="Fjern fra Favoritter">★</button>
      </li>`
    ).join('') + '</ul>';

    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        const favs = getFavs();
        favs.splice(Number(btn.dataset.del), 1);
        saveFavs(favs);
        renderHomeFavorites();
        updateButtons();
      });
    });
  }

  renderHomeFavorites();
  decorateLinks();

  const observer = new MutationObserver((mutations) => {
    observer.disconnect();
    try {
      mutations.forEach(mutation => {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE) decorateLinks(node);
        });
      });
    } finally {
      observer.observe(document.body, { childList: true, subtree: true });
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });
})();
