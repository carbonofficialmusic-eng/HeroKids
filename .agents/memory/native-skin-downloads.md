---
name: Native Skin-Downloads
description: Bestätigte Produktregel für Größe und Ladezeit der nativen iOS-App.
---

Im nativen iOS-Build bleiben nur Avatar und Hintergrund von `junior-champion` lokal gebündelt. Originaldateien gesperrter Skins dürfen nicht angefordert werden. Erst nach erfolgreichem Aufdecken lädt die App Avatar und Hintergrund des betroffenen Skins; mehrere Aufdeckungen werden als Paare nacheinander verarbeitet.

**Why:** Die bisher lokal gebündelten Skin-Medien machten die App über 300 MB groß. Im normalen Betrieb stehen höchstens wenige Karten zum Aufdecken an, daher ist ein bedarfsgesteuerter Download sinnvoller als ein großes Start-Bundle.

**How to apply:** Neue Skin-Anzeigen müssen den Aufdeckstatus prüfen, bevor sie Original-URLs verwenden. Der iOS-Sync muss bei jedem Build hart sicherstellen, dass genau ein lokaler Avatar und ein lokaler Hintergrund übrig bleiben. Web-Assets bleiben vollständig auf littlechamps.net verfügbar.

**Live bestätigt:** Am 14. September 2026 lud die bereits über den App Store installierte App die ausgelagerten Bilder erfolgreich von der URL statt aus dem nativen Bundle.

Die Stern- und Erfolgsanimation nach dem Aufdecken wartet nicht auf diese Bild-Downloads. Die Downloads bleiben nach der erfolgreichen Freigabe seriell, laufen aber im Hintergrund.

**Why:** Bei langsamer Verbindung verzögerte das vorherige Warten auf Avatar und Hintergrund das Feuerwerk um etwa zehn Sekunden, obwohl die Animation die Bilder nicht benötigt.

**How to apply:** Erst den Servererfolg abwarten, dann die Animation sofort anzeigen und nur die freigegebenen Bilder im Hintergrund laden; Downloadfehler sichtbar melden, nicht still verschlucken.