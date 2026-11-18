import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, fonts, radius } from '@/theme';
import { AppText } from './AppText';

type Props = TextInputProps & { label: string; prefix?: string; hint?: string };

export const Input = ({ label, prefix, hint, style, onFocus, onBlur, ...rest }: Props) => {
  const [focused, setFocused] = useState(false);
  return (
    <View style={styles.wrap}>
      <AppText variant="overline" color="muted">
        {label}
      </AppText>
      <View style={[styles.field, focused && styles.focused]}>
        {prefix ? (
          <AppText variant="body" color="textSecondary" style={styles.prefix}>
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          {...rest}
          accessibilityLabel={label}
          placeholderTextColor={colors.faint}
          selectionColor={colors.pink}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, style]}
        />
      </View>
      {hint ? (
        <AppText variant="caption" color="muted">
          {hint}
        </AppText>
      ) : null}
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { gap: 8 },
  field: {
    height: 52,
    borderRadius: radius.lg - 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  focused: { borderColor: 'rgba(255,77,141,0.6)', backgroundColor: 'rgba(255,77,141,0.06)' },
  prefix: { marginRight: 10, paddingRight: 10, borderRightWidth: 1, borderRightColor: colors.border },
  input: { flex: 1, color: colors.text, fontFamily: fonts.medium, fontSize: 15, paddingVertical: 0 },
});
