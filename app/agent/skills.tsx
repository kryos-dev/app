import { useCallback, useMemo, useState } from 'react';
import { FlatList } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { Badge, Button, Card, Empty, Input, Row, Screen, Spinner, Switch, Text } from '../../components/ui';
import * as dash from '../../lib/api/dashboard';
import { errMsg, hubPreview, useGo, waitAction } from '../../lib/api/agent-extra';
import type { HubSkill, Skill } from '../../lib/types';

type Mode = 'list' | 'hub' | 'new';

export default function Skills() {
  const router = useRouter();
  const go = useGo();
  const [items, setItems] = useState<Skill[] | null>(null);
  const [q, setQ] = useState('');
  const [mode, setMode] = useState<Mode>('list');
  const [err, setErr] = useState('');

  const load = useCallback(() => {
    dash.skills.list().then(setItems).catch((e) => setErr(errMsg(e)));
  }, []);
  useFocusEffect(load);

  const shown = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (items ?? []).filter((s) => !t || s.name.toLowerCase().includes(t) || s.description?.toLowerCase().includes(t));
  }, [items, q]);

  const toggle = async (s: Skill, enabled: boolean) => {
    setItems((o) => o && o.map((x) => (x.name === s.name ? { ...x, enabled } : x)));
    try {
      await dash.skills.toggle(s.name, enabled);
    } catch (e) {
      setErr(errMsg(e));
      load();
    }
  };

  const done = () => {
    setMode('list');
    load();
  };
  const header = (
    <>
      <Row title="< Back" onPress={() => router.back()} />
      <Text variant="title">Skills</Text>
      {err ? <Text variant="error">{err}</Text> : null}
      <Button title="Install from hub" variant="ghost" onPress={() => setMode(mode === 'hub' ? 'list' : 'hub')} />
      <Button title="New skill" variant="ghost" onPress={() => setMode(mode === 'new' ? 'list' : 'new')} />
      {mode === 'hub' ? <Hub onDone={done} /> : null}
      {mode === 'new' ? <NewSkill onDone={done} /> : null}
      <Input placeholder="Search skills" value={q} onChangeText={setQ} />
    </>
  );

  if (!items && !err) return <Screen><Spinner /></Screen>;
  return (
    <Screen>
      <FlatList
        data={shown}
        keyExtractor={(s) => s.name}
        contentContainerStyle={{ gap: 8 }}
        keyboardShouldPersistTaps="handled"
        ListHeaderComponent={header}
        ListEmptyComponent={<Empty message="No skills" />}
        renderItem={({ item }) => (
          <Row
            title={item.name}
            subtitle={item.description}
            onPress={() => go(`/agent/skill/${encodeURIComponent(item.name)}`)}
            right={
              <>
                {item.provenance ? <Badge label={item.provenance} /> : null}
                <Switch value={item.enabled} onValueChange={(v) => toggle(item, v)} />
              </>
            }
          />
        )}
      />
    </Screen>
  );
}

function NewSkill({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState('');
  const [content, setContent] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const save = async () => {
    setBusy(true);
    setErr('');
    try {
      const r = await dash.skills.create(name.trim(), content);
      if (r.success === false) setErr(r.error ?? 'failed');
      else onDone();
    } catch (e) {
      setErr(errMsg(e));
    }
    setBusy(false);
  };
  return (
    <Card>
      <Input placeholder="name" value={name} onChangeText={setName} />
      <Input placeholder="SKILL.md content" value={content} onChangeText={setContent} multiline style={{ minHeight: 160, textAlignVertical: 'top' }} />
      {err ? <Text variant="error">{err}</Text> : null}
      <Button title="Create" onPress={save} loading={busy} disabled={!name.trim()} />
    </Card>
  );
}

function Hub({ onDone }: { onDone: () => void }) {
  const [q, setQ] = useState('');
  const [res, setRes] = useState<HubSkill[] | null>(null);
  const [prev, setPrev] = useState<{ id: string; text: string } | null>(null);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  const search = async () => {
    setBusy(true);
    setMsg('');
    try {
      setRes((await dash.skills.hubSearch(q.trim() || undefined, undefined, 20)).results ?? []);
    } catch (e) {
      setMsg(errMsg(e));
    }
    setBusy(false);
  };
  const preview = async (id: string) => {
    try {
      const p = await hubPreview(id);
      setPrev({ id, text: `${p.description}\n\ntrust: ${p.trust_level}\n\n${(p.skill_md ?? '').slice(0, 1500)}` });
    } catch (e) {
      setMsg(errMsg(e));
    }
  };
  const install = async (id: string) => {
    setBusy(true);
    setMsg('Installing...');
    try {
      const a = await dash.skills.hubInstall(id);
      // contracts 4: log_url shape unknown; poll the action status by name instead.
      const r = await waitAction(a.action);
      if (r.exit_code === 0 || r.exit_code === null) onDone();
      else setMsg(r.lines.slice(-5).join('\n'));
    } catch (e) {
      setMsg(errMsg(e));
    }
    setBusy(false);
  };

  return (
    <Card>
      <Input placeholder="Search hub" value={q} onChangeText={setQ} onSubmitEditing={search} returnKeyType="search" />
      <Button title="Search" onPress={search} loading={busy} />
      {msg ? <Text variant="muted">{msg}</Text> : null}
      {res?.length === 0 ? <Text variant="muted">No results</Text> : null}
      {res?.map((h) => (
        <Card key={h.identifier}>
          <Text>{h.name}</Text>
          <Text variant="muted">{h.description}</Text>
          <Text variant="muted">{`${h.source} / ${h.trust_level}`}</Text>
          {prev?.id === h.identifier ? <Text variant="muted">{prev.text}</Text> : null}
          <Button title="Preview" variant="ghost" onPress={() => preview(h.identifier)} />
          {h.installed ? <Badge label="installed" tone="accent" /> : <Button title="Install" onPress={() => install(h.identifier)} disabled={busy} />}
        </Card>
      ))}
    </Card>
  );
}
