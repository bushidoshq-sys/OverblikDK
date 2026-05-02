(function () {
  window.OverblikDKLocation = window.OverblikDKLocation || {
    openLocationHelp() {
      alert(
        'For at forbedre lokation:\n\n' +
        '1. Tillad lokation i browseren/appens indstillinger.\n' +
        '2. Gå gerne tættere på et vindue eller udendørs.\n' +
        '3. Tryk igen efter et øjeblik, så telefonen kan nå en bedre GPS-fix.\n\n' +
        'OverblikDK gemmer ikke dine GPS-koordinater.'
      );
    }
  };
})();
