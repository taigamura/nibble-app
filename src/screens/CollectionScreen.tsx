import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { CollectionMap } from '../components/CollectionMap';
import {
  getBeenCategoryStats,
  getBeenEntries,
  getMapPoints,
  getReviewTags,
  getWantPlaces,
} from '../collection/selectors';
import type { BeenEntry } from '../collection/selectors';
import type { Store } from '../providers/types';
import { applyReview } from '../taste-engine';
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

type Tab = 'want' | 'been' | 'map';

const TABS: { key: Tab; label: string }[] = [
  { key: 'want', label: 'Want' },
  { key: 'been', label: 'Been' },
  { key: 'map', label: 'Map' },
];

export function CollectionScreen({ store, canSignIn, signedIn, onRequestSignIn }: CollectionScreenProps) {
  const [graph, setGraph] = useState<TasteGraph | null>(null);
  const [tab, setTab] = useState<Tab>('want');
  const [selected, setSelected] = useState<{
    place: Place;
    rating?: number;
    canReview?: boolean;
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
  const mapPoints = getMapPoints(graph);
  const beenIds = new Set(beenEntries.map((entry) => entry.place.id));

  const handleSubmitReview = (placeId: string, rating: number, reviewTags: string[]) => {
    const next = applyReview(graph, placeId, { rating, reviewTags });
    setGraph(next);
    void store.saveGraph(next);
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
            onSelect={(entry) => setSelected({ place: entry.place })}
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

      {tab === 'map' && (
        <CollectionMap
          points={mapPoints}
          onSelect={(place) =>
            setSelected({
              place,
              rating: graph.ratings[place.id],
              canReview: beenIds.has(place.id),
            })
          }
        />
      )}

      <PlaceDetailModal
        place={selected?.place ?? null}
        rating={selected?.rating}
        reviewTags={selected ? getReviewTags(graph, selected.place.id) : undefined}
        onSubmitReview={selected?.canReview ? handleSubmitReview : undefined}
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
}

function PlaceList({ data, emptyText, onSelect }: PlaceListProps) {
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
});
