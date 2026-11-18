// Design tokens — mirror of Figma "v2 – Premium". Never hardcode values in screens.

export const colors = {
  bg: '#0A0A0F',
  surface: '#14121C',
  surfaceRaised: '#1A1724',
  glass: 'rgba(255,255,255,0.06)',
  glassSoft: 'rgba(255,255,255,0.04)',
  glassStrong: 'rgba(255,255,255,0.10)',
  border: 'rgba(255,255,255,0.09)',
  borderStrong: 'rgba(255,255,255,0.18)',
  scrim: 'rgba(0,0,0,0.35)',
  text: '#FFFFFF',
  textSecondary: '#C9C3DA',
  muted: '#9A93B0',
  faint: '#7D7790',
  disabled: '#6E6884',
  pink: '#FF4D8D',
  pinkSoft: '#FF7AA8',
  magenta: '#C04CF0',
  violet: '#7C5CFF',
  gold: '#FFC857',
  goldInk: '#2A1A00',
  success: '#2BD97C',
  successInk: '#06210F',
  danger: '#FF5C5C',
  ink: '#1A1030',
} as const;

export type ColorToken = keyof typeof colors;

export const gradients = {
  brand: ['#FF4D8D', '#C04CF0', '#7C5CFF'],
  hero: ['#FF4D8D', '#B44CF0', '#6D4CFF'],
  collection: ['#3A1C9B', '#8E2DE2', '#FF4D8D'],
  player: ['#2A1240', '#1A1530'],
  thumbShade: ['rgba(0,0,0,0)', 'rgba(0,0,0,0.65)'],
} as const satisfies Record<string, readonly string[]>;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, xxxl: 32 } as const;
export const screenPadding = spacing.xl;

export const radius = { sm: 8, md: 12, lg: 16, xl: 20, xxl: 24, pill: 999 } as const;

export const fonts = {
  regular: 'Inter_400Regular',
  medium: 'Inter_500Medium',
  semibold: 'Inter_600SemiBold',
  bold: 'Inter_700Bold',
  extrabold: 'Inter_800ExtraBold',
} as const;

const ls = (size: number, percent: number) => (size * percent) / 100;

export const typography = {
  display: { fontFamily: fonts.bold, fontSize: 30, lineHeight: 35, letterSpacing: ls(30, -3) },
  h1: { fontFamily: fonts.bold, fontSize: 28, lineHeight: 34, letterSpacing: ls(28, -3) },
  h2: { fontFamily: fonts.bold, fontSize: 24, lineHeight: 30, letterSpacing: ls(24, -3) },
  h3: { fontFamily: fonts.semibold, fontSize: 20, lineHeight: 26, letterSpacing: ls(20, -1) },
  title: { fontFamily: fonts.semibold, fontSize: 17, lineHeight: 22, letterSpacing: 0 },
  body: { fontFamily: fonts.medium, fontSize: 15, lineHeight: 21, letterSpacing: 0 },
  bodyRegular: { fontFamily: fonts.regular, fontSize: 15, lineHeight: 22, letterSpacing: 0 },
  bodySm: { fontFamily: fonts.regular, fontSize: 13, lineHeight: 19, letterSpacing: 0 },
  label: { fontFamily: fonts.semibold, fontSize: 13, lineHeight: 18, letterSpacing: 0 },
  caption: { fontFamily: fonts.medium, fontSize: 12, lineHeight: 16, letterSpacing: 0 },
  overline: { fontFamily: fonts.semibold, fontSize: 11, lineHeight: 14, letterSpacing: ls(11, 6), textTransform: 'uppercase' },
  micro: { fontFamily: fonts.semibold, fontSize: 10, lineHeight: 13, letterSpacing: ls(10, 4) },
} as const;

export type TypographyVariant = keyof typeof typography;

export const motion = {
  enterMs: 300,
  exitMs: 150,
  staggerMs: 100,
  gridStaggerMs: 60,
  pressScale: 0.97,
  pressMs: 120,
  enterOffset: 12,
  // No overshoot: high damping springs only.
  spring: { mass: 0.4, damping: 18, stiffness: 220 },
} as const;

export const shadows = {
  brandGlow: {
    shadowColor: '#E0479E',
    shadowOpacity: 0.45,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  float: {
    shadowColor: '#000000',
    shadowOpacity: 0.5,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: 12 },
    elevation: 16,
  },
} as const;

export const layout = {
  buttonHeight: 56,
  tabBarHeight: 68,
  tabBarBottomGap: 12,
  hitSlop: { top: 10, bottom: 10, left: 10, right: 10 },
} as const;
