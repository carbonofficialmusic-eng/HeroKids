---
name: App-Store-Sprachanzeige
description: Warum der App Store die Laufzeitübersetzungen einer Capacitor-App nicht automatisch erkennt.
---

Der App Store erkennt die unterstützten Sprachen nicht aus den i18next-Übersetzungen der eingebetteten Web-App. Eine Capacitor-App muss ihre Sprachen zusätzlich im nativen iOS-Bundle deklarieren.

**Why:** Ohne native Sprachdeklaration zeigt die App-Store-Informationsseite nur die iOS-Entwicklungsregion, selbst wenn die Benutzeroberfläche bereits vollständig multilingual ist.

**How to apply:** Halte die iOS-Liste der Bundle-Lokalisierungen und die bekannten Xcode-Regionen mit den tatsächlich ausgelieferten Übersetzungskatalogen synchron. Eine Änderung wird im Store erst nach dem Hochladen und Verarbeiten eines neuen Builds sichtbar.