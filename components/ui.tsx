import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch as RNSwitch,
  Text as RNText,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, font, MIN_TOUCH, radius, space } from '../lib/theme';

export function Screen({ children, scroll, style }: { children: ReactNode; scroll?: boolean; style?: StyleProp<ViewStyle> }) {
  return (
    <SafeAreaView style={s.screen} edges={['top', 'left', 'right']}>
      {scroll ? (
        <ScrollView contentContainerStyle={[s.pad, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[s.flex, s.pad, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

type Variant = 'title' | 'heading' | 'body' | 'muted' | 'error';
const textStyles: Record<Variant, TextStyle> = {
  title: { fontSize: font.xl, fontWeight: '600', color: colors.text },
  heading: { fontSize: font.lg, fontWeight: '600', color: colors.text },
  body: { fontSize: font.md, color: colors.text },
  muted: { fontSize: font.sm, color: colors.muted },
  error: { fontSize: font.sm, color: colors.danger },
};
export function Text({ variant = 'body', style, ...p }: { variant?: Variant } & React.ComponentProps<typeof RNText>) {
  return <RNText {...p} style={[textStyles[variant], style]} />;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  style,
}: {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'ghost' | 'danger';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const bg = variant === 'primary' ? colors.accent : 'transparent';
  const border = variant === 'danger' ? colors.danger : variant === 'ghost' ? colors.border : colors.accent;
  const fg = variant === 'primary' ? colors.bg : variant === 'danger' ? colors.danger : colors.text;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [s.btn, { backgroundColor: bg, borderColor: border, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 }, style]}
    >
      {loading ? <ActivityIndicator color={fg} /> : <RNText style={[s.btnText, { color: fg }]}>{title}</RNText>}
    </Pressable>
  );
}

export function Input({ style, ...p }: TextInputProps) {
  return <TextInput placeholderTextColor={colors.muted} autoCapitalize="none" autoCorrect={false} {...p} style={[s.input, style]} />;
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[s.card, style]}>{children}</View>;
}

export function Row({
  title,
  subtitle,
  right,
  onPress,
}: {
  title: string;
  subtitle?: string;
  right?: ReactNode;
  onPress?: () => void;
}) {
  const body = (
    <>
      <View style={s.flex}>
        <RNText style={textStyles.body} numberOfLines={1}>
          {title}
        </RNText>
        {subtitle ? (
          <RNText style={textStyles.muted} numberOfLines={2}>
            {subtitle}
          </RNText>
        ) : null}
      </View>
      {right}
    </>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress} style={({ pressed }) => [s.row, pressed && { opacity: 0.7 }]}>
      {body}
    </Pressable>
  ) : (
    <View style={s.row}>{body}</View>
  );
}

export function Switch({ value, onValueChange, disabled }: { value: boolean; onValueChange: (v: boolean) => void; disabled?: boolean }) {
  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      trackColor={{ false: colors.border, true: colors.accent }}
      thumbColor={colors.text}
    />
  );
}

export function Badge({ label, tone = 'muted' }: { label: string; tone?: 'muted' | 'accent' | 'danger' }) {
  const c = tone === 'accent' ? colors.accent : tone === 'danger' ? colors.danger : colors.muted;
  return (
    <View style={[s.badge, { borderColor: c }]}>
      <RNText style={{ color: c, fontSize: font.sm }}>{label}</RNText>
    </View>
  );
}

export function Empty({ message, actionTitle, onAction }: { message: string; actionTitle?: string; onAction?: () => void }) {
  return (
    <View style={s.empty}>
      <Text variant="muted">{message}</Text>
      {actionTitle && onAction ? <Button title={actionTitle} onPress={onAction} variant="ghost" /> : null}
    </View>
  );
}

export function Spinner() {
  return (
    <View style={s.empty}>
      <ActivityIndicator color={colors.accent} />
    </View>
  );
}

const s = StyleSheet.create({
  flex: { flex: 1 },
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: space.lg, gap: space.md },
  btn: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.lg,
    borderRadius: radius,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnText: { fontSize: font.md, fontWeight: '600' },
  input: {
    minHeight: MIN_TOUCH,
    paddingHorizontal: space.md,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: font.md,
  },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
    padding: space.md,
    gap: space.sm,
  },
  row: {
    minHeight: MIN_TOUCH,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.surface,
    borderRadius: radius,
    borderWidth: 1,
    borderColor: colors.border,
  },
  badge: { borderWidth: 1, borderRadius: radius, paddingHorizontal: space.sm, paddingVertical: space.xs },
  empty: { alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
});
