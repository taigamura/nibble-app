import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card, type CardHandle } from '../components/Card';
import { RatingPrompt } from '../components/RatingPrompt';
import { DEFAULT_RADIUS_METERS } from '../config/areas';
import type { DeckContext, EnrichmentProvider, PlacesProvider, Store } from '../providers/types';
import { applyRating, emptyTasteGraph, rankDeck, updateTaste } from '../taste-engine';
import type { Place, SwipeAction, SwipeEvent, TasteGraph } from '../taste-engine';
import { DeckContextControl } from './DeckContextControl';
import { PlaceDetailModal } from './PlaceDetailModal';

interface SwipeScreenProps {
  placesProvider: PlacesProvider;
  enrichmentProvider: EnrichmentProvider;
  store: Store;
  /** Injected seed for the wildcard shuffle. Defaults to a per-session value. */
  seed?: number;
}

export function SwipeScreen({ placesProvider, store, seed }: SwipeScreenProps) {
  const [candidates, setCandidates] = useState<Place[] | null>(null);
  const [graph, setGraph] = useState<TasteGraph>(emptyTasteGraph());
  const [undoStack, setUndoStack] = useState<SwipeEvent[]>([]);
  const [pendingRating, setPendingRating] = useState<Place | null>(null);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [deckContext, setDeckContext] = useState<DeckContext>({ radiusMeters: DEFAULT_RADIUS_METERS });
  const [contextControlVisible, setContextControlVisible] = useState(false);
  const cardRef = useRef<CardHandle>(null);
  // `seed` is meant to be stable for the life of the session (that's what
  // makes the 70/30 blend "injected" rather than reshuffled on every
  // render). Falling back to `Date.now()` as a default *parameter* would
  // re-evaluate on every render since no caller passes `seed`, silently
  // re-randomizing the wildcard slice on each swipe/undo. Pin it once.
  const sessionSeed = useRef(seed ?? Date.now()).current;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const initialGraph = await store.getGraph();
      if (!cancelled) {
        setGraph(initialGraph);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [store]);

  // Re-fetches the candidate set whenever the deck's area/radius context
  // changes (issue #10). This only swaps which places are queried -- `graph`
  // (learned taste) is untouched, so switching area/radius can't corrupt it.
  useEffect(() => {
    let cancelled = false;
    setCandidates(null);
    (async () => {
      const places = await placesProvider.getCandidates(deckContext);
      if (!cancelled) {
        setCandidates(places);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [placesProvider, deckContext]);

  const deck = useMemo(() => {
    if (!candidates) return [];
    return rankDeck(graph, candidates, { seed: sessionSeed });
  }, [candidates, graph, sessionSeed]);

  const topPlace = deck[0];
  const nextPlace = deck[1];

  const commitSwipe = (place: Place, action: SwipeAction) => {
    const event: SwipeEvent = { place, action, timestamp: Date.now() };
    const nextGraph = updateTaste(graph, event);
    setGraph(nextGraph);
    setUndoStack((prev) => [...prev, event]);
    void store.saveGraph(nextGraph);
    // Been lands immediately at the unrated weight so the swipe loop is
    // never blocked; the rating prompt below can amend it later, or the
    // user can skip and leave it as-is.
    if (action === 'been') {
      setPendingRating(place);
    }
  };

  const handleButtonPress = (action: SwipeAction) => {
    if (!topPlace) return;
    cardRef.current?.animateOut(action);
  };

  const handleRate = (rating: number) => {
    if (!pendingRating) return;
    const rated = applyRating(graph, pendingRating.id, rating);
    setGraph(rated);
    void store.saveGraph(rated);
    setPendingRating(null);
  };

  const handleSkipRating = () => {
    setPendingRating(null);
  };

  const handleUndo = () => {
    if (undoStack.length === 0) return;
    const remaining = undoStack.slice(0, -1);
    const rebuilt = remaining.reduce(updateTaste, emptyTasteGraph());
    setGraph(rebuilt);
    setUndoStack(remaining);
    void store.saveGraph(rebuilt);
    setPendingRating(null);
  };

  const radiusLabel =
    deckContext.radiusMeters && deckContext.radiusMeters >= 1000
      ? `${deckContext.radiusMeters / 1000}km`
      : `${deckContext.radiusMeters ?? DEFAULT_RADIUS_METERS}m`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Pressable
          accessibilityLabel="Change deck area"
          style={styles.areaButton}
          onPress={() => setContextControlVisible(true)}
        >
          <Text style={styles.areaButtonText}>📍 {radiusLabel}</Text>
        </Pressable>
      </View>
      <View style={styles.deck}>
        {!candidates && (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        )}
        {candidates && !topPlace && (
          <View style={styles.center}>
            <Text style={styles.emptyText}>That&apos;s everyone nearby for now.</Text>
          </View>
        )}
        {nextPlace && (
          <View style={styles.behindCard} pointerEvents="none">
            <Card place={nextPlace} onSwiped={() => {}} />
          </View>
        )}
        {topPlace && (
          <Card
            key={topPlace.id}
            ref={cardRef}
            place={topPlace}
            onSwiped={(action) => commitSwipe(topPlace, action)}
            onInfoPress={setDetailPlace}
          />
        )}
      </View>
      <View style={styles.controls}>
        <Pressable
          accessibilityLabel="Nope"
          style={[styles.button, styles.nope]}
          onPress={() => handleButtonPress('nope')}
        >
          <Text style={styles.buttonText}>✕</Text>
        </Pressable>
        <Pressable accessibilityLabel="Undo" style={[styles.button, styles.undo]} onPress={handleUndo}>
          <Text style={styles.buttonText}>↺</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Been"
          style={[styles.button, styles.been]}
          onPress={() => handleButtonPress('been')}
        >
          <Text style={styles.buttonText}>✓</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Want"
          style={[styles.button, styles.want]}
          onPress={() => handleButtonPress('want')}
        >
          <Text style={styles.buttonText}>♥</Text>
        </Pressable>
      </View>
      {pendingRating && (
        <RatingPrompt
          placeName={pendingRating.name}
          onRate={handleRate}
          onSkip={handleSkipRating}
        />
      )}
      <PlaceDetailModal
        place={detailPlace}
        rating={detailPlace ? graph.ratings[detailPlace.id] : undefined}
        onClose={() => setDetailPlace(null)}
      />
      <DeckContextControl
        visible={contextControlVisible}
        context={deckContext}
        onChange={setDeckContext}
        onClose={() => setContextControlVisible(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f7f7f7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  areaButton: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#ddd',
  },
  areaButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#333',
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#666',
  },
  deck: {
    flex: 1,
  },
  behindCard: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    transform: [{ scale: 0.96 }],
    opacity: 0.6,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingVertical: 20,
  },
  button: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 3,
  },
  nope: { borderColor: '#e74c3c', borderWidth: 2 },
  been: { borderColor: '#27ae60', borderWidth: 2 },
  want: { borderColor: '#e91e63', borderWidth: 2 },
  undo: { width: 44, height: 44, borderRadius: 22 },
  buttonText: {
    fontSize: 22,
  },
});
