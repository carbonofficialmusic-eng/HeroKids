# HeroKids iOS App Store Anleitung

Diese Anleitung beschreibt, wie du HeroKids im Apple App Store veröffentlichst.

## Voraussetzungen

- **Mac mit macOS** (Apple-Anforderung für iOS-Entwicklung)
- **Xcode** (kostenlos im Mac App Store)
- **Apple Developer Account** (99€/Jahr): https://developer.apple.com
- **Node.js** auf deinem Mac installiert

## Schritt 1: Projekt auf Mac vorbereiten

### 1.1 Repository klonen oder Dateien kopieren

Kopiere alle Projektdateien auf deinen Mac (z.B. via GitHub oder Download).

### 1.2 Dependencies installieren

```bash
cd herokids
npm install
```

### 1.3 Web-App bauen

```bash
npm run build
```

Dies erstellt den `dist/public` Ordner, der von Capacitor verwendet wird.

### 1.4 iOS-Plattform hinzufügen

```bash
npx cap add ios
```

### 1.5 iOS-Projekt synchronisieren

```bash
npx cap sync ios
```

## Schritt 2: App-Icons erstellen

Du brauchst ein quadratisches Icon (mindestens 1024x1024 Pixel).

### Benötigte Icon-Größen:

| Dateiname | Größe (Pixel) | Verwendung |
|-----------|---------------|------------|
| icon-20.png | 20x20 | iPad Notifications |
| icon-20@2x.png | 40x40 | iPhone/iPad Notifications |
| icon-20@3x.png | 60x60 | iPhone Notifications |
| icon-29.png | 29x29 | iPad Settings |
| icon-29@2x.png | 58x58 | iPhone/iPad Settings |
| icon-29@3x.png | 87x87 | iPhone Settings |
| icon-40.png | 40x40 | iPad Spotlight |
| icon-40@2x.png | 80x80 | iPhone/iPad Spotlight |
| icon-40@3x.png | 120x120 | iPhone Spotlight |
| icon-60@2x.png | 120x120 | iPhone App |
| icon-60@3x.png | 180x180 | iPhone App |
| icon-76.png | 76x76 | iPad App |
| icon-76@2x.png | 152x152 | iPad App |
| icon-83.5@2x.png | 167x167 | iPad Pro App |
| icon-1024.png | 1024x1024 | App Store |

### Einfacher Weg: Icon-Generator verwenden

1. Gehe zu https://appicon.co
2. Lade dein 1024x1024 Icon hoch
3. Lade das generierte Icon-Set herunter
4. Kopiere die Icons nach: `ios/App/App/Assets.xcassets/AppIcon.appiconset/`

## Schritt 3: Splash Screen anpassen

Der Splash Screen wird in Xcode bearbeitet:

1. Öffne `ios/App/App.xcworkspace` in Xcode
2. Navigiere zu `App/App/Assets.xcassets/Splash.imageset`
3. Ersetze die Bilder mit deinem HeroKids-Logo

### Splash Screen Farbe ändern:

1. Öffne `ios/App/App/Assets.xcassets/Splash.storyboard`
2. Wähle die Hintergrund-View
3. Ändere die Hintergrundfarbe auf HeroKids Teal (#14b8a6)

## Schritt 3b: Kamera-Berechtigungen einrichten

Die HeroKids-App ermöglicht Kindern, Fotos als Aufgaben-Nachweis aufzunehmen. iOS erfordert dafür zwei Einträge in der `Info.plist`.

### In Xcode:

1. Öffne das Projekt mit `npx cap open ios`
2. Navigiere zu `App/App/Info.plist` in der Projektstruktur
3. Klicke auf das **+**-Symbol beim letzten Eintrag, um eine neue Zeile hinzuzufügen
4. Füge diese beiden Einträge hinzu:

| Key | Type | Value |
|-----|------|-------|
| `NSCameraUsageDescription` | String | `HeroKids needs camera access so kids can take photos as proof of completing tasks.` |
| `NSPhotoLibraryUsageDescription` | String | `HeroKids needs photo library access so kids can choose a photo as proof of completing tasks.` |

### Alternativ: Info.plist direkt bearbeiten

Rechtsklick auf `Info.plist` → **Open As** → **Source Code** und füge vor dem letzten `</dict>` ein:

```xml
<key>NSCameraUsageDescription</key>
<string>HeroKids needs camera access so kids can take photos as proof of completing tasks.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>HeroKids needs photo library access so kids can choose a photo as proof of completing tasks.</string>
```

**Wichtig:** Ohne diese Einträge stürzt die App ab, sobald ein Kind ein Foto aufnehmen möchte.

## Schritt 4: In Xcode öffnen und konfigurieren

### 4.1 Xcode öffnen

```bash
npx cap open ios
```

### 4.2 Signing konfigurieren

1. Wähle das "App" Target in Xcode
2. Gehe zu "Signing & Capabilities"
3. Wähle dein Team (dein Developer Account)
4. Xcode generiert automatisch die Provisioning Profile

### 4.3 Bundle Identifier prüfen

Stelle sicher, dass die Bundle ID korrekt ist:
- **Bundle Identifier:** `com.herokids.app`

### 4.4 Version und Build Number setzen

- **Version:** 1.0.0 (für Benutzer sichtbar)
- **Build:** 1 (interner Build-Zähler)

## Schritt 5: App testen

### Auf Simulator testen:

1. Wähle einen Simulator (z.B. "iPhone 15")
2. Klicke auf den Play-Button (Run)

### Auf echtem Gerät testen:

1. Verbinde dein iPhone via USB
2. Wähle dein Gerät als Target
3. Klicke auf den Play-Button (Run)
4. Beim ersten Mal: Vertraue dem Entwickler auf deinem iPhone (Einstellungen → Allgemein → VPN & Geräteverwaltung)

## Schritt 6: Archive für App Store erstellen

### 6.1 Build-Konfiguration

1. Wähle "Any iOS Device (arm64)" als Target
2. Gehe zu Product → Archive

### 6.2 Archive hochladen

1. Nach dem Archive: Organizer öffnet sich
2. Wähle das Archive und klicke "Distribute App"
3. Wähle "App Store Connect"
4. Folge den Anweisungen

## Schritt 7: App Store Connect konfigurieren

### 7.1 App erstellen

1. Gehe zu https://appstoreconnect.apple.com
2. "My Apps" → "+" → "New App"
3. Fülle aus:
   - **Platform:** iOS
   - **Name:** HeroKids
   - **Primary Language:** German
   - **Bundle ID:** com.herokids.app
   - **SKU:** herokids-001 (eindeutige interne ID)

### 7.2 App-Informationen

#### Beschreibung (Deutsch):

```
HeroKids macht Haushaltsaufgaben zum Abenteuer! 

Verwandle alltägliche Aufgaben in spannende Missionen für deine Kinder. Mit Punkten, Belohnungen und Leaderboards lernen Kinder spielerisch Verantwortung.

FUNKTIONEN:
- Aufgaben erstellen und verwalten
- Punkte und Belohnungen System
- Familien-Leaderboard
- Ueber 100 freischaltbare Charakter-Skins
- Echtzeit-Synchronisation fuer die ganze Familie
- Kindgerechtes Dashboard ab 6 Jahren
- Mehrsprachig (8 Sprachen)

PERFEKT FUER FAMILIEN:
- Eltern erstellen Aufgaben und Belohnungen
- Kinder erledigen Aufgaben und sammeln Punkte
- Gemeinsame Erfolge feiern

Starte jetzt und mach deine Kinder zu echten Helden!
```

#### Keywords (Deutsch):

```
Kinder,Aufgaben,Familie,Belohnungen,Haushalt,Gamification,Eltern,Hausarbeit,Motivation,Punkte
```

#### Description (English):

```
HeroKids turns household chores into adventures!

Transform everyday tasks into exciting missions for your kids. With points, rewards, and leaderboards, children learn responsibility through play.

FEATURES:
- Create and manage tasks
- Points and rewards system
- Family leaderboard
- Over 100 unlockable character skins
- Real-time sync for the whole family
- Kid-friendly dashboard for ages 6+
- Multilingual support (8 languages)

PERFECT FOR FAMILIES:
- Parents create tasks and rewards
- Kids complete tasks and earn points
- Celebrate achievements together

Start now and turn your kids into real heroes!
```

#### Keywords (English):

```
kids,chores,family,rewards,household,gamification,parents,tasks,motivation,points
```

### 7.3 Screenshots

Du brauchst Screenshots für:
- **6.7" Display** (iPhone 15 Pro Max): 1290 x 2796 px
- **6.5" Display** (iPhone 14 Plus): 1284 x 2778 px
- **5.5" Display** (iPhone 8 Plus): 1242 x 2208 px
- **12.9" Display** (iPad Pro): 2048 x 2732 px

Erstelle Screenshots mit dem Simulator oder verwende ein Tool wie Figma/Canva.

### 7.4 Altersfreigabe

Bei der Altersfreigabe-Fragebogen:
- Keine Gewalt, keine Käufe in der App (außer Abo)
- Empfohlene Einstufung: **4+**

### 7.5 Datenschutzerklärung

Die Datenschutzseite ist bereits in der App integriert:

**Privacy Policy URL:** `https://DEINE-APP-URL.replit.app/privacy`

Ersetze `DEINE-APP-URL` mit deiner tatsächlichen Replit-URL.

## Schritt 8: Review einreichen

1. Fülle alle Pflichtfelder in App Store Connect aus
2. Lade die Screenshots hoch
3. Klicke "Add for Review"
4. Klicke "Submit for Review"

### Review-Dauer:
- Erste Review: 1-3 Tage
- Updates: 1-2 Tage

### Häufige Ablehnungsgründe:
- Fehlende Datenschutzerklärung
- App stürzt ab
- Unvollständige App-Beschreibung
- Fehlende Screenshots

## Schnelle Befehle (Zusammenfassung)

```bash
# Web-App bauen
npm run build

# iOS synchronisieren
npx cap sync ios

# In Xcode öffnen
npx cap open ios
```

## Hilfreiche Links

- Apple Developer: https://developer.apple.com
- App Store Connect: https://appstoreconnect.apple.com
- App Store Review Guidelines: https://developer.apple.com/app-store/review/guidelines/
- Capacitor Docs: https://capacitorjs.com/docs/ios

## Troubleshooting

### "Code Signing Error"
→ Stelle sicher, dass du in Xcode mit deinem Developer Account angemeldet bist

### "App crashes on launch"
→ Prüfe, dass `npm run build` erfolgreich war und `dist/public` existiert

### "App crashes when taking a photo"
→ Die Kamera-Berechtigungen fehlen in Info.plist. Schritt 3b in dieser Anleitung ausführen.
→ Danach `npx cap sync ios` ausführen und die App neu auf das Gerät installieren.

### "White screen in app"
→ Server-URL in capacitor.config.ts prüfen - für Production sollte die App lokal funktionieren

---

Bei Fragen: Die Capacitor-Dokumentation (https://capacitorjs.com) ist sehr hilfreich!
