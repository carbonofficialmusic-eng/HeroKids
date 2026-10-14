// webOS 5 uses Chromium 68, which predates globalThis. Some dependencies
// reference it while the app bundle is evaluated, before React can render.
(function () {
  if (typeof window.globalThis === 'undefined') {
    window.globalThis = window;
  }

  function showStartupError(message) {
    var root = document.getElementById('root');
    if (!root || root.firstChild) return;

    var box = document.createElement('div');
    box.style.cssText = 'box-sizing:border-box;min-height:100vh;padding:8vw;background:#f4f8f7;color:#173b4b;font:24px/1.5 Arial,sans-serif';
    var title = document.createElement('h1');
    title.textContent = 'Little Champs TV konnte nicht starten';
    var detail = document.createElement('p');
    detail.textContent = String(message || 'Unbekannter Startfehler').slice(0, 220);
    box.appendChild(title);
    box.appendChild(detail);
    root.appendChild(box);
  }

  window.addEventListener('error', function (event) {
    setTimeout(function () {
      showStartupError(event.message || 'Ein Skript konnte nicht geladen werden.');
    }, 0);
  });
  window.addEventListener('unhandledrejection', function (event) {
    setTimeout(function () {
      var reason = event.reason;
      showStartupError(reason && reason.message ? reason.message : 'Ein Startvorgang ist fehlgeschlagen.');
    }, 0);
  });
  window.addEventListener('DOMContentLoaded', function () {
    setTimeout(function () {
      showStartupError('Die Oberfläche wurde nicht geladen.');
    }, 7000);
  });
})();