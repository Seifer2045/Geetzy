import { Pressable, type PressableProps, type StyleProp, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { motion } from '@/theme';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

type Props = Omit<PressableProps, 'style'> & {
  style?: StyleProp<ViewStyle>;
  scaleTo?: number;
  haptic?: 'light' | 'medium' | 'selection' | false;
};

/** Base for every tappable: interruptible scale-down on press (0.97), optional haptic. */
export const PressableScale = ({ style, scaleTo = motion.pressScale, haptic = false, onPressIn, onPressOut, onPress, disabled, ...rest }: Props) => {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <AnimatedPressable
      {...rest}
      disabled={disabled}
      onPressIn={(e) => {
        scale.value = withTiming(scaleTo, { duration: motion.pressMs });
        onPressIn?.(e);
      }}
      onPressOut={(e) => {
        scale.value = withTiming(1, { duration: motion.pressMs });
        onPressOut?.(e);
      }}
      onPress={(e) => {
        if (haptic === 'selection') void Haptics.selectionAsync();
        else if (haptic) void Haptics.impactAsync(haptic === 'medium' ? Haptics.ImpactFeedbackStyle.Medium : Haptics.ImpactFeedbackStyle.Light);
        onPress?.(e);
      }}
      style={[style, animatedStyle, disabled ? { opacity: 0.45 } : null]}
    />
  );
};
