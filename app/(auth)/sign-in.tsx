import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Button, Card, Input, Screen, Text } from '../../components/ui';
import { useAuth } from '../../lib/auth';
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

  useEffect(() => setSettings(getSettings()), []);

  const finish = async (key: string) => {
    await setGatewayKey(key);
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
          await finish((await dash.revealEnv('API_SERVER_KEY')).value);
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
                {field('opencodeBase', 'OpenCode URL')}
              </Card>
            )}
          </>
        )}
      </KeyboardAvoidingView>
    </Screen>
  );
}
