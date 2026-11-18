import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { router } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { Easing, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useTemplate } from '@/api/hooks';
import {
  AppText,
  Button,
  GlassCard,
  GradientFill,
  Icon,
  IconSwap,
  makePeaks,
  PauseGlyph,
  PlayGlyph,
  PressableScale,
  Screen,
  StickyFooter,
  STICKY_FOOTER_SPACE,
  Toggle,
  TopBar,
  Waveform,
} from '@/components';
import { useFakePlayback } from '@/hooks/useFakePlayback';
import { useStartGift } from '@/hooks/useStartGift';
import { useCreateFlow } from '@/store/createFlow';
import { colors, enterUp, gradients, radius, screenPadding, stagger } from '@/theme';
import { clamp, formatTime } from '@/utils/format';

const WINDOW_PX = 200;
const TRACK_H = 88;

export default function Trim() {
  const flow = useCreateFlow();
  const { data: template } = useTemplate(flow.templateId ?? undefined);
  const { width } = useWindowDimensions();
  const { start: startGift, isPending } = useStartGift();

  const clipSec = template?.durationSec ?? 15;
  const songSec = Math.max(flow.upload?.durationSec ?? 180, clipSec);
  const pxPerSec = WINDOW_PX / clipSec;
  const trackW = width - screenPadding * 2;
  const windowLeft = (trackW - WINDOW_PX) / 2;
  const maxStart = songSec - clipSec;
  const peaks = useMemo(() => makePeaks(Math.round(songSec * 2), 11), [songSec]);

  const [startSec, setStartSec] = useState(clamp(flow.trimStartSec, 0, maxStart));
  const playback = useFakePlayback(clipSec);

  // Waveform scrolls under a fixed 15-sec window.
  const toX = (s: number) => windowLeft - s * pxPerSec;
  const tx = useSharedValue(toX(startSec));
  const dragStart = useSharedValue(0);

  const moveTo = (s: number) => {
    const next = clamp(Math.round(s * 10) / 10, 0, maxStart);
    setStartSec(next);
    tx.value = withTiming(toX(next), { duration: 250, easing: Easing.out(Easing.cubic) });
  };

  useEffect(() => {
    playback.seek(0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startSec]);

  const minX = toX(maxStart);
  const maxX = toX(0);
  const pan = Gesture.Pan()
    .onStart(() => {
      dragStart.value = tx.value;
    })
    .onUpdate((e) => {
      const x = Math.min(maxX, Math.max(minX, dragStart.value + e.translationX));
      tx.value = x;
      runOnJS(setStartSec)(Math.round(((windowLeft - x) / pxPerSec) * 10) / 10);
    });

  const stripStyle = useAnimatedStyle(() => ({ transform: [{ translateX: tx.value }] }));
  const playheadX = windowLeft + playback.progress * WINDOW_PX;

  const applyPart = () => {
    flow.set({ trimStartSec: startSec });
    void startGift();
  };

  return (
    <Screen
      glow="violet"
      bottomInset={STICKY_FOOTER_SPACE}
      contentStyle={{ gap: 16 }}
      footer={
        <StickyFooter>
          <Button label="Use this part" loading={isPending} onPress={applyPart} />
        </StickyFooter>
      }
    >
      <TopBar title={`Trim to ${clipSec} sec`} step={3} />
      <View style={styles.pad}>
        {/* Selected file */}
        <Animated.View entering={enterUp(stagger(0))}>
          <GlassCard tone="soft" padding={10} rounded={radius.lg} style={styles.fileRow}>
            <GradientFill colors={['#FF8A5C', '#E0306E']} vertical style={styles.cover}>
              <Icon name="music" size={18} strokeWidth={2} />
            </GradientFill>
            <View style={{ flex: 1 }}>
              <AppText variant="label" style={{ fontSize: 14 }} numberOfLines={1}>
                {flow.upload?.name ?? 'Your song'}
              </AppText>
              <AppText variant="caption" color="muted" style={{ fontSize: 11 }}>{`${formatTime(songSec)} total`}</AppText>
            </View>
            <PressableScale onPress={() => router.back()} hitSlop={8}>
              <AppText variant="label" color="pinkSoft">
                Change
              </AppText>
            </PressableScale>
          </GlassCard>
        </Animated.View>

        {/* Synced video preview */}
        <Animated.View entering={enterUp(stagger(1))} style={{ alignItems: 'center' }}>
          <PressableScale onPress={playback.toggle} style={styles.video} accessibilityRole="button" accessibilityLabel="Preview this part with the video">
            <LinearGradient colors={template?.colors ?? ['#FFC857', '#B8410E']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <LinearGradient colors={gradients.thumbShade} start={{ x: 0, y: 0.5 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.videoPlay}>
              <IconSwap active={playback.playing} on={<PauseGlyph size={16} color={colors.ink} />} off={<PlayGlyph size={16} color={colors.ink} />} />
            </View>
            <AppText variant="micro" style={styles.videoName}>
              {template?.name ?? 'Template'}
            </AppText>
          </PressableScale>
        </Animated.View>

        {/* Trimmer */}
        <Animated.View entering={enterUp(stagger(2))} style={{ gap: 10 }}>
          <View style={styles.lengthBadge}>
            <Icon name="clock" size={12} />
            <AppText variant="micro" style={{ letterSpacing: 0 }}>{`${clipSec.toFixed(1)} s · matches video`}</AppText>
          </View>

          <GestureDetector gesture={pan}>
            <View style={[styles.track, { width: trackW }]} accessibilityLabel={`Trim window starts at ${formatTime(startSec, true)}`} accessibilityHint="Drag left or right to choose the part">
              <Animated.View style={[styles.strip, stripStyle]}>
                <Waveform width={songSec * pxPerSec} height={70} peaks={peaks} progress={0} barWidth={3} inactiveColor="rgba(255,255,255,0.32)" />
              </Animated.View>
              <View pointerEvents="none" style={[styles.dim, { left: 0, width: windowLeft }]} />
              <View pointerEvents="none" style={[styles.dim, { left: windowLeft + WINDOW_PX, right: 0 }]} />
              <View pointerEvents="none" style={[styles.window, { left: windowLeft, width: WINDOW_PX }]}>
                <View style={[styles.handle, { left: -6 }]}>
                  <View style={styles.grip} />
                </View>
                <View style={[styles.handle, { right: -6 }]}>
                  <View style={styles.grip} />
                </View>
              </View>
              <View pointerEvents="none" style={[styles.playhead, { left: playheadX }]} />
            </View>
          </GestureDetector>

          <View style={[styles.times, { paddingHorizontal: windowLeft - 8 }]}>
            <AppText variant="label" style={{ fontSize: 12 }}>
              {formatTime(startSec, true)}
            </AppText>
            <AppText variant="label" style={{ fontSize: 12 }}>
              {formatTime(startSec + clipSec, true)}
            </AppText>
          </View>

          {/* Whole-song overview */}
          <View style={styles.mini}>
            <View style={styles.miniTrack} />
            <GradientFill style={[styles.miniSel, { left: (startSec / songSec) * trackW, width: Math.max(8, (clipSec / songSec) * trackW) }]} />
          </View>
          <View style={styles.times}>
            <AppText variant="micro" color="faint" style={{ letterSpacing: 0 }}>
              0:00
            </AppText>
            <AppText variant="micro" color="faint" style={{ letterSpacing: 0 }}>
              {formatTime(songSec)}
            </AppText>
          </View>
        </Animated.View>

        {/* Fine controls */}
        <Animated.View entering={enterUp(stagger(3))} style={styles.controls}>
          <PressableScale onPress={() => moveTo(startSec - 1)} style={styles.small} accessibilityLabel="Move back 1 second">
            <AppText variant="label">−1s</AppText>
          </PressableScale>
          <PressableScale onPress={() => moveTo(Math.min(maxStart, songSec * 0.28))} haptic="light" style={styles.auto} accessibilityRole="button" accessibilityLabel="Auto-pick the chorus">
            <Icon name="sparkle" size={15} color={colors.pinkSoft} />
            <AppText variant="label" color="pinkSoft">
              Auto-pick chorus
            </AppText>
          </PressableScale>
          <PressableScale onPress={() => moveTo(startSec + 1)} style={styles.small} accessibilityLabel="Move forward 1 second">
            <AppText variant="label">+1s</AppText>
          </PressableScale>
        </Animated.View>

        <Animated.View entering={enterUp(stagger(4))}>
          <GlassCard tone="soft" padding={14} rounded={radius.lg} style={styles.option}>
            <AppText variant="body" style={{ flex: 1 }}>
              Fade in & out
            </AppText>
            <Toggle value={flow.fade} onChange={(v) => flow.set({ fade: v })} label="Fade in and out" />
          </GlassCard>
        </Animated.View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  pad: { paddingHorizontal: screenPadding, gap: 16 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  cover: { width: 40, height: 40, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  video: { width: 104, height: 184, borderRadius: radius.lg + 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  videoPlay: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center', paddingLeft: 2 },
  videoName: { position: 'absolute', bottom: 10, left: 10, letterSpacing: 0 },
  lengthBadge: { alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 4 },
  track: { height: TRACK_H, justifyContent: 'center', overflow: 'hidden', alignSelf: 'center' },
  strip: { position: 'absolute', left: 0, top: (TRACK_H - 70) / 2 },
  dim: { position: 'absolute', top: 0, bottom: 0, backgroundColor: 'rgba(10,10,15,0.55)' },
  window: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.pink,
    backgroundColor: 'rgba(255,77,141,0.10)',
  },
  handle: { position: 'absolute', top: 22, width: 12, height: 44, borderRadius: 6, backgroundColor: colors.text, alignItems: 'center', justifyContent: 'center' },
  grip: { width: 2, height: 16, borderRadius: 1, backgroundColor: 'rgba(26,16,48,0.5)' },
  playhead: { position: 'absolute', top: 0, bottom: 0, width: 2, borderRadius: 1, backgroundColor: colors.text },
  times: { flexDirection: 'row', justifyContent: 'space-between' },
  mini: { height: 12, justifyContent: 'center' },
  miniTrack: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.1)' },
  miniSel: { position: 'absolute', height: 10, borderRadius: 3 },
  controls: { flexDirection: 'row', gap: 10 },
  small: { width: 56, height: 42, borderRadius: radius.md, backgroundColor: colors.glass, borderWidth: 1, borderColor: colors.border, alignItems: 'center', justifyContent: 'center' },
  auto: {
    flex: 1,
    height: 42,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,77,141,0.12)',
    borderWidth: 1,
    borderColor: 'rgba(255,77,141,0.4)',
  },
  option: { flexDirection: 'row', alignItems: 'center' },
});
