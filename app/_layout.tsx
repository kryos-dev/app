import { useEffect, useState } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Spinner } from '../components/ui';
import { AuthContext } from '../lib/auth';
import { loadSettings } from '../lib/config';
import { loadGatewayKey, onAuthExpired } from '../lib/api/http';
import * as dash from '../lib/api/dashboard';
import { colors } from '../lib/theme';

export default function Layout() {
  const [ready, setReady] = useState(false);
  const [signedIn, setSignedIn] = useState(false);

  useEffect(() => {
    (async () => {
      await loadSettings();
      const key = await loadGatewayKey();
      try {
        await dash.me();
        setSignedIn(!!key);
      } catch {
        setSignedIn(false);
      }
      setReady(true);
    })();
    return onAuthExpired(() => setSignedIn(false));
  }, []);

  if (!ready) {
    return (
      <SafeAreaProvider>
        <Spinner />
      </SafeAreaProvider>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthContext.Provider value={{ signedIn, setSignedIn }}>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
          <Stack.Protected guard={signedIn}>
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="chat/[id]" />
            <Stack.Screen name="apps/[id]" />
            <Stack.Screen name="settings/providers" />
            <Stack.Screen name="agent/connector/[name]" />
            <Stack.Screen name="agent/connectors" />
            <Stack.Screen name="agent/job/[id]" />
            <Stack.Screen name="agent/memory" />
            <Stack.Screen name="agent/scheduled" />
            <Stack.Screen name="agent/skill/[name]" />
            <Stack.Screen name="agent/skills" />
          </Stack.Protected>
          <Stack.Protected guard={!signedIn}>
            <Stack.Screen name="(auth)/sign-in" />
          </Stack.Protected>
        </Stack>
      </AuthContext.Provider>
    </SafeAreaProvider>
  );
}
