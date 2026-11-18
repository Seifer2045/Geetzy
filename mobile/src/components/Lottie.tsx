import LottieView from 'lottie-react-native';
import type { StyleProp, ViewStyle } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';

// Drop LottieFiles exports into assets/lottie with the same names to upgrade the art.
const SOURCES = {
  confetti: require('../../assets/lottie/confetti-burst.json'),
  equalizer: require('../../assets/lottie/equalizer.json'),
  notes: require('../../assets/lottie/music-notes.json'),
} as const;

export type LottieName = keyof typeof SOURCES;

type Props = { name: LottieName; loop?: boolean; style?: StyleProp<ViewStyle>; speed?: number; onFinish?: () => void };

export const Lottie = ({ name, loop = true, style, speed = 1, onFinish }: Props) => {
  const reduceMotion = useReducedMotion();
  return (
    <LottieView
      source={SOURCES[name]}
      autoPlay={!reduceMotion}
      loop={loop && !reduceMotion}
      speed={speed}
      style={style}
      resizeMode="contain"
      onAnimationFinish={onFinish}
    />
  );
};
