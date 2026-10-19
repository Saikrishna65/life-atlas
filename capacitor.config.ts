import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.lifeatlas.app',
  appName: 'Life Atlas',
  webDir: 'public',
  android: {
    allowMixedContent: true,
  },
  server: {
    url: 'https://life-atlas-eight-five.vercel.app',
    cleartext: true,
    androidScheme: 'https',
  },
};

export default config;
