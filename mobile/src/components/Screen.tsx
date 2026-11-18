import { ScrollView, StyleSheet, View, type ScrollViewProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors } from '@/theme';
import { GlowBackground } from './GlowBackground';

type Props = {
  children: React.ReactNode;
  scroll?: boolean;
  glow?: 'default' | 'top' | 'violet' | 'center' | false;
  /** Extra bottom padding, e.g. for a sticky footer or the tab bar. */
  bottomInset?: number;
  contentStyle?: ViewStyle;
  footer?: React.ReactNode;
  scrollProps?: ScrollViewProps;
};

export const Screen = ({ children, scroll = true, glow = 'default', bottomInset = 24, contentStyle, footer, scrollProps }: Props) => {
  const insets = useSafeAreaInsets();
  const padding = { paddingTop: insets.top + 8, paddingBottom: insets.bottom + bottomInset };
  return (
    <View style={styles.root}>
      {glow ? <GlowBackground variant={glow} /> : null}
      {scroll ? (
        <ScrollView
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          {...scrollProps}
          contentContainerStyle={[padding, contentStyle]}
        >
          {children}
        </ScrollView>
      ) : (
        <View style={[{ flex: 1 }, padding, contentStyle]}>{children}</View>
      )}
      {footer}
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
