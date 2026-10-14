---
name: iOS-Aboänderungen und Kündigungen
description: StoreKit-Verzögerungen, geplante Herabstufungen und native Link-Prüfgrenzen.
---

RevenueCats REST-Zustand kann nach einem StoreKit-Kauf verzögert sein. Kurz erneut prüfen und nur serverseitig belegte Käufe oder Aboänderungen akzeptieren; eine Kaufbestätigung aus dem Client allein darf keinen bezahlten Tarif freischalten.

**Why:** Ein sofortiger REST-Abgleich kann einen echten Kauf noch nicht sehen, während unüberprüfte Client-Angaben beliebig nachgebildet werden können.

**How to apply:** StoreKit-/RevenueCat-Synchronisation muss begrenzte Wiederholungen und nachvollziehbare Server-Belege verwenden. Bei fehlenden Belegen eine wiederholbare Synchronisationsmeldung zurückgeben, statt erfundenen Zugriff zu vergeben.

Eine geplante Apple-Herabstufung aktiviert den günstigeren Tarif nicht zwingend sofort. Kündigung und tatsächliches Ende des bezahlten Zugriffs sind unterschiedliche Ereignisse.

**Why:** Apple lässt bereits bezahlte Zeit normalerweise weiterlaufen; ein alter Ablauf-Webhook kann zudem nach einem neuen Kauf eintreffen.

**How to apply:** Kündigungsstatus und aktuellen Tarif getrennt behandeln. Vor Zugriffsentzug den aktuellen Anbieterzustand prüfen; die zusätzliche Erinnerung zur Downgrade-Verifikation beachten.

Native Links und Web-Links müssen getrennt behandelt werden. Cordovas `_system`-Konvention ist keine verlässliche Capacitor-Schnittstelle, und ältere Hinweise auf bestimmte Plugin-Methoden sind gegen die tatsächlich installierte Plugin-Version zu prüfen.

**Why:** WKWebView kann bei nicht unterstützten System-URL-Übergaben auf einem leeren Ladebildschirm bleiben. Die installierte Capacitor-App-Schnittstelle bietet nicht jede historisch dokumentierte Methode.

**How to apply:** Unterstützte Plugin-Typen prüfen, Fehlerpfade erhalten und das Öffnen der Apple-Aboverwaltung auf einem echten iPhone testen. Ein erfolgreicher Web-Build bestätigt dieses native Verhalten nicht.