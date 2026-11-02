import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lifeatlas.app',
  appName: 'Atlas Vault',
  webDir: 'mobile-dist',
  appendUserAgent: 'LifeAtlasApp/1.0',
  android: {
    allowMixedContent: true,
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
