import { StatusBar } from 'expo-status-bar';
import React, { useRef } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { isRealBackendConfigured, loadConfig } from './src/config/env';
import { FixturePlacesProvider, InMemoryStore, NoopEnrichmentProvider } from './src/providers/inMemory';
import { SupabasePlacesProvider } from './src/providers/supabasePlaces';
import type { PlacesProvider } from './src/providers/types';
import { SwipeScreen } from './src/screens/SwipeScreen';

// Central Shibuya, used as a placeholder viewer location until issue #6 wires
// up a real location-permission flow that supplies the device's position.
const DEFAULT_LOCATION = { lat: 35.6595, lng: 139.7005 };

function createPlacesProvider(): PlacesProvider {
  const config = loadConfig();
  if (!isRealBackendConfigured(config)) {
    return new FixturePlacesProvider();
  }
  return new SupabasePlacesProvider({
    supabaseUrl: config.supabaseUrl!,
    supabaseAnonKey: config.supabaseAnonKey!,
    googlePlacesApiKey: config.googlePlacesApiKey!,
    getUserLocation: async () => DEFAULT_LOCATION,
  });
}

export default function App() {
  const placesProvider = useRef(createPlacesProvider()).current;
  const enrichmentProvider = useRef(new NoopEnrichmentProvider()).current;
  const store = useRef(new InMemoryStore()).current;

  return (
    <SafeAreaView style={styles.container}>
      <SwipeScreen
        placesProvider={placesProvider}
        enrichmentProvider={enrichmentProvider}
        store={store}
      />
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
