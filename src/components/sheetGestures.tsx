import React, { useCallback, useRef } from 'react';
import { Animated, Dimensions, Pressable, StyleSheet } from 'react-native';
import { PanResponder } from 'react-native';

import { haptics } from '../haptics';
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
  return (
    <Pressable
      accessibilityLabel="Dismiss"
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
 * Returns `sheetHeight` (apply as the sheet's fixed height so its inner
 * ScrollView has a bound to scroll within) and `translateY` (apply to the
 * transform). Because the grabber owns this pan, an inner ScrollView scrolls
 * independently without fighting the drag.
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

  const translateY = useRef(new Animated.Value(mediumOffset)).current;
  // Where the current gesture began, and which detent we're resting in.
  const detentRef = useRef<'medium' | 'large'>('medium');
  const gestureStartRef = useRef(mediumOffset);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  const settleTo = (detent: 'medium' | 'large') => {
    detentRef.current = detent;
    Animated.spring(translateY, {
      toValue: detent === 'large' ? largeOffset : mediumOffset,
      useNativeDriver: true,
      ...spring.snappy,
    }).start();
  };

  const dismiss = () => {
    haptics.selection();
    Animated.timing(translateY, {
      toValue: dismissOffset,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      detentRef.current = 'medium';
      translateY.setValue(mediumOffset);
      onCloseRef.current();
    });
  };

  // Stable identity so a consuming effect can depend on it without re-running
  // (and snapping the sheet back to medium) on every unrelated render.
  const reset = useCallback(() => {
    detentRef.current = 'medium';
    translateY.setValue(mediumOffset);
  }, [translateY, mediumOffset]);

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_evt, gesture) =>
        Math.abs(gesture.dy) > 6 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
      onPanResponderGrant: () => {
        gestureStartRef.current = detentRef.current === 'large' ? largeOffset : mediumOffset;
      },
      onPanResponderMove: (_evt, gesture) => {
        // Clamp so an upward overpull can't rise above the large detent, but a
        // downward pull can travel all the way to the dismiss position.
        const next = Math.min(dismissOffset, Math.max(largeOffset, gestureStartRef.current + gesture.dy));
        translateY.setValue(next);
      },
      onPanResponderRelease: (_evt, gesture) => {
        const pos = Math.min(dismissOffset, Math.max(largeOffset, gestureStartRef.current + gesture.dy));
        const flungDown = gesture.vy > 0.8;
        const flungUp = gesture.vy < -0.8;

        // Past the medium detent (plus slack) or flung down while already at
        // medium -> dismiss.
        if (pos > mediumOffset + 80 || (flungDown && detentRef.current === 'medium' && gesture.dy > 40)) {
          dismiss();
          return;
        }
        if (flungUp) {
          settleTo('large');
          return;
        }
        if (flungDown) {
          settleTo('medium');
          return;
        }
        // Otherwise snap to whichever detent is nearer.
        settleTo(pos < mediumOffset / 2 ? 'large' : 'medium');
      },
    })
  ).current;

  return { translateY, panHandlers: panResponder.panHandlers, sheetHeight: large, reset };
}
