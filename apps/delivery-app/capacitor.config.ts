import type { CapacitorConfig } from '@capacitor/cli';

/**
 * Live-reload target for `nx run delivery-app:cap-serve` — points the native shell at the Nx
 * dev server on the host machine's LAN IP (set CAP_SERVER_URL, e.g. http://192.168.1.20:4202)
 * instead of the bundled `webDir`. Unset in every packaged/production build.
 */
const liveReloadUrl = process.env['CAP_SERVER_URL'];

const config: CapacitorConfig = {
  appId: 'com.patheyaexpress.delivery',
  appName: 'Patheya Express Delivery',
  webDir: '../../dist/apps/delivery-app/browser',
  server: liveReloadUrl
    ? { url: liveReloadUrl, cleartext: true }
    : { androidScheme: 'https' },
  android: {
    allowMixedContent: false,
  },
  ios: {
    contentInset: 'always',
  },
  plugins: {
    SplashScreen: {
      launchShowDuration: 500,
      launchAutoHide: true,
      backgroundColor: '#ffffff',
      androidSplashResourceName: 'splash',
      showSpinner: false,
    },
    StatusBar: {
      overlaysWebView: false,
    },
    Keyboard: {
      resize: 'body',
      resizeOnFullScreen: true,
    },
  },
};

export default config;
