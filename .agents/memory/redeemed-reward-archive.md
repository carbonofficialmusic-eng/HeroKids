---
name: Eingelöste Belohnungen bleiben erhalten
description: Produktregel für das Löschen einer Shop-Belohnung nach einer bereits erfolgten Einlösung.
---

Das Löschen einer Belohnung entfernt sie nur aus dem Shop. Bereits erfolgte Einlösungen bleiben in der Schatzkiste und der Elternansicht vollständig erhalten, einschließlich Teilen, Stornieren, Rückerstatten und „Erfüllt“-Aktionen.

**Why:** Eine physische Löschung der Shop-Vorlage löschte zuvor durch die Datenbank-Kaskade auch die Einlösung und damit den bereits bezahlten Anspruch.

**How to apply:** Shop-Belohnungen archivieren statt physisch löschen. Interne Einlösungs- und Aktionsabfragen dürfen archivierte Vorlagen weiterhin auflösen; ausschließlich Shop-Abfragen müssen sie ausblenden.