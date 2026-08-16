import React, { useEffect, useMemo, useState } from 'react';
import { Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { rankTonight } from '../collection/tonight';
import type { Place, TasteVector } from '../taste-engine';
import { whySurfaced } from '../taste-engine';
import { radius, shadow, spacing, type Palette, type TypeRamp } from '../theme';
import { useTheme } from '../ThemeProvider';
import { buildMapUrl } from './googleMapsLinks';

interface TonightSheetProps {
  visible: boolean;
  /** The user's Want list -- the pool the suggestion is drawn from. */
  wantPlaces: Place[];
  /** Taste vector, used to break distance ties and explain the pick. */
  vector: TasteVector;
  onClose: () => void;
}

/**
 * "Where should I go tonight?" -- collapses the Want list down to a single
 * actionable pick (nearest first, taste-broken), reusing the app's swipe
 * metaphor: "Not tonight" walks outward to the next spot, "Let's go" hands
 * off to directions. Not a random shuffle; it's a decision shortcut.
 */
export function TonightSheet({ visible, wantPlaces, vector, onClose }: TonightSheetProps) {
  const { colors, type } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const [index, setIndex] = useState(0);
  const ranked = rankTonight(wantPlaces, vector);

  // Start from the closest pick every time the sheet is reopened.
  useEffect(() => {
    if (visible) setIndex(0);
  }, [visible]);

  const pick = ranked[index];
  const reason = pick ? whySurfaced(vector, pick) : undefined;
  const isLast = index >= ranked.length - 1;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.grabber} />
          <Text style={styles.title}>Where to tonight?</Text>

          {!pick ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                {wantPlaces.length === 0
                  ? 'Swipe right on a few places first, then I can pick one for you.'
                  : "That's every Want spot for now. Swipe more to get fresh ideas."}
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Image source={{ uri: pick.photoUrl }} style={styles.photo} />
                <View style={styles.cardBody}>
                  <Text style={styles.name}>{pick.name}</Text>
                  <Text style={styles.meta}>
                    {pick.category} · {pick.priceBand} · {Math.round(pick.distanceMeters)}m away
                  </Text>
                  {reason && <Text style={styles.reason}>{reason}</Text>}
                </View>
              </View>

              <Pressable
                accessibilityLabel={`Let's go to ${pick.name}`}
                style={[styles.button, styles.go]}
                onPress={() => Linking.openURL(buildMapUrl(pick))}
              >
                <Text style={[styles.buttonText, styles.goText]}>Let&apos;s go</Text>
              </Pressable>
              <Pressable
                accessibilityLabel="Not tonight, suggest another"
                accessibilityState={{ disabled: isLast }}
                style={[styles.button, styles.next, isLast && styles.buttonDisabled]}
                onPress={() => !isLast && setIndex((i) => i + 1)}
              >
                <Text style={styles.buttonText}>
                  {isLast ? 'No more nearby' : 'Not tonight -- another'}
                </Text>
              </Pressable>
            </>
          )}

          <Pressable accessibilityLabel="Close tonight suggestion" style={styles.close} onPress={onClose}>
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
    backgroundColor: colors.background,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.separator,
    marginBottom: spacing.md,
  },
  title: {
    ...type.title2,
    marginBottom: spacing.lg,
  },
  empty: {
    paddingVertical: spacing.xxl,
  },
  emptyText: {
    ...type.body,
    color: colors.secondaryLabel,
    textAlign: 'center',
  },
  card: {
    borderRadius: radius.lg,
    backgroundColor: colors.background,
    overflow: 'hidden',
    marginBottom: spacing.lg,
    ...shadow.md,
  },
  photo: {
    width: '100%',
    height: 180,
    backgroundColor: colors.fill,
  },
  cardBody: {
    padding: spacing.lg,
  },
  name: {
    ...type.title3,
  },
  meta: {
    ...type.subheadline,
    marginTop: spacing.xs,
    color: colors.secondaryLabel,
  },
  reason: {
    ...type.footnote,
    marginTop: spacing.sm,
    color: colors.tint,
  },
  button: {
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  go: {
    backgroundColor: colors.tint,
  },
  next: {
    backgroundColor: colors.fill,
  },
  buttonDisabled: {
    opacity: 0.4,
  },
  buttonText: {
    ...type.headline,
    color: colors.label,
  },
  goText: {
    color: colors.labelOnColor,
  },
  close: {
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  closeText: {
    ...type.subheadline,
    color: colors.secondaryLabel,
  },
  });
}
