import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, ActivityIndicator, FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { Image } from 'expo-image';

import { Icon } from '../components/Icon';
import { formatCategory } from '../format';
import { haptics } from '../haptics';
import { useT } from '../i18n';
import { spring, useReducedMotion, REDUCED_MOTION_DURATION } from '../motion';
import { seedBeenSignals } from '../onboarding/seedBeenSignals';
import { FALLBACK_PHOTO_URL } from '../providers/curatedPlace';
import type { PlacesProvider, Store } from '../providers/types';
import type { Place } from '../taste-engine';
import { radius, shadow, spacing, type Palette, type TypeRamp } from '../theme';
import { useTheme } from '../ThemeProvider';

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

/**
 * How many places the onboarding grid surfaces. Capped low so the intro takes
 * ~a minute rather than scrolling hundreds of rows, and so we never fire a
 * deck-wide burst of Google photo requests (which got throttled past ~20 and
 * left later tiles gray).
 */
const ONBOARDING_LIMIT = 10;

/** Cold-start "tap everywhere you've been" list (issue #6). */
export function OnboardingScreen({ placesProvider, store, requestLocation, onComplete }: OnboardingScreenProps) {
  const { colors, type } = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const reducedMotion = useReducedMotion();
  const [places, setPlaces] = useState<Place[] | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [finishing, setFinishing] = useState(false);
  const continueScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    void requestLocation();
  }, [requestLocation]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const candidates = await placesProvider.getCandidates();
      if (!cancelled) {
        // Drop photoless rows (they render as generic picsum "stock" or gray
        // tiles), then cap to the nearest few. Candidates arrive sorted
        // nearest-first, so a plain slice keeps the closest real-photo places.
        const withPhotos = candidates.filter((place) => place.photoUrl !== FALLBACK_PHOTO_URL);
        setPlaces(withPhotos.slice(0, ONBOARDING_LIMIT));
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
      haptics.success();
    }
    onComplete();
  };

  const pressContinue = () => {
    if (reducedMotion) {
      void finish(selected);
      return;
    }
    Animated.sequence([
      Animated.spring(continueScale, { ...spring.bouncy, toValue: 0.96, useNativeDriver: true }),
      Animated.spring(continueScale, { ...spring.bouncy, toValue: 1, useNativeDriver: true }),
    ]).start();
    void finish(selected);
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
          <Text style={styles.title}>{t('onboarding.title')}</Text>
          <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
        </View>
        <Pressable
          accessibilityLabel={t('onboarding.a11y.skip')}
          accessibilityRole="button"
          style={({ pressed }) => [styles.skip, pressed && styles.pressed]}
          onPress={() => void finish(new Set())}
          disabled={finishing}
        >
          <Text style={styles.skipText}>{t('common.skip')}</Text>
        </Pressable>
      </View>
      <FlatList
        data={places}
        keyExtractor={(item) => item.id}
        // Single column: one photo per row, comfortably large and scrollable,
        // instead of a cramped 3-wide grid of thumbnails.
        numColumns={1}
        // Show the scroll indicator so the user can gauge how far down the
        // (now short) list they are.
        showsVerticalScrollIndicator={true}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <OnboardingTile
            item={item}
            isSelected={selected.has(item.id)}
            styles={styles}
            colors={colors}
            reducedMotion={reducedMotion}
            onToggle={() => toggle(item.id)}
          />
        )}
      />
      <View style={styles.footer}>
        <Pressable
          accessibilityLabel={t('onboarding.a11y.continue')}
          accessibilityRole="button"
          onPress={pressContinue}
          disabled={finishing}
        >
          <Animated.View style={[styles.done, { transform: [{ scale: continueScale }] }]}>
            <Text style={styles.doneText}>
              {selected.size > 0
                ? t('onboarding.continueWithCount', { count: selected.size })
                : t('onboarding.continue')}
            </Text>
          </Animated.View>
        </Pressable>
      </View>
    </View>
  );
}

interface OnboardingTileProps {
  item: Place;
  isSelected: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
  reducedMotion: boolean;
  onToggle: () => void;
}

function OnboardingTile({ item, isSelected, styles, colors, reducedMotion, onToggle }: OnboardingTileProps) {
  const t = useT();
  const scale = useRef(new Animated.Value(1)).current;
  const checkScale = useRef(new Animated.Value(isSelected ? 1 : 0)).current;
  // When a hero photo fails to load, swap in a neutral initial tile rather than
  // leaving a bare gray box.
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    if (reducedMotion) {
      checkScale.setValue(isSelected ? 1 : 0);
      return;
    }
    Animated.spring(checkScale, { ...spring.bouncy, toValue: isSelected ? 1 : 0, useNativeDriver: true }).start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSelected, reducedMotion]);

  const handlePress = () => {
    haptics.selection();
    if (reducedMotion) {
      onToggle();
      return;
    }
    Animated.sequence([
      Animated.spring(scale, { ...spring.bouncy, toValue: 0.96, useNativeDriver: true }),
      Animated.spring(scale, { ...spring.bouncy, toValue: 1, useNativeDriver: true }),
    ]).start();
    onToggle();
  };

  return (
    <Pressable
      accessibilityLabel={t('onboarding.a11y.beenTo', { name: item.name })}
      accessibilityRole="checkbox"
      accessibilityState={{ selected: isSelected, checked: isSelected }}
      onPress={handlePress}
    >
      <Animated.View style={[styles.tile, isSelected && styles.tileSelected, { transform: [{ scale }] }]}>
        {imageFailed ? (
          <View style={[styles.tileImage, styles.tileImageFallback]}>
            <Text style={styles.tileImageFallbackText}>{item.name.charAt(0).toUpperCase()}</Text>
          </View>
        ) : (
          <Image
            source={{ uri: item.photoUrl }}
            style={styles.tileImage}
            cachePolicy="memory-disk"
            contentFit="cover"
            transition={200}
            onError={() => setImageFailed(true)}
          />
        )}
        <View style={styles.tileBody}>
          <View style={styles.tileTextGroup}>
            <Text style={styles.tileName} numberOfLines={1}>
              {item.name}
            </Text>
            <Text style={styles.tileMeta} numberOfLines={1}>
              {formatCategory(item.category)} · {item.priceBand}
            </Text>
          </View>
          <View style={[styles.checkBadge, isSelected && styles.checkBadgeSelected]}>
            <Animated.View style={{ transform: [{ scale: checkScale }] }}>
              <Icon name="been" size={15} color={colors.labelOnColor} />
            </Animated.View>
          </View>
        </View>
      </Animated.View>
    </Pressable>
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
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    gap: spacing.md,
  },
  headerText: {
    flex: 1,
  },
  title: {
    ...type.title1,
  },
  subtitle: {
    ...type.subheadline,
    color: colors.secondaryLabel,
    marginTop: spacing.sm,
  },
  skip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    backgroundColor: colors.fill,
  },
  skipText: {
    ...type.footnote,
    fontWeight: '600',
    color: colors.secondaryLabel,
  },
  list: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.xs,
    // Clears the pinned Continue button so the last tile is fully tappable.
    paddingBottom: 112,
    gap: spacing.md,
  },
  tile: {
    borderRadius: radius.lg,
    overflow: 'hidden',
    backgroundColor: colors.background,
    borderWidth: 2,
    borderColor: 'transparent',
    ...shadow.sm,
  },
  tileSelected: {
    borderColor: colors.been,
  },
  tileImage: {
    width: '100%',
    aspectRatio: 16 / 9,
    backgroundColor: colors.fill,
  },
  tileImageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileImageFallbackText: {
    ...type.title1,
    color: colors.secondaryLabel,
  },
  tileBody: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  tileTextGroup: {
    flex: 1,
  },
  tileName: {
    ...type.headline,
  },
  tileMeta: {
    ...type.footnote,
    color: colors.secondaryLabel,
    marginTop: spacing.xs / 2,
  },
  checkBadge: {
    width: 28,
    height: 28,
    borderRadius: radius.pill,
    borderWidth: 2,
    borderColor: colors.separator,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkBadgeSelected: {
    backgroundColor: colors.been,
    borderColor: colors.been,
  },
  checkText: {
    color: colors.labelOnColor,
    fontSize: 15,
    fontWeight: '700',
  },
  footer: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.lg,
    bottom: spacing.xl,
  },
  done: {
    // Primary CTA on the app tint (systemBlue), not `colors.label` — label
    // flips to white in dark mode and the button vanished behind its white
    // `labelOnColor` text. Same fix as the Maps button in PlaceDetailModal.
    backgroundColor: colors.tint,
    borderRadius: radius.pill,
    paddingVertical: spacing.lg,
    alignItems: 'center',
    ...shadow.md,
  },
  doneText: {
    ...type.headline,
    color: colors.labelOnColor,
  },
  pressed: {
    opacity: 0.55,
  },
  });
}
