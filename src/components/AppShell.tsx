import React from 'react';
import { Platform, SafeAreaView, StyleSheet, View } from 'react-native';

import { colors, shadow } from '../theme';

/**
 * AppShell -- the outer frame.
 *
 * On web, the app is a phone-shaped product, not a full-bleed desktop page.
 * So we center it in a bounded, rounded, elevated column on a neutral desk
 * backdrop, so it reads as an iPhone the way simple-bookkeeping does. Native
 * fills the screen with a plain `SafeAreaView`.
 *
 * Deliberately no faux chrome (status bar, Dynamic Island, home indicator):
 * per Apple's restraint principle, a fake bezel adds nothing and dates fast.
 * The rounded corners + soft shadow are enough to signal "device". The real
 * `expo-status-bar` handles the actual status bar on native.
 */

// iPhone 15/16-class logical width. Caps the column so it reads as a phone
// rather than a stretched tablet on a wide monitor.
const PHONE_MAX_WIDTH = 402;
// Bounds the height on tall desktop windows so the frame keeps a phone-like
// aspect instead of growing into a full-height slab.
const PHONE_MAX_HEIGHT = 880;
// Close to the iPhone screen corner radius at this width.
const PHONE_CORNER_RADIUS = 44;

export function AppShell({ children }: { children?: React.ReactNode }) {
  if (Platform.OS === 'web') {
    return (
      <View style={styles.backdrop}>
        <View style={styles.phone}>
          <SafeAreaView style={styles.appSurface}>{children}</SafeAreaView>
        </View>
      </View>
    );
  }

  return <SafeAreaView style={styles.appSurface}>{children}</SafeAreaView>;
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    // systemGray6-ish neutral "desk" so the white phone floats off it.
    backgroundColor: '#E3E3E8',
  },
  phone: {
    width: '100%',
    height: '100%',
    maxWidth: PHONE_MAX_WIDTH,
    maxHeight: PHONE_MAX_HEIGHT,
    borderRadius: PHONE_CORNER_RADIUS,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.separator,
    // Clips the tab bar and any sheets to the rounded device edge.
    overflow: 'hidden',
    backgroundColor: colors.groupedBackground,
    ...shadow.lg,
  },
  appSurface: {
    flex: 1,
    backgroundColor: colors.groupedBackground,
  },
});
