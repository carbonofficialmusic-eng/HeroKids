(function () {
  var meta = document.querySelector('meta[name="lc-preview-build"]');
  if (!meta) return;
  var current = meta.content;
  var url = meta.getAttribute("data-check-url");
  function check() {
    if (document.visibilityState !== "visible") return;
    fetch(url, { cache: "no-store" })
      .then(function (response) {
        if (!response.ok) throw new Error("Preview build check unavailable");
        return response.json();
      })
      .then(function (build) {
        if (build.id && build.id !== current) window.location.reload();
      })
      .catch(function () {
        // A brief rebuild or offline period must not interrupt the current app.
      });
  }
  setInterval(check, 5000);
  document.addEventListener("visibilitychange", check);
})();
