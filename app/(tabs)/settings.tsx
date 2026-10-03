import { useCallback, useEffect, useState } from 'react';
import { Linking, Platform } from 'react-native';
import { useRouter, type Href } from 'expo-router';
import Constants from 'expo-constants';
import { Badge, Button, Card, Input, Row, Screen, Text } from '../../components/ui';
import { useAuth } from '../../lib/auth';
import { getSettings, saveSettings, type Settings as ServerSettings } from '../../lib/config';
import * as dash from '../../lib/api/dashboard';
import { errText, signOut, waitForGateway } from '../../lib/api/apps-settings-extra';
import { checkForUpdate, currentBuild, type UpdateInfo } from '../../lib/update';
import type { ModelOptionsResponse } from '../../lib/types';

const isWeb = Platform.OS === 'web';

// Model entries are unknown[] in the contract (section 8); accept strings or objects with id/name.
const modelId = (m: unknown): string =>
  typeof m === 'string' ? m : String((m as { id?: string })?.id ?? (m as { name?: string })?.name ?? '');

export default function SettingsScreen() {
  const router = useRouter();
  const { setSignedIn } = useAuth();
  const [name, setName] = useState('');
  const [s, setS] = useState<ServerSettings>(getSettings());
  const [saved, setSaved] = useState(false);
  const [options, setOptions] = useState<ModelOptionsResponse | null>(null);
  const [current, setCurrent] = useState<{ provider?: string; model?: string }>({});
  const [provSlug, setProvSlug] = useState<string | null>(null);
  const [modelMsg, setModelMsg] = useState('');
  const [confirmTarget, setConfirmTarget] = useState<{ provider: string; model: string } | null>(null);
  const [gwMsg, setGwMsg] = useState('');
  const [gwBusy, setGwBusy] = useState(false);
  const [update, setUpdate] = useState<UpdateInfo | null>(null);

  const loadModel = useCallback(() => {
    dash.model.options().then(setOptions).catch((e) => setModelMsg(errText(e)));
    dash.model.info().then((i) => setCurrent({ provider: i.provider as string, model: i.model as string })).catch(() => {});
  }, []);

  useEffect(() => {
    dash.me().then((m) => setName(m.display_name || m.email || m.user_id)).catch(() => {});
    loadModel();
    checkForUpdate().then(setUpdate);
  }, [loadModel]);

  const logout = async () => {
    await signOut();
    setSignedIn(false);
    router.replace('/(auth)/sign-in' as Href);
  };

  const setModel = async (provider: string, model: string, confirm = false) => {
    setModelMsg('');
    try {
      const r = await dash.model.set({ provider, model, confirm_expensive_model: confirm });
      if (r.confirm_required) {
        setModelMsg(r.confirm_message ?? 'Confirm expensive model');
        setConfirmTarget({ provider, model });
      } else {
        setConfirmTarget(null);
        setCurrent({ provider, model });
        setModelMsg('Model updated');
      }
    } catch (e) {
      setModelMsg(errText(e));
    }
  };

  const restart = async () => {
    setGwBusy(true);
    setGwMsg('Restarting...');
    try {
      await dash.gatewayRestart();
      const ok = await waitForGateway((t) => setGwMsg(`Waiting for gateway (${t}s)`));
      setGwMsg(ok ? 'Gateway is back' : 'Timed out after 90 s');
    } catch (e) {
      setGwMsg(errText(e));
    }
    setGwBusy(false);
  };

  const shown = provSlug ?? current.provider;
  const provider = options?.providers.find((p) => p.slug === shown);

  return (
    <Screen scroll>
      <Text variant="title">Settings</Text>

      {update && (
        <Card>
          <Text variant="heading">Update available: build {update.latest}</Text>
          <Button title="Download APK" onPress={() => Linking.openURL(update.url)} />
        </Card>
      )}

      <Card>
        <Text variant="heading">Account</Text>
        <Text variant="muted">{name || 'Signed in'}</Text>
        <Button title="Log out" variant="danger" onPress={logout} />
      </Card>

      {!isWeb && (
        <Card>
          <Text variant="heading">Servers</Text>
          {(['dashboardBase', 'gatewayBase'] as const).map((k) => (
            <Input
              key={k}
              value={s[k]}
              placeholder={k}
              keyboardType="url"
              onChangeText={(v) => {
                setSaved(false);
                setS({ ...s, [k]: v });
              }}
            />
          ))}
          <Button
            title={saved ? 'Saved' : 'Save'}
            onPress={async () => {
              await saveSettings(s);
              setS(getSettings());
              setSaved(true);
            }}
          />
        </Card>
      )}

      <Card>
        <Text variant="heading">Model</Text>
        <Text variant="muted">{current.model ? `${current.provider ?? ''} / ${current.model}` : 'Current model unknown'}</Text>
        {options?.providers.map((p) => (
          <Row
            key={p.slug}
            title={p.label}
            right={p.slug === shown ? <Badge label="shown" tone="accent" /> : undefined}
            onPress={() => setProvSlug(p.slug)}
          />
        ))}
        {provider?.models
          .map(modelId)
          .filter(Boolean)
          .map((m) => (
            <Row
              key={m}
              title={m}
              right={provider.slug === current.provider && m === current.model ? <Badge label="active" tone="accent" /> : undefined}
              onPress={() => setModel(provider.slug, m)}
            />
          ))}
        {modelMsg ? <Text variant="muted">{modelMsg}</Text> : null}
        {confirmTarget ? <Button title="Confirm" onPress={() => setModel(confirmTarget.provider, confirmTarget.model, true)} /> : null}
      </Card>

      <Card>
        <Text variant="heading">Gateway</Text>
        <Button title="Restart gateway" variant="ghost" loading={gwBusy} onPress={restart} />
        {gwMsg ? <Text variant="muted">{gwMsg}</Text> : null}
        <Button title="Providers" variant="ghost" onPress={() => router.push('/settings/providers' as Href)} />
      </Card>

      <Card>
        <Text variant="heading">About</Text>
        <Text variant="muted">Version {Constants.expoConfig?.version ?? 'unknown'}</Text>
        {!isWeb && <Text variant="muted">Build {currentBuild}</Text>}
        <Button title="Latest release" variant="ghost" onPress={() => Linking.openURL('https://github.com/kryos-dev/app/releases/latest')} />
      </Card>
    </Screen>
  );
}
