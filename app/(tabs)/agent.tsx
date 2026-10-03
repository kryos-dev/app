import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { Badge, Row, Screen, Text } from '../../components/ui';
import * as dash from '../../lib/api/dashboard';
import { useGo } from '../../lib/api/agent-extra';

type Counts = { skills?: string; connectors?: string; scheduled?: string; memory?: string };

export default function Agent() {
  const go = useGo();
  const [c, setC] = useState<Counts>({});

  // Counts are fetched on focus; a failed call leaves the badge as "?".
  useFocusEffect(
    useCallback(() => {
      const n = (p: Promise<number | string>, k: keyof Counts) =>
        p.then((v) => setC((o) => ({ ...o, [k]: String(v) }))).catch(() => setC((o) => ({ ...o, [k]: '?' })));
      n(dash.skills.list().then((r) => r.length), 'skills');
      n(dash.mcp.list().then((r) => r.servers.length), 'connectors');
      n(dash.cron.list().then((r) => r.length), 'scheduled');
      n(dash.memory.get().then((r) => r.active ?? 'off'), 'memory');
    }, []),
  );

  const rows: [string, keyof Counts, string][] = [
    ['Skills', 'skills', '/agent/skills'],
    ['Connectors', 'connectors', '/agent/connectors'],
    ['Scheduled', 'scheduled', '/agent/scheduled'],
    ['Memory', 'memory', '/agent/memory'],
  ];
  return (
    <Screen scroll>
      <Text variant="title">Agent</Text>
      {rows.map(([title, k, path]) => (
        <Row key={k} title={title} onPress={() => go(path)} right={<Badge label={c[k] ?? '...'} tone="accent" />} />
      ))}
    </Screen>
  );
}
