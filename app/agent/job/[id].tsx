import { useCallback, useState } from 'react';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { Badge, Button, Card, Input, Row, Screen, Spinner, Text } from '../../../components/ui';
import * as dash from '../../../lib/api/dashboard';
import { deliveryTargets, errMsg, show } from '../../../lib/api/agent-extra';
import type { CronJob, CronJobCreate } from '../../../lib/types';

const isPaused = (j: CronJob) => j.enabled === false || j.state === 'paused';

// Route id "new" is the create form.
export default function Job() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const isNew = id === 'new';
  const router = useRouter();
  const [job, setJob] = useState<CronJob | null>(null);
  const [name, setName] = useState('');
  const [prompt, setPrompt] = useState('');
  const [schedule, setSchedule] = useState('');
  const [deliver, setDeliver] = useState('');
  const [targets, setTargets] = useState<string[]>([]);
  const [runs, setRuns] = useState<Record<string, unknown>[]>([]);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useFocusEffect(
    useCallback(() => {
      deliveryTargets().then((r) => setTargets(r.targets.map((t) => t.id))).catch(() => {});
      if (isNew) return;
      dash.cron
        .get(id)
        .then((j) => {
          setJob(j);
          setName(String(j.name ?? ''));
          setPrompt(String(j.prompt ?? ''));
          setSchedule(j.schedule_display ?? show(j.schedule && typeof j.schedule === 'object' ? (j.schedule as Record<string, unknown>).expr ?? j.schedule : j.schedule));
          setDeliver(String(j.deliver ?? ''));
        })
        .catch((e) => setMsg(errMsg(e)));
      dash.cron.runs(id).then((r) => setRuns(r.runs ?? [])).catch(() => {});
    }, [id, isNew]),
  );

  const run = async (f: () => Promise<unknown>, back = false) => {
    setBusy(true);
    setMsg('');
    try {
      const r = await f();
      if (back) router.back();
      else if (r && typeof r === 'object' && !isNew) setJob((o) => ({ ...o, ...(r as CronJob) }));
      if (!back) setMsg('Done');
    } catch (e) {
      setMsg(errMsg(e));
    }
    setBusy(false);
  };
  const body = (): CronJobCreate => ({
    name: name.trim() || undefined,
    prompt,
    schedule: schedule.trim(),
    ...(deliver.trim() ? { deliver: deliver.trim() } : {}),
  });

  if (!isNew && !job && !msg) return <Screen><Spinner /></Screen>;
  return (
    <Screen scroll>
      <Row title="< Back" onPress={() => router.back()} />
      <Text variant="title">{isNew ? 'New job' : job?.name || id}</Text>
      {job ? <Badge label={isPaused(job) ? 'paused' : 'enabled'} tone={isPaused(job) ? 'muted' : 'accent'} /> : null}
      <Card>
        <Input placeholder="name" value={name} onChangeText={setName} />
        <Input placeholder="schedule (e.g. 0 9 * * *)" value={schedule} onChangeText={setSchedule} />
        <Input placeholder="prompt" value={prompt} onChangeText={setPrompt} multiline style={{ minHeight: 120, textAlignVertical: 'top' }} autoCapitalize="sentences" />
        <Input placeholder="deliver (origin, local, platform id)" value={deliver} onChangeText={setDeliver} />
        {targets.length ? (
          <Text variant="muted">{`targets: ${['origin', 'local', ...targets].join(', ')}`}</Text>
        ) : null}
        <Button
          title={isNew ? 'Create' : 'Save'}
          loading={busy}
          disabled={!prompt.trim() || !schedule.trim()}
          onPress={() => (isNew ? run(() => dash.cron.create(body()), true) : run(() => dash.cron.update(id, body())))}
        />
      </Card>
      {msg ? <Text variant={msg === 'Done' ? 'muted' : 'error'}>{msg}</Text> : null}
      {!isNew ? (
        <>
          <Button title="Run now" variant="ghost" disabled={busy} onPress={() => run(() => dash.cron.trigger(id))} />
          <Button
            title={job && isPaused(job) ? 'Resume' : 'Pause'}
            variant="ghost"
            disabled={busy}
            onPress={() => run(() => (job && isPaused(job) ? dash.cron.resume(id) : dash.cron.pause(id)))}
          />
          <Button title="Delete" variant="danger" disabled={busy} onPress={() => run(() => dash.cron.delete(id), true)} />
          <Text variant="heading">Recent runs</Text>
          {runs.length === 0 ? <Text variant="muted">No runs</Text> : null}
          {runs.map((r, i) => (
            <Row
              key={String(r.id ?? i)}
              title={String(r.status ?? r.started_at ?? `run ${i + 1}`)}
              subtitle={String(r.started_at ?? r.finished_at ?? r.error ?? '')}
            />
          ))}
        </>
      ) : null}
    </Screen>
  );
}
