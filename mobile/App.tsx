import React from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WalletContextProvider } from './src/components/WalletProvider';
import { WebSocketSync } from './src/components/WebSocketSync';
import AppNavigator from './src/navigation/AppNavigator';

// Gracefully handle if Privy is not present in build (mocking fallback)
let PrivyProvider: any = ({ children }: any) => <>{children}</>;
try {
  const privyExpo = require('@privy-io/expo');
  if (privyExpo.PrivyProvider) {
    PrivyProvider = privyExpo.PrivyProvider;
  }
} catch (e) {
  console.warn("Privy SDK provider not initialized; running in hot wallet sandbox mode.");
}

const PRIVY_APP_ID = process.env.EXPO_PUBLIC_PRIVY_APP_ID || 'cmq8lxyxv003x0dlbupruhc22';
const PRIVY_CLIENT_ID = process.env.EXPO_PUBLIC_PRIVY_CLIENT_ID || 'client-WY6aGJUvV2184uTWs2CPmP1heQTyhtyAjgHTWWKaMUkBG';

export default function App() {
  return (
    <PrivyProvider 
      appId={PRIVY_APP_ID}
      clientId={PRIVY_CLIENT_ID}
      config={{
        appearance: {
          theme: 'dark',
          accentColor: '#39ff14', // shitmarket green
        }
      }}
    >
      <WalletContextProvider>
        <SafeAreaProvider>
          <WebSocketSync />
          <AppNavigator />
        </SafeAreaProvider>
      </WalletContextProvider>
    </PrivyProvider>
  );
}
