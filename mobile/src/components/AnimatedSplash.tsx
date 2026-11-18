import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { brand } from '@/config/brand';
import { colors } from '@/theme';
import { AppText } from './AppText';
import { GlowBackground } from './GlowBackground';
import { LogoMark } from './Illustrations';
import { GradientFill } from './primitives';

const out = Easing.out(Easing.cubic);
const inOut = Easing.inOut(Easing.cubic);

/** One bar of the sound wave: staggered bounce, then settles. */
const Bar = ({ index, height }: { index: number; height: number }) => {
  const s = useSharedValue(0.3);
  useEffect(() => {
    const start = 1250 + index * 80;
    s.value = withDelay(
      start,
      withRepeat(withSequence(withTiming(1.15, { duration: 250, easing: out }), withTiming(0.5, { duration: 250, easing: inOut })), 3, true),
    );
  }, [index, s]);
  const style = useAnimatedStyle(() => ({ transform: [{ scaleY: s.value }] }));
  return (
    <Animated.View style={[{ height, width: 6, borderRadius: 3, overflow: 'hidden' }, style]}>
      <GradientFill style={StyleSheet.absoluteFill} />
    </Animated.View>
  );
};

/**
 * Animated splash — same timeline as the Figma motion (2.8s):
 * glows bloom → logo pops in with a twist → wordmark & tagline rise → sound bars bounce → fade out.
 */
export const AnimatedSplash = ({ onDone }: { onDone: () => void }) => {
  const reduce = useReducedMotion();
  const glow = useSharedValue(0);
  const logoP = useSharedValue(0);
  const logoScale = useSharedValue(0.3);
  const word = useSharedValue(0);
  const tag = useSharedValue(0);
  const wave = useSharedValue(0);
  const foot = useSharedValue(0);
  const exit = useSharedValue(1);

  useEffect(() => {
    if (reduce) {
      glow.value = logoP.value = word.value = tag.value = wave.value = foot.value = 1;
      logoScale.value = 1;
      exit.value = withDelay(700, withTiming(0, { duration: 250 }, (f) => f && runOnJS(onDone)()));
      return;
    }
    glow.value = withTiming(1, { duration: 1000, easing: out });
    logoP.value = withDelay(150, withTiming(1, { duration: 600, easing: out }));
    logoScale.value = withDelay(150, withSequence(withTiming(1.12, { duration: 500, easing: out }), withTiming(1, { duration: 250, easing: inOut })));
    word.value = withDelay(750, withTiming(1, { duration: 400, easing: out }));
    tag.value = withDelay(1000, withTiming(1, { duration: 400, easing: out }));
    wave.value = withDelay(1150, withTiming(1, { duration: 250 }));
    foot.value = withDelay(1400, withTiming(1, { duration: 400 }));
    exit.value = withDelay(2500, withTiming(0, { duration: 300, easing: inOut }, (f) => f && runOnJS(onDone)()));
  }, [reduce, glow, logoP, logoScale, word, tag, wave, foot, exit, onDone]);

  const rootStyle = useAnimatedStyle(() => ({ opacity: exit.value }));
  const glowStyle = useAnimatedStyle(() => ({ opacity: glow.value, transform: [{ scale: 0.4 + 0.6 * glow.value }] }));
  const logoStyle = useAnimatedStyle(() => ({
    opacity: Math.min(1, logoP.value * 2),
    transform: [{ scale: logoScale.value }, { rotate: `${25 * (1 - logoP.value)}deg` }],
  }));
  const wordStyle = useAnimatedStyle(() => ({ opacity: word.value, transform: [{ translateY: 18 * (1 - word.value) }] }));
  const tagStyle = useAnimatedStyle(() => ({ opacity: tag.value, transform: [{ translateY: 12 * (1 - tag.value) }] }));
  const waveStyle = useAnimatedStyle(() => ({ opacity: wave.value }));
  const footStyle = useAnimatedStyle(() => ({ opacity: foot.value }));

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, rootStyle]} accessibilityLabel={`${brand.name} is loading`}>
      <Animated.View style={[StyleSheet.absoluteFill, glowStyle]}>
        <GlowBackground variant="center" />
      </Animated.View>
      <View style={styles.center}>
        <Animated.View style={logoStyle}>
          <LogoMark size={96} />
        </Animated.View>
        <Animated.View style={[{ marginTop: 22 }, wordStyle]}>
          <AppText variant="display" style={{ fontSize: 40, lineHeight: 46, letterSpacing: -1.2 }}>
            {brand.name}
          </AppText>
        </Animated.View>
        <Animated.View style={tagStyle}>
          <AppText variant="bodySm" color="muted" style={{ fontFamily: 'Inter_500Medium', fontSize: 14 }}>
            {brand.tagline}
          </AppText>
        </Animated.View>
        <Animated.View style={[styles.wave, waveStyle]}>
          {[14, 24, 28, 20, 12].map((h, i) => (
            <Bar key={i} index={i} height={h} />
          ))}
        </Animated.View>
      </View>
      <Animated.View style={[styles.footer, footStyle]}>
        <AppText variant="caption" style={{ color: '#5E5873' }}>
          Made with ♥ in India
        </AppText>
      </Animated.View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  root: { backgroundColor: colors.bg, zIndex: 100 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 13, height: 28, marginTop: 24 },
  footer: { position: 'absolute', bottom: 48, alignSelf: 'center' },
});
