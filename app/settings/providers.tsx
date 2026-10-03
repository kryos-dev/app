import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'expo-router';
import { Badge, Button, Card, Input, Row, Screen, Text } from '../../components/ui';
import * as dash from '../../lib/api/dashboard';
import * as oc from '../../lib/api/opencode';
import { getOpencodePassword, setOpencodePassword } from '../../lib/api/http';
import { errText, waitForGateway } from '../../lib/api/apps-settings-extra';
import type { EnvVar } from '../../lib/types';

export default function Providers() {
  const router = useRouter();
  const [env, setEnv] = useState<Record<string, EnvVar>>({});
  const [key, setKey] = useState('');
  const [pw, setPw] = useState<string | null>(null); // null = password field hidden
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
      await dash.setEnv('OPENCODE_GO_API_KEY', key.trim());
      let password = pw?.trim() || (await getOpencodePassword()) || '';
      if (!password) {
        try {
          // Reveal is rate limited to 5 per 30 s (contracts section 8).
          password = (await dash.revealEnv('OPENCODE_SERVER_PASSWORD')).value;
        } catch {
          setPw('');
          setMsg('Saved to dashboard. Enter the OpenCode password to finish.');
          return;
        }
      }
      await setOpencodePassword(password);
      await oc.putAuth('opencode-go', key.trim());
      setKey('');
      setConnected(true);
      setMsg('Connected');
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

  const names = Object.keys(env).sort();

  return (
    <Screen scroll>
      <Button title="Back" variant="ghost" onPress={() => router.back()} />
      <Text variant="title">Providers</Text>

      <Card>
        <Text variant="heading">OpenCode Go</Text>
        <Input value={key} onChangeText={setKey} placeholder="API key" secureTextEntry />
        {pw !== null && <Input value={pw} onChangeText={setPw} placeholder="OpenCode server password" secureTextEntry />}
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
