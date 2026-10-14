---
name: Unbekannte Vorschaufehler bei Menüs
description: ResizeObserver-Benachrichtigungen von echten Laufzeitfehlern beim Profilmenü unterscheiden.
---

Die Vorschau-Meldung „unknown runtime error“ beweist keinen Fehler beim Profilwechsel. Vor einer Änderung an Rollen, Sitzung oder Navigation zuerst das originale Browser-Fehlerereignis erfassen.

**Why:** Beim Öffnen des Profilmenüs trat reproduzierbar eine ResizeObserver-Benachrichtigung ohne Error-Objekt auf, die die Entwicklungs-Vorschau als blockierenden unbekannten Fehler darstellte. Der eigentliche Profilwechsel funktionierte im isolierten Browsertest.

**How to apply:** Nur die bekannten ResizeObserver-Layoutbenachrichtigungen ohne echte Exception in der Entwicklung vom blockierenden Overlay ausnehmen und diagnostisch sichtbar lassen. Unbekannte Fehler, echte Exceptions und Promise-Ablehnungen weiterhin melden; nicht pauschal das Overlay abschalten.
