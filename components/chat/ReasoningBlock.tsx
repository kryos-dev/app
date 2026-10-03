import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Text } from '../ui';
import { colors, MIN_TOUCH, radius, space } from '../../lib/theme';

export function ReasoningBlock({ text }: { text: string }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={s.box}>
      <Pressable accessibilityRole="button" onPress={() => setOpen((o) => !o)} style={s.head}>
        <Text variant="muted">{open ? '▾ Reasoning' : '▸ Reasoning'}</Text>
      </Pressable>
      {open ? (
        <Text variant="muted" selectable style={s.body}>
          {text}
        </Text>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  box: { borderLeftWidth: 2, borderLeftColor: colors.border, borderRadius: radius },
  head: { minHeight: MIN_TOUCH, justifyContent: 'center', paddingHorizontal: space.md },
  body: { paddingHorizontal: space.md, paddingBottom: space.md },
});
