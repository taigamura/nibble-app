import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ActivityIndicator, FlatList, Image, Pressable, StyleSheet, Text, View } from 'react-native';

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
import { useTheme } from '../ThemeProvider';
import { type Palette, type TypeRamp } from '../theme';
import { formatCategory } from '../format';
import { SettingsButton } from '../components/SettingsButton';
import { Icon } from '../components/Icon';
import { haptics } from '../haptics';
import { spring, useReducedMotion } from '../motion';
import { PlaceDetailModal } from './PlaceDetailModal';
import { TonightSheet } from './TonightSheet';

interface CollectionScreenProps {
  store: Store;
  /** Whether Sign in with Apple is available at all (false when the real backend isn't configured). */
  canSignIn?: boolean;
  signedIn?: boolean;
  /** Opens the sign-in prompt (issue #9) -- this is the "sync" moment named in the acceptance criteria. */
  onRequestSignIn?: () => void;
  /** Opens the Settings sheet (the gear lives in this screen's header bar). */
  onOpenSettings?: () => void;
}

type Tab = 'want' | 'been';

const TABS: { key: Tab; label: string }[] = [
  { key: 'want', label: 'Want' },
  { key: 'been', label: 'Been' },
];

export function CollectionScreen({ store, canSignIn, signedIn, onRequestSignIn, onOpenSettings }: CollectionScreenProps) {
  const { colors, type } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const reducedMotion = useReducedMotion();
  const [graph, setGraph] = useState<TasteGraph | null>(null);
  const [tab, setTab] = useState<Tab>('want');
  const [tabsWidth, setTabsWidth] = useState(0);
  const tabIndicatorAnim = useRef(new Animated.Value(0)).current;
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

  const handleTabChange = (key: Tab) => {
    if (key === tab) return;
    haptics.selection();
    setTab(key);
    const toValue = TABS.findIndex((t) => t.key === key);
    if (reducedMotion) {
      tabIndicatorAnim.setValue(toValue);
    } else {
      Animated.spring(tabIndicatorAnim, {
        toValue,
        ...spring.snappy,
        useNativeDriver: true,
      }).start();
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <SettingsButton onPress={onOpenSettings} />
      </View>
      {canSignIn && !signedIn && (
        <Pressable accessibilityLabel="Sync across devices" style={styles.syncBanner} onPress={onRequestSignIn}>
          <Text style={styles.syncBannerText}>Sync across devices</Text>
        </Pressable>
      )}
      <View
        style={styles.tabs}
        onLayout={(e) => setTabsWidth(e.nativeEvent.layout.width)}
      >
        {tabsWidth > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.tabIndicator,
              {
                width: (tabsWidth - 6) / TABS.length,
                transform: [
                  {
                    translateX: tabIndicatorAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0, (tabsWidth - 6) / TABS.length],
                    }),
                  },
                ],
              },
            ]}
          />
        )}
        {TABS.map(({ key, label }) => (
          <Pressable
            key={key}
            accessibilityLabel={`${label} tab`}
            accessibilityState={{ selected: tab === key }}
            style={styles.tab}
            onPress={() => handleTabChange(key)}
          >
            <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {tab === 'want' && (
        <>
          {wantPlaces.length > 0 && (
            <Pressable
              accessibilityLabel="Help me pick a place"
              style={styles.tonightButton}
              onPress={() => setTonightVisible(true)}
            >
              <Icon name="sparkles" size={15} color={colors.tint} style={styles.tonightButtonIcon} />
              <Text style={styles.tonightButtonText}>Where to?</Text>
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
                    {formatCategory(stat.category)} · {stat.count}
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
  const { colors, type } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const reducedMotion = useReducedMotion();
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
        <PlaceRow
          entry={item}
          styles={styles}
          reducedMotion={reducedMotion}
          onSelect={onSelect}
          onMarkBeen={onMarkBeen}
        />
      )}
    />
  );
}

interface PlaceRowProps {
  entry: BeenEntry;
  styles: ReturnType<typeof makeStyles>;
  reducedMotion: boolean;
  onSelect: (entry: BeenEntry) => void;
  onMarkBeen?: (placeId: string) => void;
}

function PlaceRow({ entry, styles, reducedMotion, onSelect, onMarkBeen }: PlaceRowProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    if (reducedMotion) return;
    Animated.spring(scale, { toValue: 0.97, ...spring.snappy, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    if (reducedMotion) return;
    Animated.spring(scale, { toValue: 1, ...spring.snappy, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityLabel={`Open ${entry.place.name}`}
        style={styles.row}
        onPress={() => onSelect(entry)}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        <Image source={{ uri: entry.place.photoUrl }} style={styles.rowImage} />
        <View style={styles.rowBody}>
          <Text style={styles.rowName}>{entry.place.name}</Text>
          <Text style={styles.rowMeta}>
            {formatCategory(entry.place.category)} · {entry.place.priceBand}
            {entry.rating !== undefined ? ` · your rating ${'★'.repeat(entry.rating)}` : ''}
          </Text>
        </View>
        {onMarkBeen && (
          <Pressable
            accessibilityLabel={`I went to ${entry.place.name}`}
            style={styles.iWentRowButton}
            onPress={(e) => {
              e.stopPropagation();
              haptics.success();
              onMarkBeen(entry.place.id);
            }}
          >
            <Text style={styles.iWentRowButtonText}>I went</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

function makeStyles(colors: Palette, type: TypeRamp) {
  return StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: colors.groupedBackground,
    },
    center: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    },
    emptyText: {
      ...type.subheadline,
      color: colors.secondaryLabel,
      textAlign: 'center',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      // Just the settings gear -- the "Collection" title was redundant with the
      // active tab-bar label, so it's dropped and the gear sits at the trailing edge.
      justifyContent: 'flex-end',
      paddingHorizontal: 16,
      paddingTop: 8,
      paddingBottom: 4,
    },
    syncBanner: {
      marginHorizontal: 16,
      marginTop: 12,
      paddingVertical: 10,
      borderRadius: 10,
      backgroundColor: colors.fill,
      alignItems: 'center',
    },
    syncBannerText: {
      ...type.footnote,
      fontWeight: '700',
      color: colors.tint,
    },
    tabs: {
      flexDirection: 'row',
      position: 'relative',
      marginHorizontal: 16,
      marginTop: 12,
      padding: 3,
      backgroundColor: colors.fill,
      borderRadius: 13,
    },
    tabIndicator: {
      position: 'absolute',
      top: 3,
      bottom: 3,
      left: 3,
      borderRadius: 10,
      backgroundColor: colors.tint,
    },
    tab: {
      flex: 1,
      paddingVertical: 7,
      borderRadius: 10,
      alignItems: 'center',
    },
    tabText: {
      ...type.subheadline,
      fontWeight: '600',
      color: colors.secondaryLabel,
    },
    tabTextActive: {
      color: colors.labelOnColor,
    },
    tonightButton: {
      flexDirection: 'row',
      alignSelf: 'center',
      marginTop: 12,
      paddingVertical: 7,
      paddingHorizontal: 14,
      borderRadius: 999,
      backgroundColor: colors.fill,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tonightButtonIcon: {
      marginRight: 5,
    },
    tonightButtonText: {
      ...type.subheadline,
      fontWeight: '600',
      color: colors.tint,
    },
    stats: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      paddingHorizontal: 16,
      paddingTop: 12,
      gap: 8,
    },
    statChip: {
      backgroundColor: colors.background,
      borderRadius: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },
    statText: {
      ...type.caption1,
      color: colors.secondaryLabel,
    },
    list: {
      padding: 16,
    },
    row: {
      flexDirection: 'row',
      backgroundColor: colors.background,
      borderRadius: 12,
      marginBottom: 10,
      overflow: 'hidden',
    },
    rowImage: {
      width: 72,
      height: 72,
      backgroundColor: colors.fill,
    },
    rowBody: {
      flex: 1,
      padding: 10,
      justifyContent: 'center',
    },
    rowName: {
      ...type.headline,
      color: colors.label,
    },
    rowMeta: {
      ...type.footnote,
      marginTop: 3,
      color: colors.secondaryLabel,
    },
    iWentRowButton: {
      alignSelf: 'center',
      marginRight: 12,
      paddingVertical: 6,
      paddingHorizontal: 12,
      borderRadius: 14,
      backgroundColor: colors.been,
    },
    iWentRowButtonText: {
      ...type.caption1,
      fontWeight: '700',
      color: colors.labelOnColor,
    },
  });
}
