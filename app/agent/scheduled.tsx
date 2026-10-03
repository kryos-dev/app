import { useCallback, useState } from 'react';
import { FlatList } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Badge, Button, Empty, Row, Screen, Spinner, Text } from '../../components/ui';
import * as dash from '../../lib/api/dashboard';
import { errMsg, useGo } from '../../lib/api/agent-extra';
import type { CronJob } from '../../lib/types';

const jobId = (j: CronJob) => String(j.id ?? '');
const isPaused = (j: CronJob) => j.enabled === false || j.state === 'paused';

export default function Scheduled() {
  const router = useRouter();
  const go = useGo();
  const [items, setItems] = useState<CronJob[] | null>(null);
  const [err, setErr] = useState('');

  useFocusEffect(
    useCallback(() => {
      dash.cron.list().then(setItems).catch((e) => setErr(errMsg(e)));
    }, []),
  );

  const header = (
    <>
      <Row title="< Back" onPress={() => router.back()} />
      <Text variant="title">Scheduled</Text>
      {err ? <Text variant="error">{err}</Text> : null}
      <Button title="New job" onPress={() => go('/agent/job/new')} />
    </>
  );

  if (!items && !err) return <Screen><Spinner /></Screen>;
  return (
    <Screen>
      <FlatList
        data={items ?? []}
        keyExtractor={(j, i) => jobId(j) || String(i)}
        contentContainerStyle={{ gap: 8 }}
        ListHeaderComponent={header}
        ListEmptyComponent={<Empty message="No scheduled jobs" actionTitle="New job" onAction={() => go('/agent/job/new')} />}
        renderItem={({ item }) => {
          const lr = item.last_run_at ?? '';
          return (
            <Row
              title={item.name || jobId(item)}
              subtitle={`${item.schedule_display ?? (typeof item.schedule === 'string' ? item.schedule : '')}${lr ? ` - last run ${lr}` : ''}`}
              onPress={() => go(`/agent/job/${encodeURIComponent(jobId(item))}`)}
              right={<Badge label={isPaused(item) ? 'paused' : 'enabled'} tone={isPaused(item) ? 'muted' : 'accent'} />}
            />
          );
        }}
      />
    </Screen>
  );
}
