(function() {
  var container = document.getElementById('cruisemap-widget');
  if (!container) {
    console.error('CruiseMAP : élément #cruisemap-widget introuvable.');
    return;
  }

  // Configuration (modifiable via data-attributes)
  var height = container.getAttribute('data-height') || container.getAttribute('data-embed-height') || '85vh';
  var width = container.getAttribute('data-width') || '100%';
  var maxWidth = container.getAttribute('data-max-width') || '1400px';
  var borderRadius = container.getAttribute('data-radius') || '12px';

  // Styles du conteneur
  container.style.width = width;
  container.style.maxWidth = maxWidth;
  container.style.height = height;
  container.style.margin = '20px auto';
  container.style.position = 'relative';
  container.style.overflow = 'hidden';
  container.style.borderRadius = borderRadius;
  container.style.boxShadow = '0 4px 20px rgba(0,0,0,0.12)';

  // Création de l'iframe
  var iframe = document.createElement('iframe');
  iframe.src = 'https://tourmag13.github.io/cruisemap/';
  iframe.style.width = '100%';
  iframe.style.height = '100%';
  iframe.style.border = 'none';
  iframe.style.display = 'block';
  iframe.setAttribute('allowfullscreen', 'true');
  iframe.setAttribute('loading', 'lazy');
  iframe.title = 'CruiseMAP — Carte interactive des croisières';

  // Responsive : ajuster la hauteur sur mobile
  if (window.innerWidth <= 768) {
    container.style.height = '100vh';
    container.style.borderRadius = '0';
    container.style.margin = '0';
    container.style.maxWidth = '100%';
  }

  container.appendChild(iframe);
})();
