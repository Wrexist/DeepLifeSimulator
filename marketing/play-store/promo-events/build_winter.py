"""Google Play promotional-content art for the December 2026 holiday event.

Same rules and same diorama as build_halloween.py (read its header first):
no text, logos, borders or rounded corners; the focal point inside Play's safe
zone; the project's own 3D render as the hero so the card matches the store
screenshots. Winter dressing instead of Halloween: snow on the roofs and the
ground, falling snow, an aurora, a small lit tree and a few presents.

  out/winter-2026-1920x1080.png / .jpg   primary image, 16:9
  out/winter-2026-1080x1080.png / .jpg   square image, 1:1

Deterministic (fixed seeds). Run:
  python marketing/play-store/promo-events/build_winter.py
Needs Pillow + numpy.
"""
from __future__ import annotations

import random

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

from build_halloween import OUT, RENDERS, SS, add_light, glow, moon, stars


def winter_sky(w: int, h: int, focus: tuple[float, float]) -> Image.Image:
    """Deep winter-night gradient with a cool bloom behind the focal point."""
    y = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None]
    top = np.array([7, 12, 34], np.float32)
    mid = np.array([16, 38, 74], np.float32)
    low = np.array([30, 64, 96], np.float32)
    t1 = np.clip(y / 0.55, 0, 1)
    t2 = np.clip((y - 0.55) / 0.45, 0, 1)
    grad = top + (mid - top) * t1[..., None]
    grad = grad + (low - mid) * t2[..., None]
    grad = np.broadcast_to(grad, (h, w, 3)).copy()

    yy, xx = np.mgrid[0:h, 0:w].astype(np.float32)
    fx, fy = focus
    d = np.sqrt(((xx - fx) / (0.55 * w)) ** 2 + ((yy - fy) / (0.6 * h)) ** 2)
    bloom = np.clip(1.0 - d, 0, 1) ** 2.2
    grad += bloom[..., None] * np.array([70, 110, 150], np.float32) * 0.5

    v = np.sqrt(((xx - w / 2) / (w / 2)) ** 2 + ((yy - h / 2) / (h / 2)) ** 2)
    grad *= (1.0 - np.clip(v - 0.55, 0, 1) * 0.55)[..., None]
    return Image.fromarray(np.clip(grad, 0, 255).astype(np.uint8), "RGB").convert("RGBA")


def aurora(w: int, h: int, seed: int, band: tuple[float, float]) -> Image.Image:
    """Soft curtains of green-teal light across the upper sky."""
    rng = random.Random(seed)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    y0, y1 = band
    for k in range(3):
        phase = rng.uniform(0, 6.28)
        amp = h * rng.uniform(0.03, 0.06)
        base = h * (y0 + (y1 - y0) * k / 2.5)
        thickness = h * rng.uniform(0.05, 0.09)
        pts_top, pts_bot = [], []
        for i in range(0, 41):
            x = w * i / 40
            yv = base + amp * np.sin(phase + i / 40 * 6.28 * 1.3)
            pts_top.append((x, yv))
            pts_bot.append((x, yv + thickness))
        col = [(80, 230, 170, 60), (70, 200, 220, 46), (120, 255, 190, 38)][k]
        d.polygon(pts_top + list(reversed(pts_bot)), fill=col)
    return layer.filter(ImageFilter.GaussianBlur(h * 0.035))


def snowfall(w: int, h: int, count: int, seed: int, size_range=(1.0, 3.2)) -> Image.Image:
    rng = random.Random(seed)
    layer = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    for _ in range(count):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(*size_range)
        d.ellipse([x - r, y - r, x + r, y + r], fill=(240, 246, 255, rng.randint(110, 230)))
    return Image.alpha_composite(glow(layer, 1.4, 0.7), layer)


def snowy_city(target_h: int) -> tuple[Image.Image, Image.Image]:
    """The city render at night with snow on its roofs and ground.

    Roofs are a flat (243, 240, 233) and the grass strip a flat
    (212, 220, 195) in the source (its bench shadow (151, 174, 144)), so all
    three are recoloured by exact-match masks computed at full resolution,
    before resampling blends their edges - the same technique the window mask
    in build_halloween.py uses.
    """
    src = Image.open(RENDERS / "city.png").convert("RGBA")
    src = src.crop(src.getbbox())
    s = np.asarray(src).astype(np.int16)
    rgb_i, a_i = s[..., :3], s[..., 3]

    def mask(color, tol):
        return (np.abs(rgb_i - np.array(color)).max(-1) <= tol) & (a_i > 200)

    r, g, b = s[..., 0], s[..., 1], s[..., 2]
    win_full = mask((210, 220, 211), 6) & (g - r >= 6) & (g - b >= 5)
    snow_full = mask((243, 240, 233), 4) | mask((212, 220, 195), 6)
    snow_shade_full = mask((151, 174, 144), 8)

    scale = target_h / src.height
    size = (int(src.width * scale), target_h)
    src = src.resize(size, Image.LANCZOS)

    def resize_mask(m):
        return np.asarray(Image.fromarray((m * 255).astype(np.uint8), "L").resize(size, Image.LANCZOS)
                          ).astype(np.float32)[..., None] / 255.0

    win, snow, shade = resize_mask(win_full), resize_mask(snow_full), resize_mask(snow_shade_full)

    a = np.asarray(src).astype(np.float32)
    rgb, alpha = a[..., :3], a[..., 3:4]
    lum = (rgb * np.array([0.299, 0.587, 0.114], np.float32)).sum(-1, keepdims=True)
    graded = rgb * 0.5 + lum * 0.5
    graded = graded * np.array([0.34, 0.36, 0.50], np.float32) + np.array([6, 8, 22], np.float32)

    snow_col = np.array([214, 228, 248], np.float32)
    shade_col = np.array([128, 150, 190], np.float32)
    h, w = rgb.shape[:2]
    yy = np.linspace(0, 1, h, dtype=np.float32)[:, None, None]
    warm = np.array([255, 186, 90], np.float32) * (0.93 + 0.07 * yy)

    out = graded
    out = out * (1 - snow) + snow_col * snow
    out = out * (1 - shade) + shade_col * shade
    out = out * (1 - win) + warm * win
    diorama = Image.fromarray(np.concatenate([np.clip(out, 0, 255), alpha], -1).astype(np.uint8), "RGBA")

    light = np.zeros((h, w, 4), np.float32)
    light[..., :3] = np.array([255, 150, 60], np.float32)
    light[..., 3] = win[..., 0] * 255.0
    return diorama, Image.fromarray(light.astype(np.uint8), "RGBA")


def tree(height: float) -> tuple[Image.Image, Image.Image]:
    """A small decorated fir. Returns (tree, lights) layers."""
    s = int(height * SS)
    w = int(s * 0.7)
    img = Image.new("RGBA", (w, s), (0, 0, 0, 0))
    lights = Image.new("RGBA", (w, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    cx = w / 2
    d.rectangle([cx - w * 0.05, s * 0.86, cx + w * 0.05, s * 0.98], fill=(70, 44, 30, 255))
    tiers = [(0.08, 0.40, 0.24), (0.26, 0.64, 0.36), (0.46, 0.88, 0.48)]
    greens = [(38, 98, 70), (32, 86, 62), (27, 74, 54)]
    for (t, bot, half), col in zip(tiers, greens):
        d.polygon([(cx, s * t), (cx - w * half, s * bot), (cx + w * half, s * bot)], fill=col + (255,))
        # a lighter left flank so it reads as lit, like the renders
        d.polygon([(cx, s * t), (cx - w * half, s * bot), (cx - w * half * 0.15, s * bot)],
                  fill=tuple(min(255, c + 22) for c in col) + (255,))
    ld = ImageDraw.Draw(lights)
    rng = random.Random(7)
    palette = [(255, 214, 102), (255, 120, 120), (130, 200, 255), (160, 255, 170)]
    for (t, bot, half) in tiers:
        for _ in range(7):
            fy = rng.uniform(t + (bot - t) * 0.35, bot - 0.02)
            span = half * (fy - t) / (bot - t)
            fx = rng.uniform(-span * 0.85, span * 0.85)
            rr = s * 0.018
            x, y = cx + fx * w, fy * s
            ld.ellipse([x - rr, y - rr, x + rr, y + rr], fill=rng.choice(palette) + (255,))
    # star
    star = []
    for i in range(10):
        ang = -np.pi / 2 + i * np.pi / 5
        rad = s * (0.06 if i % 2 == 0 else 0.025)
        star.append((cx + rad * np.cos(ang), s * 0.08 + rad * np.sin(ang)))
    ld.polygon(star, fill=(255, 226, 120, 255))
    size = (int(w / SS), int(height))
    return img.resize(size, Image.LANCZOS), lights.resize(size, Image.LANCZOS)


def present(width: float, body: tuple, ribbon: tuple) -> Image.Image:
    """A small isometric gift box."""
    s = int(width * SS)
    h = int(s * 1.0)
    img = Image.new("RGBA", (s, h), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    top = [(s * 0.5, h * 0.16), (s * 0.98, h * 0.38), (s * 0.5, h * 0.60), (s * 0.02, h * 0.38)]
    left = [(s * 0.02, h * 0.38), (s * 0.5, h * 0.60), (s * 0.5, h * 0.98), (s * 0.02, h * 0.76)]
    right = [(s * 0.5, h * 0.60), (s * 0.98, h * 0.38), (s * 0.98, h * 0.76), (s * 0.5, h * 0.98)]
    d.polygon(top, fill=tuple(min(255, c + 40) for c in body) + (255,))
    d.polygon(left, fill=body + (255,))
    d.polygon(right, fill=tuple(int(c * 0.72) for c in body) + (255,))
    lw = s * 0.05
    d.line([(s * 0.26, h * 0.27), (s * 0.74, h * 0.49)], fill=ribbon + (255,), width=int(lw))
    d.line([(s * 0.74, h * 0.27), (s * 0.26, h * 0.49)], fill=ribbon + (255,), width=int(lw))
    d.line([(s * 0.26, h * 0.49), (s * 0.26, h * 0.87)], fill=ribbon + (255,), width=int(lw))
    d.line([(s * 0.74, h * 0.49), (s * 0.74, h * 0.87)], fill=ribbon + (255,), width=int(lw))
    d.ellipse([s * 0.40, h * 0.10, s * 0.50, h * 0.22], fill=ribbon + (255,))
    d.ellipse([s * 0.50, h * 0.10, s * 0.60, h * 0.22], fill=ribbon + (255,))
    return img.resize((int(width), int(width)), Image.LANCZOS)


def compose(w: int, h: int, layout: dict, seed: int) -> Image.Image:
    cx, cy = layout["diorama_center"]
    img = winter_sky(w, h, (cx, cy + h * 0.05))
    img = add_light(img, aurora(w, h, seed, layout["aurora_band"]))
    img = Image.alpha_composite(img, stars(w, h, layout["stars"], seed, 0.55))
    mx, my, mr = layout["moon"]
    img = Image.alpha_composite(img, moon(mx, my, mr, w, h))
    img = Image.alpha_composite(img, snowfall(w, h, layout["snow_back"], seed + 1, (0.8, 2.0)))

    diorama, wlight = snowy_city(layout["diorama_h"])
    dx = int(cx - diorama.width / 2)
    dy = int(cy - diorama.height / 2)

    ground = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    gd = ImageDraw.Draw(ground)
    gw, gh = diorama.width * 0.62, diorama.height * 0.16
    gy = dy + diorama.height * 0.90
    gd.ellipse([cx - gw, gy - gh, cx + gw, gy + gh], fill=(170, 210, 255, 50))
    img = Image.alpha_composite(img, ground.filter(ImageFilter.GaussianBlur(48)))
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    sd = ImageDraw.Draw(shadow)
    sd.ellipse([cx - gw * 0.8, gy - gh * 0.55, cx + gw * 0.8, gy + gh * 0.55], fill=(4, 8, 20, 150))
    img = Image.alpha_composite(img, shadow.filter(ImageFilter.GaussianBlur(26)))

    img.alpha_composite(diorama, (dx, dy))
    spill = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    spill.alpha_composite(wlight, (dx, dy))
    img = add_light(img, glow(spill, layout["glow_r"], 0.5))
    img = add_light(img, glow(spill, layout["glow_r"] * 0.3, 0.3))

    tx, ty, th = layout["tree"]
    t_img, t_lights = tree(th * diorama.height)
    x = int(dx + tx * diorama.width - t_img.width / 2)
    y = int(dy + ty * diorama.height - t_img.height)
    img.alpha_composite(t_img, (x, y))
    lit = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    lit.alpha_composite(t_lights, (x, y))
    img = Image.alpha_composite(img, lit)
    img = add_light(img, glow(lit, 6, 0.9))

    for (px, py, pw, body, ribbon) in layout["presents"]:
        p = present(pw * diorama.height, body, ribbon)
        img.alpha_composite(p, (int(dx + px * diorama.width - p.width / 2), int(dy + py * diorama.height - p.height)))

    img = Image.alpha_composite(img, snowfall(w, h, layout["snow_front"], seed + 2, (1.6, 3.6)))
    return img.convert("RGB")


LAYOUTS = {
    (1920, 1080): {
        "diorama_center": (920, 515),
        "diorama_h": 650,
        "moon": (1440, 290, 96),
        "aurora_band": (0.08, 0.24),
        "stars": 150,
        "snow_back": 260,
        "snow_front": 120,
        "tree": (0.115, 0.86, 0.39),
        "presents": [(0.22, 0.90, 0.075, (196, 48, 52), (250, 214, 120)),
                     (0.29, 0.93, 0.06, (40, 120, 84), (250, 230, 200)),
                     (0.84, 0.88, 0.07, (60, 100, 200), (250, 214, 120))],
        "glow_r": 26,
    },
    (1080, 1080): {
        "diorama_center": (525, 585),
        "diorama_h": 590,
        "moon": (810, 240, 84),
        "aurora_band": (0.07, 0.22),
        "stars": 100,
        "snow_back": 180,
        "snow_front": 80,
        "tree": (0.115, 0.86, 0.39),
        "presents": [(0.22, 0.90, 0.075, (196, 48, 52), (250, 214, 120)),
                     (0.29, 0.93, 0.06, (40, 120, 84), (250, 230, 200)),
                     (0.84, 0.88, 0.07, (60, 100, 200), (250, 214, 120))],
        "glow_r": 24,
    },
}


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for (w, h), layout in LAYOUTS.items():
        img = compose(w, h, layout, seed=20261224)
        stem = OUT / f"winter-2026-{w}x{h}"
        img.save(stem.with_suffix(".png"), optimize=True)
        img.save(stem.with_suffix(".jpg"), quality=90, optimize=True, progressive=True)
        print(f"{stem.name}: png {stem.with_suffix('.png').stat().st_size // 1024} KB, "
              f"jpg {stem.with_suffix('.jpg').stat().st_size // 1024} KB")


if __name__ == "__main__":
    main()
