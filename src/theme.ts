import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

/**
 * iOS-native design tokens.
 *
 * The goal is that a screen built from these tokens reads as a first-class
 * iOS app rather than a generic React Native one. Values trace to Apple's
 * Human Interface Guidelines: the semantic color roles are the iOS system
 * palette (systemBlue, label/secondaryLabel, grouped backgrounds, the
 * hairline separator), the type ramp is the iOS text-style scale on the
 * system font (San Francisco on iOS, Roboto on Android -- both already ship
 * optical sizing and tracking, so we lean on the platform face), and the
 * spacing grid is the 4pt base iOS lays out on.
 *
 * Light-mode only for now. The structure (semantic role names, not raw hex
 * at the call site) is deliberately dark-mode-ready: a future pass can swap
 * `colors` for a `useColorScheme()`-driven palette without touching the
 * screens that consume it.
 */

export const colors = {
  // System accent + intent colors (iOS system palette).
  tint: '#007AFF', // systemBlue -- primary interactive tint
  want: '#FF2D55', // systemPink
  been: '#34C759', // systemGreen
  nope: '#FF3B30', // systemRed
  star: '#FF9F0A', // systemOrange (rating stars)

  // Label colors -- text on top of backgrounds. iOS layers these with
  // decreasing opacity so they sit correctly on any background.
  label: '#000000',
  secondaryLabel: 'rgba(60,60,67,0.6)',
  tertiaryLabel: 'rgba(60,60,67,0.3)',
  labelOnColor: '#FFFFFF',

  // Backgrounds.
  background: '#FFFFFF', // systemBackground -- base surface (cards, bars)
  groupedBackground: '#F2F2F7', // systemGroupedBackground -- screen canvas
  elevatedBackground: '#FFFFFF',

  // Structure.
  separator: 'rgba(60,60,67,0.29)', // hairline separator
  fill: 'rgba(120,120,128,0.12)', // tertiarySystemFill -- pill/chip backgrounds
  scrim: 'rgba(0,0,0,0.4)', // dimming behind modals
  photoScrim: 'rgba(0,0,0,0.55)', // gradient base over card photos
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  pill: 999,
} as const;

/**
 * iOS text styles. Weight, size, and tracking travel together (HIG §
 * typography): large text takes tighter/negative tracking, body sits near 0.
 * The system font is selected by leaving `fontFamily` unset on iOS.
 */
const systemFont = Platform.select({ ios: undefined, default: undefined });

export const type = StyleSheet.create({
  largeTitle: { fontFamily: systemFont, fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37, color: colors.label },
  title1: { fontFamily: systemFont, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36, color: colors.label },
  title2: { fontFamily: systemFont, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35, color: colors.label },
  title3: { fontFamily: systemFont, fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38, color: colors.label },
  headline: { fontFamily: systemFont, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41, color: colors.label },
  body: { fontFamily: systemFont, fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41, color: colors.label },
  callout: { fontFamily: systemFont, fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32, color: colors.label },
  subheadline: { fontFamily: systemFont, fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24, color: colors.label },
  footnote: { fontFamily: systemFont, fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08, color: colors.secondaryLabel },
  caption1: { fontFamily: systemFont, fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0, color: colors.secondaryLabel },
  caption2: { fontFamily: systemFont, fontSize: 11, lineHeight: 13, fontWeight: '400', letterSpacing: 0.07, color: colors.secondaryLabel },
} as unknown as Record<
  | 'largeTitle' | 'title1' | 'title2' | 'title3' | 'headline' | 'body'
  | 'callout' | 'subheadline' | 'footnote' | 'caption1' | 'caption2',
  TextStyle
>);

/**
 * Soft, layered iOS shadows. `sm` for resting chrome (buttons, chips), `lg`
 * for the raised swipe card. Kept subtle: iOS shadows suggest elevation, they
 * don't announce it.
 *
 * Platform-aware on purpose: react-native-web has deprecated the individual
 * `shadow*` style props in favor of the CSS `boxShadow` shorthand (and warns
 * on every use), while native iOS/Android still render from `shadow*` +
 * `elevation`. `elevate()` emits the right shape per platform so call sites
 * keep a single `...shadow.lg` spread and neither platform warns.
 */
export function elevate(
  offsetY: number,
  blur: number,
  opacity: number,
  androidElevation: number
): ViewStyle {
  return Platform.select({
    web: { boxShadow: `0px ${offsetY}px ${blur}px rgba(0,0,0,${opacity})` },
    default: {
      shadowColor: '#000',
      shadowOpacity: opacity,
      shadowRadius: blur,
      shadowOffset: { width: 0, height: offsetY },
      elevation: androidElevation,
    },
  }) as ViewStyle;
}

export const shadow: Record<'sm' | 'md' | 'lg', ViewStyle> = {
  sm: elevate(2, 6, 0.08, 2),
  md: elevate(4, 12, 0.1, 4),
  lg: elevate(12, 24, 0.16, 10),
};

/** Standard iOS screen gutter. */
export const GUTTER = spacing.lg;
