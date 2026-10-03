import { useCallback, useRef, useState } from 'react';
import { FlatList } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Badge, Button, Card, Empty, Input, Row, Screen, Spinner, Switch, Text } from '../../components/ui';
import * as dash from '../../lib/api/dashboard';
import { errMsg, runOAuth, useGo } from '../../lib/api/agent-extra';
import type { McpServer } from '../../lib/types';

type Mode = 'list' | 'add' | 'catalog';

export default function Connectors() {
  const router = useRouter();
  const go = useGo();
  const [items, setItems] = useState<McpServer[] | null>(null);
  const [mode, setMode] = useState<Mode>('list');
  const [err, setErr] = useState('');
  const [res, setRes] = useState<Record<string, string>>({});
  const stop = useRef(false);

  const load = useCallback(() => {
    stop.current = false;
    dash.mcp.list().then((r) => setItems(r.servers)).catch((e) => setErr(errMsg(e)));
    return () => {
      stop.current = true;
    };
  }, []);
  useFocusEffect(load);

  const say = (n: string, m: string) => setRes((o) => ({ ...o, [n]: m }));
  const toggle = async (s: McpServer, enabled: boolean) => {
    setItems((o) => o && o.map((x) => (x.name === s.name ? { ...x, enabled } : x)));
    try {
      await dash.mcp.setEnabled(s.name, enabled);
    } catch (e) {
      setErr(errMsg(e));
      load();
    }
  };
  const test = async (n: string) => {
    say(n, 'Testing...');
    try {
      const r = await dash.mcp.test(n);
      say(n, r.ok ? `${r.tools?.length ?? 0} tools` : r.error ?? 'failed');
    } catch (e) {
      say(n, errMsg(e));
    }
  };
  const auth = async (n: string) => {
    say(n, 'Authorizing...');
    try {
      const f = await runOAuth(n, () => stop.current, (f) => say(n, `auth: ${f.status}`));
      say(n, f.status === 'approved' ? `Authorized, ${f.tools?.length ?? 0} tools` : f.error ?? 'auth failed');
    } catch (e) {
      say(n, errMsg(e));
    }
  };
  const done = () => {
    setMode('list');
    load();
  };

  const header = (
    <>
      <Row title="< Back" onPress={() => router.back()} />
      <Text variant="title">Connectors</Text>
      {err ? <Text variant="error">{err}</Text> : null}
      <Button title="Add connector" variant="ghost" onPress={() => setMode(mode === 'add' ? 'list' : 'add')} />
      <Button title="Catalog" variant="ghost" onPress={() => setMode(mode === 'catalog' ? 'list' : 'catalog')} />
      {mode === 'add' ? <AddForm onDone={done} /> : null}
      {mode === 'catalog' ? <Catalog onDone={done} /> : null}
    </>
  );

  if (!items && !err) return <Screen><Spinner /></Screen>;
  return (
    <Screen>
      <FlatList
        data={items ?? []}
        keyExtractor={(s) => s.name}
        contentContainerStyle={{ gap: 8 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={<Empty message="No connectors" />}
        renderItem={({ item }) => (
          <Card>
            <Row
              title={item.name}
              subtitle={item.url ?? [item.command, ...(item.args ?? [])].filter(Boolean).join(' ')}
              onPress={() => go(`/agent/connector/${encodeURIComponent(item.name)}`)}
              right={
                <>
                  <Badge label={item.transport} />
                  <Switch value={item.enabled} onValueChange={(v) => toggle(item, v)} />
                </>
              }
            />
            <Button title="Test" variant="ghost" onPress={() => test(item.name)} />
            {item.auth === 'oauth' ? <Button title="Authorize" variant="ghost" onPress={() => auth(item.name)} /> : null}
            {res[item.name] ? <Text variant="muted">{res[item.name]}</Text> : null}
          </Card>
        )}
      />
    </Screen>
  );
}

const parseEnv = (t: string): Record<string, string> =>
  Object.fromEntries(
    t
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.includes('='))
      .map((l) => [l.slice(0, l.indexOf('=')).trim(), l.slice(l.indexOf('=') + 1)]),
  );

function AddForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [command, setCommand] = useState('');
  const [args, setArgs] = useState('');
  const [env, setEnv] = useState('');
  const [auth, setAuth] = useState<'none' | 'oauth' | 'header'>('none');
  const [bearer, setBearer] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      const u = url.trim();
      await dash.mcp.create({
        name: name.trim(),
        ...(u ? { url: u } : { command: command.trim(), args: args.trim() ? args.trim().split(/\s+/) : [] }),
        env: parseEnv(env),
        auth,
        ...(auth === 'header' && bearer ? { bearer_token: bearer } : {}),
      });
      onDone();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  };

  return (
    <Card>
      <Input placeholder="name" value={name} onChangeText={setName} />
      <Input placeholder="url (http transport)" value={url} onChangeText={setUrl} keyboardType="url" />
      <Text variant="muted">or command + args (stdio)</Text>
      <Input placeholder="command" value={command} onChangeText={setCommand} editable={!url.trim()} />
      <Input placeholder="args (space separated)" value={args} onChangeText={setArgs} editable={!url.trim()} />
      <Input placeholder={'env, one KEY=value per line'} value={env} onChangeText={setEnv} multiline style={{ minHeight: 80, textAlignVertical: 'top' }} />
      <Text variant="muted">Auth</Text>
      {(['none', 'oauth', 'header'] as const).map((a) => (
        <Button key={a} title={a === auth ? `${a} (selected)` : a} variant={a === auth ? 'primary' : 'ghost'} onPress={() => setAuth(a)} />
      ))}
      {auth === 'header' ? <Input placeholder="bearer token" value={bearer} onChangeText={setBearer} secureTextEntry /> : null}
      {err ? <Text variant="error">{err}</Text> : null}
      <Button title="Add" onPress={save} loading={busy} disabled={!name.trim() || !(url.trim() || command.trim())} />
    </Card>
  );
}

// Catalog entry shape is only in source (contracts 5, mcp.py:439); read fields defensively.
// TODO: entries that need env values cannot be filled in yet; install sends env {}.
function Catalog({ onDone }: { onDone: () => void }) {
  const [entries, setEntries] = useState<Record<string, unknown>[] | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState('');

  useFocusEffect(
    useCallback(() => {
      dash.mcp.catalog().then((r) => setEntries(r.entries ?? [])).catch((e) => setMsg(errMsg(e)));
    }, []),
  );

  const install = async (name: string) => {
    setBusy(name);
    setMsg('');
    try {
      await dash.mcp.catalogInstall(name);
      onDone();
    } catch (e) {
      setMsg(errMsg(e));
    }
    setBusy('');
  };

  if (!entries && !msg) return <Spinner />;
  return (
    <Card>
      {msg ? <Text variant="error">{msg}</Text> : null}
      {entries?.map((e, i) => {
        const name = String(e.name ?? e.id ?? i);
        return (
          <Row
            key={name}
            title={name}
            subtitle={typeof e.description === 'string' ? e.description : undefined}
            right={
              e.installed === true ? (
                <Badge label="installed" tone="accent" />
              ) : (
                <Button title="Install" onPress={() => install(name)} loading={busy === name} disabled={!!busy} />
              )
            }
          />
        );
      })}
    </Card>
  );
}
