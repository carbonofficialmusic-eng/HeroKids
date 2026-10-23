---
name: Veralteter Online-Webstand in iOS
description: Unterschied zwischen erfolgreichem Web-Publish und tatsächlich geladener iOS-Weboberfläche.
---

Eine erfolgreiche Webveröffentlichung und eine Online-Ladeadresse beweisen nicht, dass die installierte iOS-App den neuen JavaScript-Stand verwendet. Bei fehlenden Änderungen zuerst „Geladener Webstand“ mit „Webstand vom Server“ vergleichen.

**Why:** Die Diagnose der installierten App zeigte am 2026-10-23 einen geladenen Stand vom 2026-10-14, während der öffentliche Server nachweislich die neue Teilnehmeranzeige auslieferte. Der Nutzer hatte Publish und einen App-Neustart bereits durchgeführt. Die konkrete Ursache der weiterhin alten Webansicht ist damit noch nicht vollständig bewiesen.

**How to apply:** Nicht erneut Änderungen an der betroffenen Fachfunktion vornehmen oder ein fehlendes Publish unterstellen. Startnavigation und Cacheverhalten getrennt von der Server-Erreichbarkeitsprüfung prüfen: Ein cachefreier Health-Request aktualisiert nicht automatisch die laufende WebView. Keine Neuinstallation oder neue native Version als zwingend erforderlich darstellen, bevor mildere Möglichkeiten geprüft wurden.
