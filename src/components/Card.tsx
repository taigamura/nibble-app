import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Extrapolation,
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import type { Place, SwipeAction } from '../taste-engine';
import { radius, shadow, spacing, type Palette, type TypeRamp } from '../theme';
import { useTheme } from '../ThemeProvider';
import { formatCategory } from '../format';
import { spring, REDUCED_MOTION_DURATION, useReducedMotion } from '../motion';
import { haptics } from '../haptics';
import { Icon } from './Icon';

const SWIPE_THRESHOLD = 120;
const OFF_SCREEN_DISTANCE = 600;
/** Minimum finger travel (px) before the pan claims the gesture, so a tap on the
 * gallery zones or action bar still registers as a tap, not a drag. */
const PAN_ACTIVATE_DISTANCE = 5;
/** A deliberate flick can commit from under the threshold, but only above this
 * throw speed (px/s ~= 500) so a slow or small drag just springs back. */
const FLICK_MIN_PX_PER_SEC = 500;
/** Max opacity of the directional edge-tint: a hint, never a fill. */
const TINT_MAX = 0.45;

/** Animated LinearGradient so the wash's opacity can be driven by the drag on
 * the UI thread. */
const AnimatedGradient = Animated.createAnimatedComponent(LinearGradient);

/** A fully-transparent variant of a `#RRGGBB` token (appends a `00` alpha byte),
 * so the gradient fades to the same hue at zero alpha rather than bleeding
 * through black — which a `color → 'transparent'` stop does on some platforms. */
function fadeOut(hex: string): string {
  return `${hex}00`;
}

/** Projects where a flick "wants to end up" beyond the finger-release point,
 * given its release velocity (px/s) and an exponential decay constant.
 * Standard momentum-projection formula: integral of v * decel^t dt. */
function project(v_pxPerSec: number, decel = 0.998): number {
  return ((v_pxPerSec / 1000) * decel) / (1 - decel);
}

/** Ordered gallery for a place: the explicit list when present, else the lone
 * hero. Blank/duplicate entries are dropped so the indicator segment count
 * always matches what the user can actually page to. */
function galleryFor(place: Place): string[] {
  const urls = place.photoUrls?.length ? place.photoUrls : [place.photoUrl];
  const seen = new Set<string>();
  const cleaned = urls.filter((url) => url && !seen.has(url) && (seen.add(url), true));
  return cleaned.length > 0 ? cleaned : [place.photoUrl];
}

interface CardProps {
  place: Place;
  onSwiped: (action: SwipeAction) => void;
  /** Opens the place-detail screen for this card. Omitted for the non-interactive card behind it. */
  onInfoPress?: (place: Place) => void;
  /**
   * The taste-engine explanation for why this place surfaced (from
   * `whySurfaced`). Rendered as the "why" pill above the name; omit/undefined
   * to render nothing. Computed at the SwipeScreen call site so `Card` stays
   * free of engine imports.
   */
  reason?: string;
}

function directionFor(dx: number, dy: number): SwipeAction | null {
  'worklet';
  if (dy < -SWIPE_THRESHOLD && Math.abs(dy) > Math.abs(dx)) return 'been';
  if (dx > SWIPE_THRESHOLD) return 'want';
  if (dx < -SWIPE_THRESHOLD) return 'nope';
  return null;
}

function targetFor(action: SwipeAction): { x: number; y: number } {
  switch (action) {
    case 'want':
      return { x: OFF_SCREEN_DISTANCE, y: 0 };
    case 'nope':
      return { x: -OFF_SCREEN_DISTANCE, y: 0 };
    case 'been':
      return { x: 0, y: -OFF_SCREEN_DISTANCE };
  }
}

export function Card({ place, onSwiped, onInfoPress, reason }: CardProps) {
  const { colors, type } = useTheme();
  const styles = useMemo(() => makeStyles(colors, type), [colors, type]);
  const reducedMotion = useReducedMotion();
  // Only the interactive (top) card breathes in on mount; the non-interactive
  // card behind it renders static (no entrance animation).
  const isInteractive = onInfoPress != null;

  // Drag translation, driven on the UI thread by the pan gesture below.
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  // 0 → 1 entrance progress; starts settled for the non-interactive back card.
  const entrance = useSharedValue(isInteractive && !reducedMotion ? 0 : 1);
  // Last swipe direction the drag has crossed into, so the selection haptic
  // fires once per threshold crossing (in the gesture worklet), not every frame.
  const lastCrossed = useSharedValue<SwipeAction | null>(null);
  // Guards the fly-out completion so `onSwiped` fires exactly once even though
  // both axis springs report completion.
  const fired = useSharedValue(false);

  useEffect(() => {
    if (!isInteractive || reducedMotion) return;
    entrance.value = withSpring(1, spring.standard);
    // Entrance plays once, at mount, for the card that starts interactive.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Multi-photo gallery: one image is shown at a time (never crammed), and the
  // user taps the left/right of the photo to page through. Only the top
  // (interactive) card pages; the card behind stays on its hero frame.
  const photos = galleryFor(place);
  const [photoIndex, setPhotoIndex] = useState(0);
  const showGallery = onInfoPress != null && photos.length > 1;
  // A drag over the photo must never page the gallery. The pan gesture activates
  // only after PAN_ACTIVATE_DISTANCE of travel and cancels any in-flight child
  // press, so a genuine tap pages but a swipe drags the card without paging.
  const step = (delta: number) => {
    setPhotoIndex((current) => (current + delta + photos.length) % photos.length);
  };

  // Warm the adjacent frames so paging doesn't flash a blank while the next
  // photo downloads. Cheap and idempotent -- Image.prefetch dedupes by URL.
  useEffect(() => {
    if (!showGallery) return;
    const warm = (uri: string) => {
      try {
        Image.prefetch?.(uri)?.catch?.(() => {});
      } catch {
        // Image.prefetch is a no-op on some platforms/test envs; ignore.
      }
    };
    warm(photos[(photoIndex + 1) % photos.length]);
    warm(photos[(photoIndex - 1 + photos.length) % photos.length]);
  }, [photoIndex, showGallery, photos]);

  // Route the swipe commit through a ref reassigned every render — instead of
  // capturing the `onSwiped` prop in the (stable) gesture — so a drag-released
  // swipe always fires the *current* handler (and thus the current taste
  // graph), not a stale one from mount, even if this Card instance outlives a
  // parent re-render (e.g. an Undo elsewhere in the deck).
  const onSwipedRef = useRef(onSwiped);
  onSwipedRef.current = onSwiped;

  const fireSelectionHaptic = () => haptics.selection();

  const flyOut = (action: SwipeAction, vx = 0, vy = 0) => {
    haptics.impact('medium');
    const target = targetFor(action);
    const commit = () => onSwipedRef.current(action);
    fired.value = false;

    if (reducedMotion) {
      translateX.value = withTiming(target.x, { duration: REDUCED_MOTION_DURATION });
      translateY.value = withTiming(target.y, { duration: REDUCED_MOTION_DURATION }, (finished) => {
        if (finished && !fired.value) {
          fired.value = true;
          runOnJS(commit)();
        }
      });
      return;
    }

    // Two independent 1D springs (not one 2D spring) so each axis settles on its
    // own timeline -- a single spring desyncs when dx and dy start far apart,
    // which reads as the card "curving" unnaturally. `onSwiped` fires on the
    // first axis to finish (guarded by `fired`).
    const onAxisDone = (finished?: boolean) => {
      'worklet';
      if (finished && !fired.value) {
        fired.value = true;
        runOnJS(commit)();
      }
    };
    // gesture-handler reports velocity in px/s, which withSpring's `velocity`
    // config wants directly.
    translateX.value = withSpring(target.x, { ...spring.bouncy, velocity: vx }, onAxisDone);
    translateY.value = withSpring(target.y, { ...spring.bouncy, velocity: vy }, onAxisDone);
  };

  // Decides, on release, whether the drag commits (fly-out) or springs back.
  // Runs on the JS thread (via runOnJS from the gesture) so it can reach the
  // current `onSwiped` through `flyOut`. dx/dy in px, vx/vy in px/s.
  const handleRelease = (dx: number, dy: number, vx: number, vy: number) => {
    // Primary: commit when the finger let go past the position threshold.
    let action = directionFor(dx, dy);
    // Secondary: a *deliberate* flick can commit from under the threshold. Gate
    // it on a real throw speed so a slow or small drag just springs back -- the
    // momentum projection alone is far too eager (it clears the threshold at
    // modest speeds), so the speed gate is what keeps the deck calm.
    if (!action) {
      const fastX = Math.abs(vx) > FLICK_MIN_PX_PER_SEC;
      const fastY = Math.abs(vy) > FLICK_MIN_PX_PER_SEC;
      if (fastX || fastY) {
        const projectedX = dx + (fastX ? project(vx) : 0);
        const projectedY = dy + (fastY ? project(vy) : 0);
        action = directionFor(projectedX, projectedY);
      }
    }
    if (action) {
      flyOut(action, vx, vy);
    } else {
      translateX.value = withSpring(0, spring.standard);
      translateY.value = withSpring(0, spring.standard);
    }
  };

  // The pan gesture runs on the UI thread: `onUpdate` follows the finger and
  // fires the crossing haptic; `onEnd` hands the release off to `handleRelease`.
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .enabled(isInteractive)
        .minDistance(PAN_ACTIVATE_DISTANCE)
        .onUpdate((e) => {
          'worklet';
          translateX.value = e.translationX;
          translateY.value = e.translationY;
          const crossed = directionFor(e.translationX, e.translationY);
          if (crossed && crossed !== lastCrossed.value) {
            runOnJS(fireSelectionHaptic)();
          }
          lastCrossed.value = crossed;
        })
        .onEnd((e) => {
          'worklet';
          lastCrossed.value = null;
          runOnJS(handleRelease)(e.translationX, e.translationY, e.velocityX, e.velocityY);
        }),
    // Handlers close over stable shared values/refs; rebuild only if
    // interactivity flips.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isInteractive],
  );

  // Softened from ±15° — the strong tilt read as a Tinder card-throw. ±6° is
  // enough to acknowledge the drag as physical without theatrics. Reduced motion
  // skips the tilt. Entrance nudges the card up + scales it in (interactive only).
  const cardAnimatedStyle = useAnimatedStyle(() => {
    const rotate = reducedMotion
      ? 0
      : interpolate(
          translateX.value,
          [-OFF_SCREEN_DISTANCE, 0, OFF_SCREEN_DISTANCE],
          [-6, 0, 6],
          Extrapolation.CLAMP,
        );
    const entranceTranslateY = isInteractive ? interpolate(entrance.value, [0, 1], [6, 0]) : 0;
    const entranceScale = isInteractive ? interpolate(entrance.value, [0, 1], [0.96, 1]) : 1;
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value + entranceTranslateY },
        { scale: entranceScale },
        { rotate: `${rotate}deg` },
      ],
    };
  });

  // Directional edge-tint: a soft color wash bleeds in from the leading edge as
  // the drag crosses toward its threshold — Apple's "hint in the direction of
  // the gesture", not a verdict stamp. Each wash is a LinearGradient opaque at
  // the leading edge and fading to zero toward center. Opacity ramps 0 → TINT_MAX
  // clamped across 0 → threshold so it stays a hint, never a fill.
  // want = drag right (blue), nope = drag left (red), been = drag up (green).
  const wantTintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [0, SWIPE_THRESHOLD], [0, TINT_MAX], Extrapolation.CLAMP),
  }));
  const nopeTintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateX.value, [-SWIPE_THRESHOLD, 0], [TINT_MAX, 0], Extrapolation.CLAMP),
  }));
  const beenTintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(translateY.value, [-SWIPE_THRESHOLD, 0], [TINT_MAX, 0], Extrapolation.CLAMP),
  }));

  return (
    <GestureDetector gesture={panGesture}>
      {/* Outer layer casts the shadow only: opaque, rounded, NOT clipped, so
          iOS renders a cheap transform-stable shadow instead of recomputing it
          from the clipped alpha mask every frame (the old swipe-lag cause). The
          inner `cardClip` does the `overflow: hidden` rounding of the content. */}
      <Animated.View testID={`card-${place.id}`} style={[styles.card, cardAnimatedStyle]}>
        <View style={styles.cardClip}>
        <Image source={{ uri: photos[photoIndex] }} style={styles.photo} />
      {showGallery && (
        <>
          {/* Instagram-style segmented indicator: one segment per photo, the
              current one brightened. Non-interactive; paging happens via the
              tap zones below. */}
          <View
            testID={`photo-indicator-${place.id}`}
            style={[styles.indicator, { pointerEvents: 'none' }]}
          >
            {photos.map((url, i) => (
              <View
                key={url}
                style={[styles.indicatorSegment, i === photoIndex && styles.indicatorSegmentActive]}
              />
            ))}
          </View>
          {/* Tap the left third to go back, the right third to advance. The
              center is left inert so a mis-tap while reading doesn't page. */}
          <Pressable
            testID={`photo-prev-${place.id}`}
            accessibilityLabel="Previous photo"
            style={[styles.tapZone, styles.tapZonePrev]}
            onPress={() => step(-1)}
          />
          <Pressable
            testID={`photo-next-${place.id}`}
            accessibilityLabel="Next photo"
            style={[styles.tapZone, styles.tapZoneNext]}
            onPress={() => step(1)}
          />
        </>
      )}
      {onInfoPress && (
        <>
          {/* want = drag right → blue gradient bleeding in from the right edge. */}
          <AnimatedGradient
            testID={`tint-want-${place.id}`}
            colors={[colors.tint, fadeOut(colors.tint)]}
            start={{ x: 1, y: 0.5 }}
            end={{ x: 0, y: 0.5 }}
            style={[styles.tint, styles.tintHorizontal, { pointerEvents: 'none' }, wantTintStyle]}
          />
          {/* nope = drag left → red gradient bleeding in from the left edge. */}
          <AnimatedGradient
            testID={`tint-nope-${place.id}`}
            colors={[colors.nope, fadeOut(colors.nope)]}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            style={[styles.tint, styles.tintHorizontal, { pointerEvents: 'none' }, nopeTintStyle]}
          />
          {/* been = drag up → green gradient bleeding in from the top edge. */}
          <AnimatedGradient
            testID={`tint-been-${place.id}`}
            colors={[colors.been, fadeOut(colors.been)]}
            start={{ x: 0.5, y: 0 }}
            end={{ x: 0.5, y: 1 }}
            style={[styles.tint, styles.tintBeen, { pointerEvents: 'none' }, beenTintStyle]}
          />
        </>
      )}
      {onInfoPress && (
        <Pressable
          accessibilityLabel={`View details for ${place.name}`}
          style={styles.infoButton}
          onPress={() => onInfoPress(place)}
        >
          <Icon name="info" size={20} color={colors.labelOnColor} />
        </Pressable>
      )}
      <View style={styles.info}>
        {reason && (
          <View style={styles.reasonPill}>
            <Icon name="star" size={11} color={colors.star} />
            <Text style={styles.reasonText} numberOfLines={1}>
              {reason}
            </Text>
          </View>
        )}
        <Text style={styles.name}>{place.name}</Text>
        <Text style={styles.meta}>
          {formatCategory(place.category)} · {place.priceBand} · ★{place.rating.toFixed(1)} ·{' '}
          {Math.round(place.distanceMeters)}m
        </Text>
      </View>
      {onInfoPress && (
        // Docked translucent segmented action bar over the bottom of the photo.
        // Each segment fires the card's own `flyOut` directly, so the fly-off
        // and `onSwiped` commit are identical to a drag-released swipe. The
        // PanResponder only claims the gesture after >5px of movement, so a tap
        // here is never stolen by the drag.
        <View style={styles.actionBar}>
          <ActionSegment
            testID={`action-nope-${place.id}`}
            icon="nope"
            label="Not for me"
            hint="Swipe left"
            styles={styles}
            colors={colors}
            onPress={() => flyOut('nope')}
          />
          <ActionSegment
            testID={`action-been-${place.id}`}
            icon="been"
            label="Been"
            hint="Swipe up"
            styles={styles}
            colors={colors}
            onPress={() => flyOut('been')}
          />
          <ActionSegment
            testID={`action-want-${place.id}`}
            icon="collection-active"
            label="Save"
            hint="Swipe right"
            primary
            styles={styles}
            colors={colors}
            onPress={() => flyOut('want')}
          />
        </View>
      )}
        </View>
      </Animated.View>
    </GestureDetector>
  );
}
Card.displayName = 'Card';

interface ActionSegmentProps {
  testID: string;
  icon: React.ComponentProps<typeof Icon>['name'];
  label: string;
  hint: string;
  primary?: boolean;
  styles: ReturnType<typeof makeStyles>;
  colors: Palette;
  onPress: () => void;
}

/** One segment of the docked action bar. Save is the single accented control
 * (solid white pill, dark glyph); the other two are quiet neutrals. Press-down
 * feedback is instant per HIG. */
function ActionSegment({
  testID,
  icon,
  label,
  hint,
  primary,
  styles,
  colors,
  onPress,
}: ActionSegmentProps) {
  // Save's pill is solid white in both schemes, so its glyph/label must stay
  // dark regardless of theme (colors.label flips to white in dark mode). The
  // two neutral segments sit on the translucent material over the photo, so
  // they read white in both schemes.
  const glyphColor = primary ? '#1C1C1E' : colors.labelOnColor;
  return (
    <Pressable
      testID={testID}
      accessibilityLabel={label}
      accessibilityHint={hint}
      onPress={onPress}
      style={({ pressed }) => [
        styles.segment,
        primary && styles.segmentPrimary,
        pressed && styles.segmentPressed,
      ]}
    >
      <Icon name={icon} size={18} color={glyphColor} />
      <Text style={[styles.segmentLabel, { color: glyphColor }]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

function makeStyles(colors: Palette, type: TypeRamp) {
  return StyleSheet.create({
  card: {
    // Inset from the deck edges so the card is a contained object rather than a
    // full-bleed panel: a smaller top gap under the header and a larger bottom
    // gap that clears the tab bar. Percentage insets scale with screen height.
    position: 'absolute',
    top: '3%',
    bottom: '9%',
    left: '5%',
    right: '5%',
    borderRadius: radius.xl,
    backgroundColor: colors.background,
    ...shadow.lg,
    // NB: no `overflow: 'hidden'` here on purpose. Clipping happens on the
    // inner `cardClip`; keeping this layer unclipped lets iOS cast the shadow
    // from its opaque rounded rect (cheap, stable under the drag transform)
    // rather than re-deriving it from an alpha mask every frame.
  },
  // Inner clip layer: rounds and clips the photo/overlays to the card's
  // corners. Fills the card so all the absolutely-positioned overlays keep the
  // same coordinates they had when they were direct children of the card.
  cardClip: {
    flex: 1,
    borderRadius: radius.xl,
    overflow: 'hidden',
  },
  photo: {
    width: '100%',
    height: '74%',
    backgroundColor: colors.fill,
  },
  indicator: {
    position: 'absolute',
    top: spacing.sm,
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    gap: spacing.xs,
  },
  indicatorSegment: {
    flex: 1,
    height: 3,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  indicatorSegmentActive: {
    backgroundColor: colors.labelOnColor,
  },
  // Invisible paging targets over the photo. The center third is intentionally
  // left uncovered so it stays available for the drag gesture and reads as
  // "not a button". Height matches the photo (78% of the card).
  tapZone: {
    position: 'absolute',
    top: 0,
    height: '74%',
    width: '33%',
  },
  tapZonePrev: {
    left: 0,
  },
  tapZoneNext: {
    right: 0,
  },
  // Directional edge-tint gradients over the photo. Each spans the full photo
  // area and fades from its leading edge toward center (the gradient axis is set
  // per-direction via start/end in the JSX), so there's no hard panel edge.
  // Colors + animated opacity are applied inline.
  tint: {
    position: 'absolute',
    top: 0,
  },
  // want/nope: full-width horizontal wash across the photo.
  tintHorizontal: {
    left: 0,
    right: 0,
    top: 0,
    height: '74%',
  },
  // been: top-anchored vertical wash.
  tintBeen: {
    left: 0,
    right: 0,
    top: 0,
    height: '40%',
  },
  infoButton: {
    position: 'absolute',
    top: spacing.md,
    right: spacing.md,
    width: 34,
    height: 34,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoButtonText: {
    color: colors.labelOnColor,
    fontSize: 18,
    fontWeight: '600',
  },
  info: {
    flex: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    justifyContent: 'center',
  },
  // Translucent "why" pill above the name, mirroring the Tonight spotlight's
  // reason line so the two flows share one language.
  reasonPill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: spacing.xs,
    paddingVertical: spacing.xs - 1,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(0,0,0,0.3)',
    marginBottom: spacing.sm,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(14px)' } : null),
  },
  reasonText: {
    ...type.caption1,
    color: colors.labelOnColor,
    fontWeight: '600',
    flexShrink: 1,
  },
  name: {
    ...type.title2,
  },
  meta: {
    ...type.subheadline,
    marginTop: spacing.xs,
    color: colors.secondaryLabel,
  },
  // Docked translucent segmented control over the bottom of the photo.
  actionBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    // Sits just above the info panel (photo is 74% of the card height).
    top: '74%',
    marginTop: -60,
    flexDirection: 'row',
    padding: spacing.xs - 1,
    gap: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: colors.material,
    ...(Platform.OS === 'web' ? { backdropFilter: 'blur(14px)' } : null),
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.xs,
    borderRadius: radius.pill,
  },
  // Save: the single accented control — solid white pill, dark glyph/label.
  segmentPrimary: {
    backgroundColor: colors.labelOnColor,
  },
  segmentPressed: {
    transform: [{ scale: 0.96 }],
  },
  segmentLabel: {
    ...type.footnote,
    fontWeight: '600',
  },
  });
}
