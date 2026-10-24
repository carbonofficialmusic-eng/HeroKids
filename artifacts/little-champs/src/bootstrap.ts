// Keep this entry free of static app imports: a failed dependency must not
// prevent the HTML recovery screen from showing the actual startup error.
void import("./main").catch((error: unknown) => {
  console.error("[Little Champs] Startup failed", error);
  const message = document.getElementById("lc-bootstrap-message");
  const details = document.getElementById("lc-bootstrap-details");
  const retry = document.getElementById("lc-bootstrap-retry");
  if (message) {
    message.textContent = "Die App konnte nicht gestartet werden.";
    message.hidden = false;
  }
  if (details) {
    details.textContent = error instanceof Error ? error.message : String(error);
    details.hidden = false;
  }
  if (retry) retry.hidden = false;
});
