---
name: Drizzle-Zod und Zod-Versionen
description: Nicht offensichtlicher Versionskonflikt in generierten Schemas und Formular-Erweiterungen.
---

Die von Drizzle-Zod erzeugten Objektschemas verwenden zur Laufzeit Zod 4, auch wenn im Workspace noch Zod 3 als Standardimport genutzt wird. Ein mit Zod 3 ergänztes Feld kann erfolgreich gebündelt werden, aber beim Parsen „Invalid element at key …: expected a Zod schema“ auslösen.

**Why:** Der Fehler erschien erst beim Öffnen/Validieren des Aufgabenformulars; eine reine Buildprüfung erkannte ihn nicht.

**How to apply:** Beim Erweitern eines generierten Schemas dessen Zod-Generation für alle ergänzten Felder übernehmen und eine echte `safeParse`-Probe ausführen. Bei gemeinsamen Schemas auch bereits ergänzte Felder prüfen, nicht nur das im Fehler genannte Feld.

Auch der Formular-Resolver muss diese Schema-Generation unterstützen; ein passendes Schema allein genügt nicht.

**Why:** Der ältere installierte React-Hook-Form-Zod-Adapter erwartet Zod-3-Fehlerfelder. Drizzle-generierte Zod-4-Schemas können dadurch trotz erfolgreichem Build beim Absenden fehlschlagen.

**How to apply:** Bei Validator- oder Resolver-Änderungen sowohl erfolgreiche geparste Formularwerte als auch echte verschachtelte Validierungsfehler testen. Keine Adapter-Kompatibilität allein aus dem Paketnamen ableiten.