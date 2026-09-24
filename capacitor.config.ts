import type { CapacitorConfig } from '@capacitor/cli';

// App Android (APK). O mesmo código web é empacotado dentro do APK (funciona offline).
const config: CapacitorConfig = {
  appId: 'com.residuelo.app',
  appName: 'Residuelo',
  webDir: 'dist',
  android: {
    backgroundColor: '#0b0a1f',
  },
};

export default config;
