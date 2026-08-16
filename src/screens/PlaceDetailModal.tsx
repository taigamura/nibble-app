import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

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
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const [draftRating, setDraftRating] = useState<number>(rating ?? 0);
  const [draftTags, setDraftTags] = useState<string[]>(reviewTags ?? []);

  // Reset the draft whenever a different place (or its saved review) opens,
  // so the stars/chips reflect this place rather than the last one reviewed.
  useEffect(() => {
    setDraftRating(rating ?? 0);
    setDraftTags(reviewTags ?? []);
  }, [place?.id, rating, reviewTags]);

  const toggleTag = (tag: string) => {
    setDraftTags((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  const submitReview = () => {
    if (!place || draftRating === 0) return;
    onSubmitReview?.(place.id, draftRating, draftTags);
    onClose();
  };

  return (
    <Modal visible={place !== null} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          {place && (
            <ScrollView>
              <Image source={{ uri: place.photoUrl }} style={styles.photo} />
              <View style={styles.body}>
                <Text style={styles.name}>{place.name}</Text>
                <Text style={styles.meta}>
                  {place.category} · {place.priceBand} · ★{place.rating.toFixed(1)} ·{' '}
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
                    <Text style={styles.reviewTitle}>Your review</Text>
                    <Text style={styles.reviewSub}>
                      Rate it to sharpen your recommendations. Stays private.
                    </Text>
                    <View style={styles.stars}>
                      {STARS.map((n) => (
                        <Pressable
                          key={n}
                          accessibilityLabel={`Rate ${n} star${n === 1 ? '' : 's'}`}
                          accessibilityState={{ selected: draftRating >= n }}
                          style={styles.starButton}
                          onPress={() => setDraftRating(n)}
                        >
                          <Text style={[styles.star, draftRating >= n && styles.starOn]}>★</Text>
                        </Pressable>
                      ))}
                    </View>
                    {place.tags.length > 0 && (
                      <>
                        <Text style={styles.chipsLabel}>What stood out?</Text>
                        <View style={styles.chips}>
                          {place.tags.map((tag) => {
                            const on = draftTags.includes(tag);
                            return (
                              <Pressable
                                key={tag}
                                accessibilityLabel={`${tag} tag`}
                                accessibilityState={{ selected: on }}
                                style={[styles.chip, on && styles.chipOn]}
                                onPress={() => toggleTag(tag)}
                              >
                                <Text style={[styles.chipText, on && styles.chipTextOn]}>{tag}</Text>
                              </Pressable>
                            );
                          })}
                        </View>
                      </>
                    )}
                    <Pressable
                      accessibilityLabel="Save review"
                      accessibilityState={{ disabled: draftRating === 0 }}
                      style={[styles.saveButton, draftRating === 0 && styles.saveButtonDisabled]}
                      onPress={submitReview}
                    >
                      <Text style={styles.saveButtonText}>Save review</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </ScrollView>
          )}
          {place && onMarkBeen && (
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="I went"
                style={[styles.actionButton, styles.iWent]}
                onPress={() => onMarkBeen(place.id)}
              >
                <Text style={[styles.actionText, styles.iWentText]}>I went</Text>
              </Pressable>
            </View>
          )}
          {place && (
            <View style={styles.actions}>
              <Pressable
                accessibilityLabel="Open in Maps"
                style={[styles.actionButton, styles.directions]}
                onPress={() => Linking.openURL(buildMapUrl(place))}
              >
                <Text style={[styles.actionText, styles.directionsText]}>Open in Maps</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Write a Google review"
                style={[styles.actionButton, styles.googleReview]}
                onPress={() => Linking.openURL(buildWriteReviewUrl(place))}
              >
                <Text style={styles.actionText}>Google review</Text>
              </Pressable>
            </View>
          )}
          <Pressable accessibilityLabel="Close place detail" style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
        </View>
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
    maxHeight: '88%',
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    overflow: 'hidden',
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
  star: {
    fontSize: 34,
    color: colors.tertiaryLabel,
  },
  starOn: {
    color: colors.star,
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
  actionButton: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
  },
  directions: {
    backgroundColor: colors.label,
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
