import { Anton_400Regular, useFonts } from '@expo-google-fonts/anton';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { DialogHost } from '@/components/dialog-host';
import { C } from '@/constants/theme';
import { BackendProvider, useAuth } from '@/data';
import { getPushToken } from '@/lib/push';
import { Platform } from 'react-native';

SplashScreen.preventAutoHideAsync().catch(() => {});

function Effects({ fontsReady }: { fontsReady: boolean }) {
  const { ready, profile, backend } = useAuth();
  useEffect(() => {
    if (ready && fontsReady) SplashScreen.hideAsync().catch(() => {});
  }, [ready, fontsReady]);
  useEffect(() => {
    if (!profile) return;
    getPushToken()
      .then((token) => (token ? backend.registerPushToken(token, Platform.OS) : undefined))
      .catch(() => {});
  }, [profile, backend]);
  return null;
}

export default function RootLayout() {
  // The headline face; if it fails to load, headlines fall back to the system font rather than holding the app.
  const [fontsLoaded, fontError] = useFonts({ Anton_400Regular });
  return (
    <SafeAreaProvider>
      <BackendProvider>
        <Effects fontsReady={fontsLoaded || !!fontError} />
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
        <DialogHost />
      </BackendProvider>
    </SafeAreaProvider>
  );
}
