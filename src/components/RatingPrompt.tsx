import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';

import { Icon } from './Icon';
import { haptics } from '../haptics';
import { REDUCED_MOTION_DURATION, spring, useReducedMotion } from '../motion';
import { useTheme } from '../ThemeProvider';
import { elevate, type Palette, type TypeRamp } from '../theme';

interface RatingPromptProps {
  placeName: string;
  onRate: (rating: number) => void;
  onSkip: () => void;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * Non-blocking overlay: it only covers the bottom strip of the screen (via
 * pointerEvents="box-none" on the wrapper), so the card above stays
 * swipeable while this is up. Skip/rate both dismiss it immediately.
 */
export function RatingPrompt({ placeName, onRate, onSkip }: RatingPromptProps) {
  const { colors, type } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const reducedMotion = useReducedMotion();
  const translateY = useRef(new Animated.Value(reducedMotion ? 0 : 12)).current;
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reducedMotion) {
      Animated.timing(opacity, { toValue: 1, duration: REDUCED_MOTION_DURATION, useNativeDriver: true }).start();
      translateY.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.spring(translateY, { ...spring.sheet, toValue: 0, useNativeDriver: true }),
      Animated.spring(opacity, { ...spring.sheet, toValue: 1, useNativeDriver: true }),
    ]).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reducedMotion]);

  return (
    <View style={[styles.wrapper, { pointerEvents: 'box-none' }]}>
      <Animated.View style={[styles.card, { opacity, transform: [{ translateY }] }]}>
        <Text style={styles.title}>How was {placeName}?</Text>
        <View style={styles.stars}>
          {STARS.map((n) => (
            <RatingStar key={n} n={n} colors={colors} styles={styles} reducedMotion={reducedMotion} onRate={onRate} />
          ))}
        </View>
        <Pressable accessibilityLabel="Skip rating" style={styles.skip} onPress={onSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </Animated.View>
    </View>
  );
}

interface RatingStarProps {
  n: number;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  reducedMotion: boolean;
  onRate: (rating: number) => void;
}

function RatingStar({ n, colors, styles, reducedMotion, onRate }: RatingStarProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    haptics.selection();
    if (!reducedMotion) {
      Animated.sequence([
        Animated.spring(scale, { ...spring.bouncy, toValue: 1.25, useNativeDriver: true }),
        Animated.spring(scale, { ...spring.bouncy, toValue: 1, useNativeDriver: true }),
      ]).start();
    }
    onRate(n);
  };

  return (
    <Pressable
      accessibilityLabel={`Rate ${n} star${n === 1 ? '' : 's'}`}
      style={styles.starButton}
      onPress={handlePress}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon name="star" size={28} color={colors.star} />
      </Animated.View>
    </Pressable>
  );
}

function makeStyles(colors: Palette, type: TypeRamp) {
  return StyleSheet.create({
    wrapper: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 96,
      alignItems: 'center',
    },
    card: {
      width: '88%',
      borderRadius: 16,
      backgroundColor: colors.background,
      paddingVertical: 16,
      paddingHorizontal: 20,
      alignItems: 'center',
      ...elevate(4, 10, 0.2, 8),
    },
    title: {
      ...type.subheadline,
      fontWeight: '600',
      marginBottom: 10,
      color: colors.label,
    },
    stars: {
      flexDirection: 'row',
      marginBottom: 10,
    },
    starButton: {
      paddingHorizontal: 6,
    },
    skip: {
      paddingVertical: 4,
    },
    skipText: {
      ...type.footnote,
      color: colors.secondaryLabel,
    },
  });
}
