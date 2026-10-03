import { StyleSheet } from 'react-native';
import { Badge, Card, Text } from '../ui';

export function ToolCallCard({ name, args, output, status }: { name: string; args: string; output?: string; status: string }) {
  return (
    <Card>
      <Text variant="heading">{name}</Text>
      <Badge label={status} tone={status === 'completed' ? 'accent' : 'muted'} />
      {args ? (
        <Text variant="muted" style={s.mono} selectable numberOfLines={8}>
          {args}
        </Text>
      ) : null}
      {output ? (
        <Text style={s.mono} selectable numberOfLines={12}>
          {output}
        </Text>
      ) : null}
    </Card>
  );
}

const s = StyleSheet.create({ mono: { fontFamily: 'monospace', fontSize: 13 } });
