import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { seedBeenSignals } from '../onboarding/seedBeenSignals';
import type { PlacesProvider, Store } from '../providers/types';
import type { Place } from '../taste-engine';

interface OnboardingScreenProps {
  placesProvider: PlacesProvider;
  store: Store;
  /**
   * Triggers the OS location-permission prompt + GPS read. Fired on mount so
   * "first launch" always asks, independent of whether `placesProvider`
   * itself needs a location (the fixture provider ignores it). Its result is
   * not awaited for rendering — a denial or slow GPS fix must never block
   * the grid, per the "never blocked from the deck" acceptance criterion.
   */
  requestLocation: () => Promise<unknown>;
  /** Called once onboarding is done (grid completed OR skipped). Never blocks reaching the deck. */
  onComplete: () => void;
}

/** Cold-start "tap everywhere you've been" grid (issue #6). */
export function OnboardingScreen({ placesProvider, store, requestLocation, onComplete }: OnboardingScreenProps) {
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [finishing, setFinishing] = useState(false);

  useEffect(() => {
    void requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const candidates = await placesProvider.getCandidates();
      if (!cancelled) {
        setPlaces(candidates);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placesProvider]);

  const toggle = (placeId: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(placeId)) {
        next.delete(placeId);
      } else {
        next.add(placeId);
      }
      return next;
    });
  };

  const finish = async (chosenIds: Set<string>) => {
    if (finishing) return;
    setFinishing(true);
    const chosenPlaces = (places ?? []).filter((place) => chosenIds.has(place.id));
    if (chosenPlaces.length > 0) {
      const currentGraph = await store.getGraph();
      const seededGraph = seedBeenSignals(currentGraph, chosenPlaces);
      await store.saveGraph(seededGraph);
    }
    onComplete();
  };

  if (!places) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={styles.title}>Where have you been?</Text>
          <Text style={styles.subtitle}>Tap everywhere you recognize. About a minute.</Text>
        </View>
        <Pressable
          accessibilityLabel="Skip onboarding"
          style={styles.skip}
          onPress={() => void finish(new Set())}
          disabled={finishing}
        >
          <Text style={styles.skipText}>Skip</Text>
        </Pressable>
      </View>
      <FlatList
        data={places}
        keyExtractor={(item) => item.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        renderItem={({ item }) => {
          const isSelected = selected.has(item.id);
          return (
            <Pressable
              accessibilityLabel={`Been to ${item.name}`}
              accessibilityState={{ selected: isSelected }}
              style={[styles.tile, isSelected && styles.tileSelected]}
              onPress={() => toggle(item.id)}
            >
              <Image source={{ uri: item.photoUrl }} style={styles.tileImage} />
              <Text style={styles.tileName} numberOfLines={1}>
                {item.name}
              </Text>
              {isSelected && (
                <View style={styles.checkBadge}>
                  <Text style={styles.checkText}>✓</Text>
                </View>
              )}
            </Pressable>
          );
        }}
      />
      <Pressable
        accessibilityLabel="Continue to deck"
        style={styles.done}
        onPress={() => void finish(selected)}
        disabled={finishing}
      >
        <Text style={styles.doneText}>
          {selected.size > 0 ? `Continue — ${selected.size} been` : 'Continue'}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 8,
  },
  headerText: {
    flex: 1,
    paddingRight: 12,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    color: '#666',
    marginTop: 4,
  },
  skip: {
    paddingVertical: 6,
    paddingHorizontal: 10,
  },
  skipText: {
    fontSize: 14,
    color: '#888',
    fontWeight: '600',
  },
  grid: {
    paddingHorizontal: 8,
    paddingBottom: 96,
  },
  tile: {
    flex: 1 / 3,
    margin: 4,
    borderRadius: 10,
    overflow: 'hidden',
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: 'transparent',
  },
  tileSelected: {
    borderColor: '#27ae60',
  },
  tileImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: '#e5e5e5',
  },
  tileName: {
    fontSize: 11,
    padding: 4,
  },
  checkBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#27ae60',
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  done: {
    position: 'absolute',
    left: 16,
    right: 16,
    bottom: 20,
    backgroundColor: '#111',
    borderRadius: 28,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
});
