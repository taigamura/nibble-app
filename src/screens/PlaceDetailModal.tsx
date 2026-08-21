import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Image,
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { Icon } from '../components/Icon';
import { SheetScrim, useSheetDetents } from '../components/sheetGestures';
import { formatCategory } from '../format';
import { haptics } from '../haptics';
import { useT } from '../i18n';
import { spring, useReducedMotion } from '../motion';
import type { Place } from '../taste-engine';
import { radius, spacing, type Palette, type TypeRamp } from '../theme';
import { useTheme } from '../ThemeProvider';
import { buildMapUrl, buildWriteReviewUrl } from './googleMapsLinks';

interface PlaceDetailModalProps {
  place: Place | null;
  /** The user's own Been rating, when this place came from the Been list. */
  rating?: number;
  /** Tags the user already affirmed in a prior in-app review, to pre-select. */
  reviewTags?: string[];
  /**
   * When provided, the in-app review UI (stars + tag chips) is shown -- this
   * is the private "sharpen my taste" action, only meaningful for a place the
   * user has actually been. Omit it (e.g. from the swipe deck's detail view)
   * to render a read-only sheet.
   */
  onSubmitReview?: (placeId: string, rating: number, reviewTags: string[]) => void;
  /**
   * When provided, an "I went" button renders for a place that hasn't been
   * marked Been yet -- moving it from Want to Been (issue: Want -> Been).
   * Omit for places already Been or when the caller doesn't support the
   * transition (e.g. the swipe deck's detail view).
   */
  onMarkBeen?: (placeId: string) => void;
  onClose: () => void;
}

const STARS = [1, 2, 3, 4, 5];

/**
 * A Pressable that springs to a slight scale-down while held, for tactile
 * feedback (Apple: respond on press, continuously). `containerStyle` carries
 * layout (e.g. flex:1) onto the animated wrapper so wrapping never collapses a
 * flex row.
 */
function PressScale({
  children,
  style,
  containerStyle,
  reducedMotion,
  onPress,
  ...rest
}: React.ComponentProps<typeof Pressable> & {
  reducedMotion: boolean;
  containerStyle?: React.ComponentProps<typeof Animated.View>['style'];
}) {
  const scale = useRef(new Animated.Value(1)).current;

  const pressIn = () => {
    if (reducedMotion) return;
    Animated.spring(scale, { toValue: 0.95, ...spring.snappy, useNativeDriver: true }).start();
  };
  const pressOut = () => {
    if (reducedMotion) return;
    Animated.spring(scale, { toValue: 1, ...spring.snappy, useNativeDriver: true }).start();
  };

  return (
    <Animated.View style={[containerStyle, { transform: [{ scale }] }]}>
      <Pressable {...rest} style={style} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

interface ReviewStarProps {
  n: number;
  filled: boolean;
  colors: Palette;
  styles: ReturnType<typeof makeStyles>;
  reducedMotion: boolean;
  onPress: (n: number) => void;
}

/** One review star: filled/outline by draft rating, with a pop + haptic on tap. */
function ReviewStar({ n, filled, colors, styles, reducedMotion, onPress }: ReviewStarProps) {
  const t = useT();
  const scale = useRef(new Animated.Value(1)).current;

  const handlePress = () => {
    haptics.selection();
    if (!reducedMotion) {
      Animated.sequence([
        Animated.spring(scale, { ...spring.bouncy, toValue: 1.25, useNativeDriver: true }),
        Animated.spring(scale, { ...spring.bouncy, toValue: 1, useNativeDriver: true }),
      ]).start();
    }
    onPress(n);
  };

  return (
    <Pressable
      accessibilityLabel={t('common.a11y.rateStars', { n, plural: n === 1 ? '' : 's' })}
      accessibilityState={{ selected: filled }}
      style={styles.starButton}
      onPress={handlePress}
    >
      <Animated.View style={{ transform: [{ scale }] }}>
        <Icon
          name={filled ? 'star' : 'star-outline'}
          size={34}
          color={filled ? colors.star : colors.tertiaryLabel}
        />
      </Animated.View>
    </Pressable>
  );
}

/** Opening any collection item (Want/Been list row or map pin) shows this. */
export function PlaceDetailModal({
  place,
  rating,
  reviewTags,
  onSubmitReview,
  onMarkBeen,
  onClose,
}: PlaceDetailModalProps) {
  const { colors, type } = useTheme();
  const t = useT();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const reducedMotion = useReducedMotion();
  const [draftRating, setDraftRating] = useState<number>(rating ?? 0);
  const [draftTags, setDraftTags] = useState<string[]>(reviewTags ?? []);

  // Two-detent sheet (medium -> full on swipe up) + drag-down-to-dismiss +
  // tap-the-scrim-to-dismiss, shared across the app's bottom sheets. See
  // components/sheetGestures.
  const { translateY, panHandlers, sheetHeight, reset } = useSheetDetents(onClose);

  // Snap the sheet back to its resting position whenever a new place opens, so
  // a prior drag-close never leaves the next open translated off-screen.
  useEffect(() => {
    reset();
  }, [place?.id, reset]);

  // Reset the draft whenever a different place (or its saved review) opens,
  // so the stars/chips reflect this place rather than the last one reviewed.
  useEffect(() => {
    setDraftRating(rating ?? 0);
    setDraftTags(reviewTags ?? []);
  }, [place?.id, rating, reviewTags]);

  const toggleTag = (tag: string) => {
    haptics.selection();
    setDraftTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const submitReview = () => {
    if (!place || draftRating === 0) return;
    haptics.success();
    onSubmitReview?.(place.id, draftRating, draftTags);
    onClose();
  };

  const handleMarkBeen = () => {
    if (!place) return;
    haptics.success();
    onMarkBeen?.(place.id);
  };

  return (
    <Modal visible={place !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SheetScrim onPress={onClose} />
        <Animated.View style={[styles.sheet, { height: sheetHeight, transform: [{ translateY }] }]}>
          <View style={styles.grabberZone} {...panHandlers}>
            <View style={styles.grabber} />
          </View>
          {place && (
            <ScrollView style={styles.scroll} contentContainerStyle={styles.scrollContent}>
              <Image source={{ uri: place.photoUrl }} style={styles.photo} />
              <View style={styles.body}>
                <Text style={styles.name}>{place.name}</Text>
                <Text style={styles.meta}>
                  {formatCategory(place.category)} · {place.priceBand} · ★{place.rating.toFixed(1)} ·{' '}
                  {Math.round(place.distanceMeters)}m
                </Text>
                {place.tags.length > 0 && (
                  <View style={styles.tags}>
                    {place.tags.map((tag) => (
                      <View key={tag} style={styles.tag}>
                        <Text style={styles.tagText}>{tag}</Text>
                      </View>
                    ))}
                  </View>
                )}

                {onSubmitReview && (
                  <View style={styles.review}>
                    <Text style={styles.reviewTitle}>{t('placeDetail.yourReview')}</Text>
                    <Text style={styles.reviewSub}>{t('placeDetail.reviewSubtitle')}</Text>
                    <View style={styles.stars}>
                      {STARS.map((n) => (
                        <ReviewStar
                          key={n}
                          n={n}
                          filled={draftRating >= n}
                          colors={colors}
                          styles={styles}
                          reducedMotion={reducedMotion}
                          onPress={setDraftRating}
                        />
                      ))}
                    </View>
                    {place.tags.length > 0 && (
                      <>
                        <Text style={styles.chipsLabel}>{t('placeDetail.whatStoodOut')}</Text>
                        <View style={styles.chips}>
                          {place.tags.map((tag) => {
                            const on = draftTags.includes(tag);
                            return (
                              <PressScale
                                key={tag}
                                reducedMotion={reducedMotion}
                                accessibilityLabel={t('placeDetail.a11y.tag', { tag })}
                                accessibilityState={{ selected: on }}
                                style={[styles.chip, on && styles.chipOn]}
                                onPress={() => toggleTag(tag)}
                              >
                                <Text style={[styles.chipText, on && styles.chipTextOn]}>{tag}</Text>
                              </PressScale>
                            );
                          })}
                        </View>
                      </>
                    )}
                    <PressScale
                      reducedMotion={reducedMotion}
                      accessibilityLabel={t('placeDetail.saveReview')}
                      accessibilityState={{ disabled: draftRating === 0 }}
                      style={[styles.saveButton, draftRating === 0 && styles.saveButtonDisabled]}
                      onPress={submitReview}
                    >
                      <Text style={styles.saveButtonText}>{t('placeDetail.saveReview')}</Text>
                    </PressScale>
                  </View>
                )}
              </View>
              {onMarkBeen && (
                <View style={styles.actions}>
                  <PressScale
                    reducedMotion={reducedMotion}
                    containerStyle={styles.actionFlex}
                    accessibilityLabel={t('placeDetail.iWent')}
                    style={[styles.actionButton, styles.iWent]}
                    onPress={handleMarkBeen}
                  >
                    <Text style={[styles.actionText, styles.iWentText]}>{t('placeDetail.iWent')}</Text>
                  </PressScale>
                </View>
              )}
              <View style={styles.actions}>
                <PressScale
                  reducedMotion={reducedMotion}
                  containerStyle={styles.actionFlex}
                  accessibilityLabel={t('placeDetail.openInMaps')}
                  style={[styles.actionButton, styles.directions]}
                  onPress={() => Linking.openURL(buildMapUrl(place))}
                >
                  <Text style={[styles.actionText, styles.directionsText]}>{t('placeDetail.openInMaps')}</Text>
                </PressScale>
                <PressScale
                  reducedMotion={reducedMotion}
                  containerStyle={styles.actionFlex}
                  accessibilityLabel={t('placeDetail.a11y.writeGoogleReview')}
                  style={[styles.actionButton, styles.googleReview]}
                  onPress={() => Linking.openURL(buildWriteReviewUrl(place))}
                >
                  <Text style={styles.actionText}>{t('placeDetail.googleReview')}</Text>
                </PressScale>
              </View>
              <Pressable accessibilityLabel={t('placeDetail.a11y.closeDetail')} style={styles.close} onPress={onClose}>
                <Text style={styles.closeText}>{t('common.close')}</Text>
              </Pressable>
            </ScrollView>
          )}
        </Animated.View>
      </View>
    </Modal>
  );
}

function makeStyles(colors: Palette, type: TypeRamp) {
  return StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: colors.scrim,
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
  },
  // Flexes to fill the space between the grabber and the pinned action
  // buttons, so long content scrolls while the footer stays put -- and so the
  // extra room from expanding to the large detent becomes scrollable area.
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    paddingBottom: spacing.lg,
  },
  // The drag target at the top of the sheet. Kept a touch taller than the
  // grabber pill itself so there's a comfortable area to start the pull-down.
  grabberZone: {
    alignItems: 'center',
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    backgroundColor: colors.background,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: 2.5,
    backgroundColor: colors.tertiaryLabel,
  },
  photo: {
    width: '100%',
    height: 220,
    backgroundColor: colors.fill,
  },
  body: {
    padding: spacing.xl,
  },
  name: {
    ...type.title1,
  },
  meta: {
    ...type.subheadline,
    marginTop: spacing.xs,
    color: colors.secondaryLabel,
  },
  tags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.md,
    gap: spacing.sm,
  },
  tag: {
    backgroundColor: colors.fill,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 1,
  },
  tagText: {
    ...type.caption1,
    color: colors.label,
  },
  review: {
    marginTop: spacing.xl,
    paddingTop: spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  reviewTitle: {
    ...type.headline,
  },
  reviewSub: {
    ...type.footnote,
    marginTop: spacing.xs,
  },
  stars: {
    flexDirection: 'row',
    marginTop: spacing.md,
  },
  starButton: {
    paddingHorizontal: spacing.xs + 1,
  },
  chipsLabel: {
    ...type.footnote,
    marginTop: spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginTop: spacing.sm,
    gap: spacing.sm,
  },
  chip: {
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs + 2,
    backgroundColor: colors.fill,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  chipOn: {
    backgroundColor: colors.background,
    borderColor: colors.tint,
  },
  chipText: {
    ...type.footnote,
    color: colors.label,
  },
  chipTextOn: {
    color: colors.tint,
    fontWeight: '600',
  },
  saveButton: {
    marginTop: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    backgroundColor: colors.tint,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    ...type.headline,
    color: colors.labelOnColor,
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.lg,
  },
  actionFlex: {
    flex: 1,
  },
  actionButton: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  directions: {
    // Primary action: the app tint (systemBlue), not `colors.label` — label
    // flips to white in dark mode and vanished behind the white `labelOnColor`
    // text. Tint stays readable with white text in both schemes.
    backgroundColor: colors.tint,
  },
  iWent: {
    backgroundColor: colors.been,
  },
  iWentText: {
    color: colors.labelOnColor,
  },
  googleReview: {
    backgroundColor: colors.fill,
  },
  actionText: {
    ...type.subheadline,
    fontWeight: '700',
    color: colors.label,
  },
  directionsText: {
    color: colors.labelOnColor,
  },
  close: {
    paddingVertical: spacing.lg,
    alignItems: 'center',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  closeText: {
    ...type.headline,
    color: colors.label,
  },
  });
}
