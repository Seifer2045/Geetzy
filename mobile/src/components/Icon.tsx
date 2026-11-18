import { memo } from 'react';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { colors } from '@/theme';

// 24px grid, 1.9 stroke — same paths as the Figma icons.
const ICONS = {
  back: <Path d="M15 18l-6-6 6-6" />,
  chevronRight: <Path d="M9 18l6-6-6-6" />,
  arrowRight: <Path d="M5 12h14M13 6l6 6-6 6" />,
  close: <Path d="M7 7l10 10M17 7L7 17" />,
  plus: <Path d="M12 5v14M5 12h14" />,
  check: <Path d="M5 12.5l4.5 4.5L19 7.5" />,
  home: <Path d="M3 10.5L12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" />,
  explore: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M15.5 8.5l-2 5-5 2 2-5z" />
    </>
  ),
  library: (
    <>
      <Rect x="3" y="7" width="18" height="14" rx="3" />
      <Path d="M7 3h10M10.5 11.5v5l4-2.5z" />
    </>
  ),
  user: (
    <>
      <Circle cx="12" cy="8" r="4" />
      <Path d="M4 21c0-4 4-6 8-6s8 2 8 6" />
    </>
  ),
  bell: <Path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />,
  search: (
    <>
      <Circle cx="11" cy="11" r="7" />
      <Path d="M20 20l-3.5-3.5" />
    </>
  ),
  mic: (
    <>
      <Rect x="9" y="2" width="6" height="12" rx="3" />
      <Path d="M5 10a7 7 0 0 0 14 0M12 17v4" />
    </>
  ),
  filter: <Path d="M4 6h16M7 12h10M10 18h4" />,
  heart: <Path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.6-7 10-7 10z" />,
  share: <Path d="M4 12v7a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7M16 6l-4-4-4 4M12 2v14" />,
  download: <Path d="M4 17v2a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2M7 10l5 5 5-5M12 15V3" />,
  edit: <Path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z" />,
  refresh: <Path d="M21 12a9 9 0 1 1-2.6-6.4M21 4v5h-5" />,
  music: (
    <>
      <Path d="M9 18V5l12-2v13" />
      <Circle cx="6" cy="18" r="3" />
      <Circle cx="18" cy="16" r="3" />
    </>
  ),
  upload: <Path d="M12 15V3M7 8l5-5 5 5M5 21h14" />,
  clock: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M12 7v5l3 2" />
    </>
  ),
  image: (
    <>
      <Rect x="3" y="5" width="18" height="14" rx="2" />
      <Circle cx="9" cy="10" r="2" />
      <Path d="M21 16l-5-5-8 8" />
    </>
  ),
  sparkle: <Path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z" />,
  star: <Path d="M12 3l2.6 5.6 6 .7-4.5 4.1 1.2 6L12 16.5 6.7 19.4l1.2-6L3.4 9.3l6-.7z" />,
  bolt: <Path d="M13 2L4 14h7l-1 8 9-12h-7z" />,
  cassette: (
    <>
      <Rect x="3" y="6" width="18" height="12" rx="2" />
      <Circle cx="8.5" cy="12" r="2" />
      <Circle cx="15.5" cy="12" r="2" />
      <Path d="M8.5 14h7" />
    </>
  ),
  cake: <Path d="M4 21h16M5 21v-7a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v7M5 16c2 1.5 4 1.5 7 0s5-1.5 7 0M12 12V8M12 5.5c.8-.8.8-1.7 0-2.5-.8.8-.8 1.7 0 2.5z" />,
  chatHeart: (
    <>
      <Path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z" />
      <Path d="M12 15s-3-1.8-3-4a1.7 1.7 0 0 1 3-1 1.7 1.7 0 0 1 3 1c0 2.2-3 4-3 4z" />
    </>
  ),
  diya: (
    <>
      <Path d="M12 3l1.8 4.7 4.7 1.8-4.7 1.8L12 16l-1.8-4.7-4.7-1.8 4.7-1.8z" />
      <Path d="M5 20h14" />
    </>
  ),
  lock: (
    <>
      <Rect x="4" y="11" width="16" height="10" rx="2" />
      <Path d="M8 11V7a4 4 0 0 1 8 0" />
    </>
  ),
  card: (
    <>
      <Rect x="2" y="5" width="20" height="14" rx="2" />
      <Path d="M2 10h20" />
    </>
  ),
  globe: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18" />
    </>
  ),
  help: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3M12 17h.01" />
    </>
  ),
  shield: <Path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />,
  logout: <Path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />,
  trash: <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />,
  copy: (
    <>
      <Rect x="9" y="9" width="12" height="12" rx="2" />
      <Path d="M5 15V5a2 2 0 0 1 2-2h10" />
    </>
  ),
  settings: (
    <>
      <Circle cx="12" cy="12" r="3" />
      <Path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z" />
    </>
  ),
  volume: <Path d="M11 5L6 9H2v6h4l5 4zM19 9a5 5 0 0 1 0 6" />,
  film: (
    <>
      <Rect x="2" y="6" width="20" height="12" rx="2" />
      <Path d="M7 10v4M17 10v4M10 12h4" />
    </>
  ),
  smile: (
    <>
      <Circle cx="12" cy="12" r="9" />
      <Path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" />
    </>
  ),
  more: (
    <>
      <Circle cx="5" cy="12" r="1.6" fill="currentColor" />
      <Circle cx="12" cy="12" r="1.6" fill="currentColor" />
      <Circle cx="19" cy="12" r="1.6" fill="currentColor" />
    </>
  ),
  phone: <Rect x="6" y="2" width="12" height="20" rx="3" />,
} as const;

export type IconName = keyof typeof ICONS;

type Props = { name: IconName; size?: number; color?: string; strokeWidth?: number };

export const Icon = memo(({ name, size = 22, color = colors.text, strokeWidth = 1.9 }: Props) => (
  <Svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    color={color}
    fill="none"
    stroke={color}
    strokeWidth={strokeWidth}
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    {ICONS[name]}
  </Svg>
));
Icon.displayName = 'Icon';

/** Solid play triangle (filled, not stroked). */
export const PlayGlyph = ({ size = 16, color = colors.text }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Path d="M7 4v16l13-8z" fill={color} />
  </Svg>
);

export const PauseGlyph = ({ size = 16, color = colors.text }: { size?: number; color?: string }) => (
  <Svg width={size} height={size} viewBox="0 0 24 24">
    <Rect x="6" y="4" width="4" height="16" rx="1.5" fill={color} />
    <Rect x="14" y="4" width="4" height="16" rx="1.5" fill={color} />
  </Svg>
);
