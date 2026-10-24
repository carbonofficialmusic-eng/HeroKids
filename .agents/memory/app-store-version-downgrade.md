---
name: App-Store-Version zurückstufen
description: Verhalten von App Store Connect und TestFlight beim Wechsel von einer irrtümlich höheren auf eine niedrigere Marketing-Version.
---

Wenn bereits Builds einer höheren Marketing-Version in TestFlight vorhanden sind, kann App Store Connect die niedrigere gewünschte Version nicht als neueste auswählbare Version anzeigen. Die höheren Versionsreihen müssen zuerst entfernt beziehungsweise ihre Builds aus TestFlight genommen oder ablaufen gelassen werden.

**Why:** Beim Wechsel von 2.0 zurück auf 1.2 wurde 1.2 erst für die Einreichung sichtbar, nachdem alle 2.0-Versionen aus TestFlight entfernt worden waren.

**How to apply:** Vor einer App-Store-Einreichung prüfen, ob TestFlight noch Builds mit einer höheren Marketing-Version enthält. Keine höhere Marketing-Version hochladen, solange diese Version nicht wirklich veröffentlicht werden soll.

Die geplante Marketing-Version vor einem Release mit der Nutzerangabe abgleichen, statt aus einer bereits verwendeten Testversion automatisch die nächste Marketing-Version abzuleiten.

**Why:** Der Nutzer stellte klar, dass der geplante Release 1.6 ist, während im App Store noch 1.5 liegt. Die zuvor vorbereitete 1.7 war nicht die gewünschte Release-Version.

**How to apply:** Projekt-Buildnummer und Marketing-Version getrennt behandeln. Eine neue Testiteration benötigt nicht automatisch eine neue Marketing-Version; Xcode Clouds laufende Build-Zählung ist ebenfalls keine Marketing-Version.