import { useCallback, useState } from 'react';
import { useFocusEffect, useRouter } from 'expo-router';
import { View } from 'react-native';
import { Button, Screen, Spinner, Text } from '../../components/ui';
import { SessionList } from '../../components/chat/SessionList';
import * as gateway from '../../lib/api/gateway';
import type { Session } from '../../lib/types';

const stamp = (s: Session) => s.last_active ?? s.ended_at ?? s.started_at;

export default function ChatTab() {
  const router = useRouter();
  const [sessions, setSessions] = useState<Session[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const r = await gateway.sessions.list({ limit: 100 });
      setSessions(r.data.filter((s) => !s.hidden && !s.archived).sort((a, b) => stamp(b) - stamp(a)));
      setError(null);
    } catch (e) {
      setError(String((e as Error).message));
      setSessions((s) => s ?? []);
    } finally {
      setRefreshing(false);
    }
  }, []);
  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const del = async (id: string) => {
    try {
      await gateway.sessions.delete(id);
      setSessions((s) => s?.filter((x) => x.id !== id) ?? s);
    } catch (e) {
      setError(String((e as Error).message));
    }
  };

  const open = (id: string) => router.push(`/chat/${id}` as never);

  return (
    <Screen>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Text variant="title">Chat</Text>
        <Button title="New chat" onPress={() => open('new')} />
      </View>
      {error ? <Text variant="error">{error}</Text> : null}
      {sessions ? (
        <SessionList sessions={sessions} refreshing={refreshing} onRefresh={load} onOpen={open} onDelete={del} onNew={() => open('new')} />
      ) : (
        <Spinner />
      )}
    </Screen>
  );
}
