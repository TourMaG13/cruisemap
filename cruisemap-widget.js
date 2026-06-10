(function () {
  function init() {
    var containers = document.querySelectorAll('.cruisemap-widget');
    if (!containers.length) {
      var single = document.getElementById('cruisemap-widget');
      if (single) containers = [single];
      else return;
    }

    containers.forEach(function (container) {
      if (container.dataset.loaded) return;
      container.dataset.loaded = '1';

      var embedHeight = container.getAttribute('data-embed-height') || container.getAttribute('data-height') || '450px';
      var src = 'https://tourmag13.github.io/cruisemap/';

      container.style.width = '100%';
      container.style.height = embedHeight;
      container.style.transition = 'all 0.3s ease';
      container.style.overflow = 'hidden';
      container.style.borderRadius = '12px';
      container.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';

      var iframe = document.createElement('iframe');
      iframe.src = src;
      iframe.style.cssText = 'width:100%;height:100%;border:none;display:block';
      iframe.setAttribute('allowfullscreen', 'true');
      iframe.setAttribute('loading', 'lazy');
      iframe.title = 'CruiseMAP — Carte interactive des croisières';
      container.innerHTML = '';
      container.appendChild(iframe);

      window.addEventListener('message', function (e) {
        if (!e.data || !e.data.type) return;
        if (e.source !== iframe.contentWindow) return;

        if (e.data.type === 'cruise-map-open') {
          container.style.position = 'fixed';
          container.style.inset = '0';
          container.style.width = '100vw';
          container.style.height = '100vh';
          container.style.zIndex = '99999';
          container.style.borderRadius = '0';
          container.style.boxShadow = 'none';
          document.body.style.overflow = 'hidden';
        }

        if (e.data.type === 'cruise-map-close') {
          container.style.position = '';
          container.style.inset = '';
          container.style.width = '100%';
          container.style.height = embedHeight;
          container.style.zIndex = '';
          container.style.borderRadius = '12px';
          container.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';
          document.body.style.overflow = '';
        }
      });
    });
  }

  // S'exécuter quand le DOM est prêt, ou immédiatement si déjà prêt
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
  // Aussi tenter après un court délai (CMS qui injectent le HTML après le script)
  setTimeout(init, 500);
  setTimeout(init, 2000);
})();
