import Constants from 'expo-constants';

const getLocalIP = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return 'localhost';
  const ip = hostUri.split(':')[0];
  return ip || 'localhost';
};

const localIp = getLocalIP();

export const INDEXER_URL =
  process.env.EXPO_PUBLIC_INDEXER_API_URL ||
  process.env.NEXT_PUBLIC_INDEXER_API_URL ||
  (__DEV__ ? `http://${localIp}:3001` : 'https://shitmarket-indexer.onrender.com');

export const WS_URL =
  process.env.EXPO_PUBLIC_WS_URL ||
  process.env.NEXT_PUBLIC_WS_URL ||
  (__DEV__ ? `ws://${localIp}:3002` : 'ws://shitmarket-indexer.onrender.com');

