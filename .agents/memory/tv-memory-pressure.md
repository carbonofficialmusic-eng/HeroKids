---
name: TV-Speicherdruck
description: Laufzeit- und Bildspeicherbegrenzung bei LG webOS, ohne automatischen App-Neustart.
---

Die TV-App soll im Leerlauf keine vollständige Oberfläche jede Sekunde neu rendern. Zeitgeber nur für tatsächlich anstehende Fristen verwenden. Beim Scrollen Skin-Bildflächen außerhalb eines begrenzten Vorladebereichs freigeben, statt sämtliche einmal angesehenen Bilder dauerhaft im DOM zu behalten.

**Why:** Der Nutzer meldete LG-Neustarts zum Freigeben von Speicher in mehreren Ansichten, nach denen die App wieder im User Switch startet. Dauerhafte Bildhaltung und unnötige globale Renderzyklen erhöhen vermeidbare Belastung. Speicherfreigabe hat hier Vorrang vor dem Vermeiden erneuter Bilddekodierung beim Zurückscrollen.

**How to apply:** Automatische Datenaktualisierung erhalten, aber Renderzeitgeber und Medienlebensdauer begrenzen. LGs Speicherneustart nicht als konfigurierbaren App-Timer darstellen. `requiredMemory` beschreibt laut LG Mindestbedarf, nicht ein erhöhtes Maximalbudget. Eine bessere Laufzeit nicht allein aus Browser-Vorschau und Build behaupten; die Wirkung braucht Bestätigung am Gerät.