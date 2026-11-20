import type { CapacitorConfig } from '@capacitor/cli';

// App nativa iOS/Android: stessa web app (dist/) dentro Capacitor.
// Primo avvio: npm run build && npx cap add ios && npx cap add android && npx cap sync
const config: CapacitorConfig = {
  appId: 'app.vastity',
  appName: 'Vastity',
  webDir: 'dist',
  backgroundColor: '#03050c',
  ios: { contentInset: 'never', backgroundColor: '#03050c' },
  android: { backgroundColor: '#03050c' },
  plugins: {
    LocalNotifications: { iconColor: '#9cc2ff' },
  },
};

export default config;
