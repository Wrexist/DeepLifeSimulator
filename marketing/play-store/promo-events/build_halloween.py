"""Google Play promotional-content art for the Halloween 2026 event.

Renders the two images Play requires for a promotional-content event, built
from the project's own 3D renders (art/game-assets-v1/renders) so the card
matches the store screenshots instead of looking like stock art:

  out/halloween-2026-1920x1080.png / .jpg   primary image, 16:9
  out/halloween-2026-1080x1080.png / .jpg   square image, 1:1

Play's content rules shaped every choice here (see README.md in this folder):
no text, no logos, no borders or rounded corners, no button-like shapes, and
the focal point kept inside the safe zone (10% each side, 15% top, 20% bottom)
because surfaces crop the image differently.

Deterministic: every random draw comes from a fixed seed, so a rebuild is
byte-stable and a reviewer can reproduce the file that was uploaded.

Run:  python marketing/play-store/promo-events/build_halloween.py
Needs Pillow + numpy.
"""
from __future__ import annotations

import math
import random
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

HERE = Path(__file__).resolve().parent
REPO = HERE.parents[2]
RENDERS = REPO / "art" / "game-assets-v1" / "renders"
OUT = HERE / "out"

SS = 3  # supersampling factor for hand-drawn shapes


# ── small helpers ──────────────────────────────────────────────────────────

def lerp(a, b, t):
    return a + (b - a) * t


def lerp_rgb(c1, c2, t):
    return tuple(int(round(lerp(x, y, t))) for x, y in zip(c1, c2))


def glow(img: Image.Image, radius: float, strength: float = 1.0) -> Image.Image:
    """A blurred copy of an RGBA layer, alpha scaled by `strength`."""
    blurred = img.filter(ImageFilter.GaussianBlur(radius))
    if strength != 1.0:
        a = np.asarray(blurred).astype(np.float32)
        a[..., 3] = np.clip(a[..., 3] * strength, 0, 255)
        blurred = Image.fromarray(a.astype(np.uint8), "RGBA")
    return blurred


def add_light(base: Image.Image, light: Image.Image) -> Image.Image:
    """Additive blend of an RGBA light layer onto an RGB(A) base."""
    b = np.asarray(base.convert("RGB")).astype(np.float32)
    l = np.asarray(light).astype(np.float32)
    alpha = l[..., 3:4] / 255.0
    out = np.clip(b + l[..., :3] * alpha, 0, 255).astype(np.uint8)
    return Image.fromarray(out, "RGB").convert("RGBA")


# ── background ─────────────────────────────────────────────────────────────

def sky(w: int, h: int, focus: tuple[float, float]) -> Image.Image:
    """Night gradient with a warm bloom behind the focal point."""
    y = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    top = np.array([13, 9, 34], np.float32)
    mid = np.array([37, 19, 72], np.float32)
    low = np.array([66, 26, 70], np.float32)
    t1 = np.clip(y / 0.55, 0, 1)
    t2 = np.clip((y - 0.55) / 0.45, 0, 1)
    grad = top + (mid - top) * t1[..., None]
    grad = grad + (low - mid) * t2[..., None]
    grad = np.broadcast_to(grad, (h, w, 3)).copy()

    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    fx, fy = focus
    d = np.sqrt(((xx - fx) / (0.55 * w)) ** 2 + ((yy - fy) / (0.6 * h)) ** 2)
    bloom = np.clip(1.0 - d, 0, 1) ** 2.2
    warm = np.array([150, 62, 40], np.float32)
    grad += bloom[..., None] * warm * 0.55

    # vignette
    v = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    grad *= (1.0 - np.clip(v - 0.55, 0, 1) * 0.55)[..., None]
    return Image.fromarray(np.clip(grad, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def stars(w: int, h: int, count: int, seed: int, max_y: float) -> Image.Image:
    rng = random.Random(seed)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(count):
        x = rng.uniform(0, w)
        y = rng.uniform(0, h * max_y) ** 1.0
        r = rng.choice([0.8, 1.0, 1.2, 1.6, 2.2])
        a = rng.randint(70, 230)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(255, 244, 220, a))
    return Image.alpha_composite(glow(layer, 1.6, 0.9), layer)


def moon(cx: float, cy: float, r: float, w: int, h: int) -> Image.Image:
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    halo = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    hd = ImageDraw.Draw(halo)
    hd.ellipse([cx - r * 1.9, cy - r * 1.9, cx + r * 1.9, cy + r * 1.9], fill=(255, 214, 150, 70))
    hd.ellipse([cx - r * 1.35, cy - r * 1.35, cx + r * 1.35, cy + r * 1.35], fill=(255, 226, 170, 110))
    layer = Image.alpha_composite(layer, halo.filter(ImageFilter.GaussianBlur(r * 0.55)))

    size = int(r * 2 * SS)
    disc = np.zeros((size, size, 4), np.float32)
    yy, xx = np.mgrid[0:size, 0:size].astype(np.float32)
    c = size / 2
    dist = np.sqrt((xx - c) ** 2 + (yy - c) ** 2) / c
    inside = dist <= 1.0
    # lit from the upper left: brighter there, warmer toward the limb
    shade = np.clip(1.0 - 0.28 * (((xx - c * 0.6) ** 2 + (yy - c * 0.6) ** 2) ** 0.5) / c, 0.62, 1.0)
    base = np.array([255, 240, 205], np.float32)
    limb = np.array([236, 196, 140], np.float32)
    col = base + (limb - base) * np.clip(dist, 0, 1)[..., None] ** 3
    disc[..., :3] = col * shade[..., None]
    disc[..., 3] = np.where(inside, 255, 0)
    # soft edge
    edge = np.clip((1.0 - dist) * c / 2.0, 0, 1)
    disc[..., 3] *= edge
    moon_img = Image.fromarray(np.clip(disc, 0, 255).astype(np.uint8), "RGBA")

    # craters: faint, low-contrast. Drawn on their own layer and composited -
    # ImageDraw REPLACES pixels, so drawing a translucent fill straight onto
    # the disc would punch see-through holes in the moon instead of shading it.
    craters = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    cd = ImageDraw.Draw(craters)
    for (ox, oy, rr) in [(0.30, 0.38, 0.16), (0.58, 0.28, 0.09), (0.55, 0.62, 0.13),
                         (0.26, 0.66, 0.07), (0.72, 0.48, 0.06)]:
        x0, y0 = ox * size, oy * size
        rad = rr * size
        cd.ellipse([x0 - rad, y0 - rad, x0 + rad, y0 + rad], fill=(196, 160, 112, 46))
    moon_img = Image.alpha_composite(moon_img, craters.filter(ImageFilter.GaussianBlur(SS * 2)))
    moon_img = moon_img.resize((int(r * 2), int(r * 2)), Image.LANCZOS)
    layer.alpha_composite(moon_img, (int(cx - r), int(cy - r)))
    return layer


def bat(span: float, flap: float = 0.0) -> Image.Image:
    """A small bat silhouette, `span` px wide. `flap` tilts the wings (-1..1)."""
    s = int(span * SS)
    h = int(s * 0.55)
    img = Image.new("RGBA", (s, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx, cy = s / 2, h * 0.45
    lift = flap * h * 0.25
    wing = [
        (cx, cy - h * 0.05),
        (cx - s * 0.12, cy - h * 0.22 - lift * 0.4),
        (cx - s * 0.30, cy - h * 0.34 - lift),
        (cx - s * 0.50, cy - h * 0.18 - lift),
        (cx - s * 0.40, cy + h * 0.02 - lift * 0.5),
        (cx - s * 0.33, cy + h * 0.16 - lift * 0.3),
        (cx - s * 0.24, cy + h * 0.04),
        (cx - s * 0.17, cy + h * 0.20),
        (cx - s * 0.09, cy + h * 0.08),
        (cx, cy + h * 0.26),
    ]
    mirrored = [(2 * cx - x, y) for (x, y) in reversed(wing)]
    d.polygon(wing + mirrored, fill=(18, 11, 32, 255))
    # head with ears
    d.ellipse([cx - s * 0.05, cy - h * 0.18, cx + s * 0.05, cy + h * 0.10], fill=(18, 11, 32, 255))
    d.polygon([(cx - s * 0.045, cy - h * 0.10), (cx - s * 0.03, cy - h * 0.30), (cx - s * 0.005, cy - h * 0.12)],
              fill=(18, 11, 32, 255))
    d.polygon([(cx + s * 0.045, cy - h * 0.10), (cx + s * 0.03, cy - h * 0.30), (cx + s * 0.005, cy - h * 0.12)],
              fill=(18, 11, 32, 255))
    return img.resize((int(span), max(1, int(span * 0.55))), Image.LANCZOS)


def pumpkin(width: float) -> tuple[Image.Image, Image.Image]:
    """A carved, lit jack-o'-lantern. Returns (body, face-light) layers."""
    s = int(width * SS)
    h = int(s * 0.95)
    body = Image.new("RGBA", (s, h), (0, 0, 0, 0))
    face = Image.new("RGBA", (s, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    top = h * 0.22
    bot = h * 0.98
    lobes = [  # (center offset as fraction of width, half-width fraction, colour)
        (-0.28, 0.24, (176, 74, 16)),
        (0.28, 0.24, (176, 74, 16)),
        (-0.14, 0.26, (214, 98, 22)),
        (0.14, 0.26, (214, 98, 22)),
        (0.0, 0.25, (240, 124, 34)),
    ]
    for off, hw, col in lobes:
        cx = s / 2 + off * s
        d.ellipse([cx - hw * s, top, cx + hw * s, bot], fill=col + (255,))
    # soft highlight upper-left, shadow lower-right (fake 3D, like the renders)
    arr = np.asarray(body).astype(np.float32)
    yy, xx = np.mgrid[0:h, 0:s].astype(np.float32)
    hl = np.clip(1.0 - np.sqrt(((xx - s * 0.36) / (s * 0.5)) ** 2 + ((yy - h * 0.42) / (h * 0.5)) ** 2), 0, 1)
    sh = np.clip(np.sqrt(((xx - s * 0.75) / (s * 0.6)) ** 2 + ((yy - h * 0.95) / (h * 0.55)) ** 2), 0, 1)
    arr[..., :3] = arr[..., :3] * (0.72 + 0.28 * sh[..., None]) + hl[..., None] * 38
    body = Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8), "RGBA")
    d = ImageDraw.Draw(body)
    # stem
    d.rounded_rectangle([s * 0.46, h * 0.08, s * 0.56, h * 0.28], radius=s * 0.03, fill=(86, 104, 52, 255))
    d.polygon([(s * 0.52, h * 0.10), (s * 0.60, h * 0.02), (s * 0.63, h * 0.06), (s * 0.56, h * 0.14)],
              fill=(96, 116, 58, 255))
    # carved face (drawn dark on the body, lit on the face layer)
    eye_l = [(s * 0.30, h * 0.56), (s * 0.38, h * 0.42), (s * 0.45, h * 0.56)]
    eye_r = [(s * 0.55, h * 0.56), (s * 0.62, h * 0.42), (s * 0.70, h * 0.56)]
    nose = [(s * 0.47, h * 0.64), (s * 0.50, h * 0.58), (s * 0.53, h * 0.64)]
    mouth = [
        (s * 0.26, h * 0.68), (s * 0.34, h * 0.73), (s * 0.38, h * 0.69), (s * 0.44, h * 0.75),
        (s * 0.50, h * 0.70), (s * 0.56, h * 0.75), (s * 0.62, h * 0.69), (s * 0.66, h * 0.73),
        (s * 0.74, h * 0.68), (s * 0.68, h * 0.84), (s * 0.50, h * 0.88), (s * 0.32, h * 0.84),
    ]
    fd = ImageDraw.Draw(face)
    for poly in (eye_l, eye_r, nose, mouth):
        d.polygon(poly, fill=(92, 34, 6, 255))
        fd.polygon(poly, fill=(255, 216, 96, 255))
    size = (int(width), int(width * 0.95))
    return body.resize(size, Image.LANCZOS), face.resize(size, Image.LANCZOS)


# ── the diorama ────────────────────────────────────────────────────────────

def night_city(target_h: int) -> tuple[Image.Image, Image.Image]:
    """The city render graded to night, with its windows lit.

    Returns (diorama, window_light) at the same size.
    """
    src = Image.open(RENDERS / "city.png").convert("RGBA")
    src = src.crop(src.getbbox())

    # Windows are a flat (210, 220, 211) in the source render, with a green
    # tint the walls do not have. Detect them at FULL resolution, before any
    # resampling blends their edges into the wall colour; a looser match also
    # catches the white building's shaded side (217, 217, 207).
    s = np.asarray(src).astype(np.int16)
    r, g, b = s[..., 0], s[..., 1], s[..., 2]
    win_full = ((np.abs(s[..., :3] - np.array([210, 220, 211])).max(-1) <= 6)
                & (s[..., 3] > 200) & (g - r >= 6) & (g - b >= 5))
    win_mask = Image.fromarray((win_full * 255).astype(np.uint8), "L")

    scale = target_h / src.height
    size = (int(src.width * scale), target_h)
    src = src.resize(size, Image.LANCZOS)
    win = np.asarray(win_mask.resize(size, Image.LANCZOS)).astype(np.float32)[..., None] / 255.0

    a = np.asarray(src).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3:4]

    # moonlit grade: dark, cool, a touch desaturated, so the windows carry the light
    lum = (rgb * np.array([0.299, 0.587, 0.114], np.float32)).sum(-1, keepdims=True)
    graded = rgb * 0.5 + lum * 0.5
    graded = graded * np.array([0.34, 0.32, 0.52], np.float32) + np.array([6, 4, 22], np.float32)
    # a faint cool rim from the moon, strongest on pale right-hand surfaces
    h, w = rgb.shape[:2]
    xx = np.linspace(0, 1, w, dtype=np.float32)[None, :, None]
    graded += np.clip(lum - 170, 0, 255) * np.array([0.10, 0.10, 0.16], np.float32) * xx

    # lit windows: warm, slightly brighter toward the bottom of each pane
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    warm = np.array([255, 182, 78], np.float32) * (0.93 + 0.07 * yy)
    out = graded * (1.0 - win) + warm * win
    diorama = Image.fromarray(np.concatenate([np.clip(out, 0, 255), alpha], -1).astype(np.uint8), "RGBA")

    light = np.zeros((h, w, 4), np.float32)
    light[..., :3] = np.array([255, 140, 40], np.float32)
    light[..., 3] = win[..., 0] * 255.0
    window_light = Image.fromarray(light.astype(np.uint8), "RGBA")
    return diorama, window_light


# ── scene assembly ─────────────────────────────────────────────────────────

def compose(w: int, h: int, layout: dict, seed: int) -> Image.Image:
    cx, cy = layout["diorama_center"]
    img = sky(w, h, (cx, cy + h * 0.05))
    img = Image.alpha_composite(img, stars(w, h, layout["stars"], seed, 0.62))

    mx, my, mr = layout["moon"]
    img = Image.alpha_composite(img, moon(mx, my, mr, w, h))

    for (bx, by, span, flap) in layout["bats"]:
        b = bat(span, flap)
        img.alpha_composite(b, (int(bx - b.width / 2), int(by - b.height / 2)))

    diorama, wlight = night_city(layout["diorama_h"])
    dx = int(cx - diorama.width / 2)
    dy = int(cy - diorama.height / 2)

    # ground: a soft shadow + warm pool of light under the base
    ground = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(ground)
    gw, gh = diorama.width * 0.62, diorama.height * 0.16
    gy = dy + diorama.height * 0.90
    gd.ellipse([cx - gw, gy - gh, cx + gw, gy + gh], fill=(255, 120, 40, 60))
    img = Image.alpha_composite(img, ground.filter(ImageFilter.GaussianBlur(48)))
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse([cx - gw * 0.8, gy - gh * 0.55, cx + gw * 0.8, gy + gh * 0.55], fill=(6, 3, 14, 150))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(26)))

    img.alpha_composite(diorama, (dx, dy))

    # window glow spills onto the scene
    spill = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    spill.alpha_composite(wlight, (dx, dy))
    img = add_light(img, glow(spill, layout["glow_r"], 0.55))
    img = add_light(img, glow(spill, layout["glow_r"] * 0.3, 0.35))

    # jack-o'-lanterns on the pavement, positioned relative to the diorama
    for (px, py, pw) in layout["pumpkins"]:
        body, face = pumpkin(pw * diorama.height)
        x = int(dx + px * diorama.width - body.width / 2)
        y = int(dy + py * diorama.height - body.height)
        pool = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        pd = ImageDraw.Draw(pool)
        pr = body.width * 1.3
        pd.ellipse([x + body.width / 2 - pr, y + body.height - pr * 0.35,
                    x + body.width / 2 + pr, y + body.height + pr * 0.35], fill=(255, 150, 50, 120))
        img = add_light(img, pool.filter(ImageFilter.GaussianBlur(pr * 0.4)))
        img.alpha_composite(body, (x, y))
        lit = Image.new("RGBA", (w, h), (0, 0, 0, 0))
        lit.alpha_composite(face, (x, y))
        img = Image.alpha_composite(img, lit)
        img = add_light(img, glow(lit, body.width * 0.18, 0.9))

    # embers drifting up from the street
    rng = random.Random(seed + 7)
    embers = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    ed = ImageDraw.Draw(embers)
    ex0, ex1 = layout["ember_x"]
    for _ in range(layout["embers"]):
        x = rng.uniform(ex0, ex1)
        y = rng.uniform(h * 0.18, h * 0.86)
        r = rng.choice([1.5, 2.0, 2.5, 3.0, 4.0])
        col = rng.choice([(255, 186, 80), (255, 150, 60), (255, 220, 140)])
        ed.ellipse([x - r, y - r, x + r, y + r], fill=col + (rng.randint(120, 230),))
    img = add_light(img, glow(embers, 5, 0.8))
    img = Image.alpha_composite(img, embers)
    return img.convert("RGB")


LAYOUTS = {
    (1920, 1080): {
        # focal point centred; everything that matters sits inside
        # x 192..1728, y 162..864 (Play's 10% / 15% / 20% safe zone)
        "diorama_center": (920, 515),
        "diorama_h": 650,
        "moon": (1440, 300, 118),
        "bats": [(1318, 222, 60, 0.4), (1566, 262, 46, -0.3), (1496, 186, 36, 0.8)],
        "stars": 170,
        "pumpkins": [(0.13, 0.80, 0.12), (0.25, 0.875, 0.095), (0.84, 0.86, 0.105)],
        "glow_r": 26,
        "embers": 70,
        "ember_x": (300, 1640),
    },
    (1080, 1080): {
        "diorama_center": (525, 585),
        "diorama_h": 590,
        "moon": (810, 250, 100),
        "bats": [(700, 188, 52, 0.4), (915, 222, 40, -0.3), (860, 156, 32, 0.8)],
        "stars": 110,
        "pumpkins": [(0.13, 0.80, 0.12), (0.25, 0.875, 0.095), (0.84, 0.86, 0.105)],
        "glow_r": 24,
        "embers": 48,
        "ember_x": (150, 930),
    },
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for (w, h), layout in LAYOUTS.items():
        img = compose(w, h, layout, seed=20261031)
        stem = OUT / f"halloween-2026-{w}x{h}"
        img.save(stem.with_suffix(".png"), optimize=True)
        img.save(stem.with_suffix(".jpg"), quality=90, optimize=True, progressive=True)
        print(f"{stem.name}: png {stem.with_suffix('.png').stat().st_size // 1024} KB, "
              f"jpg {stem.with_suffix('.jpg').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
