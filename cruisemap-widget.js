(function () {
  var containers = document.querySelectorAll('.cruisemap-widget');
  if (!containers.length) {
    // Fallback sur l'id
    var single = document.getElementById('cruisemap-widget');
    if (single) containers = [single];
    else { console.error('CruiseMAP : aucun élément .cruisemap-widget ou #cruisemap-widget trouvé.'); return; }
  }

  containers.forEach(function (container) {
    var embedHeight = container.getAttribute('data-embed-height') || container.getAttribute('data-height') || '450px';
    var src = 'https://tourmag13.github.io/cruisemap/';

    // Style conteneur initial (mode embed compact)
    container.style.width = '100%';
    container.style.height = embedHeight;
    container.style.transition = 'all 0.3s ease';
    container.style.overflow = 'hidden';
    container.style.borderRadius = '12px';
    container.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';

    // Création de l'iframe
    var iframe = document.createElement('iframe');
    iframe.src = src;
    iframe.style.cssText = 'width:100%;height:100%;border:none;display:block';
    iframe.setAttribute('allowfullscreen', 'true');
    iframe.setAttribute('loading', 'lazy');
    iframe.title = 'CruiseMAP — Carte interactive des croisières';
    container.innerHTML = '';
    container.appendChild(iframe);

    // Écouter les messages de la carte pour passer en plein écran
    window.addEventListener('message', function (e) {
      if (!e.data || !e.data.type) return;
      if (e.source !== iframe.contentWindow) return;

      if (e.data.type === 'cruise-map-open') {
        // Plein écran
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
        // Retour à l'embed compact
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
})();
