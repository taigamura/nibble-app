/**
 * Thin, safe wrapper over `expo-haptics`.
 *
 * Guidelines (causality / harmony / utility):
 * - Causality: fire the haptic on the causal user gesture (the tap, the
 *   drag-release, the swipe-commit), not on a delayed async result.
 * - Harmony: match the feedback strength to the visual/motion weight of the
 *   event — light taps for selection changes, heavier impacts for
 *   commits/undo, notification feedback for outcomes (success/warning/error).
 * - Utility: reserve haptics for meaningful moments. Firing on every minor
 *   interaction cheapens the signal and drains the feature of meaning.
 *
 * Every method here is fire-and-forget, never throws/rejects, and is a
 * no-op on web (expo-haptics has no web implementation).
 */
import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const IMPACT_STYLES: Record<
  'light' | 'medium' | 'heavy' | 'soft' | 'rigid',
  Haptics.ImpactFeedbackStyle
> = {
  light: Haptics.ImpactFeedbackStyle.Light,
  medium: Haptics.ImpactFeedbackStyle.Medium,
  heavy: Haptics.ImpactFeedbackStyle.Heavy,
  soft: Haptics.ImpactFeedbackStyle.Soft,
  rigid: Haptics.ImpactFeedbackStyle.Rigid,
};

export const haptics = {
  selection(): void {
    if (Platform.OS === 'web') return;
    try {
      void Haptics.selectionAsync();
    } catch {}
  },

  impact(style: 'light' | 'medium' | 'heavy' | 'soft' | 'rigid' = 'light'): void {
    if (Platform.OS === 'web') return;
    try {
      void Haptics.impactAsync(IMPACT_STYLES[style]);
    } catch {}
  },

  success(): void {
    if (Platform.OS === 'web') return;
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  },

  warning(): void {
    if (Platform.OS === 'web') return;
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
  },

  error(): void {
    if (Platform.OS === 'web') return;
    try {
      void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    } catch {}
  },
};
