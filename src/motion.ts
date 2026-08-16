/**
 * Apple-style spring tokens for React Native's `Animated.spring`.
 *
 * Apple's designers think in terms of `dampingRatio` (ζ, 0..1: how much a
 * spring overshoots — 1 is critically damped / no overshoot) and `response`
 * (T, seconds: roughly the time to first settle). React Native's
 * `Animated.spring` instead wants a physical `{ stiffness, damping, mass }`
 * config. `makeSpring` converts between the two (holding mass at 1):
 *
 *   omega0     = 2*PI / response        (natural angular frequency)
 *   stiffness  = omega0^2
 *   damping    = 2 * dampingRatio * omega0
 *
 * `useNativeDriver` is intentionally left to the caller: transform/opacity
 * animations can run on the native driver, but anything animating layout
 * props (width, height, etc.) or feeding an Animated interpolation into a
 * non-transform/opacity prop cannot, and must pass `useNativeDriver: false`.
 */
import { useEffect, useState } from 'react';
import { AccessibilityInfo } from 'react-native';

export function makeSpring(
  dampingRatio: number,
  response: number
): { stiffness: number; damping: number; mass: number } {
  const omega0 = (2 * Math.PI) / response;
  const stiffness = omega0 * omega0;
  const damping = 2 * dampingRatio * omega0;
  return { stiffness, damping, mass: 1 };
}

export const spring = {
  /** Critically damped move/reposition. */
  standard: makeSpring(1.0, 0.4),
  /** Quick, no overshoot. */
  snappy: makeSpring(1.0, 0.32),
  /** Momentum/flick — slight overshoot. */
  bouncy: makeSpring(0.72, 0.4),
  /** Drawers/sheets. */
  sheet: makeSpring(0.85, 0.35),
};

/** Duration (ms) for the timing fallback used when reduced motion is on. */
export const REDUCED_MOTION_DURATION = 180;

export function useReducedMotion(): boolean {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    let mounted = true;

    try {
      AccessibilityInfo.isReduceMotionEnabled()
        .then((enabled) => {
          if (mounted) setReducedMotion(enabled);
        })
        .catch(() => {
          if (mounted) setReducedMotion(false);
        });
    } catch {
      setReducedMotion(false);
    }

    const subscription = AccessibilityInfo.addEventListener(
      'reduceMotionChanged',
      (enabled: boolean) => {
        if (mounted) setReducedMotion(enabled);
      }
    );

    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  return reducedMotion;
}
