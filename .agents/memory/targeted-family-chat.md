---
name: Gezielte Chatnachrichten
description: Freigegebene Sichtbarkeits- und Benachrichtigungsregeln für adressierte Familienchat-Nachrichten.
---

Gezielte Nachrichten sind keine privaten Nachrichten. Sichtbar sind sie für Absender, ausgewähltes Ziel und alle Eltern; andere Kinder erhalten sie weder über API noch Live-Verbindung. Push und Ungelesen-Zähler gehen nur an das ausgewählte Ziel. Eltern können nicht an sie adressierte Nachrichten einsehen, werden dadurch aber nicht benachrichtigt.

Die freigegebene Chatdarstellung trennt „Alle“ von direkten Gesprächen pro Familienmitglied. Eltern erhalten zusätzlich eine schreibgeschützte Übersicht der Kind-zu-Kind-Unterhaltungen; direkte Eltern-Chats bleiben davon getrennt.

**Why:** Kinder sollen einzelne Familienmitglieder ansprechen können, während die elterliche Aufsicht transparent erhalten bleibt und Eltern nicht durch jede Kind-zu-Kind-Unterhaltung gestört werden.

**How to apply:** Sichtbarkeit immer serverseitig erzwingen. Die Zielklassifizierung dauerhaft getrennt von der löschbaren Ziel-ID speichern, damit das Löschen eines Mitglieds eine ehemals gezielte Nachricht niemals in einen Broadcast umwandelt.