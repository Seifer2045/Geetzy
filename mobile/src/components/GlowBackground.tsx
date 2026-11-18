import { StyleSheet, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { colors } from '@/theme';

type Glow = { x: number; y: number; r: number; color: string; opacity: number };

const PRESETS: Record<string, Glow[]> = {
  default: [
    { x: 40, y: 110, r: 230, color: colors.pink, opacity: 0.3 },
    { x: 330, y: 170, r: 220, color: colors.violet, opacity: 0.3 },
  ],
  top: [
    { x: 20, y: 30, r: 230, color: colors.pink, opacity: 0.26 },
    { x: 340, y: 60, r: 210, color: colors.violet, opacity: 0.26 },
  ],
  violet: [
    { x: 20, y: 40, r: 240, color: colors.violet, opacity: 0.3 },
    { x: 320, y: 360, r: 200, color: colors.pink, opacity: 0.18 },
  ],
  center: [
    { x: 130, y: 300, r: 220, color: colors.pink, opacity: 0.32 },
    { x: 250, y: 380, r: 210, color: colors.violet, opacity: 0.32 },
  ],
};

/** Soft radial glows behind content (cheap SVG gradients — RN can't blur views). */
export const GlowBackground = ({ variant = 'default' }: { variant?: keyof typeof PRESETS }) => {
  const glows = PRESETS[variant] ?? PRESETS.default!;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Svg width="100%" height="100%">
        <Defs>
          {glows.map((g, i) => (
            <RadialGradient key={i} id={`g${i}`} cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={g.color} stopOpacity={g.opacity} />
              <Stop offset="1" stopColor={g.color} stopOpacity={0} />
            </RadialGradient>
          ))}
        </Defs>
        {glows.map((g, i) => (
          <Circle key={i} cx={g.x} cy={g.y} r={g.r} fill={`url(#g${i})`} />
        ))}
      </Svg>
    </View>
  );
};
