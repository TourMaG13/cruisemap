/**
 * CruiseMAP Encart — Embed Loader
 * Heberger sur : tourmag13.github.io/cruisemap/encart-loader.js
 */
(function() {
  var container = document.getElementById('cruisemap-encart');
  if (!container) {
    console.warn('[CruiseMAP Encart] Element #cruisemap-encart introuvable.');
    return;
  }

  // Detect base URL from script src
  var scripts = document.getElementsByTagName('script');
  var baseUrl = '';
  for (var i = 0; i < scripts.length; i++) {
    if (scripts[i].src && scripts[i].src.indexOf('encart-loader') !== -1) {
      baseUrl = scripts[i].src.replace(/encart-loader\.js.*$/, '');
      break;
    }
  }
  if (!baseUrl) {
    baseUrl = 'https://tourmag13.github.io/cruisemap/';
  }

  var iframeUrl = baseUrl + 'encart.html';

  // Default height (will be adjusted by postMessage)
  var defaultHeight = container.getAttribute('data-height') || '290';

  // Create iframe
  var iframe = document.createElement('iframe');
  iframe.src = iframeUrl;
  iframe.style.cssText = 'width:100%;border:none;overflow:hidden;display:block;max-width:1200px;margin:0 auto;';
  iframe.style.height = defaultHeight + 'px';
  iframe.setAttribute('scrolling', 'no');
  iframe.setAttribute('frameborder', '0');
  iframe.setAttribute('allowtransparency', 'true');
  iframe.setAttribute('title', 'CruiseMAP - Croisieres fluviales');

  container.appendChild(iframe);

  // Listen for height updates from the encart
  window.addEventListener('message', function(e) {
    if (e.data && e.data.type === 'cruisemap-encart-resize' && e.data.height) {
      iframe.style.height = Math.ceil(e.data.height) + 'px';
    }
  });
})();
