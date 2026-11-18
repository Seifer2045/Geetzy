import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { motion } from '@/theme';

/**
 * Contextual icon cross-fade (play→pause, like→liked):
 * scale 0.25→1 + opacity, non-bouncy spring, never overshoots. Skips animation on first render.
 */
export const IconSwap = ({ active, on, off }: { active: boolean; on: React.ReactNode; off: React.ReactNode }) => {
  const t = useSharedValue(active ? 1 : 0);
  useEffect(() => {
    t.value = withSpring(active ? 1 : 0, motion.spring);
  }, [active, t]);
  const onStyle = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.25 + 0.75 * t.value }] }));
  const offStyle = useAnimatedStyle(() => ({ opacity: 1 - t.value, transform: [{ scale: 1 - 0.75 * t.value }] }));
  return (
    <View>
      <Animated.View style={[StyleSheet.absoluteFill, styles.center, onStyle]}>{on}</Animated.View>
      <Animated.View style={offStyle}>{off}</Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({ center: { alignItems: 'center', justifyContent: 'center' } });
