import { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.shodik24.alias',
  appName: 'Alias-Uzbek',
  webDir: 'dist',
  // FIXED: Forces the iOS container to match your app's look
  ios: {
    backgroundColor: '#0f172a', // Matches your App.tsx background exactly
    contentInset: 'never'       // Removes the white 'safe area' bars
  },
  plugins: {
    StatusBar: {
      overlaysWebView: true,    // Allows content to go behind the clock
    }
  }
};

export default config;