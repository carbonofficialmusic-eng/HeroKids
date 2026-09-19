---
name: App-Store-Sprachanzeige
description: Warum der App Store die Laufzeitübersetzungen einer Capacitor-App nicht automatisch erkennt.
---

Der App Store erkennt die unterstützten Sprachen nicht aus den i18next-Übersetzungen der eingebetteten Web-App. Eine Capacitor-App braucht echte lokalisierte Ressourcenordner (`*.lproj`) im gebauten Bundle. `CFBundleLocalizations` und Xcodes `knownRegions` allein wurden bei einem veröffentlichten Build nicht als zusätzliche Store-Sprachen erkannt.

**Why:** Ein nach Ergänzung der Sprachlisten erstellter und veröffentlichter Build zeigte weiterhin nur Englisch. Apples Bundle-Scanner erkannte die zusätzlichen Sprachen erst zuverlässig, wenn lokalisierte native Ressourcen tatsächlich Teil des Targets sind.

**How to apply:** Halte `*.lproj`-Ressourcen, die Bundle-Lokalisierungsliste und Xcodes bekannte Regionen mit den ausgelieferten Web-Übersetzungen synchron. Stelle sicher, dass die Variant Group in der Resources Build Phase liegt. Änderungen werden erst mit einem neuen Store-Build sichtbar.