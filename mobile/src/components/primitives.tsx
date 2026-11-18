// Small building blocks from the design system.
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useEffect } from 'react';
import { colors, gradients, layout, radius, screenPadding, spacing } from '@/theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { PressableScale } from './PressableScale';

// ---------------------------------------------------------------- GlassCard
export const GlassCard = ({
  children,
  style,
  tone = 'glass',
  padding = spacing.lg,
  rounded = radius.xl,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  tone?: 'glass' | 'soft' | 'strong';
  padding?: number;
  rounded?: number;
}) => (
  <View
    style={[
      {
        backgroundColor: tone === 'soft' ? colors.glassSoft : tone === 'strong' ? colors.glassStrong : colors.glass,
        borderColor: colors.border,
        borderWidth: 1,
        borderRadius: rounded,
        padding,
      },
      style,
    ]}
  >
    {children}
  </View>
);

// ---------------------------------------------------------------- GradientFill
export const GradientFill = ({
  colors: c = gradients.brand,
  style,
  vertical = false,
  children,
}: {
  colors?: readonly [string, string, ...string[]];
  style?: StyleProp<ViewStyle>;
  vertical?: boolean;
  children?: React.ReactNode;
}) => (
  <LinearGradient colors={c} start={{ x: 0, y: 0 }} end={vertical ? { x: 0, y: 1 } : { x: 1, y: 0 }} style={style}>
    {children}
  </LinearGradient>
);

// ---------------------------------------------------------------- Chip
export const Chip = ({
  label,
  selected,
  onPress,
  icon,
  count,
}: {
  label: string;
  selected?: boolean;
  onPress?: () => void;
  icon?: IconName;
  count?: number;
}) => {
  const fg = selected ? colors.text : colors.textSecondary;
  const inner = (
    <View style={styles.chipRow}>
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <AppText variant={selected ? 'label' : 'caption'} style={{ color: fg, fontSize: 13 }}>
        {label}
      </AppText>
      {count !== undefined ? (
        <View style={[styles.count, { backgroundColor: selected ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.08)' }]}>
          <AppText variant="micro">{count}</AppText>
        </View>
      ) : null}
    </View>
  );
  return (
    <PressableScale onPress={onPress} haptic="selection" accessibilityRole="button" accessibilityState={{ selected: Boolean(selected) }}>
      {selected ? (
        <GradientFill style={styles.chip}>{inner}</GradientFill>
      ) : (
        <View style={[styles.chip, styles.chipIdle]}>{inner}</View>
      )}
    </PressableScale>
  );
};

// ---------------------------------------------------------------- Segmented
export const Segmented = <T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string; icon?: IconName }[];
  value: T;
  onChange: (v: T) => void;
}) => (
  <View style={styles.segment}>
    {options.map((o) => {
      const on = o.value === value;
      const inner = (
        <View style={styles.segInner}>
          {o.icon ? <Icon name={o.icon} size={15} color={on ? colors.text : colors.textSecondary} /> : null}
          <AppText variant="label" style={{ color: on ? colors.text : colors.textSecondary }}>
            {o.label}
          </AppText>
        </View>
      );
      return (
        <PressableScale key={o.value} style={{ flex: 1 }} onPress={() => onChange(o.value)} haptic="selection" accessibilityRole="tab" accessibilityState={{ selected: on }}>
          {on ? <GradientFill style={styles.segItem}>{inner}</GradientFill> : <View style={styles.segItem}>{inner}</View>}
        </PressableScale>
      );
    })}
  </View>
);

// ---------------------------------------------------------------- IconButton
export const IconButton = ({
  icon,
  onPress,
  label,
  size = 42,
  tone = 'glass',
  children,
}: {
  icon?: IconName;
  onPress?: () => void;
  label: string;
  size?: number;
  tone?: 'glass' | 'dark';
  children?: React.ReactNode;
}) => (
  <PressableScale
    onPress={onPress}
    hitSlop={layout.hitSlop}
    accessibilityRole="button"
    accessibilityLabel={label}
    style={[
      styles.iconBtn,
      { width: size, height: size, borderRadius: size * 0.33 },
      tone === 'dark' ? { backgroundColor: colors.scrim, borderColor: 'rgba(255,255,255,0.15)' } : null,
    ]}
  >
    {children ?? (icon ? <Icon name={icon} size={20} /> : null)}
  </PressableScale>
);

// ---------------------------------------------------------------- SectionHeader
export const SectionHeader = ({ title, action, onAction }: { title: string; action?: string; onAction?: () => void }) => (
  <View style={styles.section}>
    <AppText variant="title">{title}</AppText>
    {action ? (
      <PressableScale onPress={onAction} hitSlop={layout.hitSlop}>
        <AppText variant="label" color="pinkSoft">
          {action}
        </AppText>
      </PressableScale>
    ) : null}
  </View>
);

// ---------------------------------------------------------------- Badge
export const Badge = ({ label, tone = 'dark' }: { label: string; tone?: 'dark' | 'gold' | 'success' | 'brand' | 'light' | 'pink' | 'muted' }) => {
  const bg: Record<string, string> = {
    dark: 'rgba(0,0,0,0.35)',
    gold: colors.gold,
    success: colors.success,
    light: 'rgba(255,255,255,0.9)',
    pink: colors.pink,
    muted: colors.muted,
    brand: 'transparent',
  };
  const fg: Record<string, string> = { gold: colors.goldInk, success: colors.successInk, light: colors.ink, muted: '#14101F' };
  const text = (
    <AppText variant="micro" style={{ color: fg[tone] ?? colors.text, letterSpacing: 0.6 }}>
      {label}
    </AppText>
  );
  return tone === 'brand' ? <GradientFill style={styles.badge}>{text}</GradientFill> : <View style={[styles.badge, { backgroundColor: bg[tone] }]}>{text}</View>;
};

// ---------------------------------------------------------------- Toggle
export const Toggle = ({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) => {
  const x = useSharedValue(value ? 1 : 0);
  useEffect(() => {
    x.value = withTiming(value ? 1 : 0, { duration: 180 });
  }, [value, x]);
  const knob = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * 18 }] }));
  const on = useAnimatedStyle(() => ({ opacity: x.value }));
  return (
    <PressableScale onPress={() => onChange(!value)} haptic="selection" accessibilityRole="switch" accessibilityLabel={label} accessibilityState={{ checked: value }} style={styles.toggle}>
      <Animated.View style={[StyleSheet.absoluteFill, on]}>
        <GradientFill style={[StyleSheet.absoluteFill, { borderRadius: 13 }]} />
      </Animated.View>
      <Animated.View style={[styles.knob, knob]} />
    </PressableScale>
  );
};

// ---------------------------------------------------------------- Avatar
export const Avatar = ({ text, size = 42, ring = false }: { text: string; size?: number; ring?: boolean }) =>
  ring ? (
    <GradientFill style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <View style={{ width: size - 8, height: size - 8, borderRadius: (size - 8) / 2, backgroundColor: '#1C1828', alignItems: 'center', justifyContent: 'center' }}>
        <AppText variant="h2" style={{ fontSize: size * 0.32 }}>
          {text}
        </AppText>
      </View>
    </GradientFill>
  ) : (
    <GradientFill style={{ width: size, height: size, borderRadius: size / 2, alignItems: 'center', justifyContent: 'center' }}>
      <AppText variant="title">{text}</AppText>
    </GradientFill>
  );

// ---------------------------------------------------------------- Padded row helper
export const Pad = ({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) => (
  <View style={[{ paddingHorizontal: screenPadding }, style]}>{children}</View>
);

const styles = StyleSheet.create({
  chip: { borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 8 },
  chipIdle: { backgroundColor: colors.glassSoft, borderWidth: 1, borderColor: colors.border },
  chipRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  count: { borderRadius: 6, paddingHorizontal: 6, paddingVertical: 1 },
  segment: { flexDirection: 'row', padding: 4, borderRadius: 14, backgroundColor: colors.glassSoft, borderWidth: 1, borderColor: colors.border },
  segItem: { borderRadius: 11, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  segInner: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  iconBtn: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border },
  section: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: screenPadding },
  badge: { borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3, alignSelf: 'flex-start', overflow: 'hidden' },
  toggle: { width: 44, height: 26, borderRadius: 13, backgroundColor: 'rgba(255,255,255,0.15)', padding: 3, overflow: 'hidden' },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: colors.text },
});
