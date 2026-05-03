(function () {
  const KEY = 'overblikdk_favorites';
  const list = document.getElementById('favoritesList');
  const addBtn = document.getElementById('addFavoriteBtn');
  if (!list || !addBtn) return;

  function getFavs() {
    try { return JSON.parse(localStorage.getItem(KEY)) || []; } catch { return []; }
  }
  function saveFavs(favs) {
    localStorage.setItem(KEY, JSON.stringify(favs.slice(0, 20)));
  }
  function render() {
    const favs = getFavs();
    if (!favs.length) {
      list.textContent = 'Ingen favoritter endnu.';
      return;
    }
    list.innerHTML = '<ul class="link-list">' + favs.map((f, i) =>
      `<li><a href="${f.url}" target="_blank" rel="noopener"><span>${f.name}</span><button data-del="${i}" class="emergency-call" type="button">Fjern</button></a></li>`
    ).join('') + '</ul>';
    list.querySelectorAll('[data-del]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const favs = getFavs();
        favs.splice(Number(btn.dataset.del), 1);
        saveFavs(favs);
        render();
      });
    });
  }

  addBtn.addEventListener('click', () => {
    const name = prompt('Navn på favorit:');
    if (!name) return;
    const url = prompt('Link/URL:');
    if (!url) return;
    const favs = getFavs();
    favs.push({ name, url });
    saveFavs(favs);
    render();
  });

  render();
})();
