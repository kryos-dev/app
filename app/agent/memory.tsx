import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { Button, Card, Input, Row, Screen, Spinner, Switch, Text } from '../../components/ui';
import * as dash from '../../lib/api/dashboard';
import { errMsg, show } from '../../lib/api/agent-extra';
import type { MemoryProviderConfig, MemoryState } from '../../lib/types';

// contracts 7: the API exposes provider selection/config and reset. builtin_files content shape is
// unverified, so it is shown read-only.
// No dashboard route reads or writes memory file content, so the files are shown read-only.
// TODO: shape of `providers` is unverified; names are read from an array of strings/objects or object keys.
const providerNames = (p: unknown): string[] =>
  Array.isArray(p)
    ? p.map((x) => (typeof x === 'string' ? x : String((x as { name?: string })?.name ?? '')))
    : p && typeof p === 'object'
      ? Object.keys(p)
      : [];

export default function Memory() {
  const router = useRouter();
  const [m, setM] = useState<MemoryState | null>(null);
  const [cfg, setCfg] = useState<MemoryProviderConfig | null>(null);
  const [vals, setVals] = useState<Record<string, unknown>>({});
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const s = await dash.memory.get();
      setM(s);
      if (s.active) {
        const c = await dash.memory.providerConfig.get(s.active);
        setCfg(c);
        // Secrets are write-only: start blank and send only what the user types.
        setVals(Object.fromEntries(c.fields.filter((f) => f.kind !== 'secret').map((f) => [f.key, f.value])));
      } else setCfg(null);
    } catch (e) {
      setMsg(errMsg(e));
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const act = async (f: () => Promise<unknown>) => {
    setBusy(true);
    setMsg('');
    try {
      await f();
      await load();
      setMsg('Done');
    } catch (e) {
      setMsg(errMsg(e));
    }
    setBusy(false);
  };

  if (!m && !msg) return <Screen><Spinner /></Screen>;
  return (
    <Screen scroll>
      <Row title="< Back" onPress={() => router.back()} />
      <Text variant="title">Memory</Text>
      {msg ? <Text variant={msg === 'Done' ? 'muted' : 'error'}>{msg}</Text> : null}
      {m ? (
        <>
          <Text variant="heading">{`Provider: ${m.active ?? 'none'}`}</Text>
          {providerNames(m.providers).map((p) => (
            <Button key={p} title={p === m.active ? `${p} (active)` : p} variant={p === m.active ? 'primary' : 'ghost'} disabled={busy || p === m.active} onPress={() => act(() => dash.memory.setProvider(p))} />
          ))}
          {cfg ? (
            <Card>
              <Text variant="heading">{cfg.label}</Text>
              {cfg.fields.map((f) => (
                <Card key={f.key}>
                  <Text>{f.label}</Text>
                  {f.description ? <Text variant="muted">{f.description}</Text> : null}
                  {f.kind === 'bool' ? (
                    <Switch value={!!vals[f.key]} onValueChange={(v) => setVals((o) => ({ ...o, [f.key]: v }))} />
                  ) : (
                    <Input
                      secureTextEntry={f.kind === 'secret'}
                      placeholder={f.kind === 'secret' ? (f.is_set ? '(set, type to replace)' : '(not set)') : f.kind}
                      value={f.kind === 'secret' ? String(vals[f.key] ?? '') : show(vals[f.key])}
                      keyboardType={f.kind === 'number' ? 'numeric' : 'default'}
                      onChangeText={(t) => setVals((o) => ({ ...o, [f.key]: f.kind === 'number' && t.trim() !== '' && !isNaN(Number(t)) ? Number(t) : t }))}
                    />
                  )}
                </Card>
              ))}
              <Button
                title="Save provider config"
                loading={busy}
                onPress={() =>
                  act(() => dash.memory.providerConfig.put(cfg.name, Object.fromEntries(Object.entries(vals).filter(([k, v]) => v !== '' && v !== undefined))))
                }
              />
            </Card>
          ) : null}
          <Text variant="muted">Memory content is edited by the agent itself</Text>
          <Text variant="heading">Built-in memory</Text>
          <Card><Text variant="muted">{show(m.builtin_files?.memory) || 'empty'}</Text></Card>
          <Text variant="heading">User profile</Text>
          <Card><Text variant="muted">{show(m.builtin_files?.user) || 'empty'}</Text></Card>
          <Button title="Reset memory" variant="danger" disabled={busy} onPress={() => act(() => dash.memory.reset('memory'))} />
          <Button title="Reset user" variant="danger" disabled={busy} onPress={() => act(() => dash.memory.reset('user'))} />
          <Button title="Reset all" variant="danger" disabled={busy} onPress={() => act(() => dash.memory.reset('all'))} />
        </>
      ) : null}
    </Screen>
  );
}
