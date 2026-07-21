## iOS Sandbox-Kauf & Apple Review Recording

Der Code ist fertig. Diese Anleitung führt durch alle manuellen Schritte, die für das Apple Review erforderlich sind.

---

### Schritt 1 — Sandbox Tester in App Store Connect anlegen

1. Öffne [App Store Connect](https://appstoreconnect.apple.com) → **Users and Access** → **Sandbox** → **Testers**
2. Klicke **+** und lege einen neuen Tester an (eigene, separate Apple-ID — nicht dein Entwickler-Account)
3. Notiere E-Mail und Passwort dieses Test-Accounts

---

### Schritt 2 — IAP-Produkte in App Store Connect anlegen

Navigiere zu deiner App → **Monetization** → **In-App Purchases & Subscriptions**.

Lege eine **Subscription Group** an (z. B. „HeroKids Subscriptions") und füge diese 4 Produkte als **Auto-Renewable Subscription** hinzu:

| Product ID                      | Bezeichnung             | Preis |
|---------------------------------|-------------------------|-------|
| `com.herokids.family.monthly`   | Family Monthly          | 3,99€ |
| `com.herokids.family.yearly`    | Family Yearly           | 29,99€|
| `com.herokids.familypro.monthly`| FamilyPro Monthly       | 9,99€ |
| `com.herokids.familypro.yearly` | FamilyPro Yearly        | 69,99€|

Für jedes Produkt:
- Status auf **Ready for Sale** setzen
- Lokalisierung (Deutsch + Englisch) ausfüllen
- Preis in der Preismatrix setzen

---

### Schritt 3 — RevenueCat Dashboard konfigurieren

1. Öffne das [RevenueCat Dashboard](https://app.revenuecat.com) → deine App → **Products**
2. Füge alle 4 Product IDs von oben hinzu und verknüpfe sie mit dem App Store
3. Gehe zu **Offerings**:
   - Offering `family`: Packages `$rc_monthly` → `com.herokids.family.monthly`, `$rc_annual` → `com.herokids.family.yearly`
   - Offering `family_pro`: Packages `$rc_monthly` → `com.herokids.familypro.monthly`, `$rc_annual` → `com.herokids.familypro.yearly`
4. Stelle sicher, dass beide Offerings als **Current Offering** gesetzt sind (oder zumindest aktiv)

Die Entitlement-IDs müssen exakt so heißen (wie im Code verdrahtet):
- `family` — für den Family-Tier
- `family_pro` — für den FamilyPro-Tier

---

### Schritt 4 — Build auf physischem iPhone installieren und Kauf durchführen

1. Erstelle einen aktuellen Build (Xcode Cloud oder lokales Archiv) und installiere ihn auf einem physischen iPhone
2. Öffne **Einstellungen → App Store → SANDBOX-KONTO** auf dem iPhone und melde dich mit dem Sandbox-Tester-Account an
3. Starte die HeroKids App, logge dich als Elternteil ein
4. Navigiere zum Pricing-Screen (Einstellungen → Abonnement verwalten / Upgrade)
5. Wähle **Family** oder **FamilyPro** und tippe auf „Plan auswählen"
6. Der native iOS Kauf-Dialog erscheint — bestätige mit Face ID / Touch ID (bei Sandbox: kein echtes Geld)
7. Prüfe, dass der Tier nach dem Kauf korrekt angezeigt wird (Family- oder FamilyPro-Badge sichtbar)

---

### Schritt 5 — Screen-Recording aufnehmen

1. **Vor** dem Kauf-Test: Wische auf dem iPhone von oben rechts nach unten (Control Center) und tippe auf den **Aufnahme-Button** (Kreis-Symbol)
2. Führe den kompletten Kauffluss durch: Paywall öffnen → Plan auswählen → Kauf bestätigen → Erfolg sehen
3. Stoppe die Aufnahme im Control Center
4. Das Video liegt in der Fotos-App → AirDrop oder Kabel-Transfer auf den Mac

---

### Schritt 6 — Recording in App Store Connect hochladen

1. Öffne App Store Connect → deine App → der eingereichte Build
2. Gehe zu **App Review Information**
3. Im Feld **Notes** schreibe: _„Screen recording of a successful sandbox in-app purchase (Family Monthly subscription) is attached below."_
4. Lade das Video als Anhang hoch
5. Sende den Build zum Review

---

### Code-Übersicht (zur Referenz)

Die Offering-Keys und Package-Identifier sind im Code wie folgt verdrahtet:

| Tier       | RC Offering Key | Entitlement Key |
|------------|-----------------|-----------------|
| Family     | `family`        | `family`        |
| FamilyPro  | `family_pro`    | `family_pro`    |

Packages: `$rc_monthly`, `$rc_annual`, `$rc_lifetime`

Relevante Dateien:
- `client/src/lib/revenuecat.ts` — SDK-Init und Kauffunktionen
- `client/src/pages/pricing.tsx` — Pricing-Screen mit iOS-Kauflogik
- `client/src/components/first-open-paywall.tsx` — First-Open-Paywall
