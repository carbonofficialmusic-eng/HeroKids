---
name: Punktejournal als Buchhaltungsgrenze
description: Dauerhafte Regeln für atomare Punkteänderungen, Einführungssnapshots und alte Abweichungen.
---

Jede Punkteänderung muss innerhalb derselben Datenbanktransaktion den Mitgliedsdatensatz sperren, den Kontostand ändern und eine unveränderliche Buchung mit Deltas sowie Vorher-/Nachher-Werten erzeugen. Wiederholbare Requests brauchen eine stabile Vorgangs-ID.

**Why:** Historische Datensätze erklären nicht alle vorhandenen Guthaben. Stille Korrekturen würden Beweise vernichten und könnten legitime Punkte entfernen. Ein Null-Delta-Eröffnungssnapshot dokumentiert den Stand beim Rollout, ohne ihn umzuschreiben.

**How to apply:** Neue Vergabe-, Ausgabe-, Erstattungs- und Reset-Wege dürfen Punktespalten nicht direkt aktualisieren. Erstattungen stellen nur tatsächlich gebuchte Abbuchungen wieder her. Lebenszeitverdienst sinkt nur beim Factory Reset, nicht bei Ausgaben oder Erstattungen.