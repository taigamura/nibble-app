import { Platform, StyleSheet, type TextStyle, type ViewStyle } from 'react-native';

/**
 * iOS-native design tokens, now theme-aware.
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
 * Colors are no longer a single static object: `lightColors` / `darkColors`
 * carry the two iOS semantic palettes, and screens read the active one from
 * `useTheme()` (see ./theme/ThemeProvider) rather than importing `colors`
 * directly. `spacing`, `radius`, `elevate`, `shadow`, and `GUTTER` are
 * color-independent and remain static module exports.
 */

/** The resolved light/dark scheme actually in effect (never 'system'). */
export type ColorScheme = 'light' | 'dark';

/** The user's stored preference. 'system' follows the OS via useColorScheme(). */
export type Appearance = 'system' | 'light' | 'dark';

/**
 * The full set of semantic color roles. Every screen colors itself from these
 * roles (via `useTheme().colors`), never from raw hex, so a scheme swap is a
 * single palette change.
 */
export interface Palette {
  // System accent + intent colors (iOS system palette).
  tint: string; // primary interactive tint (systemBlue)
  want: string; // systemPink
  been: string; // systemGreen
  nope: string; // systemRed
  star: string; // systemOrange (rating stars)

  // Label colors -- text on top of backgrounds.
  label: string;
  secondaryLabel: string;
  tertiaryLabel: string;
  labelOnColor: string; // text/icon on top of a filled accent color

  // Backgrounds.
  background: string; // systemBackground -- base surface (cards, bars)
  groupedBackground: string; // systemGroupedBackground -- screen canvas
  elevatedBackground: string; // raised surfaces (sheets, popovers)

  // Structure.
  separator: string; // hairline separator
  fill: string; // tertiary system fill -- pill/chip backgrounds
  material: string; // translucent segmented-control fill (over photos)
  scrim: string; // dimming behind modals
  photoScrim: string; // gradient base over card photos

  // Web-only "desk" backdrop the phone frame floats on (AppShell).
  canvasBackdrop: string;
}

export const lightColors: Palette = {
  tint: '#007AFF', // systemBlue
  want: '#FF2D55', // systemPink
  been: '#34C759', // systemGreen
  nope: '#FF3B30', // systemRed
  star: '#FF9F0A', // systemOrange

  label: '#000000',
  secondaryLabel: 'rgba(60,60,67,0.6)',
  tertiaryLabel: 'rgba(60,60,67,0.3)',
  labelOnColor: '#FFFFFF',

  background: '#FFFFFF', // systemBackground
  groupedBackground: '#F2F2F7', // systemGroupedBackground
  elevatedBackground: '#FFFFFF',

  separator: 'rgba(60,60,67,0.29)',
  fill: 'rgba(120,120,128,0.12)', // tertiarySystemFill
  material: 'rgba(120,120,128,0.28)', // translucent segmented-control fill (over photos)
  scrim: 'rgba(0,0,0,0.4)',
  photoScrim: 'rgba(0,0,0,0.55)',

  canvasBackdrop: '#E3E3E8', // systemGray6-ish desk
};

export const darkColors: Palette = {
  tint: '#0A84FF', // systemBlue (dark)
  want: '#FF375F', // systemPink (dark)
  been: '#30D158', // systemGreen (dark)
  nope: '#FF453A', // systemRed (dark)
  star: '#FF9F0A', // systemOrange (dark)

  label: '#FFFFFF',
  secondaryLabel: 'rgba(235,235,245,0.6)',
  tertiaryLabel: 'rgba(235,235,245,0.3)',
  labelOnColor: '#FFFFFF',

  background: '#1C1C1E', // secondarySystemBackground (dark) -- cards, bars
  // The global dark canvas. Matches simple-bookkeeping's dark app background
  // (theme/tokens.ts `dark.bg` = #0F0F13) rather than pure black, so the app
  // reads as the same soft-charcoal system across both apps.
  groupedBackground: '#0F0F13',
  elevatedBackground: '#2C2C2E',

  separator: 'rgba(84,84,88,0.6)',
  fill: 'rgba(120,120,128,0.24)',
  material: 'rgba(120,120,128,0.36)', // translucent segmented-control fill (over photos)
  scrim: 'rgba(0,0,0,0.6)',
  photoScrim: 'rgba(0,0,0,0.55)',

  canvasBackdrop: '#0A0A0A',
};

export function paletteFor(scheme: ColorScheme): Palette {
  return scheme === 'dark' ? darkColors : lightColors;
}

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
 *
 * The ramp is color-independent here; `useTheme().type` returns the same ramp
 * with the active palette's label colors baked in, so call sites keep using
 * `type.body` etc. without hand-threading a color. The larger/body styles use
 * `label`; footnote/caption default to `secondaryLabel`, matching iOS.
 */
const systemFont = Platform.select({ ios: undefined, default: undefined });

export type TypeRamp = Record<
  | 'largeTitle' | 'title1' | 'title2' | 'title3' | 'headline' | 'body'
  | 'callout' | 'subheadline' | 'footnote' | 'caption1' | 'caption2',
  TextStyle
>;

/** Builds the type ramp with the given palette's label colors baked in. */
export function makeType(colors: Palette): TypeRamp {
  return StyleSheet.create({
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
  } as unknown as TypeRamp);
}

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
