(function () {
  const KEY = 'overblikdk-theme';
  const btn = document.getElementById('themeToggle');
  if (!btn) return;

  function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(KEY, theme);
    const dark = theme === 'dark';
    btn.setAttribute('aria-pressed', String(dark));
    const icon = btn.querySelector('.theme-toggle__icon');
    const text = btn.querySelector('.theme-toggle__text');
    if (icon) icon.textContent = dark ? '☀️' : '🌙';
    if (text) text.textContent = dark ? 'Lys' : 'Mørk';
  }

  const current = document.documentElement.getAttribute('data-theme') || 'light';
  setTheme(current);

  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    setTheme(next);
  });
})();
