import { useEffect, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Input, Row, Screen, Spinner, Text } from '../../../components/ui';
import * as dash from '../../../lib/api/dashboard';
import { errMsg, waitAction } from '../../../lib/api/agent-extra';

export default function SkillDetail() {
  const { name } = useLocalSearchParams<{ name: string }>();
  const router = useRouter();
  const [content, setContent] = useState<string | null>(null);
  const [path, setPath] = useState('');
  const [hub, setHub] = useState(false);
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    dash.skills.getContent(name).then((r) => { setContent(r.content); setPath(r.path); }).catch((e) => setMsg(errMsg(e)));
    dash.skills.list().then((l) => setHub(l.find((s) => s.name === name)?.provenance === 'hub')).catch(() => {});
  }, [name]);

  const save = async () => {
    setBusy(true);
    try {
      const r = await dash.skills.putContent(name, content ?? '');
      setMsg(r.success === false ? r.error ?? 'failed' : 'Saved');
    } catch (e) {
      setMsg(errMsg(e));
    }
    setBusy(false);
  };
  // TODO: contracts 4 has no delete route for non-hub skills; only hub uninstall is offered.
  const remove = async () => {
    setBusy(true);
    try {
      await waitAction((await dash.skills.hubUninstall(name)).action);
      router.back();
    } catch (e) {
      setMsg(errMsg(e));
      setBusy(false);
    }
  };

  return (
    <Screen scroll>
      <Row title="< Back" onPress={() => router.back()} />
      <Text variant="title">{name}</Text>
      {path ? <Text variant="muted">{path}</Text> : null}
      {content === null && !msg ? <Spinner /> : null}
      {content !== null ? (
        <Input value={content} onChangeText={setContent} multiline style={{ minHeight: 320, textAlignVertical: 'top' }} />
      ) : null}
      {msg ? <Text variant={msg === 'Saved' ? 'muted' : 'error'}>{msg}</Text> : null}
      <Button title="Save" onPress={save} loading={busy} disabled={content === null} />
      {hub ? <Button title="Uninstall" variant="danger" onPress={remove} disabled={busy} /> : null}
    </Screen>
  );
}
