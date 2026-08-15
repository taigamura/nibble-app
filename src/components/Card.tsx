import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Place, SwipeAction } from '../taste-engine';
import { colors, radius, shadow, spacing, type } from '../theme';

const SWIPE_THRESHOLD = 120;
const OFF_SCREEN_DISTANCE = 600;

export interface CardHandle {
  /** Plays the fly-off animation for a tap-button action, then fires onSwiped. */
  animateOut: (action: SwipeAction) => void;
}

interface CardProps {
  place: Place;
  onSwiped: (action: SwipeAction) => void;
  /** Opens the place-detail screen for this card. Omitted for the non-interactive card behind it. */
  onInfoPress?: (place: Place) => void;
}

function directionFor(dx: number, dy: number): SwipeAction | null {
  if (dy < -SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) return 'been';
  if (dx > SWIPE_THRESHOLD) return 'want';
  if (dx < -SWIPE_THRESHOLD) return 'nope';
  return null;
}

function targetFor(action: SwipeAction): { x: number; y: number } {
  switch (action) {
    case 'want':
      return { x: OFF_SCREEN_DISTANCE, y: 0 };
    case 'nope':
      return { x: -OFF_SCREEN_DISTANCE, y: 0 };
    case 'been':
      return { x: 0, y: -OFF_SCREEN_DISTANCE };
  }
}

export const Card = forwardRef<CardHandle, CardProps>(({ place, onSwiped, onInfoPress }, ref) => {
  const position = useRef(new Animated.ValueXY()).current;

  // The PanResponder below is created once (via useRef) and its handlers
  // close over whatever `flyOut` existed at that first render. Routing the
  // actual callback through a ref that's reassigned every render — instead
  // of calling the `onSwiped` prop directly — ensures a drag-released swipe
  // always fires the *current* handler (and thus the current taste graph),
  // not a stale one from mount, even if this Card instance outlives a
  // parent re-render (e.g. an Undo elsewhere in the deck).
  const onSwipedRef = useRef(onSwiped);
  onSwipedRef.current = onSwiped;

  const flyOut = (action: SwipeAction) => {
    const target = targetFor(action);
    Animated.timing(position, {
      toValue: target,
      duration: 220,
      useNativeDriver: false,
    }).start(() => onSwipedRef.current(action));
  };

  useImperativeHandle(ref, () => ({ animateOut: flyOut }));

  const panResponder = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 5 || Math.abs(gesture.dy) > 5,
      onPanResponderMove: Animated.event([null, { dx: position.x, dy: position.y }], {
        useNativeDriver: false,
      }),
      onPanResponderRelease: (_, gesture) => {
        const action = directionFor(gesture.dx, gesture.dy);
        if (action) {
          flyOut(action);
        } else {
          Animated.spring(position, {
            toValue: { x: 0, y: 0 },
            useNativeDriver: false,
            friction: 6,
          }).start();
        }
      },
    })
  ).current;

  const rotate = position.x.interpolate({
    inputRange: [-OFF_SCREEN_DISTANCE, 0, OFF_SCREEN_DISTANCE],
    outputRange: ['-15deg', '0deg', '15deg'],
  });

  // Directional guides: each stamp fades in as the drag crosses toward its
  // threshold, so the user sees what releasing now would do before committing.
  // want = drag right, nope = drag left, been = drag up (see `directionFor`).
  const wantOpacity = position.x.interpolate({
    inputRange: [0, SWIPE_THRESHOLD],
    outputRange: [0, 1],
    extrapolate: 'clamp',
  });
  const nopeOpacity = position.x.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });
  const beenOpacity = position.y.interpolate({
    inputRange: [-SWIPE_THRESHOLD, 0],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Animated.View
      {...panResponder.panHandlers}
      testID={`card-${place.id}`}
      style={[
        styles.card,
        { transform: [...position.getTranslateTransform(), { rotate }] },
      ]}
    >
      <Image source={{ uri: place.photoUrl }} style={styles.photo} />
      {onInfoPress && (
        <>
          <Animated.View
            testID={`guide-want-${place.id}`}
            style={[styles.guide, styles.guideWant, { opacity: wantOpacity, pointerEvents: 'none' }]}
          >
            <Text style={[styles.guideText, { color: colors.want }]}>♥ WANT</Text>
          </Animated.View>
          <Animated.View
            testID={`guide-nope-${place.id}`}
            style={[styles.guide, styles.guideNope, { opacity: nopeOpacity, pointerEvents: 'none' }]}
          >
            <Text style={[styles.guideText, { color: colors.nope }]}>NOPE ✕</Text>
          </Animated.View>
          <Animated.View
            testID={`guide-been-${place.id}`}
            style={[styles.guideBeenRow, { opacity: beenOpacity, pointerEvents: 'none' }]}
          >
            <View style={[styles.guide, styles.guideBeen]}>
              <Text style={[styles.guideText, { color: colors.been }]}>✓ BEEN</Text>
            </View>
          </Animated.View>
        </>
      )}
      {onInfoPress && (
        <Pressable
          accessibilityLabel={`View details for ${place.name}`}
          style={styles.infoButton}
          onPress={() => onInfoPress(place)}
        >
          <Text style={styles.infoButtonText}>ⓘ</Text>
        </Pressable>
      )}
      <View style={styles.info}>
        <Text style={styles.name}>{place.name}</Text>
        <Text style={styles.meta}>
          {place.category} · {place.priceBand} · ★{place.rating.toFixed(1)} ·{' '}
          {Math.round(place.distanceMeters)}m
        </Text>
      </View>
    </Animated.View>
  );
});
Card.displayName = 'Card';

const styles = StyleSheet.create({
  card: {
    position: 'absolute',
    width: '90%',
    height: '78%',
    borderRadius: radius.xl,
    backgroundColor: colors.background,
    ...shadow.lg,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  photo: {
    width: '100%',
    height: '78%',
    backgroundColor: colors.fill,
  },
  guide: {
    position: 'absolute',
    top: spacing.xl,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 3,
    backgroundColor: 'rgba(255,255,255,0.85)',
  },
  guideWant: {
    left: spacing.xl,
    transform: [{ rotate: '-14deg' }],
    borderColor: colors.want,
  },
  guideNope: {
    right: spacing.xl,
    transform: [{ rotate: '14deg' }],
    borderColor: colors.nope,
  },
  // Full-width row that horizontally centers the "been" stamp (an absolutely
  // positioned child can't be centered with alignSelf, so we center via a
  // flex row instead).
  guideBeenRow: {
    position: 'absolute',
    top: spacing.xl,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  guideBeen: {
    top: undefined,
    position: 'relative',
    borderColor: colors.been,
  },
  guideText: {
    fontSize: 20,
    fontWeight: '800',
    letterSpacing: 1,
  },
  infoButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonText: {
    color: colors.labelOnColor,
    fontSize: 18,
    fontWeight: '600',
  },
  info: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  name: {
    ...type.title2,
  },
  meta: {
    ...type.subheadline,
    marginTop: spacing.xs,
    color: colors.secondaryLabel,
  },
});
