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
import { useLanguage, useT } from '../i18n';
import type { Language } from '../i18n';
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
  /** Brings every "not for me" place back into the Discover deck (confirmation handled here). */
  onBringBackPassed: () => void;
  /** Non-destructive: replays the intro grid without wiping taste data. */
  onReplayOnboarding: () => void;
  /** Destructive: wipes local data + signs out (confirmation handled here). */
  onResetAllData: () => void;
}

const APPEARANCE_OPTIONS: { value: Appearance; labelKey: 'settings.appearance.system' | 'settings.appearance.light' | 'settings.appearance.dark' }[] = [
  { value: 'system', labelKey: 'settings.appearance.system' },
  { value: 'light', labelKey: 'settings.appearance.light' },
  { value: 'dark', labelKey: 'settings.appearance.dark' },
];

const LOCATION_COPY_KEY: Record<LocationPermissionStatus, 'settings.location.enabled' | 'settings.location.off' | 'settings.location.notSet'> = {
  granted: 'settings.location.enabled',
  denied: 'settings.location.off',
  undetermined: 'settings.location.notSet',
};

/** The three language options, in display order. 日本語/English stay literal (shown in their own script regardless of the current language); System is translated. */
const LANGUAGE_OPTIONS: { value: Language; label: (t: ReturnType<typeof useT>) => string }[] = [
  { value: 'system', label: (t) => t('settings.language.system') },
  { value: 'ja', label: () => '日本語' },
  { value: 'en', label: () => 'English' },
];

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
  onBringBackPassed,
  onReplayOnboarding,
  onResetAllData,
}: SettingsScreenProps) {
  const { appearance, setAppearance, colors, type } = useTheme();
  const { language, setLanguage } = useLanguage();
  const t = useT();
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

  const handleBringBackPassed = () => {
    haptics.selection();
    Alert.alert(
      t('settings.discover.alertTitle'),
      t('settings.discover.alertMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.discover.alertConfirm'), onPress: onBringBackPassed },
      ]
    );
  };

  const handleReset = () => {
    haptics.warning();
    Alert.alert(
      t('settings.data.alertTitle'),
      t('settings.data.alertMessage'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('settings.data.alertConfirm'), style: 'destructive', onPress: onResetAllData },
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
            accessibilityLabel={t('settings.a11y.close')}
            hitSlop={8}
            style={({ pressed }) => pressed && styles.pressedText}
            onPress={onClose}
          >
            <Text style={styles.headerDone}>{t('settings.done')}</Text>
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.largeTitle}>{t('settings.title')}</Text>

          {/* Appearance */}
          <Text style={[styles.sectionHeader, styles.firstSectionHeader]}>{t('settings.section.appearance')}</Text>
          <View style={styles.card}>
            <View style={styles.segment} accessibilityRole="radiogroup">
              {APPEARANCE_OPTIONS.map((opt) => {
                const selected = appearance === opt.value;
                const label = t(opt.labelKey);
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t('settings.a11y.appearanceOption', { label })}
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
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Language */}
          <Text style={styles.sectionHeader}>{t('settings.section.language')}</Text>
          <View style={styles.card}>
            <View style={styles.segment} accessibilityRole="radiogroup">
              {LANGUAGE_OPTIONS.map((opt) => {
                const selected = language === opt.value;
                const label = opt.label(t);
                return (
                  <Pressable
                    key={opt.value}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={t('settings.a11y.languageOption', { label })}
                    style={({ pressed }) => [
                      styles.segmentButton,
                      selected && styles.segmentButtonActive,
                      pressed && styles.segmentPressed,
                    ]}
                    onPress={() => {
                      haptics.selection();
                      setLanguage(opt.value);
                    }}
                  >
                    <Text style={[styles.segmentLabel, selected && styles.segmentLabelActive]}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
          <Text style={styles.footnote}>{t('settings.language.footnote')}</Text>

          {/* Account */}
          {showAccount && (
            <>
              <Text style={styles.sectionHeader}>{t('settings.section.account')}</Text>
              <View style={styles.card}>
                {signedIn ? (
                  <>
                    <View style={styles.row}>
                      <Text style={styles.rowLabel}>{t('settings.account.status')}</Text>
                      <Text style={styles.rowValue}>{t('settings.account.signedIn')}</Text>
                    </View>
                    <View style={styles.divider} />
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={t('settings.account.signOut')}
                      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                      onPress={() => {
                        haptics.selection();
                        onSignOut();
                      }}
                    >
                      <Text style={styles.rowAction}>{t('settings.account.signOut')}</Text>
                    </Pressable>
                  </>
                ) : (
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={t('common.signInWithApple')}
                    style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                    onPress={() => {
                      haptics.selection();
                      onSignIn();
                    }}
                  >
                    <Text style={styles.rowActionTint}>{t('common.signInWithApple')}</Text>
                  </Pressable>
                )}
              </View>
              <Text style={styles.footnote}>{t('settings.account.footnote')}</Text>
            </>
          )}

          {/* Location */}
          <Text style={styles.sectionHeader}>{t('settings.section.location')}</Text>
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.rowLabel}>{t('settings.location.permission')}</Text>
              <Text style={styles.rowValue}>
                {locationStatus ? t(LOCATION_COPY_KEY[locationStatus]) : '…'}
              </Text>
            </View>
            {showLocationButton && (
              <>
                <View style={styles.divider} />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={t('settings.location.enable')}
                  style={({ pressed }) => [styles.row, pressed && styles.pressed]}
                  onPress={handleEnableLocation}
                >
                  <Text style={styles.rowActionTint}>
                    {locationStatus === 'undetermined' ? t('settings.location.enable') : t('settings.location.openSettings')}
                  </Text>
                </Pressable>
              </>
            )}
          </View>
          <Text style={styles.footnote}>{t('settings.location.footnote')}</Text>

          {/* Discover */}
          <Text style={styles.sectionHeader}>{t('settings.section.discover')}</Text>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.discover.bringBack')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={handleBringBackPassed}
            >
              <Text style={styles.rowAction}>{t('settings.discover.bringBack')}</Text>
            </Pressable>
          </View>
          <Text style={styles.footnote}>{t('settings.discover.footnote')}</Text>

          {/* Data */}
          <Text style={styles.sectionHeader}>{t('settings.section.data')}</Text>
          <View style={styles.card}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.data.replayIntro')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={() => {
                haptics.selection();
                onReplayOnboarding();
              }}
            >
              <Text style={styles.rowAction}>{t('settings.data.replayIntro')}</Text>
            </Pressable>
            <View style={styles.divider} />
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('settings.data.resetAll')}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
              onPress={handleReset}
            >
              <Text style={styles.rowActionDestructive}>{t('settings.data.resetAll')}</Text>
            </Pressable>
          </View>
          <Text style={styles.footnote}>{t('settings.data.footnote')}</Text>
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
