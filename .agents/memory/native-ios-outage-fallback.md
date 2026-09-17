---
name: Nativer iOS-Ausfallbildschirm
description: Verbindliche Strategie für den vollständig lokalen iOS-Fallback bei Ausfällen der Remote-WebView.
---

Die iOS-App legt einen nativen UIKit-Ausfallbildschirm über die Remote-WebView, bis sowohl die Produktions-Startseite mit 2xx antwortet als auch React sein Bereitschaftssignal gesetzt hat. Jede neue Hauptnavigation blendet den Schutz erneut ein.

**Why:** Die native App lädt im Normalbetrieb eine Remote-URL. Scheitert schon deren HTML-Navigation, können weder React noch ein webbasierter Status-Guard zuverlässig erscheinen.

**How to apply:** Server- und WebView-Bereitschaft gemeinsam prüfen, veraltete Antworten über Generationen verwerfen, im Vordergrund sofort neu prüfen und WebView-Neuladeversuche begrenzen.