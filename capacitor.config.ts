import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lifeatlas.app',
  appName: 'Atlas',
  webDir: 'mobile-dist',
  loggingBehavior: 'none',
  appendUserAgent: 'AtlasApp/1.0',
  android: {
    webContentsDebuggingEnabled: false,
    allowMixedContent: false,
  },
  plugins: {
    CapacitorHttp: { enabled: true },
  },
  server: {
    androidScheme: 'https',
    errorPath: 'offline.html',
  },
};

export default config;
