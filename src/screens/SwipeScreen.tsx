import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '../components/Card';
import { RatingPrompt } from '../components/RatingPrompt';
import { DEFAULT_RADIUS_METERS, RADIUS_OPTIONS_METERS } from '../config/areas';
import type { DeckContext, EnrichmentProvider, GeoPoint, PlacesProvider, Store } from '../providers/types';
import {
  applyRating,
  clearNopes,
  emptyTasteGraph,
  rankDeck,
  updateTaste,
  whySurfaced,
} from '../taste-engine';
import type { Place, SwipeAction, SwipeEvent, TasteGraph } from '../taste-engine';
import { DeckContextControl } from './DeckContextControl';
import { PlaceDetailModal } from './PlaceDetailModal';
import { SettingsButton } from '../components/SettingsButton';
import { Icon } from '../components/Icon';
import { haptics } from '../haptics';
import { useT } from '../i18n';
import { radius, shadow, spacing, type Palette, type TypeRamp } from '../theme';
import { useTheme } from '../ThemeProvider';

interface SwipeScreenProps {
  placesProvider: PlacesProvider;
  enrichmentProvider: EnrichmentProvider;
  store: Store;
  /** Injected seed for the wildcard shuffle. Defaults to a per-session value. */
  seed?: number;
  /** Navigates to the Want tab (Collection screen). Hidden when omitted. */
  onGoToWant?: () => void;
  /** Opens the Settings sheet (the gear lives in this screen's header bar). */
  onOpenSettings?: () => void;
  /** The user's saved Home snapshot (a selectable chip in the area picker), or `null`. */
  homePoint?: GeoPoint | null;
  /** Captures the device's current position as Home. */
  onSetHome?: () => void;
  /** Un-sets Home. */
  onClearHome?: () => void;
  /**
   * Bumped by the parent (e.g. after the Settings "bring back passed places"
   * action mutates the shared store) to force this screen to re-read the graph
   * from the store. Changing it re-runs the graph-load effect.
   */
  reloadKey?: number;
}

export function SwipeScreen({
  placesProvider,
  store,
  seed,
  onGoToWant,
  onOpenSettings,
  homePoint,
  onSetHome,
  onClearHome,
  reloadKey,
}: SwipeScreenProps) {
  const { colors, type } = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const [candidates, setCandidates] = useState<Place[] | null>(null);
  const [graph, setGraph] = useState<TasteGraph>(emptyTasteGraph());
  const [undoStack, setUndoStack] = useState<SwipeEvent[]>([]);
  const [pendingRating, setPendingRating] = useState<Place | null>(null);
  const [detailPlace, setDetailPlace] = useState<Place | null>(null);
  const [deckContext, setDeckContext] = useState<DeckContext>({ radiusMeters: DEFAULT_RADIUS_METERS });
  const [contextControlVisible, setContextControlVisible] = useState(false);
  // "Reset seen" (empty-deck decision card) is a two-tap confirm since it
  // brings every place the user passed on back into the deck.
  const [resetSeenArmed, setResetSeenArmed] = useState(false);
  // `seed` is meant to be stable for the life of the session (that's what
  // makes the 70/30 blend "injected" rather than reshuffled on every
  // render). Falling back to `Date.now()` as a default *parameter* would
  // re-evaluate on every render since no caller passes `seed`, silently
  // re-randomizing the wildcard slice on each swipe/undo. Pin it once.
  const sessionSeed = useRef(seed ?? Date.now()).current;

  // Always holds the latest graph, so the stable-order deck ranking below can
  // read current taste without depending on `graph` (which would re-rank on
  // every swipe -- see the `deck` comment further down).
  const graphRef = useRef(graph);
  graphRef.current = graph;

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
    // `reloadKey` is intentionally a dependency: bumping it (after the Settings
    // "bring back passed places" action writes to the store) re-reads the graph
    // so the deck reflects the cleared Nopes without a remount.
  }, [store, reloadKey]);

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

  // Ranked once per candidate set (stable order for the session) rather than
  // depending on `graph` -- every swipe calls updateTaste, which changes
  // graph.vector/history, and re-ranking on that would reorder the deck out
  // from under the previewed next card (issue: deck reorders on every swipe).
  // Newly-learned taste still applies on the next candidate refetch or
  // restart, since `candidates` changing recomputes this.
  const rankedDeck = useMemo(() => {
    if (!candidates) return [];
    return rankDeck(graphRef.current, candidates, { seed: sessionSeed });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [candidates, sessionSeed]);

  // Derives the visible deck by filtering actioned places out of the stable
  // order above, so Nope/Want/Been drop off the front without reordering the
  // rest.
  const actionedIds = useMemo(() => new Set(graph.history.map((e) => e.place.id)), [graph.history]);
  const deck = useMemo(() => rankedDeck.filter((p) => !actionedIds.has(p.id)), [rankedDeck, actionedIds]);

  // Prefetch the hero photo of the next few cards so they don't flash/reload
  // right after a swipe promotes the behind card.
  useEffect(() => {
    deck.slice(0, 4).forEach((p) => {
      try {
        Image.prefetch?.(p.photoUrl)?.catch?.(() => {});
      } catch {
        // Image.prefetch is a no-op on some platforms/test envs; ignore.
      }
    });
  }, [deck]);

  const topPlace = deck[0];
  const nextPlace = deck[1];
  // The taste-engine explanation for the top card, computed here (the graph
  // lives in this screen) and passed down so `Card` stays free of engine
  // imports. `undefined` when there's no positive signal yet → no pill.
  const topReason = topPlace ? whySurfaced(graph.vector, topPlace) : undefined;

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
    haptics.selection();
    const remaining = undoStack.slice(0, -1);
    const rebuilt = remaining.reduce(updateTaste, emptyTasteGraph());
    setGraph(rebuilt);
    setUndoStack(remaining);
    void store.saveGraph(rebuilt);
    setPendingRating(null);
  };

  const currentRadius = deckContext.radiusMeters ?? DEFAULT_RADIUS_METERS;
  const radiusIndex = RADIUS_OPTIONS_METERS.indexOf(
    currentRadius as (typeof RADIUS_OPTIONS_METERS)[number]
  );
  const nextRadius =
    radiusIndex >= 0 && radiusIndex < RADIUS_OPTIONS_METERS.length - 1
      ? RADIUS_OPTIONS_METERS[radiusIndex + 1]
      : undefined;

  const handleWiden = () => {
    if (!nextRadius) return;
    setDeckContext((prev) => ({ ...prev, radiusMeters: nextRadius }));
  };

  // Brings every passed-on ("not for me") place back into the deck by stripping
  // the Nope events from the graph, then persists it so they stay back across
  // restarts. The undo stack is cleared since its events no longer match the
  // rewritten graph. Same effect as the Settings "bring back passed places"
  // action, offered here in-context when the deck runs dry.
  const handleResetSeen = () => {
    if (!resetSeenArmed) {
      setResetSeenArmed(true);
      return;
    }
    const refreshed = clearNopes(graph);
    setGraph(refreshed);
    setUndoStack([]);
    void store.saveGraph(refreshed);
    setResetSeenArmed(false);
  };

  const radiusLabel =
    deckContext.radiusMeters && deckContext.radiusMeters >= 1000
      ? `${deckContext.radiusMeters / 1000}km`
      : `${deckContext.radiusMeters ?? DEFAULT_RADIUS_METERS}m`;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {undoStack.length > 0 && (
            <Pressable
              accessibilityLabel={t('swipe.a11y.undo')}
              accessibilityHint={t('swipe.a11y.undoHint')}
              style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}
              onPress={handleUndo}
            >
              <Icon name="undo" size={20} color={colors.tint} />
            </Pressable>
          )}
          <Pressable
            accessibilityLabel={t('swipe.a11y.changeArea')}
            style={({ pressed }) => [styles.areaButton, pressed && styles.pressed]}
            onPress={() => setContextControlVisible(true)}
          >
            <Icon name="location" size={13} color={colors.tint} style={styles.areaButtonIcon} />
            <Text style={styles.areaButtonText}>{radiusLabel}</Text>
          </Pressable>
        </View>
        <SettingsButton onPress={onOpenSettings} />
      </View>
      <View style={styles.deck}>
        {!candidates && (
          <View style={styles.center}>
            <ActivityIndicator />
          </View>
        )}
        {candidates && !topPlace && (
          <View style={styles.center}>
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>{t('swipe.emptyTitle')}</Text>
              <Text style={styles.emptySubtitle}>{t('swipe.emptySubtitle')}</Text>
              <View style={styles.emptyActions}>
                {nextRadius && (
                  <Pressable
                    accessibilityLabel={t('swipe.a11y.widenRadius')}
                    style={({ pressed }) => [styles.emptyButton, styles.emptyButtonPrimary, pressed && styles.pressed]}
                    onPress={handleWiden}
                  >
                    <Text style={styles.emptyButtonPrimaryText}>{t('swipe.widenSearch')}</Text>
                  </Pressable>
                )}
                <Pressable
                  accessibilityLabel={t('swipe.a11y.resetSeenPlaces')}
                  accessibilityHint={t('swipe.a11y.resetSeenHint')}
                  style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
                  onPress={handleResetSeen}
                >
                  <Text style={styles.emptyButtonText}>
                    {resetSeenArmed ? t('swipe.resetSeenConfirm') : t('swipe.resetSeen')}
                  </Text>
                </Pressable>
                {onGoToWant && (
                  <Pressable
                    accessibilityLabel={t('swipe.seeWantList')}
                    style={({ pressed }) => [styles.emptyButton, pressed && styles.pressed]}
                    onPress={onGoToWant}
                  >
                    <Text style={styles.emptyButtonText}>{t('swipe.seeWantList')}</Text>
                  </Pressable>
                )}
              </View>
            </View>
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
            place={topPlace}
            reason={topReason}
            onSwiped={(action) => commitSwipe(topPlace, action)}
            onInfoPress={setDetailPlace}
          />
        )}
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
        homePoint={homePoint}
        onSetHome={onSetHome}
        onClearHome={onClearHome}
        onChange={setDeckContext}
        onClose={() => setContextControlVisible(false)}
      />
    </View>
  );
}

function makeStyles(colors: Palette, type: TypeRamp) {
  return StyleSheet.create({
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
    paddingBottom: spacing.sm,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  headerButton: {
    width: 32,
    height: 32,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.fill,
  },
  areaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.xs + 1,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  areaButtonIcon: {
    marginRight: spacing.xs,
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
  emptyCard: {
    width: '100%',
    alignItems: 'center',
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    ...shadow.sm,
  },
  emptyTitle: {
    ...type.headline,
    textAlign: 'center',
  },
  emptySubtitle: {
    ...type.footnote,
    color: colors.secondaryLabel,
    textAlign: 'center',
    marginTop: spacing.xs,
  },
  emptyActions: {
    marginTop: spacing.lg,
    width: '100%',
    gap: spacing.sm,
  },
  emptyButton: {
    paddingVertical: spacing.sm + 2,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
    alignItems: 'center',
  },
  emptyButtonPrimary: {
    backgroundColor: colors.tint,
  },
  emptyButtonText: {
    ...type.subheadline,
    fontWeight: '600',
    color: colors.secondaryLabel,
  },
  emptyButtonPrimaryText: {
    ...type.subheadline,
    fontWeight: '600',
    color: colors.labelOnColor,
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
  });
}
