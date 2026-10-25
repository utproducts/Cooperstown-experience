import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { C } from '@/constants/theme';
import { BackendProvider, useAuth } from '@/data';
import { getPushToken } from '@/lib/push';
import { Platform } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Effects() {
  const { ready, profile, backend } = useAuth();
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready]);
  useEffect(() => {
    if (!profile) return;
    getPushToken()
      .then((token) => (token ? backend.registerPushToken(token, Platform.OS) : undefined))
      .catch(() => {});
  }, [profile, backend]);
  return null;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <BackendProvider>
        <Effects />
        <StatusBar style="dark" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: C.cream },
            headerTintColor: C.navy,
            headerStyle: { backgroundColor: C.cream },
            headerShadowVisible: false,
          }}
        />
      </BackendProvider>
    </SafeAreaProvider>
  );
}
