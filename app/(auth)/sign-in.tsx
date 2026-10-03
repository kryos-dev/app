import { useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, View } from 'react-native';
import { useRouter } from 'expo-router';
import { WebView } from 'react-native-webview';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, space } from '../../lib/theme';
import { Button, Card, Input, Screen, Text } from '../../components/ui';
import { revealAndStoreGatewayKey, useAuth } from '../../lib/auth';
import { getSettings, saveSettings, type Settings } from '../../lib/config';
import { ApiError, setGatewayKey } from '../../lib/api/http';
import * as dash from '../../lib/api/dashboard';

const isWeb = Platform.OS === 'web';

function errMsg(e: unknown): string {
  if (e instanceof ApiError) {
    const b = e.body as { detail?: unknown } | null;
    return typeof b?.detail === 'string' ? b.detail : `Request failed (${e.status})`;
  }
  return e instanceof Error ? e.message : 'Something went wrong';
}

export default function SignIn() {
  const router = useRouter();
  const { setSignedIn } = useAuth();
  const [settings, setSettings] = useState<Settings>(getSettings());
  const [advanced, setAdvanced] = useState(false);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [manualKey, setManualKey] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [sso, setSso] = useState<dash.AuthProvider | null>(null);

  useEffect(() => setSettings(getSettings()), []);

  // A provider that is not password-capable is an OIDC redirect login.
  useEffect(() => {
    dash
      .providers()
      .then((r) => setSso(r.providers.find((p) => !p.supports_password) ?? null))
      .catch(() => {});
  }, []);

  const [ssoOpen, setSsoOpen] = useState(false);
  const ssoDone = useRef(false);

  // Web redirects the page; native runs the login in a WebView whose cookies fetch then shares.
  const ssoLogin = () => {
    if (!sso) return;
    if (isWeb) window.location.assign(`/auth/login?provider=${encodeURIComponent(sso.name)}&next=/`);
    else {
      ssoDone.current = false;
      setSsoOpen(true);
    }
  };

  const onSsoNav = async (n: { url: string }) => {
    if (ssoDone.current || !n.url.startsWith(`${getSettings().dashboardBase}/signed-in`)) return;
    ssoDone.current = true;
    setSsoOpen(false);
    try {
      await finish();
    } catch (e) {
      setManualKey('');
      setError(`Signed in, but the API key could not be fetched (${errMsg(e)}). Paste it below.`);
    }
  };

  const finish = async (key?: string) => {
    if (key) await setGatewayKey(key);
    else await revealAndStoreGatewayKey();
    setSignedIn(true);
    router.replace('/(tabs)/chat');
  };

  const submit = async () => {
    setBusy(true);
    setError('');
    try {
      if (manualKey === null) {
        if (!isWeb) await saveSettings(settings);
        // TODO: provider name is not fixed in the doc; use the first password provider, else 'password'.
        const provider = await dash
          .providers()
          .then((r) => r.providers.find((p) => p.supports_password)?.name ?? 'password')
          .catch(() => 'password');
        await dash.passwordLogin(username, password, provider);
        try {
          await finish();
        } catch (e) {
          setManualKey('');
          setError(`Signed in, but the API key could not be fetched (${errMsg(e)}). Paste it below.`);
        }
      } else {
        if (!manualKey.trim()) return setError('Enter the API key');
        await finish(manualKey.trim());
      }
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  const field = (k: keyof Settings, label: string) => (
    <Input key={k} placeholder={label} value={settings[k]} keyboardType="url" onChangeText={(v) => setSettings({ ...settings, [k]: v })} />
  );

  return (
    <Screen scroll>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ gap: 12 }}>
        <Text variant="title">Kryos</Text>
        {sso && <Button title={sso.display_name || 'Sign in with auth.kryos.dev'} onPress={ssoLogin} />}
        {manualKey === null ? (
          <>
            <Input placeholder="Username" value={username} onChangeText={setUsername} textContentType="username" />
            <Input placeholder="Password" value={password} onChangeText={setPassword} secureTextEntry textContentType="password" onSubmitEditing={submit} />
          </>
        ) : (
          <Input placeholder="API_SERVER_KEY" value={manualKey} onChangeText={setManualKey} secureTextEntry />
        )}
        {error ? <Text variant="error">{error}</Text> : null}
        <Button title={manualKey === null ? 'Sign in' : 'Continue'} onPress={submit} loading={busy} />
        {!isWeb && (
          <>
            <Button title={advanced ? 'Hide advanced' : 'Advanced'} variant="ghost" onPress={() => setAdvanced(!advanced)} />
            {advanced && (
              <Card>
                {field('dashboardBase', 'Dashboard URL')}
                {field('gatewayBase', 'Gateway URL')}
              </Card>
            )}
          </>
        )}
      </KeyboardAvoidingView>
      {!isWeb && sso && (
        <Modal visible={ssoOpen} animationType="slide" onRequestClose={() => setSsoOpen(false)}>
          <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }}>
            <View style={{ padding: space.sm, alignItems: 'flex-start' }}>
              <Button title="Close" variant="ghost" onPress={() => setSsoOpen(false)} />
            </View>
            <WebView
              source={{ uri: `${getSettings().dashboardBase}/auth/login?provider=${encodeURIComponent(sso.name)}&next=/signed-in` }}
              sharedCookiesEnabled
              thirdPartyCookiesEnabled
              javaScriptEnabled
              incognito={false}
              onNavigationStateChange={onSsoNav}
              style={{ flex: 1, backgroundColor: colors.bg }}
            />
          </SafeAreaView>
        </Modal>
      )}
    </Screen>
  );
}
