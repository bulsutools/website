#!/usr/bin/env python3
"""Generate public/og.png (1200x630) for Open Graph embeds."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
FONTS = Path(__file__).resolve().parent / "fonts"
ICON = ROOT / "public" / "icon.png"
OUT = ROOT / "public" / "og.png"

W, H = 1200, 630
PAD_X = 80
PAD_BOTTOM = 72
TEXT_MAX = 640
ICON_SIZE = 72
MARK_SIZE = 560

MAROON_DEEP = (64, 26, 22)  # hsl(5, 53%, 26%)
WHITE = (255, 255, 255)
CREAM = (248, 236, 234)


def load_icon(size: int) -> Image.Image:
    icon = Image.open(ICON).convert("RGBA")
    return icon.resize((size, size), Image.Resampling.LANCZOS)


def draw_faded_mark(canvas: Image.Image) -> None:
    mark = load_icon(MARK_SIZE)
    # White silhouette from the logo's alpha channel.
    alpha = mark.split()[-1]
    silhouette = Image.new("RGBA", mark.size, WHITE + (90,))
    silhouette.putalpha(alpha)
    x = W - MARK_SIZE // 2 - 60
    y = (H - MARK_SIZE) // 2 + 30
    canvas.paste(silhouette, (x, y), silhouette)


def measure(draw: ImageDraw.ImageDraw, text: str, font: ImageFont.FreeTypeFont) -> tuple[int, int]:
    box = draw.textbbox((0, 0), text, font=font)
    return box[2] - box[0], box[3] - box[1]


def main() -> None:
    canvas = Image.new("RGBA", (W, H), MAROON_DEEP + (255,))
    draw_faded_mark(canvas)
    draw = ImageDraw.Draw(canvas)

    brand = ImageFont.truetype(FONTS / "Raleway-Bold.ttf", 46)
    title = ImageFont.truetype(FONTS / "Raleway-Bold.ttf", 68)
    sub = ImageFont.truetype(FONTS / "Inter-SemiBold.ttf", 28)
    meta = ImageFont.truetype(FONTS / "Inter-Medium.ttf", 22)

    text_x = PAD_X
    gap_lg = 30
    gap_md = 20
    gap_sm = 12

    meta_text = "bulsu.tools"
    _, meta_h = measure(draw, meta_text, meta)
    _, sub_h = measure(draw, "Geary", sub)
    _, line1_h = measure(draw, "Free, open-source", title)
    _, line2_h = measure(draw, "tools for BulSU students", title)
    title_h = line1_h + line2_h
    _, brand_h = measure(draw, "bulsu.tools", brand)
    row_h = max(ICON_SIZE, brand_h)

    block_h = row_h + gap_lg + title_h + gap_md + sub_h + gap_lg + meta_h
    y = H - PAD_BOTTOM - block_h

    icon = load_icon(ICON_SIZE)
    canvas.paste(icon, (text_x, y + (row_h - ICON_SIZE) // 2), icon)

    word_x = text_x + ICON_SIZE + 18
    draw.text((word_x, y + (row_h - brand_h) // 2), "bulsu.tools", fill=WHITE, font=brand)
    word_w, _ = measure(draw, "bulsu.tools", brand)

    y += row_h + gap_lg
    draw.text((text_x, y), "Free, open-source", fill=WHITE, font=title)
    y += line1_h
    draw.text((text_x, y), "tools for BulSU students", fill=WHITE, font=title)
    y += line2_h + gap_md

    tools_text = "Geary  ·  GWA Calculator  ·  Room TBA"
    draw.text((text_x, y), tools_text, fill=CREAM, font=sub)
    y += sub_h + gap_lg

    draw.text((text_x, y), meta_text, fill=(255, 255, 255, 200), font=meta)

    _, title_w = measure(draw, "tools for BulSU students", title)
    assert max(title_w, word_x + word_w - text_x) <= TEXT_MAX + PAD_X

    canvas.convert("RGB").save(OUT, optimize=True)
    print(f"Wrote {OUT} ({W}x{H})")


if __name__ == "__main__":
    main()
