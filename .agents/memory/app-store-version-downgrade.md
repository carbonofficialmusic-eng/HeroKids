---
name: App-Store-Version zurückstufen
description: Verhalten von App Store Connect und TestFlight beim Wechsel von einer irrtümlich höheren auf eine niedrigere Marketing-Version.
---

Wenn bereits Builds einer höheren Marketing-Version in TestFlight vorhanden sind, kann App Store Connect die niedrigere gewünschte Version nicht als neueste auswählbare Version anzeigen. Die höheren Versionsreihen müssen zuerst entfernt beziehungsweise ihre Builds aus TestFlight genommen oder ablaufen gelassen werden.

**Why:** Beim Wechsel von 2.0 zurück auf 1.2 wurde 1.2 erst für die Einreichung sichtbar, nachdem alle 2.0-Versionen aus TestFlight entfernt worden waren.

**How to apply:** Vor einer App-Store-Einreichung prüfen, ob TestFlight noch Builds mit einer höheren Marketing-Version enthält. Keine höhere Marketing-Version hochladen, solange diese Version nicht wirklich veröffentlicht werden soll.