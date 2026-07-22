import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.herokids.com',
  appName: 'Little Champs',
  webDir: 'dist/public',
  server: {
    // TESTMODUS: App lädt direkt von littlechamps.net (kein lokaler Build nötig).
    // Für App-Store-Release: Diese beiden Zeilen auskommentieren,
    // dann `npm run build && npx cap sync` ausführen.
    url: 'https://littlechamps.net',
    allowNavigation: ['littlechamps.net'],
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scheme: 'LittleChamps',
  },
  plugins: {
    StatusBar: {
      overlay: true,
      style: 'LIGHT',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#4a4a4a',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
