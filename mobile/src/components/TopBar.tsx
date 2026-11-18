import { StyleSheet, View } from 'react-native';
import { router } from 'expo-router';
import { colors, screenPadding } from '@/theme';
import { AppText } from './AppText';
import { GradientFill, IconButton } from './primitives';

type Props = {
  title: string;
  /** 1–4: create-flow progress pills */
  step?: number;
  totalSteps?: number;
  right?: React.ReactNode;
  onBack?: () => void;
};

export const TopBar = ({ title, step, totalSteps = 4, right, onBack }: Props) => (
  <View style={styles.bar}>
    <IconButton icon="back" label="Go back" size={40} onPress={onBack ?? (() => router.back())} />
    <AppText variant="title" numberOfLines={1} style={styles.title}>
      {title}
    </AppText>
    {right}
    {step ? (
      <View style={styles.pills} accessibilityLabel={`Step ${step} of ${totalSteps}`}>
        {Array.from({ length: totalSteps }, (_, i) =>
          i < step ? (
            <GradientFill key={i} style={[styles.pill, i === step - 1 && styles.pillActive]} />
          ) : (
            <View key={i} style={[styles.pill, { backgroundColor: 'rgba(255,255,255,0.18)' }]} />
          ),
        )}
      </View>
    ) : null}
  </View>
);

const styles = StyleSheet.create({
  bar: { height: 56, flexDirection: 'row', alignItems: 'center', gap: 14, paddingHorizontal: screenPadding },
  title: { flex: 1, color: colors.text },
  pills: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  pill: { width: 6, height: 6, borderRadius: 3 },
  pillActive: { width: 18 },
});
