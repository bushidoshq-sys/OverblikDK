(() => {
  const KEY = "overblikdk_favorites";
  const addBtn = document.getElementById("addFavoriteBtn");
  const list = document.getElementById("favoritesList");
  if (!addBtn || !list) return;

  const defaults = [
    { title: "Borger.dk", url: "https://www.borger.dk" },
    { title: "Sundhed.dk", url: "https://www.sundhed.dk" },
    { title: "Rejseplanen", url: "https://www.rejseplanen.dk" }
  ];

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(KEY) || "null");
      if (Array.isArray(saved)) return saved;
    } catch {}
    return defaults;
  }

  function save(items) {
    localStorage.setItem(KEY, JSON.stringify(items.slice(0, 12)));
  }

  function render() {
    const items = load();
    list.innerHTML = "";
    if (!items.length) {
      list.innerHTML = `<div class="empty-emergency">Ingen favoritter endnu.</div>`;
      return;
    }

    items.forEach((item, index) => {
      const card = document.createElement("article");
      card.className = "favorite-card";
      card.innerHTML = `
        <a href="${item.url}" target="_blank" rel="noopener">${item.title}</a>
        <button type="button" class="mini-action remove" aria-label="Fjern favorit">Fjern</button>
      `;
      card.querySelector("button").addEventListener("click", () => {
        const updated = load().filter((_, i) => i !== index);
        save(updated);
        render();
      });
      list.appendChild(card);
    });
  }

  addBtn.addEventListener("click", () => {
    const title = prompt("Navn på favorit:");
    if (!title || !title.trim()) return;

    const url = prompt("Link / URL:");
    if (!url || !url.trim()) return;

    let clean = url.trim();
    if (!/^https?:\/\//i.test(clean)) clean = "https://" + clean;

    const items = load();
    items.unshift({ title: title.trim(), url: clean });
    save(items);
    render();
  });

  render();
})();