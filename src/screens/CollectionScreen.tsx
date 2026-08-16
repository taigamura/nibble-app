import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import {
  getBeenCategoryStats,
  getBeenEntries,
  getReviewTags,
  getWantPlaces,
} from '../collection/selectors';
import type { BeenEntry } from '../collection/selectors';
import type { Store } from '../providers/types';
import { applyReview, markBeen } from '../taste-engine';
import type { Place, TasteGraph } from '../taste-engine';
import { PlaceDetailModal } from './PlaceDetailModal';
import { TonightSheet } from './TonightSheet';

interface CollectionScreenProps {
  store: Store;
  /** Whether Sign in with Apple is available at all (false when the real backend isn't configured). */
  canSignIn?: boolean;
  signedIn?: boolean;
  /** Opens the sign-in prompt (issue #9) -- this is the "sync" moment named in the acceptance criteria. */
  onRequestSignIn?: () => void;
}

type Tab = 'want' | 'been';

const TABS: { key: Tab; label: string }[] = [
  { key: 'want', label: 'Want' },
  { key: 'been', label: 'Been' },
];

export function CollectionScreen({ store, canSignIn, signedIn, onRequestSignIn }: CollectionScreenProps) {
  const [graph, setGraph] = useState<TasteGraph | null>(null);
  const [tab, setTab] = useState<Tab>('want');
  const [selected, setSelected] = useState<{
    place: Place;
    rating?: number;
    canReview?: boolean;
    /** True when opened from a Want row/context -- offers "I went" in the modal. */
    isWant?: boolean;
  } | null>(null);
  const [tonightVisible, setTonightVisible] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const loaded = await store.getGraph();
      if (!cancelled) setGraph(loaded);
    })();
    return () => {
      cancelled = true;
    };
  }, [store]);

  if (!graph) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const wantPlaces = getWantPlaces(graph);
  const beenEntries = getBeenEntries(graph);
  const categoryStats = getBeenCategoryStats(graph);

  const handleSubmitReview = (placeId: string, rating: number, reviewTags: string[]) => {
    const next = applyReview(graph, placeId, { rating, reviewTags });
    setGraph(next);
    void store.saveGraph(next);
  };

  // Moves a place from Want to Been, then reopens the detail modal (with
  // review enabled) on the freshly-Been place so the user can rate right
  // away or skip.
  const handleMarkBeen = (placeId: string) => {
    const place = wantPlaces.find((p) => p.id === placeId);
    const next = markBeen(graph, placeId);
    setGraph(next);
    void store.saveGraph(next);
    if (place) {
      setSelected({ place, rating: next.ratings[placeId], canReview: true, isWant: false });
    }
  };

  return (
    <View style={styles.container}>
      {canSignIn && !signedIn && (
        <Pressable accessibilityLabel="Sync across devices" style={styles.syncBanner} onPress={onRequestSignIn}>
          <Text style={styles.syncBannerText}>Sync across devices</Text>
        </Pressable>
      )}
      <View style={styles.tabs}>
        {TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            accessibilityLabel={`${label} tab`}
            accessibilityState={{ selected: tab === key }}
            style={[styles.tab, tab === key && styles.tabActive]}
            onPress={() => setTab(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'want' && (
        <>
          {wantPlaces.length > 0 && (
            <Pressable
              accessibilityLabel="Where should I go tonight?"
              style={styles.tonightButton}
              onPress={() => setTonightVisible(true)}
            >
              <Text style={styles.tonightButtonText}>🌙 Where to tonight?</Text>
            </Pressable>
          )}
          <PlaceList
            data={wantPlaces.map((place) => ({ place }))}
            emptyText="Swipe right on places to build your Want list."
            onSelect={(entry) => setSelected({ place: entry.place, isWant: true })}
            onMarkBeen={handleMarkBeen}
          />
        </>
      )}

      {tab === 'been' && (
        <>
          {categoryStats.length > 0 && (
            <View style={styles.stats}>
              {categoryStats.map((stat) => (
                <View key={stat.category} style={styles.statChip}>
                  <Text style={styles.statText}>
                    {stat.category} · {stat.count}
                  </Text>
                </View>
              ))}
            </View>
          )}
          <PlaceList
            data={beenEntries}
            emptyText="Places you mark Been will show up here."
            onSelect={(entry) => setSelected({ ...entry, canReview: true })}
          />
        </>
      )}

      <PlaceDetailModal
        place={selected?.place ?? null}
        rating={selected?.rating}
        reviewTags={selected ? getReviewTags(graph, selected.place.id) : undefined}
        onSubmitReview={selected?.canReview ? handleSubmitReview : undefined}
        onMarkBeen={selected?.isWant ? handleMarkBeen : undefined}
        onClose={() => setSelected(null)}
      />

      <TonightSheet
        visible={tonightVisible}
        wantPlaces={wantPlaces}
        vector={graph.vector}
        onClose={() => setTonightVisible(false)}
      />
    </View>
  );
}

interface PlaceListProps {
  data: BeenEntry[];
  emptyText: string;
  onSelect: (entry: BeenEntry) => void;
  /** When provided, each row shows an "I went" affordance (Want tab only). */
  onMarkBeen?: (placeId: string) => void;
}

function PlaceList({ data, emptyText, onSelect, onMarkBeen }: PlaceListProps) {
  if (data.length === 0) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>{emptyText}</Text>
      </View>
    );
  }
  return (
    <FlatList
      data={data}
      keyExtractor={(entry) => entry.place.id}
      contentContainerStyle={styles.list}
      renderItem={({ item }) => (
        <Pressable
          accessibilityLabel={`Open ${item.place.name}`}
          style={styles.row}
          onPress={() => onSelect(item)}
        >
          <Image source={{ uri: item.place.photoUrl }} style={styles.rowImage} />
          <View style={styles.rowBody}>
            <Text style={styles.rowName}>{item.place.name}</Text>
            <Text style={styles.rowMeta}>
              {item.place.category} · {item.place.priceBand}
              {item.rating !== undefined ? ` · your rating ${'★'.repeat(item.rating)}` : ''}
            </Text>
          </View>
          {onMarkBeen && (
            <Pressable
              accessibilityLabel={`I went to ${item.place.name}`}
              style={styles.iWentRowButton}
              onPress={(e) => {
                e.stopPropagation();
                onMarkBeen(item.place.id);
              }}
            >
              <Text style={styles.iWentRowButtonText}>I went</Text>
            </Pressable>
          )}
        </Pressable>
      )}
    />
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
    padding: 24,
  },
  emptyText: {
    fontSize: 14,
    color: '#888',
    textAlign: 'center',
  },
  syncBanner: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 10,
    borderRadius: 10,
    backgroundColor: '#111',
    alignItems: 'center',
  },
  syncBannerText: {
    color: '#fff',
    fontSize: 13,
    fontWeight: '700',
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  tab: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 16,
    backgroundColor: '#fff',
  },
  tabActive: {
    backgroundColor: '#111',
  },
  tabText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  tabTextActive: {
    color: '#fff',
  },
  tonightButton: {
    marginHorizontal: 16,
    marginTop: 12,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: '#007AFF',
    alignItems: 'center',
  },
  tonightButtonText: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '700',
  },
  stats: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 16,
    paddingTop: 12,
    gap: 8,
  },
  statChip: {
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  statText: {
    fontSize: 12,
    color: '#444',
  },
  list: {
    padding: 16,
  },
  row: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  rowImage: {
    width: 72,
    height: 72,
    backgroundColor: '#e5e5e5',
  },
  rowBody: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  rowName: {
    fontSize: 15,
    fontWeight: '700',
  },
  rowMeta: {
    marginTop: 3,
    fontSize: 12,
    color: '#666',
  },
  iWentRowButton: {
    alignSelf: 'center',
    marginRight: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 14,
    backgroundColor: '#34C759',
  },
  iWentRowButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#fff',
  },
});
