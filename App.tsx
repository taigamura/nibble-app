import { StatusBar } from 'expo-status-bar';
import React, { useRef } from 'react';
import { SafeAreaView, StyleSheet } from 'react-native';

import { FixturePlacesProvider, InMemoryStore, NoopEnrichmentProvider } from './src/providers/inMemory';
import { SwipeScreen } from './src/screens/SwipeScreen';

export default function App() {
  const placesProvider = useRef(new FixturePlacesProvider()).current;
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
