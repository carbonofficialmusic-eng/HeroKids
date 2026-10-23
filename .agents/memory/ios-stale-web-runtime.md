---
name: Veralteter Online-Webstand in iOS
description: Unterschied zwischen erfolgreichem Web-Publish und tatsächlich geladener iOS-Weboberfläche.
---

Eine erfolgreiche Webveröffentlichung und eine Online-Ladeadresse beweisen nicht, dass die installierte iOS-App den neuen JavaScript-Stand verwendet. Bei fehlenden Änderungen zuerst „Geladener Webstand“ mit „Webstand vom Server“ vergleichen.

**Why:** Die Diagnose der installierten App zeigte am 2026-10-23 einen geladenen Stand vom 2026-10-14, während der öffentliche Server nachweislich die neue Teilnehmeranzeige auslieferte. Der Nutzer hatte Publish und einen App-Neustart bereits durchgeführt. Die konkrete Ursache der weiterhin alten Webansicht ist damit noch nicht vollständig bewiesen.

**How to apply:** Nicht erneut Änderungen an der betroffenen Fachfunktion vornehmen oder ein fehlendes Publish unterstellen. Startnavigation und Cacheverhalten getrennt von der Server-Erreichbarkeitsprüfung prüfen: Ein cachefreier Health-Request aktualisiert nicht automatisch die laufende WebView. Keine Neuinstallation oder neue native Version als zwingend erforderlich darstellen, bevor mildere Möglichkeiten geprüft wurden.

Der Nutzer bestätigte, dass eine echte Seitennavigation über das Impressum den aktuellen Webstand in der bestehenden iOS-App geladen hat. Das ist nur eine Soforthilfe, ausdrücklich keine akzeptierte Dauerlösung. Die bestehende iOS-Version soll neue Webveröffentlichungen ohne manuelle Umwege übernehmen.

**Why:** Ein neuer nativer Build war für die erfolgreiche Aktualisierung nachweislich nicht nötig. Die bisherige statische Auslieferung setzte keine ausdrückliche Cache-Control für die Startseite; die tatsächliche Geräte-Cacheursache wurde nicht per WebView-Debugger gemessen.

**How to apply:** Die Web-Auslieferung muss HTML und Versionsdatei ausdrücklich ohne Cache liefern. Inhaltlich versionierte JS/CSS-Dateien und Skin-Downloads dürfen weiter gecacht werden. Produktions-Cache-Regeln müssen am tatsächlich verwendeten Artefakt-Dienst greifen, nicht nur am API-Server oder an der Entwicklungs-Vorschau. Aktualisierungen beim Wiederöffnen dürfen keine offenen Dialoge, Kameraabläufe oder Entwürfe verwerfen. Die erstmalige Übernahme einer neuen Aktualisierungslogik in bereits alten Sitzungen ist getrennt von ihrem Verhalten bei späteren Veröffentlichungen zu betrachten.
