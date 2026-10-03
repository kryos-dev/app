import { useCallback, useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, View } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Button, Screen, Spinner, Text } from '../../components/ui';
import { MessageBubble, type ChatItem } from '../../components/chat/MessageBubble';
import { Composer, type EffortChoice } from '../../components/chat/Composer';
import * as gateway from '../../lib/api/gateway';
import { space } from '../../lib/theme';
import type { Message, SseEvent } from '../../lib/types';

// Message history to items; tool results (role 'tool') attach to the call by tool_call_id.
function fromMessages(msgs: Message[]): ChatItem[] {
  const out: ChatItem[] = [];
  for (const m of msgs) {
    if (m.role === 'user' && m.content) out.push({ key: `m${m.id}`, kind: 'user', text: m.content });
    else if (m.role === 'assistant') {
      const r = m.reasoning_content || m.reasoning;
      if (r) out.push({ key: `r${m.id}`, kind: 'reasoning', text: r });
      if (m.content) out.push({ key: `m${m.id}`, kind: 'assistant', text: m.content });
      for (const c of m.tool_calls ?? [])
        out.push({ key: `t${c.id}`, kind: 'tool', callId: c.id, name: c.function?.name ?? 'tool', args: c.function?.arguments ?? '', status: 'completed' });
    } else if (m.role === 'tool') {
      const t = out.find((i) => i.kind === 'tool' && i.callId === m.tool_call_id);
      if (t && t.kind === 'tool') t.output = m.content;
    }
  }
  return out;
}

export default function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const isNew = id === 'new';
  const [items, setItems] = useState<ChatItem[]>([]);
  const [loading, setLoading] = useState(!isNew);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [usage, setUsage] = useState<string | null>(null);
  const [effort, setEffort] = useState<EffortChoice>('default');
  const listRef = useRef<FlatList<ChatItem>>(null);
  const abortRef = useRef<AbortController | null>(null);
  const prevRef = useRef<string | null>(null);
  const sidRef = useRef<string | null>(isNew ? null : id);
  const lastRef = useRef('');

  useEffect(() => {
    if (isNew) return;
    gateway.sessions
      .messages(id, { order: 'oldest' })
      .then((r) => setItems(fromMessages(r.data)))
      .catch((e) => setError(String((e as Error).message)))
      .finally(() => setLoading(false));
  }, [id, isNew]);

  // Upsert by key: deltas for an item not yet seen create it.
  const upsert = useCallback((key: string, make: ChatItem, patch: (i: ChatItem) => ChatItem) => {
    setItems((cur) => (cur.some((i) => i.key === key) ? cur.map((i) => (i.key === key ? patch(i) : i)) : [...cur, patch(make)]));
  }, []);

  const apply = useCallback(
    (ev: SseEvent) => {
      switch (ev.type) {
        case 'response.created':
          prevRef.current = ev.response.id;
          break;
        case 'response.output_item.added':
        case 'response.output_item.done': {
          const it = ev.item;
          const key = it.id ?? `o${ev.output_index}`;
          if (it.type === 'function_call') {
            const fresh: ChatItem = { key: `t${it.call_id}`, kind: 'tool', callId: it.call_id, name: it.name, args: it.arguments, status: it.status };
            upsert(fresh.key, fresh, (i) => (i.kind === 'tool' ? { ...i, name: it.name, args: it.arguments, status: it.status } : i));
          } else if (it.type === 'function_call_output') {
            setItems((cur) =>
              cur.map((i) =>
                i.kind === 'tool' && i.callId === it.call_id ? { ...i, output: it.output?.map((o) => o.text).join(''), status: it.status } : i,
              ),
            );
          } else if (it.type === 'reasoning') upsert(key, { key, kind: 'reasoning', text: '' }, (i) => i);
          else if (it.type === 'message') upsert(key, { key, kind: 'assistant', text: '' }, (i) => i);
          break;
        }
        case 'response.output_text.delta':
          upsert(ev.item_id, { key: ev.item_id, kind: 'assistant', text: '' }, (i) => (i.kind === 'assistant' ? { ...i, text: i.text + ev.delta } : i));
          break;
        case 'response.reasoning_summary_text.delta':
          upsert(ev.item_id, { key: ev.item_id, kind: 'reasoning', text: '' }, (i) => (i.kind === 'reasoning' ? { ...i, text: i.text + ev.delta } : i));
          break;
        case 'response.completed': {
          prevRef.current = ev.response.id;
          const u = ev.response.usage;
          if (u) setUsage(`${u.input_tokens} in / ${u.output_tokens} out / ${u.total_tokens} total tokens`);
          break;
        }
        case 'response.failed':
          // TODO: failure detail shape is unverified (contracts 2.5 [?]).
          setError(typeof ev.response.error === 'string' ? ev.response.error : JSON.stringify(ev.response.error ?? 'Response failed'));
          break;
      }
    },
    [upsert],
  );

  const send = async (text: string, retry = false) => {
    lastRef.current = text;
    setError(null);
    setUsage(null);
    if (!retry) setItems((c) => [...c, { key: `u${Date.now()}`, kind: 'user', text }]);
    const ac = new AbortController();
    abortRef.current = ac;
    setBusy(true);
    try {
      const r = await gateway.createResponse(
        {
          input: text,
          previous_response_id: prevRef.current,
          model_options: effort === 'default' ? undefined : { reasoning_effort: effort },
        },
        { sessionId: sidRef.current ?? undefined, signal: ac.signal },
      );
      if (r.sessionId) sidRef.current = r.sessionId;
      for await (const ev of r.events) apply(ev);
    } catch (e) {
      if (!ac.signal.aborted) setError(String((e as Error).message));
    } finally {
      setBusy(false);
      // New chat: move to the real id once the stream ends (remount reloads history from the server).
      if (isNew && sidRef.current) router.replace(`/chat/${sidRef.current}` as never);
    }
  };

  return (
    <Screen style={{ padding: 0, gap: 0 }}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={{ padding: space.md }}>
        <Button title="‹ Back" variant="ghost" onPress={() => router.back()} style={{ alignSelf: 'flex-start' }} />
      </View>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {loading ? (
          <Spinner />
        ) : (
          <FlatList
            ref={listRef}
            data={items}
            keyExtractor={(i) => i.key}
            renderItem={({ item }) => <MessageBubble item={item} />}
            contentContainerStyle={{ padding: space.md, gap: space.sm }}
            onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
            keyboardShouldPersistTaps="handled"
            ListFooterComponent={
              <View style={{ gap: space.sm }}>
                {busy ? <Spinner /> : null}
                {usage ? <Text variant="muted">{usage}</Text> : null}
                {error ? (
                  <View style={{ gap: space.sm }}>
                    <Text variant="error">{error}</Text>
                    <Button title="Retry" variant="ghost" onPress={() => send(lastRef.current, true)} disabled={busy || !lastRef.current} />
                  </View>
                ) : null}
              </View>
            }
          />
        )}
        <Composer busy={busy} effort={effort} onEffort={setEffort} onSend={send} onStop={() => abortRef.current?.abort()} />
      </KeyboardAvoidingView>
    </Screen>
  );
}
