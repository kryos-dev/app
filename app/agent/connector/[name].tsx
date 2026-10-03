import { useCallback, useRef, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, Row, Screen, Spinner, Switch, Text } from '../../../components/ui';
import * as dash from '../../../lib/api/dashboard';
import { errMsg, runOAuth } from '../../../lib/api/agent-extra';
import type { McpServer } from '../../../lib/types';

export default function ConnectorDetail() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const [s, setS] = useState<McpServer | null>(null);
  const [tools, setTools] = useState<{ name: string; description?: string }[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);
  const stop = useRef(false);

  useFocusEffect(
    useCallback(() => {
      stop.current = false;
      dash.mcp.list().then((r) => setS(r.servers.find((x) => x.name === name) ?? null)).catch((e) => setMsg(errMsg(e)));
      return () => {
        stop.current = true;
      };
    }, [name]),
  );

  const run = async (f: () => Promise<void>) => {
    setBusy(true);
    setMsg('');
    try {
      await f();
    } catch (e) {
      setMsg(errMsg(e));
    }
    setBusy(false);
  };
  const test = () =>
    run(async () => {
      const r = await dash.mcp.test(name);
      setTools(r.tools ?? []);
      setMsg(r.ok ? `${r.tools?.length ?? 0} tools` : r.error ?? 'failed');
    });
  const auth = () =>
    run(async () => {
      const f = await runOAuth(name, () => stop.current, (f) => setMsg(`auth: ${f.status}`));
      setTools(f.tools ?? []);
      setMsg(f.status === 'approved' ? `Authorized, ${f.tools?.length ?? 0} tools` : f.error ?? 'auth failed');
    });
  const remove = () =>
    run(async () => {
      await dash.mcp.delete(name);
      router.back();
    });
  const toggle = (enabled: boolean) =>
    run(async () => {
      await dash.mcp.setEnabled(name, enabled);
      setS((o) => o && { ...o, enabled });
    });

  return (
    <Screen scroll>
      <Row title="< Back" onPress={() => router.back()} />
      <Text variant="title">{name}</Text>
      {!s && !msg ? <Spinner /> : null}
      {s ? (
        <Card>
          <Row title="Enabled" right={<Switch value={s.enabled} onValueChange={toggle} disabled={busy} />} />
          <Text variant="muted">{s.url ?? [s.command, ...(s.args ?? [])].join(' ')}</Text>
          <Row title="Transport" right={<Badge label={s.transport} />} />
          <Row title="Auth" right={<Badge label={s.auth ?? 'none'} />} />
          {Object.keys(s.env ?? {}).map((k) => (
            <Text key={k} variant="muted">{`${k}=${s.env[k]}`}</Text>
          ))}
        </Card>
      ) : null}
      <Button title="Test" variant="ghost" onPress={test} disabled={busy} />
      {s?.auth === 'oauth' ? <Button title="Authorize" variant="ghost" onPress={auth} disabled={busy} /> : null}
      {msg ? <Text variant="muted">{msg}</Text> : null}
      {tools.map((t) => (
        <Row key={t.name} title={t.name} subtitle={t.description} />
      ))}
      <Button title="Delete" variant="danger" onPress={remove} disabled={busy || !s} />
    </Screen>
  );
}
