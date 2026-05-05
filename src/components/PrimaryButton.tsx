import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  type PressableProps,
  type ViewStyle,
} from 'react-native';

import { colors, radius, spacing } from '@/lib/theme';

type Variant = 'primary' | 'danger' | 'ghost';

type Props = Omit<PressableProps, 'children' | 'style'> & {
  title: string;
  loading?: boolean;
  variant?: Variant;
  style?: ViewStyle;
};

export function PrimaryButton({
  title,
  loading,
  disabled,
  variant = 'primary',
  style,
  ...rest
}: Props) {
  const palette = palettes[variant];
  const isDisabled = disabled || loading;
  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled }}
      disabled={isDisabled}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: palette.bg, borderColor: palette.border },
        pressed && !isDisabled && { opacity: 0.85 },
        isDisabled && { opacity: 0.5 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <Text style={[styles.label, { color: palette.text }]}>{title}</Text>
      )}
    </Pressable>
  );
}

const palettes: Record<Variant, { bg: string; border: string; text: string }> = {
  primary: { bg: colors.primary, border: colors.primaryDark, text: '#fff' },
  danger: { bg: colors.danger, border: colors.dangerDark, text: '#fff' },
  ghost: { bg: 'transparent', border: colors.border, text: colors.text },
};

const styles = StyleSheet.create({
  btn: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontSize: 16, fontWeight: '600' },
});
