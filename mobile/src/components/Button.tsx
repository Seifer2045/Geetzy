import { ActivityIndicator, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { colors, gradients, layout, radius, shadows } from '@/theme';
import { AppText } from './AppText';
import { PressableScale } from './PressableScale';

type Variant = 'primary' | 'glass' | 'light' | 'ghost';

type Props = {
  label: string;
  onPress?: () => void;
  variant?: Variant;
  icon?: React.ReactNode;
  loading?: boolean;
  disabled?: boolean;
  style?: StyleProp<ViewStyle>;
  accessibilityLabel?: string;
};

export const Button = ({ label, onPress, variant = 'primary', icon, loading, disabled, style, accessibilityLabel }: Props) => {
  const textColor = variant === 'light' ? colors.ink : colors.text;
  const content = (
    <View style={styles.row}>
      {loading ? <ActivityIndicator color={textColor} /> : icon}
      <AppText variant="title" style={{ color: textColor, fontSize: 16 }}>
        {label}
      </AppText>
    </View>
  );

  return (
    <PressableScale
      onPress={onPress}
      disabled={disabled || loading}
      haptic={variant === 'primary' ? 'medium' : 'light'}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ disabled: Boolean(disabled), busy: Boolean(loading) }}
      style={[styles.base, variant === 'primary' && !disabled ? shadows.brandGlow : null, style]}
    >
      {variant === 'primary' ? (
        <LinearGradient colors={gradients.brand} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={styles.fill}>
          {content}
        </LinearGradient>
      ) : (
        <View style={[styles.fill, variantStyles[variant]]}>{content}</View>
      )}
    </PressableScale>
  );
};

const styles = StyleSheet.create({
  base: { height: layout.buttonHeight, borderRadius: radius.lg, alignSelf: 'stretch' },
  fill: { flex: 1, borderRadius: radius.lg, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
});

const variantStyles = StyleSheet.create({
  primary: {},
  glass: { backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
  light: { backgroundColor: colors.text },
  ghost: { backgroundColor: 'transparent' },
});
