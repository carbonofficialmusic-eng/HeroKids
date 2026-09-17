---
name: Nativer iOS-Ausfallbildschirm
description: Verbindliche Strategie für den vollständig lokalen iOS-Fallback bei Ausfällen der Remote-WebView.
---

Der native UIKit-Ausfallbildschirm bleibt beim normalen App-Start und bei jeder WebView-Navigation verborgen. Er darf nur erscheinen, wenn die Produktions-Startseite nach einer Start-Schonfrist mehrfach hintereinander wirklich nicht erreichbar war. Eine erreichbare Seite mit noch nicht aufgebautem React-Root ist kein Ausfall.

**Why:** Das sofortige Einblenden bei `isLoading` ließ nach dem Splash-Screen und bei Profilwechseln fälschlich „Gleich zurück!“ aufblitzen. Auch ein leerer React-Root während des normalen Starts wurde zu früh als Fehler gewertet.

**How to apply:** Navigation und React-Aufbau dürfen den Screen niemals auslösen. Nur wiederholte HTTP-/Netzwerkfehler nach der Schonfrist zählen; eine erfolgreiche Serverantwort setzt die Fehlerfolge zurück. Keine Reload-Schleife bei kurzzeitig leerem Root starten.