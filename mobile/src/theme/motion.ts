import {
  Easing,
  withDelay,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';
import { motion } from './tokens';

/** Enter: opacity 0→1 + translateY 12→0, 300ms ease-out, optional delay (stagger). */
export const enterUp = (delay = 0): EntryExitAnimationFunction => () => {
  'worklet';
  const cfg = { duration: motion.enterMs, easing: Easing.out(Easing.quad) };
  return {
    initialValues: { opacity: 0, transform: [{ translateY: motion.enterOffset }] },
    animations: {
      opacity: withDelay(delay, withTiming(1, cfg)),
      transform: [{ translateY: withDelay(delay, withTiming(0, cfg)) }],
    },
  };
};

/** Exit: softer than enter — 150ms, fixed -12px. */
export const exitUp: EntryExitAnimationFunction = () => {
  'worklet';
  const cfg = { duration: motion.exitMs, easing: Easing.in(Easing.quad) };
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: {
      opacity: withTiming(0, cfg),
      transform: [{ translateY: withTiming(-motion.enterOffset, cfg) }],
    },
  };
};

/** Stagger helper: delay for the n-th group. */
export const stagger = (index: number, step: number = motion.staggerMs) => index * step;
