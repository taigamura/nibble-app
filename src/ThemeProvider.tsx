import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { useColorScheme } from 'react-native';

import { AppearanceState } from './settings/appearanceState';
import {
  makeType,
  paletteFor,
  type Appearance,
  type ColorScheme,
  type Palette,
  type TypeRamp,
} from './theme';

export interface ThemeValue {
  /** The user's stored preference ('system' | 'light' | 'dark'). */
  appearance: Appearance;
  /** The resolved scheme actually in effect ('light' | 'dark'). */
  scheme: ColorScheme;
  /** The active semantic palette. Screens color themselves from this. */
  colors: Palette;
  /** The iOS type ramp with the active palette's label colors baked in. */
  type: TypeRamp;
  /** Persists and applies a new appearance preference. */
  setAppearance: (next: Appearance) => void;
}

const ThemeContext = createContext<ThemeValue | null>(null);

/**
 * Provides the active theme (palette + type ramp) to the tree and owns the
 * appearance preference.
 *
 * Resolution: an explicit 'light'/'dark' preference wins; 'system' follows the
 * OS via `useColorScheme()`, which updates live when the user flips the phone's
 * appearance. The stored preference is restored on mount from `AppearanceState`
 * so the app paints in the chosen scheme rather than flashing light first.
 *
 * `appearanceState` is injectable for tests; it defaults to the AsyncStorage
 * -backed implementation.
 */
export function ThemeProvider({
  children,
  appearanceState = new AppearanceState(),
}: {
  children: React.ReactNode;
  appearanceState?: AppearanceState;
}) {
  const systemScheme = useColorScheme();
  const [appearance, setAppearanceState] = useState<Appearance>('system');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = await appearanceState.get();
      if (!cancelled) setAppearanceState(stored);
    })();
    return () => {
      cancelled = true;
    };
  }, [appearanceState]);

  const setAppearance = useMemo(
    () => (next: Appearance) => {
      setAppearanceState(next);
      // Fire-and-forget: the in-memory state already repaints the UI;
      // persisting is what makes the next cold start honor the choice.
      void appearanceState.set(next);
    },
    [appearanceState]
  );

  const scheme: ColorScheme =
    appearance === 'system' ? (systemScheme === 'dark' ? 'dark' : 'light') : appearance;

  const value = useMemo<ThemeValue>(() => {
    const colors = paletteFor(scheme);
    return { appearance, scheme, colors, type: makeType(colors), setAppearance };
  }, [appearance, scheme, setAppearance]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}

/** Reads the active theme. Throws if used outside a `ThemeProvider`. */
export function useTheme(): ThemeValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider');
  return ctx;
}
