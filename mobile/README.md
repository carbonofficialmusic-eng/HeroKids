# HeroKids Mobile App

iOS-App für HeroKids, die die Web-App in einem nativen Container lädt.

## Voraussetzungen

1. **Apple Developer Account** (99€/Jahr) - für App Store Submission
2. **Expo Go App** auf deinem iPhone - zum Testen
3. **Node.js** installiert

## Schnellstart

### 1. Dependencies installieren

```bash
cd mobile
npm install
```

### 2. App testen mit Expo Go

```bash
npx expo start
```

Scanne den QR-Code mit deinem iPhone (Expo Go App oder Kamera).

### 3. Web-App URL anpassen

Bearbeite `constants/config.ts` und setze deine published URL:

```typescript
export const APP_CONFIG = {
  WEB_APP_URL: 'https://DEINE-URL.replit.app',
  // ...
};
```

## App Store Submission

### 1. EAS CLI installieren

```bash
npm install -g eas-cli
eas login
```

### 2. EAS Build konfigurieren

```bash
eas build:configure
```

### 3. iOS Build erstellen

```bash
eas build --platform ios
```

### 4. Zu TestFlight hochladen

```bash
eas submit --platform ios
```

## Assets anpassen

Ersetze diese Dateien mit deinen eigenen:

- `assets/icon.png` - App Icon (1024x1024)
- `assets/splash-icon.png` - Splash Screen (512x512)
- `assets/adaptive-icon.png` - Android Adaptive Icon (1024x1024)
- `assets/favicon.png` - Web Favicon (48x48)

## Wichtige Hinweise

- Die App braucht eine Internetverbindung
- Änderungen an der Web-App sind sofort in der iOS-App sichtbar
- Kein App Store Update nötig für Web-App Änderungen
