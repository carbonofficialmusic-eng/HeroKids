import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.herokids.com',
  appName: 'HeroKids',
  webDir: 'dist/public',
  server: {
    // TESTMODUS: App lädt direkt von herokids.app (kein lokaler Build nötig).
    // Für App-Store-Release: Diese beiden Zeilen auskommentieren,
    // dann `npm run build && npx cap sync` ausführen.
    url: 'https://herokids.app',
    allowNavigation: ['herokids.app'],
    androidScheme: 'https',
    iosScheme: 'https',
  },
  ios: {
    contentInset: 'never',
    preferredContentMode: 'mobile',
    scheme: 'HeroKids',
  },
  plugins: {
    StatusBar: {
      overlay: true,
      style: 'LIGHT',
    },
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#14b8a6',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
  },
};

export default config;
