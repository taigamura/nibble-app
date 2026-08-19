import React, { useEffect, useState } from 'react';
import {
  Alert,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { haptics } from '../haptics';
import { useTheme } from '../ThemeProvider';
import type { LocationPermissionStatus, LocationProvider } from '../providers/types';
import {
  GUTTER,
  radius,
  spacing,
  type Appearance,
  type Palette,
  type TypeRamp,
} from '../theme';

export interface SettingsScreenProps {
  visible: boolean;
  onClose: () => void;
  /** Reads/re-requests foreground-location permission for the Location row. */
  locationProvider: LocationProvider;
  /** Whether Sign in with Apple is available at all (false when the real backend isn't configured). */
  canSignIn: boolean;
  signedIn: boolean;
  onSignIn: () => void;
  /** Signs out but keeps local data, unlike Reset. */
  onSignOut: () => void;
  /** Non-destructive: replays the intro grid without wiping taste data. */
  onReplayOnboarding: () => void;
  /** Destructive: wipes local data + signs out (confirmation handled here). */
  onResetAllData: () => void;
}

const APPEARANCE_OPTIONS: { value: Appearance; label: string }[] = [
  { value: 'system', label: 'System' },
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
];

const LOCATION_COPY: Record<LocationPermissionStatus, string> = {
  granted: 'Enabled',
  denied: 'Off',
  undetermined: 'Not set',
};

/**
 * The Settings sheet (full-screen native Modal), reachable from a gear on both
 * the Discover and Collection screens. Grouped-list layout in the iOS idiom,
 * fully theme-aware via `useTheme()`.
 *
 * Side effects that mutate app-level state (sign in/out, reset, replay) are
 * delegated to `App` via callbacks, since it owns the stores and the
 * onboarded/session React state; this screen owns only presentation, the
 * destructive-reset confirmation, and reading location permission status.
 */
export function SettingsScreen({
  visible,
  onClose,
  locationProvider,
  canSignIn,
  signedIn,
  onSignIn,
  onSignOut,
  onReplayOnboarding,
  onResetAllData,
}: SettingsScreenProps) {
  const { appearance, setAppearance, colors, type } = useTheme();
  const styles = React.useMemo(() => makeStyles(colors, type), [colors, type]);

  const [locationStatus, setLocationStatus] = useState<LocationPermissionStatus | null>(null);

  // Refresh the permission status each time the sheet opens, so it reflects any
  // change the user made in the OS Settings app while we were backgrounded.
  useEffect(() => {
    if (!visible) return;
    let cancelled = false;
    (async () => {
      const status = await locationProvider.getPermissionStatus();
      if (!cancelled) setLocationStatus(status);
    })();
    return () => {
      cancelled = true;
    };
  }, [visible, locationProvider]);

  const handleEnableLocation = async () => {
    haptics.selection();
    if (locationStatus === 'undetermined') {
      // First ask: getCurrentLocation triggers the OS prompt as a side effect.
      await locationProvider.getCurrentLocation();
      setLocationStatus(await locationProvider.getPermissionStatus());
    } else {
      // Already denied: iOS caches the denial, so the only path back is the
      // OS Settings app. (No-op-safe on web where openSettings is unsupported.)
      Linking.openSettings?.();
    }
  };

  const handleReset = () => {
    haptics.warning();
    Alert.alert(
      'Reset all data?',
      'This clears your taste history and signs you out on this device. Your appearance setting is kept, and any data synced to your account stays safe.',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Reset', style: 'destructive', onPress: onResetAllData },
      ]
    );
  };

  const showAccount = canSignIn;
  const showLocationButton = locationStatus !== 'granted';

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Slim top bar carrying only Done; the page title lives in the scroll
            as a large title, the iOS grouped-settings idiom. This keeps the top
            from feeling heavy and empty. */}
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close settings"
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressedText}
            onPress={onClose}
          >
            <Text style={styles.headerDone}>Done</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.largeTitle}>Settings</Text>

          {/* Appearance */}
          <Text style={[styles.sectionHeader, styles.firstSectionHeader]}>APPEARANCE</Text>
          <View style={styles.card}>
            <View style={styles.segment} accessibilityRole="radiogroup">
              {APPEARANCE_OPTIONS.map((opt) => {
                const selected = appearance === opt.value;
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${opt.label} appearance`}
                    style={({ pressed }) => [
                      styles.segmentButton,
                      selected && styles.segmentButtonActive,
                      pressed && styles.segmentPressed,
                    ]}
                    onPress={() => {
                      haptics.selection();
                      setAppearance(opt.value);
                    }}
                  >
                    <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]}>
                      {opt.label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Account */}
          {showAccount && (
            <>
              <Text style={styles.sectionHeader}>ACCOUNT</Text>
              <View style={styles.card}>
                {signedIn ? (
                  <>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>Status</Text>
                      <Text style={styles.rowValue}>Signed in</Text>
                    </View>
                    <View style={styles.divider} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel="Sign out"
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                      onPress={() => {
                        haptics.selection();
                        onSignOut();
                      }}
                    >
                      <Text style={styles.rowAction}>Sign out</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel="Sign in with Apple"
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    onPress={() => {
                      haptics.selection();
                      onSignIn();
                    }}
                  >
                    <Text style={styles.rowActionTint}>Sign in with Apple</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.footnote}>Signing out keeps your data on this device.</Text>
            </>
          )}

          {/* Location */}
          <Text style={styles.sectionHeader}>LOCATION</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>Permission</Text>
              <Text style={styles.rowValue}>
                {locationStatus ? LOCATION_COPY[locationStatus] : '…'}
              </Text>
            </View>
            {showLocationButton && (
              <>
                <View style={styles.divider} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Enable location"
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  onPress={handleEnableLocation}
                >
                  <Text style={styles.rowActionTint}>
                    {locationStatus === 'undetermined' ? 'Enable location' : 'Open Settings'}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
          <Text style={styles.footnote}>
            Nibble uses your location to center the deck nearby. Without it, the deck defaults to Tokyo.
          </Text>

          {/* Data */}
          <Text style={styles.sectionHeader}>DATA</Text>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Replay intro"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => {
                haptics.selection();
                onReplayOnboarding();
              }}
            >
              <Text style={styles.rowAction}>Replay intro</Text>
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Reset all data"
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={handleReset}
            >
              <Text style={styles.rowActionDestructive}>Reset all data</Text>
            </Pressable>
          </View>
          <Text style={styles.footnote}>
            Reset clears this device's taste history and signs you out. Data synced to your account is not deleted.
          </Text>
        </ScrollView>
      </View>
    </Modal>
  );
}

function makeStyles(colors: Palette, type: TypeRamp) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.groupedBackground,
    },
    topBar: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'flex-end',
      paddingHorizontal: GUTTER,
      paddingTop: spacing.md,
      paddingBottom: spacing.xs,
    },
    headerDone: {
      ...type.body,
      color: colors.tint,
      fontWeight: '600',
    },
    largeTitle: {
      ...type.largeTitle,
      marginLeft: spacing.xs,
      marginBottom: spacing.sm,
    },
    scroll: {
      paddingHorizontal: GUTTER,
      paddingBottom: spacing.xxxl,
    },
    sectionHeader: {
      ...type.footnote,
      color: colors.secondaryLabel,
      marginTop: spacing.xl,
      marginBottom: spacing.sm,
      marginLeft: spacing.xs,
    },
    // The first header sits right under the large title, so it needs far less
    // top gap than the inter-section headers below it.
    firstSectionHeader: {
      marginTop: spacing.sm,
    },
    card: {
      backgroundColor: colors.background,
      borderRadius: radius.md,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: 44,
    },
    pressed: {
      backgroundColor: colors.fill,
    },
    pressedText: {
      opacity: 0.55,
    },
    divider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: colors.separator,
      marginLeft: spacing.lg,
    },
    rowLabel: {
      ...type.body,
    },
    rowValue: {
      ...type.body,
      color: colors.secondaryLabel,
    },
    rowAction: {
      ...type.body,
    },
    rowActionTint: {
      ...type.body,
      color: colors.tint,
    },
    rowActionDestructive: {
      ...type.body,
      color: colors.nope,
    },
    footnote: {
      ...type.footnote,
      color: colors.secondaryLabel,
      marginTop: spacing.sm,
      marginHorizontal: spacing.xs,
    },
    segment: {
      flexDirection: 'row',
      padding: spacing.xs,
      gap: spacing.xs,
    },
    segmentButton: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: spacing.sm,
      borderRadius: radius.sm,
    },
    segmentButtonActive: {
      backgroundColor: colors.tint,
    },
    segmentPressed: {
      opacity: 0.7,
    },
    segmentLabel: {
      ...type.body,
      fontWeight: '500',
    },
    segmentLabelActive: {
      color: colors.labelOnColor,
      fontWeight: '600',
    },
  });
}
