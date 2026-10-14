---
name: LG-TV-Skin-Medien
description: Entscheidung zur Bildauslieferung für das installierte webOS-5-Familien-TV.
---

Das installierbare webOS-Paket enthält verkleinerte, optimierte lokale Kopien der Skin-Avatare und -Hintergründe. Diese Entscheidung gilt nur für den Fernseher, nicht für den nativen iOS-Build.

**Why:** Auf dem echten LG-TV fehlten anfangs Skin-Bilder, obwohl die getesteten HTTPS-PNG-Adressen 200 lieferten und TV-API-Anfragen funktionierten. Die genaue Ursache ist nicht bewiesen. Die nachinstallierte TV-App zeigt die lokal gebündelten Avatare und Galerie-Hintergründe; der aktive Ganzseiten-Hintergrund blieb aber zu dunkel bzw. unsichtbar. Lokale Bilder beseitigen die Abhängigkeit von Cross-Origin-Bildaufrufen aus einer `file://`-App, ersetzen jedoch keine Prüfung der CSS-Ebenen. Die Originalbilder waren für ein vollständiges natives Bundle zu groß; die TV-Kopien sind deshalb komprimiert.

**How to apply:** TV-Pakete mit lokalem Skin-Material ausliefern und gesperrte Motive in der Oberfläche weiterhin nicht laden oder zeigen. Die Webvorschau kann ihre Bilder weiterhin über den Haupt-App-Server beziehen. Die iOS-Regel, nur den Starter-Skin zu bündeln und weitere Bilder nach dem Aufdecken zu laden, bleibt unverändert.

Für kleine Skin-Karten separate, ausschließlich dem TV gehörende Vorschaubilder verwenden. Die große TV-Anprobe und der aktive Hintergrund behalten ihre bisherigen Bildquellen. Gemeinsame Originale, Web-/iOS-Vorschaubilder und Skin-IDs dürfen dabei nicht verändert werden.

**Why:** Der Nutzer hat ausdrücklich nur die TV-Karten zur Optimierung freigegeben und die bestehenden Web-/iOS-Darstellungen geschützt. Dieselbe kleine Datei für Anprobe oder Ganzseiten-Hintergrund würde die sichtbare Qualität verschlechtern.

**How to apply:** Vorschaudateien getrennt im TV-Artefakt halten und über dessen Basis-Pfad laden, im installierten LG-Paket relativ und lokal. Abgeleitete Dateien samt Herkunftsprüfung mitführen: Veröffentlichung prüft vorhandene Dateien ohne Bildkonverter; neue oder geänderte Originale erfordern bewusstes Neugenerieren der TV-Vorschauen.