import { useState } from 'react';
import { ActivityIndicator, Alert, Share, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useEvent } from 'expo';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import Animated from 'react-native-reanimated';
import { useGift, useVerifyPayment } from '@/api/hooks';
import type { Occasion } from '@/api/types';
import {
  AppText,
  Button,
  GlassCard,
  Icon,
  type IconName,
  IconSwap,
  Lottie,
  PauseGlyph,
  PlayGlyph,
  PressableScale,
  Screen,
  TopBar,
} from '@/components';
import { useFakePlayback } from '@/hooks/useFakePlayback';
import { useCreateFlow } from '@/store/createFlow';
import { colors, enterUp, radius, screenPadding, stagger } from '@/theme';
import { formatPrice } from '@/utils/format';

const CAPTION: Record<Occasion, (n: string) => string> = {
  birthday: (n) => `Happy Birthday\n${n}!`,
  anniversary: (n) => `Happy Anniversary\n${n}!`,
  apology: (n) => `Sorry na,\n${n}!`,
  festival: (n) => `Happy Festival\n${n}!`,
};

const SHARE_TARGETS: { icon: IconName; label: string; color: string }[] = [
  { icon: 'chatHeart', label: 'WhatsApp', color: '#25D366' },
  { icon: 'image', label: 'Status', color: colors.pink },
  { icon: 'download', label: 'Save', color: colors.violet },
  { icon: 'share', label: 'More', color: colors.gold },
];

/** The real rendered video (preview or HD) from the server. Tap to pause/play. */
const RealVideo = ({ uri, hd }: { uri: string; hd: boolean }) => {
  const player = useVideoPlayer(uri, (p) => {
    p.loop = true;
    p.play();
  });
  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing });
  return (
    <PressableScale
      onPress={() => (isPlaying ? player.pause() : player.play())}
      style={styles.video}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? 'Pause video' : 'Play video'}
    >
      <VideoView player={player} style={StyleSheet.absoluteFill} contentFit="cover" nativeControls={false} />
      {!isPlaying ? (
        <View style={styles.play}>
          <PlayGlyph size={22} />
        </View>
      ) : null}
      {hd ? (
        <View style={styles.hdBadge}>
          <AppText variant="micro" style={{ color: colors.successInk }}>
            HD
          </AppText>
        </View>
      ) : null}
    </PressableScale>
  );
};

export default function Preview() {
  const { giftId } = useLocalSearchParams<{ giftId: string }>();
  const { data: gift } = useGift(giftId);
  const verify = useVerifyPayment();
  const playback = useFakePlayback(15);
  const [confettiDone, setConfettiDone] = useState(false);

  if (!gift) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={colors.pink} />
      </View>
    );
  }

  const paid = gift.status === 'paid';
  const hdReady = paid && Boolean(gift.hdUrl);
  const videoUrl = hdReady ? gift.hdUrl : gift.previewUrl;
  const realVideo = videoUrl?.startsWith('http') ? videoUrl : null; // mock uses mock:// placeholders
  const share = () =>
    void Share.share({ message: `${CAPTION[gift.occasion](gift.recipientName).replace('\n', ' ')} 🎵 A song made just for you, from ${gift.senderName}.` });

  /** Mock of Google Play Billing: launch purchase → server verifies token → HD unlocked. */
  const pay = async () => {
    try {
      await verify.mutateAsync(gift.id);
    } catch {
      Alert.alert('Payment failed', 'You were not charged. Please try again.');
    }
  };

  const finish = () => {
    useCreateFlow.getState().reset();
    router.dismissTo('/(tabs)/library');
  };

  return (
    <Screen glow="center" contentStyle={{ gap: 16 }} bottomInset={24}>
      <TopBar title={paid ? 'Your gift is ready' : 'Ready to share'} step={4} onBack={finish} />

      <View style={{ alignItems: 'center' }}>
        <Animated.View entering={enterUp(stagger(0))} style={styles.videoShadow}>
          {realVideo ? (
            <RealVideo key={realVideo} uri={realVideo} hd={hdReady} />
          ) : (
          <PressableScale onPress={playback.toggle} style={styles.video} accessibilityRole="button" accessibilityLabel={playback.playing ? 'Pause video' : 'Play video'}>
            <LinearGradient colors={gift.colors} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={['rgba(0,0,0,0)', 'rgba(0,0,0,0.55)']} start={{ x: 0, y: 0.5 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <AppText variant="h2" align="center" style={styles.caption}>
              {CAPTION[gift.occasion](gift.recipientName)}
            </AppText>
            {!paid ? (
              <AppText variant="h1" style={styles.watermark}>
                PREVIEW
              </AppText>
            ) : null}
            <View style={styles.play}>
              <IconSwap active={playback.playing} on={<PauseGlyph size={22} />} off={<PlayGlyph size={22} />} />
            </View>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${playback.progress * 100}%` }]} />
            </View>
            {paid ? (
              <View style={styles.hdBadge}>
                <AppText variant="micro" style={{ color: colors.successInk }}>
                  HD
                </AppText>
              </View>
            ) : null}
          </PressableScale>
          )}
        </Animated.View>
        {!confettiDone ? (
          <View pointerEvents="none" style={styles.confetti}>
            <Lottie name="confetti" loop={false} style={StyleSheet.absoluteFill} onFinish={() => setConfettiDone(true)} />
          </View>
        ) : null}
      </View>

      <View style={{ paddingHorizontal: screenPadding, gap: 12 }}>
        {paid && !hdReady && realVideo ? (
          <Animated.View key="hd-making" entering={enterUp(0)} style={styles.hdMaking}>
            <ActivityIndicator color={colors.pink} />
            <AppText variant="label" align="center">
              Payment done! Making your HD video…
            </AppText>
            <AppText variant="caption" color="muted" align="center">
              This takes about a minute. You can leave this screen; it will be in your Library.
            </AppText>
          </Animated.View>
        ) : paid ? (
          <Animated.View key="paid" entering={enterUp(0)} style={{ gap: 14 }}>
            <AppText variant="h3" align="center">
              {`Send it to ${gift.recipientName} 🎉`}
            </AppText>
            <View style={styles.shareRow}>
              {SHARE_TARGETS.map((s) => (
                <PressableScale key={s.label} onPress={share} style={styles.shareItem} accessibilityRole="button" accessibilityLabel={`Share to ${s.label}`}>
                  <View style={[styles.shareIcon, { backgroundColor: `${s.color}22`, borderColor: `${s.color}55` }]}>
                    <Icon name={s.icon} size={22} color={s.color} />
                  </View>
                  <AppText variant="caption" color="textSecondary">
                    {s.label}
                  </AppText>
                </PressableScale>
              ))}
            </View>
            <Button label="Done" onPress={finish} />
          </Animated.View>
        ) : (
          <Animated.View key="pay" entering={enterUp(stagger(1))} style={{ gap: 12 }}>
            <GlassCard tone="soft" padding={14} rounded={radius.lg} style={styles.priceRow}>
              <View style={{ flex: 1 }}>
                <AppText variant="label" style={{ fontSize: 14 }}>
                  HD video · no watermark
                </AppText>
                <AppText variant="caption" color="muted" style={{ fontFamily: 'Inter_400Regular' }}>
                  Download & share anywhere
                </AppText>
              </View>
              <AppText variant="h2" color="gold">
                {formatPrice(gift.price)}
              </AppText>
            </GlassCard>
            <Button label={`Pay ${formatPrice(gift.price)} & get HD video`} loading={verify.isPending} onPress={pay} />
            <PressableScale onPress={() => router.back()} style={{ alignSelf: 'center', padding: 6 }}>
              <AppText variant="label" color="pinkSoft">
                Change song or photos
              </AppText>
            </PressableScale>
          </Animated.View>
        )}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' },
  videoShadow: { borderRadius: radius.xxl, shadowColor: '#FF8A3D', shadowOpacity: 0.35, shadowRadius: 30, shadowOffset: { width: 0, height: 18 }, elevation: 12 },
  video: { width: 230, height: 408, borderRadius: radius.xxl, overflow: 'hidden', alignItems: 'center', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  caption: { marginTop: 36, fontFamily: 'Inter_800ExtraBold', fontSize: 26, lineHeight: 30 },
  watermark: { position: 'absolute', top: '62%', opacity: 0.18, letterSpacing: 4, transform: [{ rotate: '-25deg' }] },
  play: {
    position: 'absolute',
    top: '45%',
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.25)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
    paddingLeft: 3,
  },
  track: { position: 'absolute', left: 16, right: 16, bottom: 22, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)' },
  fill: { height: 3, borderRadius: 2, backgroundColor: colors.text },
  hdBadge: { position: 'absolute', top: 12, right: 12, backgroundColor: colors.success, borderRadius: 7, paddingHorizontal: 7, paddingVertical: 3 },
  confetti: { position: 'absolute', width: 360, height: 360, top: 20, alignSelf: 'center' },
  priceRow: { flexDirection: 'row', alignItems: 'center' },
  hdMaking: { alignItems: 'center', gap: 8, paddingVertical: 8 },
  shareRow: { flexDirection: 'row', justifyContent: 'space-between' },
  shareItem: { alignItems: 'center', gap: 6, width: 72 },
  shareIcon: { width: 56, height: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
});
