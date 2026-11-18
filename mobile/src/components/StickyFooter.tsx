import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, radius, screenPadding } from '@/theme';

/** Surface sheet pinned to the bottom (price + CTA). */
export const StickyFooter = ({ children }: { children: React.ReactNode }) => {
  const insets = useSafeAreaInsets();
  return <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) + 10 }]}>{children}</View>;
};

/** Height to reserve under scroll content so nothing hides behind the footer. */
export const STICKY_FOOTER_SPACE = 150;

const styles = StyleSheet.create({
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    borderTopWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: screenPadding,
    paddingTop: 14,
    gap: 12,
  },
});
