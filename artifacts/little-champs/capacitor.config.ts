import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'app.herokids.com',
  appName: 'Little Champs',
  webDir: 'dist/public',
  server: {
    // Online-Oberfläche auch für App-Store-Builds beibehalten.
    // Entfernen dieser URL würde auf die lokal gebündelte Oberfläche umstellen
    // und damit Webveröffentlichungen ohne neues iOS-Update verhindern.
    // Vom Workspace-Root: pnpm run ios:prepare (nur die Handy-App).
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
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'banner', 'list'],
    },
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
