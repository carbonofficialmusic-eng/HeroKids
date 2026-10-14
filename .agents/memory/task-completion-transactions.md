---
name: Aufgaben-Abschlussgrenze
description: Fachliche Reservierungen und atomare Entscheidungen bei begrenzten Aufgaben, Teams und Einkaufslisten.
---

Eine ausstehende Einreichung reserviert ihren Platz, solange sie noch genehmigt werden kann. Ein Kalender- oder Periodenwechsel allein darf diese Reservierung nicht freigeben; dafür muss die Einreichung tatsächlich abgelehnt, entfernt oder abschließend verarbeitet werden.

**Why:** Sonst kann ein neuer Teilnehmer den vermeintlich freien Platz erhalten und die alte Einreichung später zusätzlich genehmigt werden. Die Verfügbarkeitsgrenze einer Person und die Lebensdauer einer genehmigungsfähigen Reservierung sind verschiedene Regeln.

**How to apply:** Kapazität aus bereits genehmigten Abschlüssen plus weiterhin ausstehenden Reservierungen bestimmen. Ablehnung gibt die Reservierung frei; Genehmigung wandelt sie um, statt einen weiteren Platz zu verbrauchen. Keine historischen Punktestände oder Zähler still reparieren.

Ein idempotentes Punktejournal allein macht einen Aufgabenabschluss nicht idempotent. Statusentscheidung, Abschlusszähler, Verlauf und kollektive Empfänger müssen ebenfalls gemeinsam geschützt sein.

**Why:** Eine zweite oder gegensätzliche Entscheidung kann ohne zusätzliche Punktetransaktion trotzdem einen bezahlten Abschluss ablehnen oder seinen Zähler erneut erhöhen. Bei Einkaufslisten darf ein Häkchen nicht außerhalb der Transaktion geändert werden, die die komplette Liste zur Auszahlung vorbereitet.

**How to apply:** Aufgaben vor Einreichungen sperren, bei Sammelentscheidungen eine stabile Sperrreihenfolge verwenden und unter der Sperre den aktuellen Status erneut prüfen. Produktänderung, Empfängerermittlung, Abschlussabgleich und kollektive Entscheidung atomar durchführen; Meldungen erst nach Commit senden. Resets dürfen keine aus einem alten Leseergebnis abgeleiteten Zähler über frisch abgeschlossene Aktionen schreiben.