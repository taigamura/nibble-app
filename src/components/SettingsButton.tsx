import React, { useMemo, useRef } from 'react';
import { Animated, Pressable, StyleSheet } from 'react-native';

import { Icon } from './Icon';
import { spring, useReducedMotion } from '../motion';
import { radius, type Palette } from '../theme';
import { useTheme } from '../ThemeProvider';

/**
 * The gear that opens the Settings sheet. Lives inside each screen's header bar
 * (Discover, Collection) rather than as a floating overlay, so it never hovers
 * over the swipe card or list content.
 */
export function SettingsButton({ onPress }: { onPress?: () => void }) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const reducedMotion = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const animateTo = (toValue: number) => {
    if (reducedMotion) {
      scale.setValue(toValue);
      return;
    }
    Animated.spring(scale, { toValue, useNativeDriver: true, ...spring.snappy }).start();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Open settings"
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
      onPressIn={() => animateTo(0.88)}
      onPressOut={() => animateTo(1)}
      onPress={onPress}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon name="settings" size={18} color={colors.label} />
      </Animated.View>
    </Pressable>
  );
}

function makeStyles(colors: Palette) {
  return StyleSheet.create({
    button: {
      width: 36,
      height: 36,
      borderRadius: radius.pill,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.fill,
    },
    pressed: {
      opacity: 0.55,
    },
  });
}
