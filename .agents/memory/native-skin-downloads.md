---
name: Native Skin-Downloads
description: Bestätigte Produktregel für Größe und Ladezeit der nativen iOS-App.
---

Skin-Avatare und Skin-Hintergründe werden vollständig online geladen, einschließlich `junior-champion`. Die drei serverseitig festgelegten Startangebote dürfen bereits vor der Auswahl als Vorschau laden; andere gesperrte Originalbilder weiterhin erst nach erfolgreichem Aufdecken laden, als Paare nacheinander.

**Why:** Die bisher lokal gebündelten Skin-Medien machten die App über 300 MB groß. Im normalen Betrieb stehen höchstens wenige Karten zum Aufdecken an, daher ist ein bedarfsgesteuerter Download sinnvoller als ein großes Start-Bundle.

**How to apply:** Auch den historischen Starter nicht erneut ins Paket aufnehmen. Ausschließlich die drei erlaubten Angebote vorab laden, nicht den Katalog; Web-Assets bleiben vollständig online verfügbar. App-Icon und lokale Ausfallanzeige sind keine Skin-Bilder und bleiben erhalten.

Die zwei festen Startmotive für Eltern- und Kinderboard sind ausdrücklich eine Ausnahme: Sie sollen im nächsten iOS-Build an Bord sein. Zufällige Helden, ihre Profilbilder und ihre regulären Skin-Hintergründe bleiben online, auch der früher feste erste Skin.

**Why:** Der Nutzer möchte die neuen Startbilder lokal verfügbar haben, ohne beim zufälligen Heldenangebot wieder Spiel-Skins ins Paket aufzunehmen.

**How to apply:** Beide Einstiegsillustrationen bündeln und für die weiterhin remote geladene Weboberfläche wirklich lokal zugänglich machen; bloßes Kopieren reicht bei einer HTTPS-Startadresse nicht. Ältere native Builds ohne diese Unterstützung und Browser verwenden weiterhin Online-Bilder. Die Ausnahme macht die App selbst nicht offlinefähig.

**Live bestätigt:** Am 14. September 2026 lud die bereits über den App Store installierte App die ausgelagerten Bilder erfolgreich von der URL statt aus dem nativen Bundle.

Die Stern- und Erfolgsanimation nach dem Aufdecken wartet nicht auf diese Bild-Downloads. Die Downloads bleiben nach der erfolgreichen Freigabe seriell, laufen aber im Hintergrund.

**Why:** Bei langsamer Verbindung verzögerte das vorherige Warten auf Avatar und Hintergrund das Feuerwerk um etwa zehn Sekunden, obwohl die Animation die Bilder nicht benötigt.

**How to apply:** Erst den Servererfolg abwarten, dann die Animation sofort anzeigen und nur die freigegebenen Bilder im Hintergrund laden; Downloadfehler sichtbar melden, nicht still verschlucken.