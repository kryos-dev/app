import { Alert, FlatList, Platform, Pressable, StyleSheet, View } from 'react-native';
import { Badge, Button, Empty, Text } from '../ui';
import { colors, MIN_TOUCH, radius, space } from '../../lib/theme';
import type { Session } from '../../lib/types';

const when = (s: Session) => {
  const t = s.last_active ?? s.ended_at ?? s.started_at;
  return t ? new Date(t * 1000).toLocaleString() : '';
};

export function SessionList({
  sessions,
  refreshing,
  onRefresh,
  onOpen,
  onDelete,
  onNew,
}: {
  sessions: Session[];
  refreshing: boolean;
  onRefresh: () => void;
  onOpen: (id: string) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}) {
  // Alert has no web implementation, so web deletes directly.
  const confirmDelete = (id: string) =>
    Platform.OS === 'web'
      ? onDelete(id)
      : Alert.alert('Delete chat?', undefined, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: () => onDelete(id) },
        ]);
  return (
    <FlatList
      data={sessions}
      keyExtractor={(x) => x.id}
      refreshing={refreshing}
      onRefresh={onRefresh}
      contentContainerStyle={{ gap: space.sm }}
      ListEmptyComponent={<Empty message="No chats yet" actionTitle="New chat" onAction={onNew} />}
      renderItem={({ item }) => (
        <Pressable
          accessibilityRole="button"
          onPress={() => onOpen(item.id)}
          onLongPress={() => confirmDelete(item.id)}
          style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}
        >
          <View style={{ flex: 1, gap: space.xs }}>
            <Text numberOfLines={1}>{item.title || item.preview || 'Untitled'}</Text>
            <Text variant="muted">{when(item)}</Text>
          </View>
          <Badge label={item.source} />
          <Button title="Delete" variant="ghost" onPress={() => confirmDelete(item.id)} />
        </Pressable>
      )}
    />
  );
}

const s = StyleSheet.create({
  row: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
});
