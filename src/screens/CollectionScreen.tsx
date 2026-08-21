import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import {
  getBeenCategoryStats,
  getBeenEntries,
  getReviewTags,
  getWantPlaces,
} from '../collection/selectors';
import type { BeenEntry } from '../collection/selectors';
import { summarizeTaste, type TasteSummary } from '../collection/tasteSummary';
import type { Store } from '../providers/types';
import { applyReview, markBeen } from '../taste-engine';
import type { Place, TasteGraph } from '../taste-engine';
import { useTheme } from '../ThemeProvider';
import { type Palette, type TypeRamp } from '../theme';
import { formatCategory } from '../format';
import { SettingsButton } from '../components/SettingsButton';
import { Icon } from '../components/Icon';
import { haptics } from '../haptics';
import { useT } from '../i18n';
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

const TABS: { key: Tab; labelKey: 'collection.tab.want' | 'collection.tab.been' }[] = [
  { key: 'want', labelKey: 'collection.tab.want' },
  { key: 'been', labelKey: 'collection.tab.been' },
];

export function CollectionScreen({ store, canSignIn, signedIn, onRequestSignIn, onOpenSettings }: CollectionScreenProps) {
  const { colors, type } = useTheme();
  const t = useT();
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
  const tasteSummary = summarizeTaste(graph);

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
        <Pressable accessibilityLabel={t('collection.syncBanner')} style={styles.syncBanner} onPress={onRequestSignIn}>
          <Text style={styles.syncBannerText}>{t('collection.syncBanner')}</Text>
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
        {TABS.map(({ key, labelKey }) => {
          const label = t(labelKey);
          return (
            <Pressable
              key={key}
              accessibilityLabel={t('collection.a11y.tab', { label })}
              accessibilityState={{ selected: tab === key }}
              style={styles.tab}
              onPress={() => handleTabChange(key)}
            >
              <Text style={[styles.tabText, tab === key && styles.tabTextActive]}>{label}</Text>
            </Pressable>
          );
        })}
      </View>

      {tasteSummary && <TasteCard summary={tasteSummary} styles={styles} colors={colors} />}

      {tab === 'want' && (
        <>
          {wantPlaces.length > 0 && (
            <Pressable
              accessibilityLabel={t('collection.a11y.tonightButton')}
              style={styles.tonightButton}
              onPress={() => setTonightVisible(true)}
            >
              <Icon name="sparkles" size={15} color={colors.tint} style={styles.tonightButtonIcon} />
              <Text style={styles.tonightButtonText}>{t('collection.whereTo')}</Text>
            </Pressable>
          )}
          <PlaceList
            data={wantPlaces.map((place) => ({ place }))}
            emptyText={t('collection.want.empty')}
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
            emptyText={t('collection.been.empty')}
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
  const t = useT();
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
        accessibilityLabel={t('collection.a11y.openPlace', { name: entry.place.name })}
        style={styles.row}
        onPress={() => onSelect(entry)}
        onPressIn={pressIn}
        onPressOut={pressOut}
      >
        <Image
          source={{ uri: entry.place.photoUrl }}
          style={styles.rowImage}
          cachePolicy="memory-disk"
          contentFit="cover"
          transition={200}
        />
        <View style={styles.rowBody}>
          <Text style={styles.rowName}>{entry.place.name}</Text>
          <Text style={styles.rowMeta}>
            {formatCategory(entry.place.category)} · {entry.place.priceBand}
            {entry.rating !== undefined ? t('collection.yourRating', { stars: '★'.repeat(entry.rating) }) : ''}
          </Text>
        </View>
        {onMarkBeen && (
          <Pressable
            accessibilityLabel={t('collection.a11y.iWentTo', { name: entry.place.name })}
            style={styles.iWentRowButton}
            onPress={(e) => {
              e.stopPropagation();
              haptics.success();
              onMarkBeen(entry.place.id);
            }}
          >
            <Text style={styles.iWentRowButtonText}>{t('placeDetail.iWent')}</Text>
          </Pressable>
        )}
      </Pressable>
    </Animated.View>
  );
}

interface TasteCardProps {
  summary: TasteSummary;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
}

/**
 * Option D: a tinted "Your taste" hero card that makes the Collection read as a
 * personalized profile rather than a bookmark folder. Headline = strongest
 * positive signals, chips = where you've actually been, footer = breadth +
 * price lean. All fields are derived by `summarizeTaste`, which returns null
 * (and this card doesn't render) until there's enough signal to be honest.
 */
function TasteCard({ summary, styles, colors }: TasteCardProps) {
  const t = useT();
  const unit = t(summary.placeCount === 1 ? 'collection.taste.unitOne' : 'collection.taste.unitOther');
  const footer =
    t('collection.taste.footerBuilt', { count: summary.placeCount, unit }) +
    (summary.priceLean ? t('collection.taste.footerPriceLean', { price: summary.priceLean }) : '');

  return (
    <View style={styles.tasteCard}>
      <View style={styles.tasteEyebrowRow}>
        <Icon name="sparkles" size={12} color={colors.tint} style={styles.tasteEyebrowIcon} />
        <Text style={styles.tasteEyebrow}>{t('collection.taste.eyebrow')}</Text>
      </View>
      <Text style={styles.tasteHeadline}>{summary.headline}</Text>
      {summary.categoryChips.length > 0 && (
        <View style={styles.tasteChips}>
          {summary.categoryChips.map((chip) => (
            <View key={chip.category} style={styles.tasteChip}>
              <Text style={styles.tasteChipText}>
                {formatCategory(chip.category)} · {chip.count}
              </Text>
            </View>
          ))}
        </View>
      )}
      <Text style={styles.tasteFooter}>{footer}</Text>
    </View>
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
    // "Your taste" hero card (Option D). The tint wash is derived from the
    // active palette's tint via RN 8-digit hex (#RRGGBBAA), so it adapts to
    // light/dark without a separate token.
    tasteCard: {
      marginHorizontal: 16,
      marginTop: 12,
      padding: 16,
      borderRadius: 16,
      backgroundColor: `${colors.tint}1F`, // ~12% tint wash
      borderWidth: StyleSheet.hairlineWidth,
      borderColor: `${colors.tint}40`, // ~25% tint hairline
    },
    tasteEyebrowRow: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    tasteEyebrowIcon: {
      marginRight: 5,
    },
    tasteEyebrow: {
      ...type.caption2,
      fontWeight: '700',
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: colors.tint,
    },
    tasteHeadline: {
      ...type.title3,
      fontWeight: '700',
      color: colors.label,
      marginTop: 8,
    },
    tasteChips: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 7,
      marginTop: 12,
    },
    tasteChip: {
      backgroundColor: `${colors.tint}26`, // ~15% tint
      borderRadius: 999,
      paddingHorizontal: 10,
      paddingVertical: 5,
    },
    tasteChipText: {
      ...type.caption1,
      fontWeight: '600',
      color: colors.tint,
    },
    tasteFooter: {
      ...type.footnote,
      color: colors.secondaryLabel,
      marginTop: 12,
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
