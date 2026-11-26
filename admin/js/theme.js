// Editor admin page: light or dark, chosen with the toggle in the top bar (light by default). Loaded in <head> as a
// classic script so the page never flashes in the wrong colours.
(function () {
  var t = null;
  try { t = localStorage.getItem('hv-theme'); } catch (e) { /* storage blocked: light */ }
  document.documentElement.setAttribute('data-theme', t === 'dark' ? 'dark' : 'light');
})();
