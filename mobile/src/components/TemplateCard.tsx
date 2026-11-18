import { memo } from 'react';
import { StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import type { Template } from '@/api/types';
import { colors, gradients, radius } from '@/theme';
import { formatCount, formatPrice } from '@/utils/format';
import { AppText } from './AppText';
import { PlayGlyph } from './Icon';
import { PressableScale } from './PressableScale';

const STYLE_LABEL = { bollywood: 'Bollywood', retro: 'Retro', genz: 'Gen Z' } as const;

type Props = {
  template: Template;
  width: number;
  height: number;
  onPress?: (t: Template) => void;
  showPrice?: boolean;
  selected?: boolean;
};

export const TemplateCard = memo(({ template, width, height, onPress, showPrice = true, selected }: Props) => (
  <PressableScale
    onPress={() => onPress?.(template)}
    accessibilityRole="button"
    accessibilityLabel={`${template.name} template, ${formatPrice(template.price)}`}
    style={[{ width, height }, styles.card, selected && styles.selected]}
  >
    <LinearGradient colors={template.colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
    <View style={styles.shine} />
    <LinearGradient colors={gradients.thumbShade} start={{ x: 0, y: 0.45 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
    <View style={styles.top}>
      <View style={styles.badge}>
        <AppText variant="micro">{STYLE_LABEL[template.style]}</AppText>
      </View>
      {showPrice ? (
        <View style={styles.price}>
          <AppText variant="micro" style={{ color: colors.goldInk }}>
            {formatPrice(template.price)}
          </AppText>
        </View>
      ) : null}
    </View>
    <View style={styles.play}>
      <PlayGlyph size={16} />
    </View>
    <View>
      <AppText variant="label" style={{ fontSize: 15 }} numberOfLines={1}>
        {template.name}
      </AppText>
      <AppText variant="caption" style={{ opacity: 0.75 }}>
        {`0:${template.durationSec} · ${formatCount(template.madeCount)} made`}
      </AppText>
    </View>
  </PressableScale>
));
TemplateCard.displayName = 'TemplateCard';

const styles = StyleSheet.create({
  card: { borderRadius: radius.xl, overflow: 'hidden', padding: 12, justifyContent: 'space-between' },
  selected: { borderWidth: 2, borderColor: colors.text },
  shine: { position: 'absolute', width: 140, height: 140, borderRadius: 70, top: -60, right: -40, backgroundColor: 'rgba(255,255,255,0.18)' },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  badge: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
  price: { backgroundColor: colors.gold, borderRadius: 8, paddingHorizontal: 7, paddingVertical: 3 },
  play: {
    position: 'absolute',
    alignSelf: 'center',
    top: '42%',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 2,
  },
});
