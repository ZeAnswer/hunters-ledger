import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.memento.huntersledger',
  appName: "Hunter's Ledger",
  webDir: 'dist',
  android: { allowMixedContent: false },
};

export default config;
