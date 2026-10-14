---
name: Google-Kalender bleibt Einweg-Quelle
description: Dauerhafte Produktgrenze und Synchronisationsregeln für importierte Familientermine.
---

Google Calendar ist in dieser Ausbaustufe die Quelle für Titel, Datum, Uhrzeit, Verschiebungen und Absagen. Little Champs schreibt niemals zurück zu Google und verwaltet lokal nur Mitgliedszuordnung, Punkte, Erledigung und Genehmigung.

**Why:** Eltern sollen getrennte Kinderkalender freiwillig zuordnen können, ohne dass Little Champs deren Google-Daten verändert. Ein späterer Export ist ausdrücklich ein separates Vorhaben.

**How to apply:** Künftige Terminänderungen müssen stabile Google-Ereignisreferenzen bewahren, Import und Export getrennt modellieren und die bestehende Einweg-Synchronisation nicht stillschweigend bidirektional machen. Wiederholte Importe dürfen lokal geänderte Punkte und Mitgliedszuweisungen nicht überschreiben.

Ein konkreter Google-Kalender darf mehreren Little-Champs-Familien zugeordnet werden. Bei der Einrichtung muss vor der Aktivierung gewarnt und ausdrücklich bestätigt werden, wenn derselbe Kalender bereits über dasselbe Google-Konto mit einer anderen Familie verbunden ist.

**Why:** Patchwork-, Test- und Mehrfamilienfälle bleiben möglich, ohne dass Eltern versehentlich dieselben Termine in mehreren Familien importieren. Die Prüfung des bestätigten Google-Kontos verhindert, dass fremde Familiennamen offengelegt werden.

**How to apply:** Konflikte kalenderbezogen statt nur kontobezogen prüfen. Ohne Treffer keine zusätzliche Meldung zeigen; bei Treffern Familiennamen nennen und „Trotzdem verbinden“ oder „Abbrechen“ anbieten.