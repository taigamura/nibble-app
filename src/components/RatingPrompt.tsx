import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

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
  return (
    <View style={[styles.wrapper, { pointerEvents: 'box-none' }]}>
      <View style={styles.card}>
        <Text style={styles.title}>How was {placeName}?</Text>
        <View style={styles.stars}>
          {STARS.map((n) => (
            <Pressable
              key={n}
              accessibilityLabel={`Rate ${n} star${n === 1 ? '' : 's'}`}
              style={styles.starButton}
              onPress={() => onRate(n)}
            >
              <Text style={styles.starText}>★</Text>
            </Pressable>
          ))}
        </View>
        <Pressable accessibilityLabel="Skip rating" style={styles.skip} onPress={onSkip}>
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
    </View>
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
      fontSize: 15,
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
    starText: {
      fontSize: 28,
      color: colors.star,
    },
    skip: {
      paddingVertical: 4,
    },
    skipText: {
      fontSize: 13,
      color: colors.secondaryLabel,
    },
  });
}
