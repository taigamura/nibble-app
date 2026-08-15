import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { isRealBackendConfigured, loadConfig } from './src/config/env';
import { FixturePlacesProvider, InMemoryStore, NoopEnrichmentProvider } from './src/providers/inMemory';
import { ExpoLocationProvider } from './src/providers/location';
import { SupabasePlacesProvider } from './src/providers/supabasePlaces';
import type { GeoPoint, LocationProvider, PlacesProvider } from './src/providers/types';
import { OnboardingScreen } from './src/screens/OnboardingScreen';
import { SwipeScreen } from './src/screens/SwipeScreen';

// Central Shibuya, used when location permission is denied or unavailable so
// the deck degrades gracefully instead of blocking on a coordinate.
const DEFAULT_LOCATION: GeoPoint = { lat: 35.6595, lng: 139.7005 };

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

export default function App() {
  const locationProvider = useRef(new ExpoLocationProvider()).current;
  const getUserLocation = useRef(createUserLocationResolver(locationProvider)).current;
  const placesProvider = useRef(createPlacesProvider(getUserLocation)).current;
  const enrichmentProvider = useRef(new NoopEnrichmentProvider()).current;
  const store = useRef(new InMemoryStore()).current;
  const [onboarded, setOnboarded] = useState(false);

  return (
    <SafeAreaView style={styles.container}>
      {onboarded ? (
        <SwipeScreen
          placesProvider={placesProvider}
          enrichmentProvider={enrichmentProvider}
          store={store}
        />
      ) : (
        <OnboardingScreen
          placesProvider={placesProvider}
          store={store}
          requestLocation={getUserLocation}
          onComplete={() => setOnboarded(true)}
        />
      )}
      <StatusBar style="auto" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
});
