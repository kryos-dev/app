import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Button, Input, Text } from '../ui';
import { colors, MIN_TOUCH, radius, space } from '../../lib/theme';

export type EffortChoice = 'default' | 'none' | 'low' | 'medium' | 'high';
const EFFORTS: EffortChoice[] = ['default', 'none', 'low', 'medium', 'high'];

export function Composer({
  busy,
  effort,
  onEffort,
  onSend,
  onStop,
}: {
  busy: boolean;
  effort: EffortChoice;
  onEffort: (e: EffortChoice) => void;
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [text, setText] = useState('');
  const send = () => {
    const t = text.trim();
    if (!t) return;
    setText('');
    onSend(t);
  };
  return (
    <View style={s.wrap}>
      <View style={s.efforts}>
        {EFFORTS.map((e) => (
          <Pressable key={e} accessibilityRole="button" onPress={() => onEffort(e)} style={[s.chip, e === effort && s.chipOn]}>
            <Text variant="muted" style={e === effort ? { color: colors.accent } : undefined}>
              {e}
            </Text>
          </Pressable>
        ))}
      </View>
      <View style={s.line}>
        <Input value={text} onChangeText={setText} placeholder="Message" multiline style={s.input} />
        {busy ? <Button title="Stop" variant="danger" onPress={onStop} /> : <Button title="Send" onPress={send} disabled={!text.trim()} />}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  wrap: { gap: space.sm, padding: space.md, borderTopWidth: 1, borderTopColor: colors.border, backgroundColor: colors.bg },
  efforts: { flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' },
  chip: { minHeight: MIN_TOUCH, paddingHorizontal: space.md, justifyContent: 'center', borderRadius: radius, borderWidth: 1, borderColor: colors.border },
  chipOn: { borderColor: colors.accent },
  line: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-end' },
  input: { flex: 1, maxHeight: 140, paddingTop: space.md },
});
