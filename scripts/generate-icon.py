#!/usr/bin/env python3
"""
Generates the nibble app icon (light + dark variants) and the web favicon.

Design: two distinct chopsticks entering from the upper-left and pinching an
orange morsel down in the lower-right corner -- "picking something up from the
bottom right". Rendered at 4x supersample with Pillow, then downsampled with
LANCZOS for clean anti-aliased edges (including the rotated chopsticks).

Backgrounds match the in-app canvas so the icon reads as light/dark aware:
  - light icon: systemGroupedBackground gray, indigo chopsticks
  - dark icon:  black, cream chopsticks
The orange morsel is shared across both.

Re-run after editing:  python3 scripts/generate-icon.py
"""

from PIL import Image, ImageDraw
import math
import os

SS = 4                       # supersample factor
SIZE = 1024
S = SIZE * SS

ASSETS = os.path.join(os.path.dirname(__file__), "..", "assets")

ORANGE = (242, 90, 42)       # shared food morsel

# Per-variant art direction.
VARIANTS = {
    "icon.png": {
        "bg_top": (245, 245, 250),      # #F5F5FA -> subtle gradient
        "bg_bottom": (230, 230, 238),   # #E6E6EE
        "chopstick": (52, 58, 134),     # #343A86 brand indigo
    },
    "icon-dark.png": {
        "bg_top": (14, 14, 18),         # near-black, faint lift
        "bg_bottom": (0, 0, 0),         # #000000
        "chopstick": (245, 239, 227),   # #F5EFE3 cream
    },
}


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(3))


def make_background(top, bottom):
    """Vertical gradient, full-bleed (iOS masks the corners itself)."""
    img = Image.new("RGB", (S, S), top)
    px = img.load()
    for y in range(S):
        t = y / (S - 1)
        color = lerp(top, bottom, t)
        for x in range(S):
            px[x, y] = color
    return img.convert("RGBA")


def make_bar(length, thickness, color):
    """A single chopstick: a horizontal rounded bar, fully rounded caps."""
    bar = Image.new("RGBA", (length, thickness), (0, 0, 0, 0))
    d = ImageDraw.Draw(bar)
    d.rounded_rectangle([0, 0, length - 1, thickness - 1],
                        radius=thickness // 2, fill=color)
    return bar


def paste_chopstick(canvas, p0, p1, thickness, color):
    """Draw a chopstick from p0 (held end) to p1 (tip), centered on the line."""
    dx, dy = p1[0] - p0[0], p1[1] - p0[1]
    length = int(round(math.hypot(dx, dy)))
    # Screen y grows downward; PIL rotate is CCW in math coords, so negate.
    angle = -math.degrees(math.atan2(dy, dx))
    bar = make_bar(length + thickness, thickness, color)
    rot = bar.rotate(angle, expand=True, resample=Image.BICUBIC)
    cx, cy = (p0[0] + p1[0]) / 2, (p0[1] + p1[1]) / 2
    top_left = (int(round(cx - rot.width / 2)), int(round(cy - rot.height / 2)))
    canvas.alpha_composite(rot, top_left)


def build(variant):
    cfg = VARIANTS[variant]
    img = make_background(cfg["bg_top"], cfg["bg_bottom"])

    def sc(v):
        return int(v * SS)

    thickness = sc(70)

    # Two chopsticks: wide apart at the held (upper-left) end, converging to a
    # pinch at the morsel in the lower-right. The clear gap at top keeps them
    # reading as two distinct sticks rather than one mushed shape.
    #   held ends spread out           tips converge on the morsel
    stick_a = ((sc(215), sc(360)), (sc(648), sc(688)))
    stick_b = ((sc(378), sc(212)), (sc(700), sc(636)))
    paste_chopstick(img, *stick_a, thickness, cfg["chopstick"])
    paste_chopstick(img, *stick_b, thickness, cfg["chopstick"])

    # Morsel sits over the tips so it reads as pinched between the sticks.
    morsel_c = (sc(712), sc(716))
    morsel_r = sc(126)
    d = ImageDraw.Draw(img)
    d.ellipse(
        [morsel_c[0] - morsel_r, morsel_c[1] - morsel_r,
         morsel_c[0] + morsel_r, morsel_c[1] + morsel_r],
        fill=ORANGE,
    )

    out = img.resize((SIZE, SIZE), Image.LANCZOS).convert("RGB")
    path = os.path.join(ASSETS, variant)
    out.save(path)
    print(f"wrote {path}")
    return out


if __name__ == "__main__":
    light = build("icon.png")
    build("icon-dark.png")
    # Web favicon: reuse the light icon, downscaled.
    fav = light.resize((256, 256), Image.LANCZOS)
    fav_path = os.path.join(ASSETS, "favicon.png")
    fav.save(fav_path)
    print(f"wrote {fav_path}")
