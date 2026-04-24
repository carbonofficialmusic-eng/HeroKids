import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.herokids.app',
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
    contentInset: 'automatic',
    preferredContentMode: 'mobile',
    scheme: 'HeroKids',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 2000,
      launchAutoHide: true,
      backgroundColor: '#14b8a6',
      showSpinner: false,
      splashFullScreen: true,
      splashImmersive: true,
    },
    // WICHTIG – behebt den breiten Rand nach Tastatur (Make a Wish etc.):
    // resize: 'none' verhindert, dass iOS den WKWebView-Frame beim
    // Erscheinen/Verschwinden der Tastatur physisch verschiebt.
    // Nach dieser Änderung: `npx cap sync` → Xcode → Build → auf iPhone testen.
    Keyboard: {
      resize: 'none',
      style: 'default',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
