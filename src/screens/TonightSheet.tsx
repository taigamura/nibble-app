import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Image, Linking, Modal, Pressable, StyleSheet, Text, View } from 'react-native';

import { SheetScrim, useDragToDismiss } from '../components/sheetGestures';
import { rankTonight } from '../collection/tonight';
import { applyAnswer, nextQuestion, type DrillAxis } from '../collection/tonightDrilldown';
import { formatCategory } from '../format';
import { haptics } from '../haptics';
import { spring, useReducedMotion } from '../motion';
import type { Place, TasteVector } from '../taste-engine';
import { seededShuffle, whySurfaced } from '../taste-engine';
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
  /** Injected seed for the 🎲 randomizer. Defaults to a per-session value. */
  seed?: number;
}

const AXIS_QUESTION: Record<DrillAxis, string> = {
  cuisine: 'What do you want to eat?',
  price: 'What price range?',
  vibe: 'What kind of vibe?',
};

/** One answered drill step; `value: null` means the user picked "Any". */
interface Answer {
  axis: DrillAxis;
  value: string | null;
}

/**
 * "Where should I go tonight?" -- an adaptive drill-down over the Want list.
 * Walks cuisine -> price -> vibe, asking only about axes the remaining pool
 * can still be split on, and stops as soon as it's down to a handful (or the
 * ladder runs out) to hand off to the same nearest-first result card as
 * before. A 🎲 shortcut is available at any step for a uniformly random pick
 * from whatever remains, seeded so "another" re-rolls deterministically.
 * Never mutates the taste graph -- it only ever reads `wantPlaces`/`vector`.
 */
/** A Pressable that springs to a slight scale-down while held, for tactile feedback. */
function PressScale({
  children,
  style,
  reducedMotion,
  onPress,
  ...rest
}: React.ComponentProps<typeof Pressable> & { reducedMotion: boolean }) {
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
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable {...rest} style={style} onPress={onPress} onPressIn={pressIn} onPressOut={pressOut}>
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function TonightSheet({ visible, wantPlaces, vector, onClose, seed }: TonightSheetProps) {
  const { colors, type } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const reducedMotion = useReducedMotion();
  const sessionSeed = useRef(seed ?? Date.now()).current;
  const { translateY, panHandlers, reset } = useDragToDismiss(onClose);

  // Snap back to rest each time the sheet reopens, so a prior drag-close never
  // leaves the next open translated off-screen.
  useEffect(() => {
    if (visible) reset();
  }, [visible, reset]);

  const [mode, setMode] = useState<'drill' | 'result' | 'random'>('drill');
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [resultIndex, setResultIndex] = useState(0);
  const [rerollCount, setRerollCount] = useState(0);

  // Reset the whole drill every time the sheet is reopened.
  useEffect(() => {
    if (visible) {
      setMode('drill');
      setAnswers([]);
      setResultIndex(0);
      setRerollCount(0);
    }
  }, [visible]);

  // `remaining` is fully derived from wantPlaces + the answers applied so
  // far, so Back (popping an answer) recomputes it for free.
  const remaining = useMemo(() => {
    let pool = wantPlaces;
    for (const answer of answers) {
      if (answer.value !== null) {
        pool = applyAnswer(pool, answer.axis, answer.value);
      }
    }
    return pool;
  }, [wantPlaces, answers]);

  const askedAxes = answers.map((a) => a.axis);
  const question = mode === 'drill' ? nextQuestion(remaining, askedAxes) : null;

  // Drill exhausted (or STOP_AT reached) -- move to the result view.
  useEffect(() => {
    if (mode === 'drill' && !question) {
      setMode('result');
    }
  }, [mode, question]);

  const ranked = useMemo(() => rankTonight(remaining, vector), [remaining, vector]);
  const drillPick = ranked[resultIndex];

  const randomPool = mode === 'random' ? remaining : [];
  const randomPick =
    mode === 'random' && randomPool.length > 0
      ? seededShuffle(randomPool, sessionSeed + rerollCount)[0]
      : undefined;

  const pick = mode === 'random' ? randomPick : drillPick;
  const reason = pick ? whySurfaced(vector, pick) : undefined;
  const isLast = mode === 'random' ? remaining.length <= 1 : resultIndex >= ranked.length - 1;

  const handleAnswer = (axis: DrillAxis, value: string | null) => {
    haptics.selection();
    setAnswers((prev) => [...prev, { axis, value }]);
  };

  const handleBack = () => {
    haptics.selection();
    setAnswers((prev) => prev.slice(0, -1));
    setMode('drill');
  };

  const handleStartOver = () => {
    haptics.selection();
    setMode('drill');
    setAnswers([]);
    setResultIndex(0);
    setRerollCount(0);
  };

  const handleRandomPick = () => {
    setMode('random');
    setRerollCount(0);
  };

  const handleAnother = () => {
    haptics.selection();
    if (mode === 'random') {
      setRerollCount((n) => n + 1);
    } else {
      setResultIndex((i) => i + 1);
    }
  };

  const handleGo = () => {
    haptics.success();
    void Linking.openURL(buildMapUrl(pick!));
  };

  const canGoBack = mode !== 'random' && answers.length > 0;
  const showRandomizer = mode === 'drill';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <SheetScrim onPress={onClose} />
        <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
          <View style={styles.grabberZone} {...panHandlers}>
            <View style={styles.grabber} />
          </View>
          <View style={styles.header}>
            <Text style={styles.title}>Where to?</Text>
            {showRandomizer && (
              <Pressable accessibilityLabel="Just pick for me" onPress={handleRandomPick}>
                <Text style={styles.randomLink}>just pick for me 🎲</Text>
              </Pressable>
            )}
          </View>

          {wantPlaces.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                Swipe right on a few places first, then I can pick one for you.
              </Text>
            </View>
          ) : mode === 'drill' && question ? (
            <>
              <Text style={styles.question}>{AXIS_QUESTION[question.axis]}</Text>
              <View style={styles.chipRow}>
                {question.options.map((value) => {
                  // Cuisine options are raw category slugs (e.g. `coffee_shop`);
                  // humanize the label but keep the slug as the answer value so
                  // `applyAnswer`'s exact-match filter still works.
                  const label = question.axis === 'cuisine' ? formatCategory(value) : value;
                  return (
                    <PressScale
                      key={value}
                      accessibilityLabel={`Choose ${label}`}
                      style={styles.chip}
                      reducedMotion={reducedMotion}
                      onPress={() => handleAnswer(question.axis, value)}
                    >
                      <Text style={styles.chipText}>{label}</Text>
                    </PressScale>
                  );
                })}
                <PressScale
                  accessibilityLabel="No preference"
                  style={[styles.chip, styles.chipAny]}
                  reducedMotion={reducedMotion}
                  onPress={() => handleAnswer(question.axis, null)}
                >
                  <Text style={styles.chipText}>Any</Text>
                </PressScale>
              </View>

              {canGoBack && (
                <Pressable accessibilityLabel="Back" style={styles.textButton} onPress={handleBack}>
                  <Text style={styles.textButtonText}>Back</Text>
                </Pressable>
              )}
            </>
          ) : !pick ? (
            <View style={styles.empty}>
              <Text style={styles.emptyText}>
                That&apos;s every Want spot for now. Swipe more to get fresh ideas.
              </Text>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <Image source={{ uri: pick.photoUrl }} style={styles.photo} />
                <View style={styles.cardBody}>
                  <Text style={styles.name}>{pick.name}</Text>
                  <Text style={styles.meta}>
                    {formatCategory(pick.category)} · {pick.priceBand} · {Math.round(pick.distanceMeters)}m away
                  </Text>
                  {reason && <Text style={styles.reason}>{reason}</Text>}
                </View>
              </View>

              <PressScale
                accessibilityLabel={`Let's go to ${pick.name}`}
                style={[styles.button, styles.go]}
                reducedMotion={reducedMotion}
                onPress={handleGo}
              >
                <Text style={[styles.buttonText, styles.goText]}>Let&apos;s go</Text>
              </PressScale>
              <PressScale
                accessibilityLabel="Suggest another"
                accessibilityState={{ disabled: isLast }}
                style={[styles.button, styles.next, isLast && styles.buttonDisabled]}
                reducedMotion={reducedMotion}
                onPress={() => !isLast && handleAnother()}
              >
                <Text style={styles.buttonText}>
                  {isLast ? 'No more nearby' : 'Show another'}
                </Text>
              </PressScale>

              <View style={styles.footerRow}>
                {canGoBack && (
                  <Pressable accessibilityLabel="Back" style={styles.textButton} onPress={handleBack}>
                    <Text style={styles.textButtonText}>Back</Text>
                  </Pressable>
                )}
                {(answers.length > 0 || mode === 'random') && (
                  <Pressable accessibilityLabel="Start over" style={styles.textButton} onPress={handleStartOver}>
                    <Text style={styles.textButtonText}>Start over</Text>
                  </Pressable>
                )}
              </View>
            </>
          )}

          <Pressable accessibilityLabel="Close tonight suggestion" style={styles.close} onPress={onClose}>
            <Text style={styles.closeText}>Close</Text>
          </Pressable>
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
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    paddingTop: spacing.sm,
  },
  // Taller than the pill itself so there's a comfortable area to start the
  // pull-down drag (mirrors PlaceDetailModal's grabberZone).
  grabberZone: {
    alignItems: 'center',
    paddingTop: spacing.xs,
    paddingBottom: spacing.md,
  },
  grabber: {
    width: 36,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.separator,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.lg,
  },
  title: {
    ...type.title2,
  },
  randomLink: {
    ...type.footnote,
    color: colors.tint,
  },
  question: {
    ...type.headline,
    marginBottom: spacing.md,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  chip: {
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.separator,
    backgroundColor: colors.fill,
  },
  chipAny: {
    borderColor: colors.tint,
  },
  chipText: {
    ...type.subheadline,
    color: colors.label,
  },
  textButton: {
    paddingVertical: spacing.sm,
    alignItems: 'center',
  },
  footerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.lg,
  },
  textButtonText: {
    ...type.subheadline,
    color: colors.secondaryLabel,
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
