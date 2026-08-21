import React, { useCallback, useMemo, useRef } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet } from 'react-native';
import { PanResponder } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { haptics } from '../haptics';
import { useT } from '../i18n';
import { spring } from '../motion';

/**
 * Shared bottom-sheet dismissal gestures, so every sheet in the app closes the
 * same two ways iOS users expect (and simple-bookkeeping does):
 *
 *   1. Tap the dimmed backdrop above the sheet  -> `SheetScrim`
 *   2. Drag the grabber pill down past a threshold -> `useDragToDismiss`
 *
 * Both live here rather than being copy-pasted into each modal so the feel
 * (threshold, spring, haptic) stays identical everywhere.
 */

/**
 * A full-bleed Pressable that sits *behind* the sheet and dismisses on tap.
 * Render it as the first child of the backdrop, before the sheet, so the sheet
 * paints on top and only taps on the exposed scrim reach this handler.
 */
export function SheetScrim({ onPress }: { onPress: () => void }) {
  const t = useT();
  return (
    <Pressable
      accessibilityLabel={t('common.dismiss')}
      style={StyleSheet.absoluteFill}
      onPress={onPress}
    />
  );
}

/**
 * Drag-to-dismiss for a bottom sheet. Returns the `translateY` to apply to the
 * sheet's transform and the `panHandlers` to spread onto the grabber zone.
 *
 * Only claims a clearly-downward drag, so a tap on the handle still passes
 * through and horizontal movement never hijacks the gesture. Closes once pulled
 * past a distance/velocity threshold, matching the native iOS sheet gesture.
 * `onClose` is read through a ref so the (stable) PanResponder always sees the
 * latest callback without being re-created each render.
 */
export function useDragToDismiss(onClose: () => void) {
  const screenHeight = Dimensions.get('window').height;
  const translateY = useRef(new Animated.Value(0)).current;
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        gesture.dy > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderMove: (_evt, gesture) => {
        translateY.setValue(Math.max(0, gesture.dy));
      },
      onPanResponderRelease: (_evt, gesture) => {
        if (gesture.dy > 120 || gesture.vy > 0.8) {
          haptics.selection();
          Animated.timing(translateY, {
            toValue: screenHeight,
            duration: 200,
            useNativeDriver: true,
          }).start(() => {
            translateY.setValue(0);
            onCloseRef.current();
          });
        } else {
          Animated.spring(translateY, {
            toValue: 0,
            useNativeDriver: true,
            ...spring.snappy,
          }).start();
        }
      },
    })
  ).current;

  // Stable identity so a consuming effect can depend on it without re-running
  // (and snapping the sheet) on every unrelated render.
  const reset = useCallback(() => translateY.setValue(0), [translateY]);

  return { translateY, panHandlers: panResponder.panHandlers, reset };
}

/**
 * Two-detent bottom sheet (iOS "medium" + "large"), for sheets whose content is
 * tall enough to be worth expanding. The sheet is laid out at its full (large)
 * height and pushed down so only the medium detent shows; dragging the grabber:
 *
 *   - up   -> snaps to the large detent (full screen)
 *   - down from large -> back to medium
 *   - down from medium past the threshold -> dismiss
 *
 * Built on `react-native-gesture-handler`'s `Gesture.Pan()` + Reanimated shared
 * values rather than a bare `PanResponder` -- inside a RN `Modal`, PanResponder
 * gesture arbitration is unreliable (see Card.tsx for the same idiom used by
 * the swipe deck, which works there). The detent and gesture-start offset are
 * held as shared values (not refs) so the `onStart`/`onUpdate`/`onEnd` worklets
 * can read/write them on the UI thread without a JS round-trip.
 *
 * Returns `sheetHeight` (apply as the sheet's fixed height so its inner
 * ScrollView has a bound to scroll within), `animatedStyle` (spread onto the
 * Reanimated `Animated.View` sheet container) and `gesture` (pass to a
 * `GestureDetector` wrapping the grabber zone). Because the grabber owns this
 * pan, an inner ScrollView scrolls independently without fighting the drag.
 */
export function useSheetDetents(
  onClose: () => void,
  { mediumRatio = 0.6, largeRatio = 0.94 }: { mediumRatio?: number; largeRatio?: number } = {}
) {
  const screenHeight = Dimensions.get('window').height;
  const large = Math.round(screenHeight * largeRatio);
  const medium = Math.round(screenHeight * mediumRatio);

  // translateY offset for each detent (0 = fully expanded/large).
  const largeOffset = 0;
  const mediumOffset = large - medium;
  const dismissOffset = large;

  const translateY = useSharedValue(mediumOffset);
  // Which detent we're resting in, and where the current gesture began.
  const detent = useSharedValue<'medium' | 'large'>('medium');
  const gestureStartY = useSharedValue(mediumOffset);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const fireHaptic = () => haptics.selection();
  const commitClose = () => onCloseRef.current();

  // Stable identity so a consuming effect can depend on it without re-running
  // (and snapping the sheet back to medium) on every unrelated render.
  const reset = useCallback(() => {
    detent.value = 'medium';
    translateY.value = mediumOffset;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mediumOffset]);

  const gesture = useMemo(
    () =>
      Gesture.Pan()
        .onStart(() => {
          'worklet';
          gestureStartY.value = detent.value === 'large' ? largeOffset : mediumOffset;
        })
        .onUpdate((e) => {
          'worklet';
          // Clamp so an upward overpull can't rise above the large detent, but
          // a downward pull can travel all the way to the dismiss position.
          translateY.value = Math.min(
            dismissOffset,
            Math.max(largeOffset, gestureStartY.value + e.translationY)
          );
        })
        .onEnd((e) => {
          'worklet';
          const pos = Math.min(
            dismissOffset,
            Math.max(largeOffset, gestureStartY.value + e.translationY)
          );
          // gesture-handler reports velocity in px/s (unlike RN PanResponder's
          // px/ms `vy`), so the flick gate is 800 px/s here, not 0.8.
          const flungDown = e.velocityY > 800;
          const flungUp = e.velocityY < -800;

          // A decisive downward flick dismisses regardless of current detent
          // (native iOS feel: a quick flick on the grabber closes from
          // anywhere). Past the medium detent (plus slack) also dismisses.
          const shouldDismiss = (flungDown && e.translationY > 40) || pos > mediumOffset + 80;

          if (shouldDismiss) {
            runOnJS(fireHaptic)();
            translateY.value = withTiming(dismissOffset, { duration: 200 }, (finished) => {
              if (finished) {
                detent.value = 'medium';
                translateY.value = mediumOffset;
                runOnJS(commitClose)();
              }
            });
            return;
          }

          if (flungUp) {
            detent.value = 'large';
            translateY.value = withSpring(largeOffset, spring.snappy);
            return;
          }
          if (flungDown) {
            detent.value = 'medium';
            translateY.value = withSpring(mediumOffset, spring.snappy);
            return;
          }
          // Otherwise snap to whichever detent is nearer.
          const nearest = pos < mediumOffset / 2 ? 'large' : 'medium';
          detent.value = nearest;
          translateY.value = withSpring(nearest === 'large' ? largeOffset : mediumOffset, spring.snappy);
        }),
    // Shared values/refs are stable identities; only rebuild if the detent
    // geometry itself changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [largeOffset, mediumOffset, dismissOffset]
  );

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
  }));

  return { gesture, animatedStyle, sheetHeight: large, reset };
}
