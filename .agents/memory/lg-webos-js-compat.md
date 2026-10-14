---
name: LG-webOS-5-JavaScript-Kompatibilität
description: Laufzeitmethoden prüfen, die der ältere TV-Browser trotz erfolgreich gebautem Paket nicht kennt.
---

Ein erfolgreicher Vite-Build macht moderne JavaScript-Laufzeitmethoden nicht automatisch für den Chromium-68-Browser auf LG webOS 5 verfügbar. Besonders `String.prototype.replaceAll` ist dort nicht vorhanden; schon ein Aufruf während des Renderns lässt die TV-App in ihre allgemeine Fehleranzeige fallen.

**Why:** Das neue Aufgabenboard stürzte auf dem echten TV nach erfolgreichem Build beim Rendern einer Kategorie ab, während die normale Browser-Vorschau funktionierte. Die Umstellung auf einen regulären Ausdruck beseitigte den offensichtlichen Kompatibilitätsfehler; eine Bestätigung auf dem Gerät stand zum Zeitpunkt dieser Notiz noch aus.

**How to apply:** Vor dem Weitergeben eines TV-Pakets neue Methoden gegen Chromium 68 prüfen und auf unterstützte Alternativen oder explizite Polyfills ausweichen. Die normale Desktop-Vorschau ersetzt den Test auf dem Gerät nicht.