import { useState } from 'react';
import { ActivityIndicator, ScrollView, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated from 'react-native-reanimated';
import { useTemplate } from '@/api/hooks';
import {
  AppText,
  Badge,
  Button,
  Icon,
  IconButton,
  type IconName,
  IconSwap,
  PauseGlyph,
  PlayGlyph,
  PressableScale,
  StickyFooter,
  STICKY_FOOTER_SPACE,
} from '@/components';
import { useFakePlayback } from '@/hooks/useFakePlayback';
import { useCreateFlow } from '@/store/createFlow';
import { colors, enterUp, radius, screenPadding, stagger } from '@/theme';
import { discountPercent, formatCount, formatPrice } from '@/utils/format';

const HERO_H = 400;

const SAMPLE_CAPTION = {
  birthday: 'Happy Birthday\nPriya!',
  anniversary: 'Happy Anniversary\nNeha!',
  apology: 'Sorry na,\nAman!',
  festival: 'Happy Diwali\nMaa!',
} as const;

export default function TemplatePreview() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { data: t, isLoading } = useTemplate(id);
  const [saved, setSaved] = useState(false);
  const [copied, setCopied] = useState(false);
  const playback = useFakePlayback(t?.durationSec ?? 15);

  if (isLoading || !t) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.pink} />
      </View>
    );
  }

  const off = discountPercent(t.price, t.originalPrice);
  const facts: { icon: IconName; value: string; label: string }[] = [
    { icon: 'clock', value: `${t.durationSec} sec`, label: 'Length' },
    { icon: 'image', value: `${t.photosMin}–${t.photosMax}`, label: 'Photos' },
    { icon: 'music', value: 'AI song', label: 'Music' },
    { icon: 'film', value: '1080p', label: 'Quality' },
  ];

  const copyId = async () => {
    await Clipboard.setStringAsync(t.id);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const useTemplateNow = () => {
    playback.stop();
    useCreateFlow.getState().set({ templateId: t.id, occasion: t.occasion });
    router.push('/create/details');
  };

  return (
    <View style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: STICKY_FOOTER_SPACE + insets.bottom }}>
        {/* Video preview (gradient stand-in until previewUrl exists) */}
        <View style={{ height: HERO_H + insets.top }}>
          <LinearGradient colors={t.colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.heroShine} />
          <LinearGradient
            colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)', 'rgba(10,10,15,0)', colors.bg]}
            locations={[0, 0.25, 0.7, 1]}
            style={StyleSheet.absoluteFill}
          />
          <View style={[styles.heroTop, { top: insets.top + 12 }]}>
            <IconButton icon="back" label="Go back" size={40} tone="dark" onPress={() => router.back()} />
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <IconButton label={saved ? 'Remove from saved' : 'Save template'} size={40} tone="dark" onPress={() => setSaved((s) => !s)}>
                <IconSwap active={saved} on={<Icon name="heart" size={20} color={colors.pink} strokeWidth={2.4} />} off={<Icon name="heart" size={20} />} />
              </IconButton>
              <IconButton icon="share" label="Share template" size={40} tone="dark" onPress={() => void Share.share({ message: `Check out the “${t.name}” song video template (${t.id})` })} />
            </View>
          </View>
          <AppText variant="display" align="center" style={[styles.caption, { top: insets.top + 92 }]}>
            {SAMPLE_CAPTION[t.occasion]}
          </AppText>
          <PressableScale onPress={playback.toggle} style={[styles.play, { top: insets.top + 190 }]} accessibilityRole="button" accessibilityLabel={playback.playing ? 'Pause preview' : 'Play preview'}>
            <IconSwap active={playback.playing} on={<PauseGlyph size={22} />} off={<PlayGlyph size={22} />} />
          </PressableScale>
          <View style={styles.heroBottom}>
            <View style={styles.soundPill}>
              <Icon name="volume" size={14} />
              <AppText variant="caption" style={{ fontSize: 11 }}>
                Tap for sound
              </AppText>
            </View>
            <View style={styles.durPill}>
              <AppText variant="micro">{`0:${String(Math.round(playback.progress * t.durationSec)).padStart(2, '0')} / 0:${t.durationSec}`}</AppText>
            </View>
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${playback.progress * 100}%` }]} />
          </View>
        </View>

        {/* Info */}
        <View style={styles.info}>
          <Animated.View entering={enterUp(stagger(0))} style={styles.tags}>
            {t.tags.map((tag, i) => (
              <Badge key={tag} label={tag.toUpperCase()} tone={i === 0 ? 'brand' : 'dark'} />
            ))}
          </Animated.View>
          <Animated.View entering={enterUp(stagger(1))} style={styles.nameRow}>
            <AppText variant="h1" style={{ flex: 1 }}>
              {t.name}
            </AppText>
            <View style={styles.made}>
              <Icon name="star" size={14} color={colors.gold} />
              <AppText variant="caption" color="muted">{`${formatCount(t.madeCount)} made`}</AppText>
            </View>
          </Animated.View>
          <Animated.View entering={enterUp(stagger(1))}>
            <PressableScale onPress={copyId} style={styles.idPill} accessibilityRole="button" accessibilityLabel={`Template ID ${t.id}, copy`}>
              <AppText variant="micro" color="muted">
                ID
              </AppText>
              <AppText variant="label" style={{ fontSize: 12, letterSpacing: 0.5 }}>
                {t.id}
              </AppText>
              <Icon name={copied ? 'check' : 'copy'} size={14} color={copied ? colors.success : colors.muted} />
            </PressableScale>
          </Animated.View>
          <Animated.View entering={enterUp(stagger(2))} style={styles.facts}>
            {facts.map((f, i) => (
              <View key={f.label} style={styles.factWrap}>
                <View style={styles.fact}>
                  <Icon name={f.icon} size={18} color={colors.pinkSoft} />
                  <AppText variant="label">{f.value}</AppText>
                  <AppText variant="micro" color="muted" style={{ letterSpacing: 0 }}>
                    {f.label}
                  </AppText>
                </View>
                {i < facts.length - 1 ? <View style={styles.divider} /> : null}
              </View>
            ))}
          </Animated.View>
          <Animated.View entering={enterUp(stagger(3))}>
            <AppText variant="bodySm" color="muted" style={{ lineHeight: 20 }}>
              {t.description}
            </AppText>
          </Animated.View>
        </View>
      </ScrollView>

      {/* Sticky price + CTA (price is dynamic from the API) */}
      <StickyFooter>
        <View style={styles.priceRow}>
          <View>
            <AppText variant="caption" color="muted" style={{ fontSize: 11 }}>
              Price for HD video
            </AppText>
            <View style={styles.amount}>
              <AppText variant="h2">{formatPrice(t.price, t.currency)}</AppText>
              {t.originalPrice ? (
                <AppText variant="label" style={styles.strike}>
                  {formatPrice(t.originalPrice, t.currency)}
                </AppText>
              ) : null}
            </View>
          </View>
          {off ? (
            <View style={styles.off}>
              <AppText variant="micro" style={{ color: colors.success, fontFamily: 'Inter_700Bold' }}>{`${off}% OFF`}</AppText>
            </View>
          ) : null}
        </View>
        <Button label={`Use this template · ${formatPrice(t.price, t.currency)}`} onPress={useTemplateNow} />
      </StickyFooter>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  heroShine: { position: 'absolute', width: 260, height: 260, borderRadius: 130, top: -80, right: -50, backgroundColor: 'rgba(255,255,255,0.16)' },
  heroTop: { position: 'absolute', left: screenPadding, right: screenPadding, flexDirection: 'row', justifyContent: 'space-between' },
  caption: { position: 'absolute', left: 0, right: 0, fontFamily: 'Inter_800ExtraBold' },
  play: {
    position: 'absolute',
    alignSelf: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  heroBottom: { position: 'absolute', bottom: 34, left: screenPadding, right: screenPadding, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  soundPill: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 6 },
  durPill: { backgroundColor: 'rgba(0,0,0,0.35)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 5 },
  progressTrack: { position: 'absolute', bottom: 22, left: screenPadding, right: screenPadding, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.25)' },
  progressFill: { height: 3, borderRadius: 2, backgroundColor: colors.text },
  info: { paddingHorizontal: screenPadding, gap: 14, marginTop: -6 },
  tags: { flexDirection: 'row', gap: 6, flexWrap: 'wrap' },
  nameRow: { flexDirection: 'row', alignItems: 'center' },
  made: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  idPill: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    backgroundColor: colors.glassSoft,
    borderWidth: 1,
    borderColor: colors.border,
  },
  facts: { flexDirection: 'row', paddingVertical: 12, borderRadius: radius.lg, backgroundColor: colors.glassSoft, borderWidth: 1, borderColor: colors.border },
  factWrap: { flex: 1, flexDirection: 'row', alignItems: 'center' },
  fact: { flex: 1, alignItems: 'center', gap: 3 },
  divider: { width: 1, height: 40, backgroundColor: 'rgba(255,255,255,0.08)' },
  priceRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  amount: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  strike: { color: colors.disabled, textDecorationLine: 'line-through' },
  off: { backgroundColor: 'rgba(43,217,124,0.15)', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4 },
});
