---
name: Produktionsdaten gezielt bearbeiten
description: Bestätigter Weg für gezielte Änderungen einzelner nullable Werte in der Produktionsdatenbank
---

In der Replit-Datenbankansicht lassen sich einzelne Produktionswerte nach Aktivieren des Bearbeitungsmodus ändern; bei nullable Zeitstempeln ist ein Datenbank-NULL nötig, nicht die Zeichenfolge „null“. Der Nutzer hat bestätigt, dass dieser Weg funktionierte.

**Why:** Die Tabellenansicht startet schreibgeschützt, und ein sichtbarer Familienname allein identifiziert die Zeile nicht sicher, wenn ähnlich benannte Familien existieren.

**How to apply:** Bei ausdrücklich autorisierten Einzelfalländerungen die exakte Zeile anhand ihres vollständigen Schlüssels und Tarifs identifizieren; nur die bezeichneten Spalten bearbeiten. Der Agent selbst hat für Produktions-SQL nur lesenden Zugriff.