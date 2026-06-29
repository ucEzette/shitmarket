import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, Platform, ActivityIndicator, View } from 'react-native';
import * as SecureStore from 'expo-secure-store';

import { useWalletContext } from '../components/WalletProvider';
import { COLORS, FONTS } from '../utils/theme';
import Header from '../components/Header';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import CreateRoomScreen from '../screens/CreateRoomScreen';
import ParlaysScreen from '../screens/ParlaysScreen';
import LeaderboardScreen from '../screens/LeaderboardScreen';
import PortfolioScreen from '../screens/PortfolioScreen';
import RoomScreen from '../screens/RoomScreen';
import RulesScreen from '../screens/RulesScreen';
import IntroScreen from '../screens/IntroScreen';

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        header: () => <Header />,
        tabBarStyle: {
          backgroundColor: COLORS.trenchBlack,
          borderTopWidth: 1.5,
          borderTopColor: COLORS.border,
          height: Platform.OS === 'ios' ? 88 : 60,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
        },
        tabBarActiveTintColor: COLORS.neonMoon,
        tabBarInactiveTintColor: COLORS.gasmask,
        tabBarLabelStyle: {
          fontFamily: FONTS.mono,
          fontSize: 8,
          fontWeight: 'bold',
          letterSpacing: 0.5,
        },
      }}
    >
      <Tab.Screen
        name="Battlefield"
        component={HomeScreen}
        options={{
          title: 'BATTLEFIELD 💣',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>💣</Text>,
        }}
      />
      <Tab.Screen
        name="Launch"
        component={CreateRoomScreen}
        options={{
          title: 'LAUNCH ARENA ⛏️',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>⛏️</Text>,
        }}
      />
      <Tab.Screen
        name="Parlays"
        component={ParlaysScreen}
        options={{
          title: 'PARLAYS 🚀',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🚀</Text>,
        }}
      />
      <Tab.Screen
        name="Leaderboard"
        component={LeaderboardScreen}
        options={{
          title: 'LEADERBOARD 🏆',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🏆</Text>,
        }}
      />
      <Tab.Screen
        name="HQ"
        component={PortfolioScreen}
        options={{
          title: 'COMMAND HQ 🎖️',
          tabBarIcon: ({ color }) => <Text style={{ color, fontSize: 20 }}>🎖️</Text>,
        }}
      />
    </Tab.Navigator>
  );
}

export default function AppNavigator() {
  const { activeWalletAddress } = useWalletContext();
  const [introPlayed, setIntroPlayed] = React.useState<boolean | null>(null);

  React.useEffect(() => {
    (async () => {
      try {
        const played = await SecureStore.getItemAsync('shitmarket_intro_played');
        setIntroPlayed(played === 'true');
      } catch (e) {
        setIntroPlayed(false);
      }
    })();
  }, []);

  if (introPlayed === null) {
    return (
      <View style={{ flex: 1, backgroundColor: COLORS.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={COLORS.neonMoon} />
      </View>
    );
  }

  if (!introPlayed) {
    return (
      <IntroScreen
        onComplete={async () => {
          try {
            await SecureStore.setItemAsync('shitmarket_intro_played', 'true');
          } catch (e) {
            console.warn("Failed to set intro played state in SecureStore:", e);
          }
          setIntroPlayed(true);
        }}
      />
    );
  }

  return (
    <NavigationContainer>
      <Stack.Navigator
        screenOptions={{
          headerStyle: {
            backgroundColor: COLORS.trenchBlack,
          },
          headerTitleStyle: {
            fontFamily: FONTS.sans,
            fontWeight: '900',
            color: COLORS.white,
          },
          headerTintColor: COLORS.neonMoon,
        }}
      >
        {activeWalletAddress === null ? (
          // Unauthenticated Flow
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />
        ) : (
          // Authenticated Flow
          <>
            <Stack.Screen
              name="Main"
              component={MainTabNavigator}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Room"
              component={RoomScreen}
              options={({ route }: any) => ({
                title: `WAR ROOM`,
              })}
            />
            <Stack.Screen
              name="Rules"
              component={RulesScreen}
              options={{ headerShown: false }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
