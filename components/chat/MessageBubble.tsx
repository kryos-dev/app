import { StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { colors, radius, space } from '../../lib/theme';
import { ReasoningBlock } from './ReasoningBlock';
import { ToolCallCard } from './ToolCallCard';

export type ChatItem =
  | { key: string; kind: 'user' | 'assistant' | 'reasoning'; text: string }
  | { key: string; kind: 'tool'; callId: string; name: string; args: string; output?: string; status: string };

const FENCE = '`'.repeat(3);

// Plain text with fenced code blocks (split on the fence), nothing fancier.
function Body({ text }: { text: string }) {
  return (
    <>
      {text.split(FENCE).map((part, i) =>
        i % 2 ? (
          <View key={i} style={s.code}>
            <Text style={s.mono} selectable>
              {part.replace(/^[^\n]*\n/, '').replace(/\n$/, '')}
            </Text>
          </View>
        ) : part.trim() ? (
          <Text key={i} selectable>
            {part.trim()}
          </Text>
        ) : null,
      )}
    </>
  );
}

export function MessageBubble({ item }: { item: ChatItem }) {
  if (item.kind === 'reasoning') return <ReasoningBlock text={item.text} />;
  if (item.kind === 'tool') return <ToolCallCard name={item.name} args={item.args} output={item.output} status={item.status} />;
  const user = item.kind === 'user';
  return (
    <View style={[s.bubble, user ? s.user : s.assistant]}>
      <Body text={item.text} />
    </View>
  );
}

const s = StyleSheet.create({
  bubble: { padding: space.md, borderRadius: radius, gap: space.sm, maxWidth: '92%' },
  user: { alignSelf: 'flex-end', backgroundColor: colors.border },
  assistant: { alignSelf: 'flex-start' },
  code: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius, padding: space.sm },
  mono: { fontFamily: 'monospace', fontSize: 13 },
});
