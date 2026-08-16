import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { AppShell } from './src/components/AppShell';
import { migrateLocalDataToCloud } from './src/auth/migrateToCloud';
import { isRealBackendConfigured, loadConfig } from './src/config/env';
import { SupabaseAppleAuthProvider } from './src/providers/appleAuth';
import { FixturePlacesProvider, NoopEnrichmentProvider } from './src/providers/inMemory';
import { LocalStore } from './src/providers/localStore';
import { OnboardingState } from './src/onboarding/onboardingState';
import { HomeLocationState } from './src/settings/homeLocationState';
import { ExpoLocationProvider } from './src/providers/location';
import { SupabasePlacesProvider } from './src/providers/supabasePlaces';
import { SupabaseStore } from './src/providers/supabaseStore';
import type { AuthProvider, AuthSession, GeoPoint, LocationProvider, PlacesProvider, Store } from './src/providers/types';
import { CollectionScreen } from './src/screens/CollectionScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { SignInPromptModal } from './src/screens/SignInPromptModal';
import { SwipeScreen } from './src/screens/SwipeScreen';
import { ThemeProvider, useTheme } from './src/ThemeProvider';
import { elevate, spacing, type Palette, type TypeRamp } from './src/theme';

// Used when location permission is denied or unavailable so the deck degrades
// gracefully instead of blocking on a coordinate.
const DEFAULT_LOCATION: GeoPoint = { lat: 35.695601, lng: 139.8123635 };

/**
 * Wraps a `LocationProvider` into a memoized `getUserLocation` callback: the
 * OS permission prompt + GPS read fires at most once per app session (on
 * first call, typically from the onboarding grid), and every later caller
 * (the swipe deck) reuses that same resolved position or its fallback.
 */
function createUserLocationResolver(locationProvider: LocationProvider): () => Promise<GeoPoint> {
  let cached: Promise<GeoPoint> | null = null;
  return () => {
    if (!cached) {
      cached = locationProvider.getCurrentLocation().then((location) => location ?? DEFAULT_LOCATION);
    }
    return cached;
  };
}

function createPlacesProvider(getUserLocation: () => Promise<GeoPoint>): PlacesProvider {
  const config = loadConfig();
  if (!isRealBackendConfigured(config)) {
    return new FixturePlacesProvider();
  }
  return new SupabasePlacesProvider({
    supabaseUrl: config.supabaseUrl!,
    supabaseAnonKey: config.supabaseAnonKey!,
    googlePlacesApiKey: config.googlePlacesApiKey!,
    getUserLocation,
  });
}

/** `null` when the real backend isn't configured -- Sign in with Apple stays hidden and the app runs fully anonymous/local, same fallback rule as `createPlacesProvider`. */
function createAuthProvider(): AuthProvider | null {
  const config = loadConfig();
  if (!isRealBackendConfigured(config)) return null;
  return new SupabaseAppleAuthProvider({
    supabaseUrl: config.supabaseUrl!,
    supabaseAnonKey: config.supabaseAnonKey!,
  });
}

/**
 * The cloud `Store`, created once so its identity is stable across renders;
 * it reads whichever session `getSession` currently resolves to rather than
 * capturing one at construction time, since sign-in happens well after this
 * runs.
 */
function createCloudStore(getSession: () => Promise<AuthSession>): Store | null {
  const config = loadConfig();
  if (!isRealBackendConfigured(config)) return null;
  return new SupabaseStore({
    supabaseUrl: config.supabaseUrl!,
    supabaseAnonKey: config.supabaseAnonKey!,
    getSession,
  });
}

/**
 * Root: mounts the `ThemeProvider` so everything below (AppShell, screens,
 * the tab bar, the Settings sheet) can read the active light/dark palette from
 * `useTheme()`. All the app logic lives in `AppContent`, which must sit inside
 * the provider to call the hook.
 */
export default function App() {
  return (
    <ThemeProvider>
      <AppContent />
    </ThemeProvider>
  );
}

function AppContent() {
  const { colors, type } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);

  const locationProvider = useRef(new ExpoLocationProvider()).current;
  const getUserLocation = useRef(createUserLocationResolver(locationProvider)).current;
  const placesProvider = useRef(createPlacesProvider(getUserLocation)).current;
  const enrichmentProvider = useRef(new NoopEnrichmentProvider()).current;
  const localStore = useRef(new LocalStore()).current;
  const onboardingState = useRef(new OnboardingState()).current;
  const homeLocationState = useRef(new HomeLocationState()).current;
  const authProvider = useRef(createAuthProvider()).current;
  const sessionRef = useRef<AuthSession | null>(null);
  const cloudStore = useRef(
    createCloudStore(async () => {
      if (!sessionRef.current) throw new Error('No auth session');
      return sessionRef.current;
    })
  ).current;

  // `null` while the persisted flag is still being restored, so we render
  // nothing rather than flashing onboarding before we know the answer.
  const [onboarded, setOnboarded] = useState<boolean | null>(null);
  const [activeTab, setActiveTab] = useState<'swipe' | 'collection'>('swipe');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [signInPromptVisible, setSignInPromptVisible] = useState(false);
  const [hasPromptedThisRun, setHasPromptedThisRun] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [homePoint, setHomePoint] = useState<GeoPoint | null>(null);

  // Restores the persisted onboarding flag on cold start so a returning user
  // lands straight on the deck instead of re-running the "been" grid.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const done = await onboardingState.hasOnboarded();
      if (!cancelled) setOnboarded(done);
    })();
    return () => {
      cancelled = true;
    };
  }, [onboardingState]);

  // Restores a previously-established session (e.g. after a cold restart) so
  // a signed-in user lands on their cloud store without re-prompting.
  useEffect(() => {
    if (!authProvider) return;
    let cancelled = false;
    (async () => {
      const restored = await authProvider.getSession();
      if (!cancelled && restored) {
        sessionRef.current = restored;
        setSession(restored);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authProvider]);

  // Restores the saved Home snapshot on cold start so its chip is available in
  // the area picker without waiting for the user to reopen Settings.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const point = await homeLocationState.get();
      if (!cancelled) setHomePoint(point);
    })();
    return () => {
      cancelled = true;
    };
  }, [homeLocationState]);

  const store = session && cloudStore ? cloudStore : localStore;

  const handleTabChange = (tab: 'swipe' | 'collection') => {
    const leavingFirstSwipeSession = tab === 'collection' && activeTab === 'swipe';
    setActiveTab(tab);
    if (leavingFirstSwipeSession && !session && authProvider && !hasPromptedThisRun) {
      setHasPromptedThisRun(true);
      setSignInPromptVisible(true);
    }
  };

  const handleSignIn = async () => {
    if (!authProvider) return;
    setSigningIn(true);
    setSignInError(null);
    try {
      const newSession = await authProvider.signInWithApple();
      sessionRef.current = newSession;
      if (cloudStore) {
        await migrateLocalDataToCloud(localStore, cloudStore);
        await localStore.clear();
      }
      setSession(newSession);
      setSignInPromptVisible(false);
    } catch (err) {
      setSignInError(err instanceof Error ? err.message : 'Sign-in failed. Try again.');
    } finally {
      setSigningIn(false);
    }
  };

  // Clears the local auth session but keeps local data intact (unlike Reset).
  // The store falls back to `localStore` once `session` is null.
  const handleSignOut = async () => {
    if (authProvider) await authProvider.signOut();
    sessionRef.current = null;
    setSession(null);
    setSettingsVisible(false);
  };

  // Destructive: wipe device-local data and sign out, then drop the user back
  // into onboarding. Cloud data is untouched (signing back in restores it),
  // and the appearance preference is deliberately preserved.
  const handleResetAllData = async () => {
    await localStore.clear();
    await onboardingState.clear();
    // Home is user location data (unlike the appearance preference), so Reset
    // clears it too. See HomeLocationState's doc comment.
    await homeLocationState.clear();
    setHomePoint(null);
    if (authProvider) await authProvider.signOut();
    sessionRef.current = null;
    setSession(null);
    setHasPromptedThisRun(false);
    setSettingsVisible(false);
    setActiveTab('swipe');
    setOnboarded(false);
  };

  // Freezes the device's current GPS position as Home. Reads a fresh fix
  // directly (not the cached session resolver) so re-capturing after a move
  // actually updates it; a denial/failure resolves to null, so we surface a
  // hint instead of silently storing the Tokyo fallback.
  const handleSetHome = async () => {
    const point = await locationProvider.getCurrentLocation();
    if (!point) {
      Alert.alert(
        'Location unavailable',
        'Nibble needs location access to set Home. Enable it in your device Settings and try again.'
      );
      return;
    }
    await homeLocationState.set(point);
    setHomePoint(point);
  };

  const handleClearHome = async () => {
    await homeLocationState.clear();
    setHomePoint(null);
  };

  // Non-destructive: replay the intro grid without touching taste data.
  const handleReplayOnboarding = async () => {
    await onboardingState.clear();
    setSettingsVisible(false);
    setOnboarded(false);
  };

  const handleOnboardingComplete = () => {
    setOnboarded(true);
    // Fire-and-forget: the in-memory flag already advances the UI; persisting
    // is what makes the next cold start skip onboarding.
    void onboardingState.setOnboarded();
  };

  // Hold on a blank shell until the persisted flag resolves, so we never flash
  // onboarding at a user who has already completed it.
  if (onboarded === null) {
    return <AppShell />;
  }

  return (
    <AppShell>
      {onboarded ? (
        <>
          <View style={styles.screen}>
            {activeTab === 'swipe' ? (
              <SwipeScreen
                placesProvider={placesProvider}
                enrichmentProvider={enrichmentProvider}
                store={store}
                onGoToWant={() => setActiveTab('collection')}
                homePoint={homePoint}
                onSetHome={handleSetHome}
                onClearHome={handleClearHome}
              />
            ) : (
              <CollectionScreen
                store={store}
                canSignIn={authProvider !== null}
                signedIn={session !== null}
                onRequestSignIn={() => setSignInPromptVisible(true)}
              />
            )}
            {/* Floating gear -- reachable from both screens. Kept as an overlay
                (rather than a header on each screen) so the full-bleed Discover
                deck doesn't lose vertical space to a chrome bar. */}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open settings"
              hitSlop={8}
              style={styles.gear}
              onPress={() => setSettingsVisible(true)}
            >
              <Text style={styles.gearIcon}>⚙️</Text>
            </Pressable>
          </View>
          <View style={styles.tabBar}>
            <Pressable
              accessibilityLabel="Swipe tab"
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'swipe' }}
              style={styles.tabBarButton}
              onPress={() => handleTabChange('swipe')}
            >
              <Text style={[styles.tabBarIcon, activeTab === 'swipe' && styles.tabBarActive]}>🍴</Text>
              <Text style={[styles.tabBarLabel, activeTab === 'swipe' && styles.tabBarActive]}>
                Discover
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel="Collection tab"
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'collection' }}
              style={styles.tabBarButton}
              onPress={() => handleTabChange('collection')}
            >
              <Text style={[styles.tabBarIcon, activeTab === 'collection' && styles.tabBarActive]}>🗺️</Text>
              <Text style={[styles.tabBarLabel, activeTab === 'collection' && styles.tabBarActive]}>
                Collection
              </Text>
            </Pressable>
          </View>
        </>
      ) : (
        <OnboardingScreen
          placesProvider={placesProvider}
          store={store}
          requestLocation={getUserLocation}
          onComplete={handleOnboardingComplete}
        />
      )}
      <SignInPromptModal
        visible={signInPromptVisible}
        signingIn={signingIn}
        error={signInError}
        onSignIn={handleSignIn}
        onDismiss={() => {
          setSignInPromptVisible(false);
          setSignInError(null);
        }}
      />
      <SettingsScreen
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
        locationProvider={locationProvider}
        canSignIn={authProvider !== null}
        signedIn={session !== null}
        onSignIn={() => {
          setSettingsVisible(false);
          void handleSignIn();
        }}
        onSignOut={handleSignOut}
        onReplayOnboarding={handleReplayOnboarding}
        onResetAllData={handleResetAllData}
      />
      <StatusBar style="auto" />
    </AppShell>
  );
}

function makeStyles(colors: Palette, type: TypeRamp) {
  return StyleSheet.create({
    screen: {
      flex: 1,
    },
    gear: {
      position: 'absolute',
      top: spacing.sm,
      right: spacing.md,
      width: 36,
      height: 36,
      borderRadius: 18,
      alignItems: 'center',
      justifyContent: 'center',
      backgroundColor: colors.fill,
    },
    gearIcon: {
      fontSize: 18,
    },
    tabBar: {
      flexDirection: 'row',
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.separator,
      backgroundColor: colors.background,
      paddingTop: 8,
      paddingBottom: 6,
      // Upward shadow (tab bar sits at the bottom edge), platform-aware so
      // react-native-web doesn't warn on the deprecated shadow* props.
      ...elevate(-1, 6, 0.08, 2),
    },
    tabBarButton: {
      flex: 1,
      alignItems: 'center',
      gap: 2,
    },
    tabBarIcon: {
      fontSize: 22,
      opacity: 0.35,
    },
    tabBarLabel: {
      ...type.caption2,
      fontWeight: '600',
      color: colors.secondaryLabel,
    },
    tabBarActive: {
      opacity: 1,
      color: colors.tint,
    },
  });
}
