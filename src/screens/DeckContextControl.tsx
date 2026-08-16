import React, { useMemo } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { DECK_AREAS, RADIUS_OPTIONS_METERS } from '../config/areas';
import type { DeckContext } from '../providers/types';
import { useTheme } from '../ThemeProvider';
import { type Palette, type TypeRamp } from '../theme';

interface DeckContextControlProps {
  visible: boolean;
  context: DeckContext;
  /** Label shown for the "use my current location" option. */
  currentLocationLabel?: string;
  onChange: (context: DeckContext) => void;
  onClose: () => void;
}

function formatRadius(meters: number): string {
  return meters >= 1000 ? `${meters / 1000}km` : `${meters}m`;
}

/**
 * Lets the user widen/narrow the deck radius and re-center it on a different
 * east-Tokyo area (issue #10). Only ever changes the `DeckContext` passed
 * back up to `SwipeScreen` -- it never touches the taste graph, so switching
 * area/radius can't corrupt learned taste.
 */
export function DeckContextControl({
  visible,
  context,
  currentLocationLabel = 'Current location',
  onChange,
  onClose,
}: DeckContextControlProps) {
  const { colors, type } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const selectedAreaId = context.center
    ? DECK_AREAS.find(
        (area) => area.center.lat === context.center!.lat && area.center.lng === context.center!.lng
      )?.id
    : undefined;

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Deck area</Text>

          <Text style={styles.sectionLabel}>Radius</Text>
          <View style={styles.row}>
            {RADIUS_OPTIONS_METERS.map((meters) => (
              <Pressable
                key={meters}
                accessibilityLabel={`Radius ${formatRadius(meters)}`}
                accessibilityState={{ selected: context.radiusMeters === meters }}
                style={[styles.chip, context.radiusMeters === meters && styles.chipActive]}
                onPress={() => onChange({ ...context, radiusMeters: meters })}
              >
                <Text style={[styles.chipText, context.radiusMeters === meters && styles.chipTextActive]}>
                  {formatRadius(meters)}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Area</Text>
          <ScrollView>
            <Pressable
              accessibilityLabel={currentLocationLabel}
              accessibilityState={{ selected: !context.center }}
              style={[styles.chip, styles.areaRow, !context.center && styles.chipActive]}
              onPress={() => onChange({ ...context, center: undefined })}
            >
              <Text style={[styles.chipText, !context.center && styles.chipTextActive]}>
                {currentLocationLabel}
              </Text>
            </Pressable>
            {DECK_AREAS.map((area) => (
              <Pressable
                key={area.id}
                accessibilityLabel={area.name}
                accessibilityState={{ selected: selectedAreaId === area.id }}
                style={[styles.chip, styles.areaRow, selectedAreaId === area.id && styles.chipActive]}
                onPress={() => onChange({ ...context, center: area.center })}
              >
                <Text style={[styles.chipText, selectedAreaId === area.id && styles.chipTextActive]}>
                  {area.name}
                </Text>
              </Pressable>
            ))}
          </ScrollView>

          <Pressable accessibilityLabel="Done" style={styles.done} onPress={onClose}>
            <Text style={styles.doneText}>Done</Text>
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
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 24,
      maxHeight: '70%',
    },
    title: {
      fontSize: 20,
      fontWeight: '700',
      color: colors.label,
    },
    sectionLabel: {
      marginTop: 16,
      marginBottom: 8,
      fontSize: 13,
      fontWeight: '600',
      color: colors.secondaryLabel,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    areaRow: {
      marginBottom: 8,
    },
    chip: {
      paddingVertical: 10,
      paddingHorizontal: 16,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: colors.separator,
      backgroundColor: colors.fill,
    },
    chipActive: {
      borderColor: colors.tint,
      backgroundColor: colors.tint,
    },
    chipText: {
      fontSize: 14,
      fontWeight: '600',
      color: colors.label,
    },
    chipTextActive: {
      color: colors.labelOnColor,
    },
    done: {
      marginTop: 16,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: colors.fill,
      borderRadius: 10,
    },
    doneText: {
      fontSize: 15,
      fontWeight: '700',
      color: colors.label,
    },
  });
}
