---
name: Chat-Push-Bündelung
description: Freigegebene Regel für zeitnahe Chat-Benachrichtigungen ohne Push-Spam.
---

Die erste Chatnachricht eines Absenders an einen Empfänger wird sofort als Push gesendet. Weitere Nachrichten desselben Absenders werden erst nach 90 Sekunden ohne neue Nachricht zusammengefasst. Öffnet und liest der Empfänger den Chat vorher, entfällt die Zusammenfassung.

**Why:** Ein festes Fünf-Minuten-Bündel ließ einzelne Nachrichten wie ausgefallene Pushes wirken. Der erste Hinweis muss sofort kommen; nur eine laufende Nachrichtenserie soll gebündelt werden.

**How to apply:** Bündel pro Empfänger und Absender führen, den Ruhe-Timer bei jeder Folgemeldung neu starten und bestehende Ruhezeiten sowie Push-Einstellungen weiterhin vor jedem Versand prüfen.