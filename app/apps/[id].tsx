import { useEffect, useRef, useState } from 'react';
import { BackHandler, Linking, Platform, StyleSheet, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, Empty, Spinner, Text } from '../../components/ui';
import { apps } from '../../lib/apps';
import { colors, space } from '../../lib/theme';

export default function AppDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const app = apps.find((a) => a.id === id);
  const ref = useRef<WebView>(null);
  const [canGoBack, setCanGoBack] = useState(false);

  useEffect(() => {
    if (Platform.OS === 'web' && app) window.location.assign(app.url);
  }, [app]);

  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canGoBack) return false;
      ref.current?.goBack();
      return true;
    });
    return () => sub.remove();
  }, [canGoBack]);

  if (!app) return <Empty message="Unknown app" actionTitle="Back" onAction={() => router.back()} />;
  if (Platform.OS === 'web') return <Spinner />;

  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right', 'bottom']}>
      <View style={s.bar}>
        <Button title="Close" variant="ghost" onPress={() => router.back()} />
        <Text variant="heading" style={s.title} numberOfLines={1}>
          {app.name}
        </Text>
        <Button title="Reload" variant="ghost" onPress={() => ref.current?.reload()} />
        <Button title="Browser" variant="ghost" onPress={() => Linking.openURL(app.url)} />
      </View>
      <WebView
        ref={ref}
        source={{ uri: app.url }}
        sharedCookiesEnabled
        thirdPartyCookiesEnabled
        startInLoadingState
        renderLoading={() => <Spinner />}
        onNavigationStateChange={(n) => setCanGoBack(n.canGoBack)}
        style={s.web}
      />
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  bar: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm },
  title: { flex: 1 },
  web: { flex: 1, backgroundColor: colors.bg },
});
