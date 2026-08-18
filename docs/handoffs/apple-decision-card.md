# Handoff — Re-plate the swipe decision screen ("Mockup 2")

**Status:** ready for implementation
**Owner of spec:** design study (see visual reference below)
**Scope:** UI/UX surface only. **No changes to the taste engine, ranking, providers, or persistence.**

## Visual reference

Interactive mockups: <https://claude.ai/code/artifact/c0add1ef-c576-490c-b5c2-9db32cb34b88>
This handoff implements **Mockup 02 — "The decision, re-plated"** (the before/after focus screen). Toggle the artifact between light/dark to see both palettes; the redesign must work in both.

---

## 1. Goal in one sentence

Keep the one-at-a-time swipe flow and its gesture physics exactly as they are, but strip the three Tinder tells from it: the rotated **WANT / NOPE / BEEN** stamps, the row of four floating circular buttons, and the romance-pink heart. Replace them with a calm directional **edge-tint**, a docked **translucent segmented action bar**, and a **"why" pill** that reuses the taste engine's existing explanation.

## 2. What must NOT change (guardrails)

- `src/taste-engine/**` — untouched. Ranking, `updateTaste`, cooldowns, `whySurfaced` stay as-is.
- `src/providers/**`, `src/collection/**`, stores, auth — untouched.
- The **gesture physics in `Card.tsx`**: the `PanResponder`, the two independent 1-D springs in `flyOut`, momentum projection (`project()`), velocity handoff, the flick speed gate (`FLICK_MIN`), `directionFor`, `targetFor`, `SWIPE_THRESHOLD`, and reduced-motion timing fallback are all **correct and stay verbatim**. We are re-skinning what the drag *shows*, not how it *moves*.
- The photo gallery (indicator + tap zones + prefetch) stays.
- The action semantics stay: three directions map to `nope` (left), `want` (right), `been` (up). We only relabel them in the UI (`want`→"Save", `nope`→"Not for me", `been`→"Been"). **Do not rename the `SwipeAction` union or any engine value.**

---

## 3. Files to change

| File | Change |
| --- | --- |
| `src/components/Card.tsx` | Remove stamp overlays; add directional edge-tint; add the docked segmented action bar over the photo; add the "why" pill; optionally soften the drag rotation. |
| `src/screens/SwipeScreen.tsx` | Remove the four circular action buttons (`styles.controls` block); move **Undo** into the header as a nav action; pass the reason string + action handler into `Card`. |
| `src/theme.ts` | Add a `material` / glass token used by the segmented bar (translucent fill + hairline). Palette intent colors already exist. |
| `src/components/__tests__/Card.design.test.tsx` | Rewrite: stamps are gone. Assert the new edge-tint + action bar instead. |
| `src/screens/__tests__/SwipeScreen.design.test.tsx` | Update the "labels every bottom button" / accessibility-hint tests to the new control layout. |

---

## 4. Detailed spec

### 4.1 Remove the stamps (`Card.tsx`)

Delete the three `guide-*` overlays (currently `Card.tsx:334`–`376`) and their styles (`guide`, `guideWant`, `guideNope`, `guideBeen`, `guideBeenRow`, `guideText`). The `♥ WANT`, `NOPE ✕`, `✓ BEEN` rotated stamps are the single most recognizable Tinder tell — they go entirely.

**Keep** the interpolation nodes `wantOpacity`, `nopeOpacity`, `beenOpacity` (`Card.tsx:240`–`254`) — repurpose them to drive the edge-tint below. You can drop `wantScale` / `nopeScale` / `beenScale` (they only fed the stamp growth).

### 4.2 Add the directional edge-tint (`Card.tsx`)

While dragging, a soft color wash grows from the leading edge toward the finger — Apple's "hint in the direction of the gesture," not a verdict stamp. Reuse the existing opacity interpolations.

Render three absolutely-positioned `Animated.View`s inside the card, above the photo, below the info, `pointerEvents: 'none'`, only on the interactive card (`onInfoPress != null`):

| Direction | Action | Tint color (token) | Gradient |
| --- | --- | --- | --- |
| Drag **right** | `want` → "Save" | `colors.tint` (systemBlue) | fades in from the **right** edge |
| Drag **left** | `nope` → "Not for me" | `colors.nope` (systemRed) | fades in from the **left** edge |
| Drag **up** | `been` → "Been" | `colors.been` (systemGreen) | fades in from the **top** edge |

- Opacity driven by the existing `wantOpacity` / `nopeOpacity` / `beenOpacity` (already `0→1` clamped across `0→SWIPE_THRESHOLD`). Cap the visual with a container max opacity of ~`0.45` so it stays a *hint*, never a fill.
- Implement the gradient with `expo-linear-gradient` (add the dep) **or**, to avoid a new dependency, a plain `Animated.View` with the tint color and a horizontal/vertical opacity falloff via a semi-transparent overlay. Prefer `expo-linear-gradient` for a clean falloff; confirm it's acceptable to add. Web parity: `expo-linear-gradient` works under `react-native-web`.
- **Note:** the mockup renders the right-edge tint in green for illustration; the authoritative mapping is the table above (right = blue/Save). Match the table.

Keep the single selection haptic already fired on threshold crossing (`Card.tsx:191`–`193`). Do **not** add per-frame haptics.

**Rotation:** the current drag rotation is `±15deg` (`Card.tsx:232`). That strong tilt reads as a Tinder card-throw. Soften to **`±6deg`**. (Tunable — leave a comment; product may want 0.)

### 4.3 Docked segmented action bar (`Card.tsx`)

Replace the four external circular buttons with **one translucent segmented control docked to the bottom of the card**, over the photo gradient. Three segments, left→right:

1. **Not for me** — SF-symbol `xmark`, neutral label color, triggers `nope`.
2. **Been** — `checkmark`, neutral label color, triggers `been`.
3. **Save** — `bookmark`, **primary**: solid white pill background, dark glyph/label. Triggers `want`.

Spend the accent once, on Save. The other two are quiet neutrals (white-ish on the photo).

- Material: container `backgroundColor: rgba(120,120,128,0.28)`, `backdrop-filter: blur(14px)` on web (native uses the translucent fill; there is no blur on native RN `View` without extra libs — a semi-opaque fill is an acceptable native fallback, matching how the app already approximates materials). Add a `material` token to `theme.ts` so both platforms read one source.
- Each segment calls the card's **own** `flyOut(action)` directly (the card already owns `flyOut` and `useImperativeHandle`). This lets us delete the SwipeScreen→`cardRef.animateOut` button plumbing for these three actions. `onSwiped` still fires at the end of `flyOut`, so `commitSwipe` in SwipeScreen is unchanged.
- Only render on the interactive card (`onInfoPress != null`), same gate as the old guides.
- The buttons are `Pressable`; the `PanResponder` only claims the gesture after >5px of movement, so a tap on a segment won't be stolen by the drag. Verify a tap still fires `flyOut` and a drag over the bar still drags the card.
- Press feedback: `:active`/`pressed` → `scale(0.96)`, instant (respond on press-down, per HIG).
- Accessibility: keep `accessibilityLabel` ("Save" / "Been" / "Not for me") and `accessibilityHint` describing the gesture ("Swipe right", "Swipe up", "Swipe left") so the existing SwipeScreen hint tests can move here.

### 4.4 The "why" pill (`Card.tsx`)

Above the place name, show a small translucent pill with an amber star and the taste reason.

- Source string: `whySurfaced(graph.vector, place)` — already exported from `src/taste-engine` (`whySurfaced.ts`). Returns e.g. `"Because you like ramen"`, or `undefined` when there's no positive signal yet.
- **Wiring:** `graph` lives in `SwipeScreen`. Pass the reason down as a new optional prop `reason?: string` on `Card` (compute `whySurfaced(graph.vector, topPlace)` at the `SwipeScreen` call site, `Card.tsx:252`). Keep `Card` free of engine imports.
- When `reason` is `undefined`, render nothing (no empty pill).
- Style: dark translucent pill (`rgba(0,0,0,0.3)` + blur on web), white text ~12px, amber star `colors.star`. This mirrors the Tonight spotlight's reason line so the two flows share one language.

### 4.5 Move Undo into the header (`SwipeScreen.tsx`)

The four-button row (`SwipeScreen.tsx:262`–`307`, styles `controls`/`controlItem`/`button`/etc.) is deleted. **Undo** needs a home:

- Add a header nav button (top-left of the existing header row, `SwipeScreen.tsx:192`), SF-symbol `arrow.uturn.backward`, shown only when `undoStack.length > 0`.
- It calls the existing `handleUndo` unchanged (keeps the selection haptic).
- Keep the area pill and settings gear where they are.

Remove now-unused styles. Keep `handleButtonPress` only if something still calls it; otherwise delete it (the segmented bar calls `flyOut` inside the card, so `cardRef.animateOut` may become unused — check and remove `CardHandle`/`animateOut` only if truly unreferenced; the empty-deck buttons and rating flow don't use it).

### 4.6 Theme token (`theme.ts`)

Add to `Palette` (both `lightColors` / `darkColors`):

```ts
material: 'rgba(120,120,128,0.28)', // translucent segmented-control fill (over photos)
```

Keep everything else. The intent colors (`tint`, `been`, `nope`, `star`) already exist and are the ones to use.

---

## 5. Tests to update

Both design tests currently assert the old UI and **will fail** — that's expected; rewrite them to lock the new design.

### `Card.design.test.tsx`
- Delete the `Card swipe guides (design)` block (`guide-*` testIDs, "WANT/NOPE/BEEN" text, `lightColors.want`). Those elements no longer exist.
- Add assertions:
  - The interactive card renders an action segment for each action (add stable testIDs, e.g. `action-want-<id>`, `action-nope-<id>`, `action-been-<id>`), and none on the non-interactive card behind it.
  - Save is the primary (assert its distinct style/label), the other two are neutral.
  - Add edge-tint testIDs (e.g. `tint-want-<id>`) and assert their resting opacity is `0` (same pattern as the old "starts fully transparent" test at `Card.design.test.tsx:56`).
- **Keep** the entire `Card photo gallery (design)` block — unchanged.

### `SwipeScreen.design.test.tsx`
- Keep the empty-deck decision-card tests (unchanged).
- Rewrite `SwipeScreen guidance (design)`: the labels **Save / Been / Not for me** and their gesture hints now live on the card's segmented bar (rendered by `Card`), not on SwipeScreen's own buttons. Either assert them via the rendered `Card`, or move these assertions into `Card.design.test.tsx`. Add an assertion that **Undo** appears in the header only when there's something to undo.

### Full suite
Run `npm test` and `npm run typecheck`. Expect only the two design tests above to need edits; everything else should stay green. If any engine/provider test breaks, you've overstepped scope — revert that part.

---

## 6. Motion & accessibility checklist

- Springs: reuse the existing `spring.standard` (spring-back) and `spring.bouncy` (fly-off) from `src/motion.ts`. Do not retune.
- `prefers-reduced-motion` (`useReducedMotion`): keep the existing `REDUCED_MOTION_DURATION` timing fallback in `flyOut`. The edge-tint should still cross-fade (opacity is fine under reduced motion); skip the rotation.
- Haptics: exactly one `selection()` on threshold crossing (existing) and one `impact('medium')` on commit inside `flyOut` (existing). No new haptics.
- Web parity: the app also renders under `react-native-web` (see `AppShell`). Test the web build — `backdrop-filter` works on web; on native the translucent fill is the fallback. No `shadow*` prop warnings (use the existing `elevate()` helper if you add shadows).
- Light **and** dark: verify both palettes, since intent tints and the material fill differ per scheme.

---

## 7. Acceptance criteria

- [ ] No rotated WANT/NOPE/BEEN stamps anywhere. No pink heart.
- [ ] Dragging shows a soft directional edge-tint (blue right / red left / green up), capped as a hint, that grows toward the finger and fades on spring-back.
- [ ] A single translucent segmented bar (Not for me · Been · **Save**) is docked to the card; Save is the only accented control.
- [ ] Tapping a segment flies the card off in the correct direction and commits the correct `SwipeAction`; dragging still works identically to before.
- [ ] The "why" pill shows the `whySurfaced` reason when present, nothing when absent.
- [ ] Undo lives in the header, visible only when `undoStack` is non-empty, and still undoes.
- [ ] Drag rotation softened to ~±6°.
- [ ] `npm test` and `npm run typecheck` pass; only the two design tests were modified.
- [ ] Verified in light + dark, on web and (if available) a native simulator, with reduced motion on and off.

## 8. Suggested commit slicing

1. `theme.ts` material token (+ any tint plumbing).
2. `Card.tsx`: remove stamps, add edge-tint (keep old buttons working in SwipeScreen for now).
3. `Card.tsx`: add docked segmented bar + why pill; wire `flyOut` from segments.
4. `SwipeScreen.tsx`: delete circular buttons, move Undo to header, pass `reason`.
5. Rewrite the two design tests; run full suite.

Each step should typecheck and leave the app runnable.

## 9. Open decisions (confirm with product if unsure)

- **Add `expo-linear-gradient`?** Cleanest edge-tint falloff. Fallback: solid tint `Animated.View` with an opacity overlay, no new dep.
- **Rotation:** ±6° vs. 0°. Spec says ±6°; product may prefer flat.
- **Undo placement:** header top-left (this spec) vs. a small text button under the card. Spec picks the header.
