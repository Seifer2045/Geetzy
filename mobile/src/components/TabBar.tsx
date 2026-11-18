import { StyleSheet, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { router } from 'expo-router';
import type { BottomTabBarProps } from 'expo-router/tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, layout, radius, shadows } from '@/theme';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { GradientFill } from './primitives';
import { PressableScale } from './PressableScale';

const TABS: Record<string, { label: string; icon: IconName }> = {
  index: { label: 'Home', icon: 'home' },
  explore: { label: 'Explore', icon: 'explore' },
  library: { label: 'Library', icon: 'library' },
  profile: { label: 'Profile', icon: 'user' },
};

/** Floating glass tab bar with a center Create button: Home · Explore · ＋ · Library · Profile */
export const TabBar = ({ state, emitter, navigateToTab }: BottomTabBarProps) => {
  const insets = useSafeAreaInsets();
  const routes = state.routes.filter((r) => TABS[r.name]);

  const renderTab = (routeName: string) => {
    const index = state.routes.findIndex((r) => r.name === routeName);
    const route = state.routes[index];
    const meta = TABS[routeName];
    if (!route || !meta) return null;
    const focused = state.index === index;
    const color = focused ? colors.text : colors.faint;
    return (
      <PressableScale
        key={route.key}
        haptic="selection"
        accessibilityRole="tab"
        accessibilityState={{ selected: focused }}
        accessibilityLabel={meta.label}
        style={styles.tab}
        onPress={() => {
          const event = emitter.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!focused && !event.defaultPrevented) navigateToTab(route.key);
        }}
      >
        <Icon name={meta.icon} size={22} color={color} />
        <AppText variant="micro" style={{ color, fontFamily: focused ? 'Inter_600SemiBold' : 'Inter_500Medium', letterSpacing: 0 }}>
          {meta.label}
        </AppText>
      </PressableScale>
    );
  };

  const names = routes.map((r) => r.name);
  const left = names.filter((n) => n === 'index' || n === 'explore');
  const right = names.filter((n) => n === 'library' || n === 'profile');

  return (
    <View pointerEvents="box-none" style={[styles.wrap, { bottom: Math.max(insets.bottom, 8) + layout.tabBarBottomGap - 8 }]}>
      <View style={[styles.bar, shadows.float]}>
        <BlurView intensity={30} tint="dark" style={StyleSheet.absoluteFill} />
        <View style={[StyleSheet.absoluteFill, styles.tint]} />
        {left.map(renderTab)}
        <PressableScale
          haptic="medium"
          accessibilityRole="button"
          accessibilityLabel="Create a new gift"
          onPress={() => router.push('/create/templates')}
          style={shadows.brandGlow}
        >
          <GradientFill style={styles.fab}>
            <Icon name="plus" size={24} strokeWidth={2.4} />
          </GradientFill>
        </PressableScale>
        {right.map(renderTab)}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', left: 16, right: 16 },
  bar: {
    height: layout.tabBarHeight,
    borderRadius: radius.xxl,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  tint: { backgroundColor: 'rgba(26,23,36,0.86)' },
  tab: { alignItems: 'center', gap: 4, minWidth: 48, paddingVertical: 6 },
  fab: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
});

/** Space to leave under tab screens' scroll content. */
export const TAB_BAR_SPACE = layout.tabBarHeight + 40;
