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
import { colors, radius, shadow, spacing, type } from '../theme';

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
        <Text style={styles.title}>Discover</Text>
        <Pressable
          accessibilityLabel="Change deck area"
          style={({ pressed }) => [styles.areaButton, pressed && styles.pressed]}
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
          <View style={[styles.behindCard, { pointerEvents: 'none' }]}>
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
      <Text style={styles.swipeHint}>
        Swipe ← Nope · ↑ Been · → Want, or use the buttons below
      </Text>
      <View style={styles.controls}>
        <View style={styles.controlItem}>
          <Pressable
            accessibilityLabel="Nope"
            accessibilityHint="Not interested — swipe left"
            style={({ pressed }) => [styles.button, styles.nope, pressed && styles.buttonPressed]}
            onPress={() => handleButtonPress('nope')}
          >
            <Text style={[styles.buttonText, { color: colors.nope }]}>✕</Text>
          </Pressable>
          <Text style={styles.controlLabel}>Nope</Text>
        </View>
        <View style={styles.controlItem}>
          <Pressable
            accessibilityLabel="Undo"
            accessibilityHint="Undo your last swipe"
            style={({ pressed }) => [styles.button, styles.undo, pressed && styles.buttonPressed]}
            onPress={handleUndo}
          >
            <Text style={[styles.buttonText, styles.undoText]}>↺</Text>
          </Pressable>
          <Text style={styles.controlLabel}>Undo</Text>
        </View>
        <View style={styles.controlItem}>
          <Pressable
            accessibilityLabel="Been"
            accessibilityHint="Been here — swipe up"
            style={({ pressed }) => [styles.button, styles.been, pressed && styles.buttonPressed]}
            onPress={() => handleButtonPress('been')}
          >
            <Text style={[styles.buttonText, { color: colors.been }]}>✓</Text>
          </Pressable>
          <Text style={styles.controlLabel}>Been</Text>
        </View>
        <View style={styles.controlItem}>
          <Pressable
            accessibilityLabel="Want"
            accessibilityHint="Want to go — swipe right"
            style={({ pressed }) => [styles.button, styles.want, pressed && styles.buttonPressed]}
            onPress={() => handleButtonPress('want')}
          >
            <Text style={[styles.buttonText, styles.wantText, { color: colors.want }]}>♥</Text>
          </Pressable>
          <Text style={styles.controlLabel}>Want</Text>
        </View>
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
    backgroundColor: colors.groupedBackground,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
  },
  title: {
    ...type.title1,
  },
  areaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  areaButtonText: {
    ...type.footnote,
    fontWeight: '600',
    color: colors.tint,
  },
  pressed: {
    opacity: 0.55,
  },
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: spacing.xxl,
  },
  emptyText: {
    ...type.body,
    color: colors.secondaryLabel,
    textAlign: 'center',
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
    transform: [{ scale: 0.94 }],
    opacity: 0.5,
  },
  swipeHint: {
    ...type.footnote,
    color: colors.secondaryLabel,
    textAlign: 'center',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-start',
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
  },
  controlItem: {
    alignItems: 'center',
    gap: spacing.xs + 2,
  },
  controlLabel: {
    ...type.caption2,
    fontWeight: '600',
    color: colors.secondaryLabel,
  },
  button: {
    width: 60,
    height: 60,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.background,
    ...shadow.sm,
  },
  buttonPressed: {
    transform: [{ scale: 0.92 }],
    opacity: 0.9,
  },
  nope: {},
  been: {},
  want: {},
  undo: { width: 48, height: 48 },
  buttonText: {
    fontSize: 26,
    fontWeight: '600',
    lineHeight: 30,
  },
  undoText: {
    fontSize: 22,
    color: colors.secondaryLabel,
  },
  wantText: {
    fontSize: 24,
  },
});
