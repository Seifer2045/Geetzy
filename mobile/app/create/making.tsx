import { useEffect } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Animated, { Easing, useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Path, Stop } from 'react-native-svg';
import { useGift } from '@/api/hooks';
import type { GiftStatus } from '@/api/types';
import { AppText, Button, GlassCard, Lottie, Screen, Vinyl } from '@/components';
import { env } from '@/config/env';
import { colors, enterUp, screenPadding, stagger } from '@/theme';

/** Rough time for the whole job: ElevenLabs song + JSON2Video render (mock: 14 s). */
const TYPICAL_JOB_SEC = env.useMock ? 14 : 75;

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const SIZE = 220;
const R = 100;
const C = 2 * Math.PI * R;

const STEPS: { key: GiftStatus; label: string }[] = [
  { key: 'composing', label: 'Composing your song' },
  { key: 'rendering', label: 'Syncing photos to the beat' },
  { key: 'preview_ready', label: 'Final touches' },
];
const ORDER: GiftStatus[] = ['queued', 'writing_lyrics', 'composing', 'rendering', 'preview_ready', 'paid'];

const StepIcon = ({ state }: { state: 'done' | 'now' | 'todo' }) => (
  <Svg width={22} height={22} viewBox="0 0 24 24">
    {state === 'done' ? (
      <>
        <Circle cx="12" cy="12" r="11" fill={colors.success} fillOpacity={0.16} />
        <Path d="M7.5 12.5l3 3 6-6.5" stroke={colors.success} strokeWidth={2.4} strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </>
    ) : state === 'now' ? (
      <>
        <Circle cx="12" cy="12" r="11" fill={colors.pink} fillOpacity={0.18} />
        <Circle cx="12" cy="12" r="4.5" fill={colors.pink} />
      </>
    ) : (
      <Circle cx="12" cy="12" r="10" stroke="#FFFFFF" strokeOpacity={0.2} strokeWidth={2} fill="none" />
    )}
  </Svg>
);

export default function Making() {
  const { giftId } = useLocalSearchParams<{ giftId: string }>();
  const { data: gift } = useGift(giftId);
  const progress = gift?.progress ?? 0;
  const status = gift?.status ?? 'queued';

  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(progress, { duration: 650, easing: Easing.out(Easing.cubic) });
  }, [progress, p]);
  const ringProps = useAnimatedProps(() => ({ strokeDashoffset: C * (1 - p.value) }));

  useEffect(() => {
    if (status === 'preview_ready' || status === 'paid') {
      const id = setTimeout(() => router.replace({ pathname: '/create/preview', params: { giftId } }), 600);
      return () => clearTimeout(id);
    }
    if (status === 'failed') {
      Alert.alert(
        'Could not make your video',
        'Something went wrong while making the song or video. You were not charged. Please try again.',
        [{ text: 'Go back', onPress: () => router.back() }],
      );
    }
  }, [status, giftId]);

  const idx = ORDER.indexOf(status);
  const remainingSec = Math.max(5, Math.round((1 - progress) * TYPICAL_JOB_SEC));

  return (
    <Screen glow="center" scroll={false} contentStyle={styles.root}>
      <Animated.View entering={enterUp(stagger(0))} style={styles.ringWrap}>
        <Svg width={SIZE} height={SIZE} style={StyleSheet.absoluteFill}>
          <Defs>
            <LinearGradient id="ring" x1="0" y1="0" x2={SIZE} y2={SIZE} gradientUnits="userSpaceOnUse">
              <Stop offset="0" stopColor={colors.pink} />
              <Stop offset="1" stopColor={colors.violet} />
            </LinearGradient>
          </Defs>
          <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke="rgba(255,255,255,0.08)" strokeWidth={10} fill="none" />
          <AnimatedCircle
            cx={SIZE / 2}
            cy={SIZE / 2}
            r={R}
            stroke="url(#ring)"
            strokeWidth={10}
            strokeLinecap="round"
            fill="none"
            strokeDasharray={`${C} ${C}`}
            animatedProps={ringProps}
            transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
          />
        </Svg>
        <Vinyl size={140} spinMs={3000} />
        <Lottie name="notes" style={styles.notes} />
      </Animated.View>

      <Animated.View entering={enterUp(stagger(1))} style={{ alignItems: 'center', gap: 6 }}>
        <AppText variant="h1" style={{ fontSize: 34, lineHeight: 40 }} accessibilityLiveRegion="polite">{`${Math.round(progress * 100)}%`}</AppText>
        <AppText variant="h3" align="center">{`Making ${gift?.recipientName ?? 'their'}’s video`}</AppText>
        <AppText variant="bodySm" color="muted" align="center" style={{ maxWidth: 280 }}>
          {`About ${remainingSec} sec left. You can close the app — we’ll notify you.`}
        </AppText>
      </Animated.View>

      <Animated.View entering={enterUp(stagger(2))} style={{ alignSelf: 'stretch' }}>
        <GlassCard tone="soft" padding={18} style={{ gap: 14 }}>
          {STEPS.map((s, i) => {
            const stepIdx = i + 1;
            const state = idx > stepIdx || (status === 'preview_ready' && s.key === 'preview_ready') ? 'done' : idx === stepIdx ? 'now' : 'todo';
            return (
              <View key={s.key} style={styles.step}>
                <StepIcon state={state} />
                <AppText variant={state === 'now' ? 'label' : 'body'} style={{ flex: 1, fontSize: 14, color: state === 'todo' ? colors.disabled : colors.text }}>
                  {s.label}
                </AppText>
                {state !== 'todo' ? (
                  <AppText variant="caption" style={{ fontSize: 11, color: state === 'now' ? colors.pinkSoft : colors.disabled }}>
                    {state === 'now' ? 'In progress' : 'Done'}
                  </AppText>
                ) : null}
              </View>
            );
          })}
        </GlassCard>
      </Animated.View>

      <View style={{ flex: 1 }} />
      <Button variant="glass" label="Notify me when it’s ready" onPress={() => router.dismissTo('/(tabs)/library')} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', paddingHorizontal: screenPadding, gap: 20, paddingTop: 40 },
  ringWrap: { width: SIZE, height: SIZE, alignItems: 'center', justifyContent: 'center' },
  notes: { position: 'absolute', width: 160, height: 160, top: -40, right: -40 },
  step: { flexDirection: 'row', alignItems: 'center', gap: 12 },
});
