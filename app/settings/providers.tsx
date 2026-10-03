import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, Input, Row, Screen, Text } from '../../components/ui';
import * as dash from '../../lib/api/dashboard';
import * as WebBrowser from 'expo-web-browser';
import { errText, waitForGateway } from '../../lib/api/apps-settings-extra';
import type { EnvVar } from '../../lib/types';

export default function Providers() {
  const router = useRouter();
  const [env, setEnv] = useState<Record<string, EnvVar>>({});
  const [key, setKey] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const [connected, setConnected] = useState(false);
  const [gwBusy, setGwBusy] = useState(false);
  const [newName, setNewName] = useState('');
  const [newVal, setNewVal] = useState('');
  const [envMsg, setEnvMsg] = useState('');

  const load = useCallback(() => {
    dash.listEnv().then(setEnv).catch((e) => setEnvMsg(errText(e)));
  }, []);
  useEffect(load, [load]);

  const connect = async () => {
    if (!key.trim()) return setMsg('Enter the key');
    setBusy(true);
    setMsg('');
    setConnected(false);
    try {
      // The opencode CLI the agent drives reads OPENCODE_API_KEY; the Hermes provider reads OPENCODE_GO_API_KEY.
      await dash.setEnv('OPENCODE_GO_API_KEY', key.trim());
      await dash.setEnv('OPENCODE_API_KEY', key.trim());
      setKey('');
      setConnected(true);
      setMsg('Saved. Restart the gateway to apply.');
      load();
    } catch (e) {
      setMsg(errText(e));
    } finally {
      setBusy(false);
    }
  };

  const restart = async () => {
    setGwBusy(true);
    setMsg('Restarting...');
    try {
      await dash.gatewayRestart();
      setMsg((await waitForGateway((t) => setMsg(`Waiting for gateway (${t}s)`))) ? 'Gateway is back' : 'Timed out after 90 s');
    } catch (e) {
      setMsg(errText(e));
    }
    setGwBusy(false);
  };

  const [dsKey, setDsKey] = useState('');
  const [dsMsg, setDsMsg] = useState('');
  const [dsBusy, setDsBusy] = useState(false);
  const [dsSaved, setDsSaved] = useState(false);
  const connectDeepseek = async () => {
    if (!dsKey.trim()) return setDsMsg('Enter the key');
    setDsBusy(true);
    setDsMsg('');
    try {
      await dash.setEnv('DEEPSEEK_API_KEY', dsKey.trim());
      setDsKey('');
      setDsSaved(true);
      setDsMsg('Restart the gateway, then pick a DeepSeek model in Settings');
      load();
    } catch (e) {
      setDsMsg(errText(e));
    }
    setDsBusy(false);
  };

  // ChatGPT (Codex) device-code sign-in: start, show the code, poll until terminal or expired.
  const [codex, setCodex] = useState<dash.OauthProvider | null>(null);
  const [cx, setCx] = useState<dash.OauthStart | null>(null);
  const [cxMsg, setCxMsg] = useState('');
  const [cxBusy, setCxBusy] = useState(false);
  const stopPoll = useRef<() => void>(() => {});
  const loadCodex = useCallback(
    () =>
      dash.providerOauth
        .list()
        .then((r) => setCodex(r.providers.find((p) => p.id === 'openai-codex') ?? null))
        .catch((e) => setCxMsg(errText(e))),
    [],
  );
  useEffect(() => {
    loadCodex();
    return () => stopPoll.current();
  }, [loadCodex]);
  const connectCodex = async () => {
    setCxBusy(true);
    setCxMsg('');
    stopPoll.current();
    try {
      const s = await dash.providerOauth.start('openai-codex');
      setCx(s);
      let live = true;
      stopPoll.current = () => {
        live = false;
      };
      const end = Date.now() + (s.expires_in || 900) * 1000;
      while (live && Date.now() < end) {
        await new Promise((r) => setTimeout(r, (s.poll_interval || 5) * 1000));
        if (!live) return;
        const p = await dash.providerOauth.poll('openai-codex', s.session_id);
        if (p.status === 'pending') continue;
        setCx(null);
        setCxMsg(p.status === 'approved' ? 'Connected' : p.error_message || `Sign-in ${p.status}`);
        await loadCodex();
        return;
      }
      if (live) {
        setCx(null);
        setCxMsg('Sign-in timed out');
      }
    } catch (e) {
      setCx(null);
      setCxMsg(errText(e));
    } finally {
      setCxBusy(false);
    }
  };

  const [ccToken, setCcToken] = useState('');
  const [ccMsg, setCcMsg] = useState('');
  const [ccBusy, setCcBusy] = useState(false);
  const [ccSaved, setCcSaved] = useState(false);
  const saveClaude = async () => {
    if (!ccToken.trim()) return setCcMsg('Enter the token');
    setCcBusy(true);
    setCcMsg('');
    try {
      await dash.setEnv('CLAUDE_CODE_OAUTH_TOKEN', ccToken.trim());
      setCcToken('');
      setCcSaved(true);
      setCcMsg('Saved. Restart the gateway to apply.');
      load();
    } catch (e) {
      setCcMsg(errText(e));
    }
    setCcBusy(false);
  };

  const names = Object.keys(env).sort();

  return (
    <Screen scroll>
      <Button title="Back" variant="ghost" onPress={() => router.back()} />
      <Text variant="title">Providers</Text>

      <Card>
        <Text variant="heading">OpenCode Go</Text>
        <Input value={key} onChangeText={setKey} placeholder="API key" secureTextEntry />
        <Button title="Connect" loading={busy} onPress={connect} />
        {msg ? <Text variant="muted">{msg}</Text> : null}
        {connected && <Button title="Restart gateway" variant="ghost" loading={gwBusy} onPress={restart} />}
      </Card>

      <Card>
        <Text variant="heading">DeepSeek</Text>
        <Input value={dsKey} onChangeText={setDsKey} placeholder="API key" secureTextEntry />
        <Button title="Connect" loading={dsBusy} onPress={connectDeepseek} />
        {dsMsg ? <Text variant="muted">{dsMsg}</Text> : null}
        {dsSaved && <Button title="Restart gateway" variant="ghost" loading={gwBusy} onPress={restart} />}
      </Card>

      <Card>
        <Text variant="heading">ChatGPT (Codex subscription)</Text>
        <Badge label={codex?.status.logged_in ? 'connected' : 'not connected'} tone={codex?.status.logged_in ? 'accent' : 'muted'} />
        {cx ? (
          <>
            <Text variant="title" selectable>
              {cx.user_code}
            </Text>
            {Platform.OS === 'web' && (
              <Button title="Copy code" variant="ghost" onPress={() => navigator.clipboard?.writeText(cx.user_code)} />
            )}
            <Button title="Open sign-in page" onPress={() => WebBrowser.openBrowserAsync(cx.verification_url)} />
            <Text variant="muted">Waiting for approval...</Text>
          </>
        ) : (
          <Button title={codex?.status.logged_in ? 'Reconnect' : 'Connect'} loading={cxBusy} onPress={connectCodex} />
        )}
        {codex?.status.logged_in && codex.disconnectable && !cx && (
          <Button
            title="Disconnect"
            variant="danger"
            onPress={() =>
              dash.providerOauth
                .disconnect('openai-codex')
                .then(loadCodex)
                .catch((e) => setCxMsg(errText(e)))
            }
          />
        )}
        {codex?.status.logged_in && !codex.disconnectable && codex.disconnect_command ? (
          <Text variant="muted">{codex.disconnect_command}</Text>
        ) : null}
        {cxMsg ? <Text variant="muted">{cxMsg}</Text> : null}
      </Card>

      <Card>
        <Text variant="heading">Claude (subscription setup token)</Text>
        <Input value={ccToken} onChangeText={setCcToken} placeholder="Setup token" secureTextEntry />
        <Text variant="muted">Run `claude setup-token` on your computer and paste the result</Text>
        <Button title="Save" loading={ccBusy} onPress={saveClaude} />
        {ccMsg ? <Text variant="muted">{ccMsg}</Text> : null}
        {ccSaved && <Button title="Restart gateway" variant="ghost" loading={gwBusy} onPress={restart} />}
      </Card>

      <Card>
        <Text variant="heading">Environment keys</Text>
        <Input value={newName} onChangeText={setNewName} placeholder="NAME" autoCapitalize="characters" />
        <Input value={newVal} onChangeText={setNewVal} placeholder="Value" secureTextEntry />
        <Button
          title="Set"
          disabled={!newName.trim() || !newVal}
          onPress={async () => {
            try {
              await dash.setEnv(newName.trim(), newVal);
              setNewName('');
              setNewVal('');
              setEnvMsg('');
              load();
            } catch (e) {
              setEnvMsg(errText(e));
            }
          }}
        />
        {envMsg ? <Text variant="error">{envMsg}</Text> : null}
        {names.map((n) => (
          <Row
            key={n}
            title={n}
            subtitle={env[n].is_set ? env[n].redacted_value ?? 'set' : 'not set'}
            right={
              <>
                <Badge label={env[n].is_set ? 'set' : 'empty'} tone={env[n].is_set ? 'accent' : 'muted'} />
                {env[n].is_set && (
                  <Button
                    title="Delete"
                    variant="danger"
                    onPress={() =>
                      dash
                        .deleteEnv(n)
                        .then(load)
                        .catch((e) => setEnvMsg(errText(e)))
                    }
                  />
                )}
              </>
            }
          />
        ))}
      </Card>
    </Screen>
  );
}
