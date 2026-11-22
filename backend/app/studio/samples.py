"""Built-in sample photos + names for template previews (so previews need no uploaded assets)."""
from PIL import Image, ImageDraw, ImageOps

from .imaging import to_bytes

SAMPLE_NAME = "Priya"
SAMPLE_SENDER = "Rahul"
SAMPLE_FUN_FACT = "loves chai and old Hindi songs"

PALETTES = [
    ((255, 133, 162), (110, 60, 190)),
    ((255, 190, 90), (210, 70, 120)),
    ((110, 200, 255), (70, 70, 200)),
    ((120, 230, 180), (30, 120, 150)),
    ((255, 160, 120), (150, 50, 160)),
    ((200, 150, 255), (60, 80, 210)),
]
SIZE = (900, 1200)


def sample_photo(i: int) -> bytes:
    """A soft gradient with a simple person silhouette. Different colours per index."""
    top, bottom = PALETTES[i % len(PALETTES)]
    grad = Image.linear_gradient("L").resize(SIZE)
    img = ImageOps.colorize(grad, black=top, white=bottom).convert("RGBA")
    w, h = SIZE
    layer = Image.new("RGBA", SIZE, (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    fill = (255, 255, 255, 120)
    d.ellipse((w * 0.33, h * 0.22, w * 0.67, h * 0.50), fill=fill)  # head
    d.ellipse((w * 0.14, h * 0.55, w * 0.86, h * 1.25), fill=fill)  # shoulders
    return to_bytes(Image.alpha_composite(img, layer).convert("RGB"), "JPEG", quality=88)


def sample_photos(n: int) -> list[bytes]:
    return [sample_photo(i) for i in range(max(1, n))]
