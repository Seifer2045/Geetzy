import { memo, useMemo } from 'react';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { colors } from '@/theme';

const pseudo = (i: number) => {
  const x = Math.sin(i * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

/** Deterministic bar heights (0.2..1) — stands in for real audio peaks from the server. */
export const makePeaks = (count: number, seed = 0) =>
  Array.from({ length: count }, (_, i) => 0.2 + 0.8 * Math.abs(Math.sin((i + seed) * 0.55)) * (0.5 + 0.5 * pseudo(i + seed)));

type Props = {
  width: number;
  height: number;
  peaks: number[];
  /** 0..1 — bars before this point use the brand gradient */
  progress?: number;
  barWidth?: number;
  inactiveColor?: string;
};

export const Waveform = memo(({ width, height, peaks, progress = 0, barWidth = 3, inactiveColor = 'rgba(255,255,255,0.25)' }: Props) => {
  const bars = useMemo(() => {
    const n = peaks.length;
    const gap = n > 1 ? (width - n * barWidth) / (n - 1) : 0;
    return peaks.map((p, i) => {
      const h = Math.max(4, p * height);
      return { x: i * (barWidth + gap), y: (height - h) / 2, h, played: i / n < progress };
    });
  }, [peaks, width, height, barWidth, progress]);

  return (
    <Svg width={width} height={height}>
      <Defs>
        <LinearGradient id="wf" x1="0" y1="0" x2={width} y2="0" gradientUnits="userSpaceOnUse">
          <Stop offset="0" stopColor={colors.pink} />
          <Stop offset="0.55" stopColor={colors.magenta} />
          <Stop offset="1" stopColor={colors.violet} />
        </LinearGradient>
      </Defs>
      {bars.map((b, i) => (
        <Rect key={i} x={b.x} y={b.y} width={barWidth} height={b.h} rx={barWidth / 2} fill={b.played ? 'url(#wf)' : inactiveColor} />
      ))}
    </Svg>
  );
});
Waveform.displayName = 'Waveform';
