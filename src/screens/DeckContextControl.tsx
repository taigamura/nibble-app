import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Icon } from '../components/Icon';
import { SheetScrim, useDragToDismiss } from '../components/sheetGestures';
import { DECK_AREAS, RADIUS_OPTIONS_METERS } from '../config/areas';
import { haptics } from '../haptics';
import { spring, useReducedMotion } from '../motion';
import type { DeckContext, GeoPoint } from '../providers/types';
import { useTheme } from '../ThemeProvider';
import { type Palette, type TypeRamp } from '../theme';

interface DeckContextControlProps {
  visible: boolean;
  context: DeckContext;
  /** Label shown for the "use my current location" option. */
  currentLocationLabel?: string;
  /** The user's saved Home snapshot, or `null` when unset. Surfaces as a chip. */
  homePoint?: GeoPoint | null;
  /** Captures the device's current position as Home (may prompt for permission). */
  onSetHome?: () => void;
  /** Un-sets Home. */
  onClearHome?: () => void;
  onChange: (context: DeckContext) => void;
  onClose: () => void;
}

function formatRadius(meters: number): string {
  return meters >= 1000 ? `${meters / 1000}km` : `${meters}m`;
}

function pointsEqual(a: GeoPoint | undefined | null, b: GeoPoint | undefined | null): boolean {
  return !!a && !!b && a.lat === b.lat && a.lng === b.lng;
}

/**
 * A Pressable that press-scales with a subtle spring (respecting reduced
 * motion) around arbitrary children, without altering the caller's
 * accessibility props or press handler.
 */
interface PressScaleProps {
  onPress: () => void;
  style?: any;
  accessibilityLabel: string;
  accessibilityState?: Record<string, unknown>;
  reducedMotion: boolean;
  children: React.ReactNode;
}

function PressScale({ onPress, style, accessibilityLabel, accessibilityState, reducedMotion, children }: PressScaleProps) {
  const scale = useRef(new Animated.Value(1)).current;

  const handlePressIn = () => {
    if (reducedMotion) return;
    Animated.spring(scale, { ...spring.snappy, toValue: 0.96, useNativeDriver: true }).start();
  };

  const handlePressOut = () => {
    if (reducedMotion) return;
    Animated.spring(scale, { ...spring.bouncy, toValue: 1, useNativeDriver: true }).start();
  };

  return (
    <Pressable
      accessibilityLabel={accessibilityLabel}
      accessibilityState={accessibilityState}
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
    >
      <Animated.View style={[style, { transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
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
  homePoint,
  onSetHome,
  onClearHome,
  onChange,
  onClose,
}: DeckContextControlProps) {
  const { colors, type } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const reducedMotion = useReducedMotion();
  const { translateY, panHandlers, reset } = useDragToDismiss(onClose);

  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const homeSelected = pointsEqual(context.center, homePoint);
  const selectedAreaId =
    context.center && !homeSelected
      ? DECK_AREAS.find(
          (area) => area.center.lat === context.center!.lat && area.center.lng === context.center!.lng
        )?.id
      : undefined;

  const chooseRadius = (meters: number) => {
    haptics.selection();
    onChange({ ...context, radiusMeters: meters });
  };

  const chooseArea = (center: GeoPoint | undefined) => {
    haptics.selection();
    onChange({ ...context, center });
  };

  const handleSetHome = () => {
    haptics.impact('light');
    onSetHome?.();
  };

  const handleClearHome = () => {
    haptics.impact('light');
    onClearHome?.();
  };

  const handleDone = () => {
    haptics.impact('light');
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SheetScrim onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.grabberZone} {...panHandlers}>
            <View style={styles.grabber} />
          </View>
          <Text style={styles.title}>Deck area</Text>

          <Text style={styles.sectionLabel}>Radius</Text>
          <View style={styles.row}>
            {RADIUS_OPTIONS_METERS.map((meters) => (
              <PressScale
                key={meters}
                accessibilityLabel={`Radius ${formatRadius(meters)}`}
                accessibilityState={{ selected: context.radiusMeters === meters }}
                style={[styles.chip, context.radiusMeters === meters && styles.chipActive]}
                reducedMotion={reducedMotion}
                onPress={() => chooseRadius(meters)}
              >
                <Text style={[styles.chipText, context.radiusMeters === meters && styles.chipTextActive]}>
                  {formatRadius(meters)}
                </Text>
              </PressScale>
            ))}
          </View>

          <Text style={styles.sectionLabel}>Area</Text>
          <ScrollView>
            <PressScale
              accessibilityLabel={currentLocationLabel}
              accessibilityState={{ selected: !context.center }}
              style={[styles.chip, styles.areaRow, !context.center && styles.chipActive]}
              reducedMotion={reducedMotion}
              onPress={() => chooseArea(undefined)}
            >
              <Text style={[styles.chipText, !context.center && styles.chipTextActive]}>
                {currentLocationLabel}
              </Text>
            </PressScale>
            {homePoint && (
              <PressScale
                accessibilityLabel="Home"
                accessibilityState={{ selected: homeSelected }}
                style={[styles.chip, styles.areaRow, styles.homeChip, homeSelected && styles.chipActive]}
                reducedMotion={reducedMotion}
                onPress={() => chooseArea(homePoint)}
              >
                <Icon
                  name="location"
                  size={14}
                  color={homeSelected ? colors.labelOnColor : colors.label}
                  style={styles.homeIcon}
                />
                <Text style={[styles.chipText, homeSelected && styles.chipTextActive]}>Home</Text>
              </PressScale>
            )}
            {DECK_AREAS.map((area) => (
              <PressScale
                key={area.id}
                accessibilityLabel={area.name}
                accessibilityState={{ selected: selectedAreaId === area.id }}
                style={[styles.chip, styles.areaRow, selectedAreaId === area.id && styles.chipActive]}
                reducedMotion={reducedMotion}
                onPress={() => chooseArea(area.center)}
              >
                <Text style={[styles.chipText, selectedAreaId === area.id && styles.chipTextActive]}>
                  {area.name}
                </Text>
              </PressScale>
            ))}
          </ScrollView>

          {onSetHome && (
            <View style={styles.homeActions}>
              <PressScale
                accessibilityLabel={homePoint ? 'Update Home to current location' : 'Set current location as Home'}
                style={styles.homeAction}
                reducedMotion={reducedMotion}
                onPress={handleSetHome}
              >
                <Text style={styles.homeActionText}>
                  {homePoint ? 'Update Home to current location' : 'Set current location as Home'}
                </Text>
              </PressScale>
              {homePoint && onClearHome && (
                <PressScale
                  accessibilityLabel="Clear Home"
                  style={styles.homeAction}
                  reducedMotion={reducedMotion}
                  onPress={handleClearHome}
                >
                  <Text style={styles.homeActionClear}>Clear Home</Text>
                </PressScale>
              )}
            </View>
          )}

          <PressScale accessibilityLabel="Done" style={styles.done} reducedMotion={reducedMotion} onPress={handleDone}>
            <Text style={styles.doneText}>Done</Text>
          </PressScale>
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
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingHorizontal: 24,
      paddingBottom: 24,
      paddingTop: 8,
      maxHeight: '70%',
    },
    grabberZone: {
      alignItems: 'center',
      paddingTop: 4,
      paddingBottom: 12,
    },
    grabber: {
      width: 36,
      height: 5,
      borderRadius: 999,
      backgroundColor: colors.separator,
    },
    title: {
      ...type.title2,
    },
    sectionLabel: {
      ...type.footnote,
      fontWeight: '600',
      marginTop: 16,
      marginBottom: 8,
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
    homeChip: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    homeIcon: {
      marginRight: 6,
    },
    chipActive: {
      borderColor: colors.tint,
      backgroundColor: colors.tint,
    },
    chipText: {
      ...type.subheadline,
      fontWeight: '600',
      color: colors.label,
    },
    chipTextActive: {
      color: colors.labelOnColor,
    },
    homeActions: {
      marginTop: 12,
      borderTopWidth: StyleSheet.hairlineWidth,
      borderTopColor: colors.separator,
      paddingTop: 12,
      gap: 4,
    },
    homeAction: {
      paddingVertical: 8,
    },
    homeActionText: {
      ...type.subheadline,
      color: colors.tint,
    },
    homeActionClear: {
      ...type.subheadline,
      color: colors.nope,
    },
    done: {
      marginTop: 16,
      paddingVertical: 14,
      alignItems: 'center',
      backgroundColor: colors.fill,
      borderRadius: 10,
    },
    doneText: {
      ...type.headline,
      color: colors.label,
    },
  });
}
