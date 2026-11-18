import { useEffect } from 'react';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, Ellipse, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

/** Brand logo mark: gradient tile, music note, gold sparkle. */
export const LogoMark = ({ size = 96 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 96 96">
    <Defs>
      <LinearGradient id="lg" x1="0" y1="0" x2="96" y2="96" gradientUnits="userSpaceOnUse">
        <Stop offset="0" stopColor="#FF4D8D" />
        <Stop offset="0.55" stopColor="#C04CF0" />
        <Stop offset="1" stopColor="#7C5CFF" />
      </LinearGradient>
    </Defs>
    <Rect width="96" height="96" rx="28" fill="url(#lg)" />
    <Path d="M40 64V32l26-6v30" stroke="#FFFFFF" strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    <Circle cx="33" cy="64" r="8" fill="#FFFFFF" />
    <Circle cx="59" cy="56" r="8" fill="#FFFFFF" />
    <Path d="M72 13l2.5 6.5L81 22l-6.5 2.5L72 31l-2.5-6.5L63 22l6.5-2.5z" fill="#FFD27A" />
  </Svg>
);

/** Gentle floating loop (respects Reduce motion). */
const useFloat = (distance = 6, duration = 1800) => {
  const reduce = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    y.value = withRepeat(
      withSequence(
        withTiming(-distance, { duration, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
    );
  }, [reduce, y, distance, duration]);
  return useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
};

/** Login hero: gift box with notes (static art; music-notes Lottie layers on top). */
export const GiftBoxArt = ({ size = 240 }: { size?: number }) => {
  const float = useFloat();
  return (
    <Animated.View style={float}>
      <Svg width={size} height={size} viewBox="0 0 240 240">
        <Defs>
          <LinearGradient id="g1" x1="60" y1="100" x2="180" y2="210" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FF4D8D" />
            <Stop offset="1" stopColor="#7C5CFF" />
          </LinearGradient>
          <LinearGradient id="g2" x1="50" y1="80" x2="190" y2="110" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FF7AA8" />
            <Stop offset="1" stopColor="#A78BFA" />
          </LinearGradient>
        </Defs>
        <Ellipse cx="120" cy="214" rx="70" ry="8" fill="#000000" opacity={0.35} />
        <Rect x="62" y="112" width="116" height="96" rx="16" fill="url(#g1)" />
        <Rect x="52" y="88" width="136" height="32" rx="11" fill="url(#g2)" />
        <Rect x="112" y="88" width="16" height="120" fill="#FFC857" />
        <Path d="M120 88c-10-22-38-26-40-10-2 14 26 12 40 10z" fill="#FFC857" />
        <Path d="M120 88c10-22 38-26 40-10 2 14-26 12-40 10z" fill="#FFB020" />
        <Path d="M204 132l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" fill="#FFFFFF" opacity={0.9} />
        <Path d="M26 146l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#FF4D8D" />
        <Circle cx="170" cy="26" r="4" fill="#A78BFA" />
        <Circle cx="74" cy="20" r="3" fill="#FFC857" />
        <Circle cx="214" cy="190" r="3" fill="#FF7AA8" />
      </Svg>
    </Animated.View>
  );
};

/** Spinning vinyl record (Home hero + Making screen). */
export const Vinyl = ({ size = 104, spinMs = 4000 }: { size?: number; spinMs?: number }) => {
  const reduce = useReducedMotion();
  const r = useSharedValue(0);
  useEffect(() => {
    if (reduce) return;
    r.value = withRepeat(withTiming(360, { duration: spinMs, easing: Easing.linear }), -1);
  }, [reduce, r, spinMs]);
  const spin = useAnimatedStyle(() => ({ transform: [{ rotate: `${r.value}deg` }] }));
  return (
    <Animated.View style={spin}>
      <Svg width={size} height={size} viewBox="0 0 104 104">
        <Defs>
          <LinearGradient id="vr" x1="0" y1="0" x2="104" y2="104" gradientUnits="userSpaceOnUse">
            <Stop offset="0" stopColor="#FF4D8D" />
            <Stop offset="1" stopColor="#7C5CFF" />
          </LinearGradient>
        </Defs>
        <Circle cx="52" cy="52" r="50" fill="#FFFFFF" fillOpacity={0.12} />
        <Circle cx="52" cy="52" r="40" fill="#120A24" />
        <Circle cx="52" cy="52" r="32" stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={1.5} fill="none" />
        <Circle cx="52" cy="52" r="24" stroke="#FFFFFF" strokeOpacity={0.12} strokeWidth={1.5} fill="none" />
        <Path d="M30 30a32 32 0 0 1 20-10" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={2} strokeLinecap="round" fill="none" />
        <Circle cx="52" cy="52" r="12" fill="url(#vr)" />
        <Circle cx="52" cy="52" r="3" fill="#120A24" />
      </Svg>
    </Animated.View>
  );
};

/** Diya art for the featured collection card. */
export const DiyaArt = ({ size = 120 }: { size?: number }) => (
  <Svg width={size} height={size} viewBox="0 0 150 150">
    <Circle cx="110" cy="40" r="60" fill="#FFFFFF" fillOpacity={0.08} />
    <Path d="M60 92c12-6 24-6 36 0" stroke="#FFC857" strokeWidth={4} strokeLinecap="round" fill="none" />
    <Ellipse cx="78" cy="100" rx="22" ry="8" fill="#FFC857" />
    <Path d="M78 92c-6-10 0-22 0-28 4 8 8 16 0 28z" fill="#FF8A3D" />
    <Path d="M120 70l3 7 7 3-7 3-3 7-3-7-7-3 7-3z" fill="#FFFFFF" />
    <Circle cx="40" cy="40" r="3" fill="#FFC857" />
    <Circle cx="130" cy="118" r="3" fill="#FF7AA8" />
  </Svg>
);
