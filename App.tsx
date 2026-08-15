import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppShell } from './src/components/AppShell';
import { migrateLocalDataToCloud } from './src/auth/migrateToCloud';
import { isRealBackendConfigured, loadConfig } from './src/config/env';
import { SupabaseAppleAuthProvider } from './src/providers/appleAuth';
import { FixturePlacesProvider, NoopEnrichmentProvider } from './src/providers/inMemory';
import { LocalStore } from './src/providers/localStore';
import { ExpoLocationProvider } from './src/providers/location';
import { SupabasePlacesProvider } from './src/providers/supabasePlaces';
import { SupabaseStore } from './src/providers/supabaseStore';
import type { AuthProvider, AuthSession, GeoPoint, LocationProvider, PlacesProvider, Store } from './src/providers/types';
import { CollectionScreen } from './src/screens/CollectionScreen';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SignInPromptModal } from './src/screens/SignInPromptModal';
import { SwipeScreen } from './src/screens/SwipeScreen';
import { colors, elevate, type } from './src/theme';

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

export default function App() {
  const locationProvider = useRef(new ExpoLocationProvider()).current;
  const getUserLocation = useRef(createUserLocationResolver(locationProvider)).current;
  const placesProvider = useRef(createPlacesProvider(getUserLocation)).current;
  const enrichmentProvider = useRef(new NoopEnrichmentProvider()).current;
  const localStore = useRef(new LocalStore()).current;
  const authProvider = useRef(createAuthProvider()).current;
  const sessionRef = useRef<AuthSession | null>(null);
  const cloudStore = useRef(
    createCloudStore(async () => {
      if (!sessionRef.current) throw new Error('No auth session');
      return sessionRef.current;
    })
  ).current;

  const [onboarded, setOnboarded] = useState(false);
  const [activeTab, setActiveTab] = useState<'swipe' | 'collection'>('swipe');
  const [session, setSession] = useState<AuthSession | null>(null);
  const [signInPromptVisible, setSignInPromptVisible] = useState(false);
  const [hasPromptedThisRun, setHasPromptedThisRun] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);

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
              />
            ) : (
              <CollectionScreen
                store={store}
                canSignIn={authProvider !== null}
                signedIn={session !== null}
                onRequestSignIn={() => setSignInPromptVisible(true)}
              />
            )}
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
          onComplete={() => setOnboarded(true)}
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
      <StatusBar style="auto" />
    </AppShell>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
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
