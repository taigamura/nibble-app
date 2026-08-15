import React, { forwardRef, useImperativeHandle, useRef } from 'react';
import { Animated, Image, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';

import type { Place, SwipeAction } from '../taste-engine';

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
    height: '75%',
    borderRadius: 20,
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 6,
    overflow: 'hidden',
    alignSelf: 'center',
  },
  photo: {
    width: '100%',
    height: '78%',
  },
  infoButton: {
    position: 'absolute',
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(0,0,0,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
  },
  info: {
    padding: 16,
  },
  name: {
    fontSize: 22,
    fontWeight: '700',
  },
  meta: {
    marginTop: 4,
    fontSize: 14,
    color: '#666',
  },
});
