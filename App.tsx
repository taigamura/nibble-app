import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Platform, Pressable, SafeAreaView, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { AppShell } from './src/components/AppShell';
import { Icon } from './src/components/Icon';
import { migrateLocalDataToCloud } from './src/auth/migrateToCloud';
import { isMisconfiguredRelease, isRealBackendConfigured, loadConfig, missingBackendKeys } from './src/config/env';
import { CLOUD_SYNC_ENABLED } from './src/config/features';
import { haptics } from './src/haptics';
import { spring, useReducedMotion } from './src/motion';
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
import { clearNopes } from './src/taste-engine';
import { LanguageProvider, useT } from './src/i18n';
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
  // Cloud sync is off for the initial release (see CLOUD_SYNC_ENABLED). With no
  // auth provider, `canSignIn` is false everywhere and the entire Sign in with
  // Apple surface (prompt, Settings account row, sync banner) stays hidden.
  if (!CLOUD_SYNC_ENABLED) return null;
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
  // Paired with createAuthProvider: no cloud store when sync is off, so the app
  // always reads/writes the device-local store.
  if (!CLOUD_SYNC_ENABLED) return null;
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
  // Fail-loud guard: a release build must never silently ship on fixture data.
  // If the backend keys were missing at bundle time, block the app with a
  // visible error instead of degrading to sample places (generic photos,
  // wrong-area results). Dev builds keep the intentional fixture fallback.
  const config = loadConfig();
  let content: React.ReactNode;
  if (isMisconfiguredRelease(config)) {
    const missing = missingBackendKeys(config);
    console.error(
      `[nibble] Release build is missing backend configuration: ${missing.join(', ')}. ` +
        'Refusing to run on fixture data. This build must not be released.',
    );
    content = <ReleaseMisconfiguredScreen missingKeys={missing} />;
  } else {
    content = (
      <LanguageProvider>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </LanguageProvider>
    );
  }

  // GestureHandlerRootView must wrap the whole tree so the card's pan gesture
  // (react-native-gesture-handler) receives touches on the UI thread.
  return <GestureHandlerRootView style={guardStyles.gestureRoot}>{content}</GestureHandlerRootView>;
}

/**
 * Full-screen, theme-independent block shown only in a misconfigured release
 * build (see `isMisconfiguredRelease`). Deliberately loud and self-contained
 * so it renders before any provider or theme is set up.
 */
function ReleaseMisconfiguredScreen({ missingKeys }: { missingKeys: string[] }) {
  return (
    <View style={guardStyles.root}>
      <Text style={guardStyles.title}>Configuration error</Text>
      <Text style={guardStyles.body}>
        This build is missing its backend keys and cannot load real places. It must not be
        released. Rebuild with the backend environment variables set.
      </Text>
      <Text style={guardStyles.missingLabel}>Missing:</Text>
      {missingKeys.map((key) => (
        <Text key={key} style={guardStyles.missingKey}>
          {key}
        </Text>
      ))}
    </View>
  );
}

const guardStyles = StyleSheet.create({
  gestureRoot: {
    flex: 1,
  },
  root: {
    flex: 1,
    backgroundColor: '#7f1d1d',
    paddingHorizontal: 28,
    justifyContent: 'center',
  },
  title: {
    color: '#ffffff',
    fontSize: 28,
    fontWeight: '800',
    marginBottom: 16,
  },
  body: {
    color: '#fecaca',
    fontSize: 16,
    lineHeight: 24,
    marginBottom: 24,
  },
  missingLabel: {
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '700',
    marginBottom: 8,
  },
  missingKey: {
    color: '#fca5a5',
    fontSize: 13,
    fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace', default: 'monospace' }),
    marginBottom: 4,
  },
});

function AppContent() {
  const { colors, type } = useTheme();
  const t = useT();
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
  // Bumped after a store mutation made outside the Swipe screen (the Settings
  // "bring back passed places" action) so the deck re-reads the graph.
  const [swipeReloadNonce, setSwipeReloadNonce] = useState(0);

  const reducedMotion = useReducedMotion();
  const swipeTabScale = useRef(new Animated.Value(1)).current;
  const collectionTabScale = useRef(new Animated.Value(1)).current;

  // Springs the newly-active tab's icon up and gently back down when the
  // selection changes, and snaps the previously-active one back to rest.
  useEffect(() => {
    const active = activeTab === 'swipe' ? swipeTabScale : collectionTabScale;
    const inactive = activeTab === 'swipe' ? collectionTabScale : swipeTabScale;

    if (reducedMotion) {
      active.setValue(1);
      inactive.setValue(1);
      return;
    }

    active.setValue(1);
    Animated.sequence([
      Animated.spring(active, { toValue: 1.12, useNativeDriver: true, ...spring.snappy }),
      Animated.spring(active, { toValue: 1, useNativeDriver: true, ...spring.snappy }),
    ]).start();
    Animated.spring(inactive, { toValue: 1, useNativeDriver: true, ...spring.snappy }).start();
  }, [activeTab, reducedMotion, swipeTabScale, collectionTabScale]);

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
    if (tab !== activeTab) haptics.selection();
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
      Alert.alert(t('app.locationAlert.title'), t('app.locationAlert.message'));
      return;
    }
    await homeLocationState.set(point);
    setHomePoint(point);
  };

  const handleClearHome = async () => {
    await homeLocationState.clear();
    setHomePoint(null);
  };

  // Brings every "not for me" place back into the Discover deck by stripping
  // the Nope events from the persisted graph. Deliberate and manual (never
  // automatic): passed-on places otherwise stay gone. Bumps the reload nonce so
  // a mounted Swipe screen re-reads the refreshed graph from the store.
  const handleBringBackPassed = async () => {
    const graph = await store.getGraph();
    await store.saveGraph(clearNopes(graph));
    setSwipeReloadNonce((n) => n + 1);
    setSettingsVisible(false);
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
          {/* Top-only safe area: this view fills down to the tab bar without
              touching the bottom edge, so RN insets only the top (notch). */}
          <SafeAreaView style={styles.screen}>
            {activeTab === 'swipe' ? (
              <SwipeScreen
                placesProvider={placesProvider}
                enrichmentProvider={enrichmentProvider}
                store={store}
                onGoToWant={() => setActiveTab('collection')}
                onOpenSettings={() => setSettingsVisible(true)}
                homePoint={homePoint}
                onSetHome={handleSetHome}
                onClearHome={handleClearHome}
                reloadKey={swipeReloadNonce}
              />
            ) : (
              <CollectionScreen
                store={store}
                canSignIn={authProvider !== null}
                signedIn={session !== null}
                onRequestSignIn={() => setSignInPromptVisible(true)}
                onOpenSettings={() => setSettingsVisible(true)}
              />
            )}
          </SafeAreaView>
          {/* Bottom-only safe area: sits at the physical bottom edge, so RN
              insets only the bottom (home indicator). Its background is the tab
              bar color, so the bar visually reaches the very bottom of the
              screen instead of floating above a strip of canvas. */}
          <SafeAreaView style={styles.tabBarSafe}>
          <View style={styles.tabBar}>
            <Pressable
              accessibilityLabel={t('app.a11y.swipeTab')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'swipe' }}
              style={styles.tabBarButton}
              onPress={() => handleTabChange('swipe')}
            >
              <Animated.View style={{ transform: [{ scale: swipeTabScale }] }}>
                <Icon
                  name={activeTab === 'swipe' ? 'discover-active' : 'discover'}
                  size={22}
                  color={activeTab === 'swipe' ? colors.tint : colors.secondaryLabel}
                />
              </Animated.View>
              <Text style={[styles.tabBarLabel, activeTab === 'swipe' && styles.tabBarActive]}>
                {t('app.tab.discover')}
              </Text>
            </Pressable>
            <Pressable
              accessibilityLabel={t('app.a11y.collectionTab')}
              accessibilityRole="tab"
              accessibilityState={{ selected: activeTab === 'collection' }}
              style={styles.tabBarButton}
              onPress={() => handleTabChange('collection')}
            >
              <Animated.View style={{ transform: [{ scale: collectionTabScale }] }}>
                <Icon
                  name={activeTab === 'collection' ? 'collection-active' : 'collection'}
                  size={22}
                  color={activeTab === 'collection' ? colors.tint : colors.secondaryLabel}
                />
              </Animated.View>
              <Text style={[styles.tabBarLabel, activeTab === 'collection' && styles.tabBarActive]}>
                {t('app.tab.collection')}
              </Text>
            </Pressable>
          </View>
          </SafeAreaView>
        </>
      ) : (
        // Onboarding owns the whole screen (no tab bar), so a single all-edges
        // safe area keeps its header clear of the notch and its Continue button
        // clear of the home indicator.
        <SafeAreaView style={styles.screen}>
          <OnboardingScreen
            placesProvider={placesProvider}
            store={store}
            requestLocation={getUserLocation}
            onComplete={handleOnboardingComplete}
          />
        </SafeAreaView>
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
        onBringBackPassed={handleBringBackPassed}
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
      // Matches the screens' canvas so the top safe-area strip (behind the
      // status bar) blends with the content below it.
      backgroundColor: colors.groupedBackground,
    },
    // Carries the tab bar's background into the bottom safe-area inset so the
    // bar reaches the physical screen edge. See the render tree for why this is
    // a separate SafeAreaView from the screen content.
    tabBarSafe: {
      backgroundColor: colors.background,
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
