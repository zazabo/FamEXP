"""Generate the PWA icons (minimal euro mark on a rounded tile). Run: python3 scripts/make-icons.py"""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

OUT = Path(__file__).resolve().parent.parent / "public" / "icons"
OUT.mkdir(parents=True, exist_ok=True)
BG = (31, 107, 92)      # deep teal (matches theme primary)
FG = (247, 247, 245)
FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"


def tile(size: int, radius_ratio: float, glyph_ratio: float, full_bleed: bool = False) -> Image.Image:
    scale = 4
    s = size * scale
    img = Image.new("RGBA", (s, s), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    if full_bleed:
        d.rectangle([0, 0, s, s], fill=BG)
    else:
        d.rounded_rectangle([0, 0, s - 1, s - 1], radius=int(s * radius_ratio), fill=BG)
    font = ImageFont.truetype(FONT, int(s * glyph_ratio))
    d.text((s / 2, s / 2), "€", font=font, fill=FG, anchor="mm")
    return img.resize((size, size), Image.LANCZOS)


tile(192, 0.22, 0.58).save(OUT / "icon-192.png")
tile(512, 0.22, 0.58).save(OUT / "icon-512.png")
tile(512, 0, 0.42, full_bleed=True).save(OUT / "icon-maskable-512.png")
tile(180, 0, 0.56, full_bleed=True).convert("RGB").save(OUT / "apple-touch-icon.png")
tile(64, 0.22, 0.6).save(OUT / "favicon.png")
print("icons written to", OUT)
