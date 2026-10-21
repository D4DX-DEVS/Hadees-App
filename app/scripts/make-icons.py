#!/usr/bin/env python3
"""Generate app icons from the brand mark (white ح on brand green).

Usage:  python3 scripts/make-icons.py      (needs: pip install pillow)
Writes into assets/images/: icon, android-icon-{background,foreground,monochrome}, splash-icon, favicon.
"""
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
FONT = ROOT / "node_modules/@expo-google-fonts/amiri/700Bold/Amiri_700Bold.ttf"
OUT = ROOT / "assets/images"
GREEN = (15, 107, 79, 255)        # #0F6B4F  (palettes.light.accent)
GREEN_DARK = (11, 84, 62, 255)
WHITE = (255, 255, 255, 255)
GLYPH = "ح"


def glyph_layer(size: int, height_frac: float, color) -> Image.Image:
    """Transparent square with the glyph centred (by ink bbox) at the given fraction of the canvas height."""
    probe = ImageFont.truetype(str(FONT), 1000)
    l, t, r, b = probe.getbbox(GLYPH)
    font = ImageFont.truetype(str(FONT), int(1000 * size * height_frac / (b - t)))
    l, t, r, b = font.getbbox(GLYPH)
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    d.text(((size - (r - l)) / 2 - l, (size - (b - t)) / 2 - t), GLYPH, font=font, fill=color)
    return layer


def gradient(size: int) -> Image.Image:
    """Soft top-left light -> bottom-right dark green."""
    img = Image.new("RGBA", (size, size), GREEN)
    px = img.load()
    for y in range(size):
        for x in range(size):
            k = (x + y) / (2 * size)
            px[x, y] = tuple(int(GREEN[i] * (1 - 0.35 * k) + GREEN_DARK[i] * 0.35 * k) for i in range(3)) + (255,)
    return img


def rounded(img: Image.Image, radius_frac: float, opacity: float = 1.0) -> Image.Image:
    """Clip to a rounded square (keeps the image's own alpha, scaled by `opacity`)."""
    s = img.size[0]
    mask = Image.new("L", (s * 4, s * 4), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, s * 4 - 1, s * 4 - 1), radius=int(s * 4 * radius_frac), fill=255)
    mask = mask.resize((s, s), Image.LANCZOS).point(lambda v: int(v * opacity))
    out = img.copy()
    out.putalpha(mask)
    return out


def main():
    S = 1024
    # iOS / store icon: full-bleed, opaque (the OS applies the rounded mask)
    icon = gradient(S)
    icon.alpha_composite(glyph_layer(S, 0.50, WHITE))
    icon.convert("RGB").save(OUT / "icon.png")

    # Android adaptive: background + foreground (glyph inside the 66% safe zone) + monochrome
    gradient(S).convert("RGB").save(OUT / "android-icon-background.png")
    glyph_layer(S, 0.40, WHITE).save(OUT / "android-icon-foreground.png")
    glyph_layer(S, 0.40, (0, 0, 0, 255)).save(OUT / "android-icon-monochrome.png")

    # splash (shown on the brand-green splash background): white mark inside a soft rounded tile
    tile = Image.new("RGBA", (512, 512), (0, 0, 0, 0))
    tile.alpha_composite(rounded(Image.new("RGBA", (512, 512), (255, 255, 255, 255)), 0.22, opacity=0.16))
    tile.alpha_composite(glyph_layer(512, 0.46, WHITE))
    tile.save(OUT / "splash-icon.png")

    # favicon: rounded green tile
    fav = rounded(gradient(256), 0.22)
    fav.alpha_composite(glyph_layer(256, 0.52, WHITE))
    fav.resize((64, 64), Image.LANCZOS).save(OUT / "favicon.png")
    print("icons written to", OUT)


if __name__ == "__main__":
    main()
