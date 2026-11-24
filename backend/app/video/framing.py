"""Crop a user photo to ONE frame of the video, with the person placed well. Pure functions, no network.

The video shows a photo inside a frame (a full screen, a box in the template's design). JSON2Video's
"cover" would crop around the picture's CENTRE, so a face near an edge is lost. Here we cut the exact aspect ratio ourselves:

  faces found  -> the faces together (plus some room for hair) sit at 50% across and 40% from the top of the window,
                  as far as the photo's edges allow (never outside the photo, never cropped closer than the largest window)
  no face      -> "smart crop": the window with the most edges and contrast (the busiest, sharpest part), with a mild pull to the middle
The result has exactly the frame's aspect, so "cover" crops nothing more and this placement survives.
"""
import io

from PIL import Image

Face = tuple[float, float, float, float]   # x, y, w, h in photo pixels
Window = tuple[int, int, int, int]         # left, top, right, bottom in photo pixels

ANCHOR_X, ANCHOR_Y = 0.5, 0.40  # where the head sits in the frame (slightly above the middle, like a portrait)
HEAD_UP = 0.35                  # a face box stops at the forehead: add this share of the face height for hair
CENTRE_PULL = 0.25              # smart crop: how much a window far from the middle is penalised (0 = none)
ENERGY_SIDE = 96                # the smart crop looks at a copy this wide/tall
JPEG_QUALITY = 92


def largest_window(photo: tuple[int, int], aspect: float) -> tuple[float, float]:
    """Size of the biggest window with this aspect (w / h) that fits inside the photo."""
    pw, ph = photo
    if pw / ph > aspect:
        return ph * aspect, float(ph)
    return float(pw), pw / aspect


def _clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def face_window(photo: tuple[int, int], aspect: float, faces: list[Face]) -> Window:
    """The largest window of this aspect, moved so the faces (all of them) sit at the anchor, clamped to the photo."""
    pw, ph = photo
    ww, wh = largest_window(photo, aspect)
    left = min(f[0] for f in faces)
    right = max(f[0] + f[2] for f in faces)
    bottom = max(f[1] + f[3] for f in faces)
    head_top = min(f[1] - HEAD_UP * f[3] for f in faces)
    focus_x, focus_y = (left + right) / 2, (max(0.0, head_top) + bottom) / 2
    x0 = _clamp(focus_x - ANCHOR_X * ww, 0, pw - ww)
    y0 = _clamp(focus_y - ANCHOR_Y * wh, 0, ph - wh)
    return round(x0), round(y0), round(x0 + ww), round(y0 + wh)


def _energy(img: Image.Image):
    """Edge strength per pixel of a small grey copy (numpy array). Imported lazily: numpy comes with OpenCV."""
    import numpy as np  # noqa: PLC0415

    scale = ENERGY_SIDE / max(img.size)
    small = img.convert("L").resize((max(2, round(img.width * scale)), max(2, round(img.height * scale))), Image.BILINEAR)
    a = np.asarray(small, dtype="float32")
    gx = np.abs(np.diff(a, axis=1, prepend=a[:, :1]))
    gy = np.abs(np.diff(a, axis=0, prepend=a[:1, :]))
    return gx + gy, small.size


def smart_window(img: Image.Image, aspect: float) -> Window:
    """No face: slide the largest window along the one free axis and keep the busiest one, with a mild pull to the middle."""
    import numpy as np  # noqa: PLC0415

    pw, ph = img.size
    ww, wh = largest_window(img.size, aspect)
    if abs(ww - pw) < 1 and abs(wh - ph) < 1:
        return 0, 0, pw, ph
    energy, (sw, sh) = _energy(img)
    horizontal = ww < pw - 1                       # free axis = x when the window is narrower than the photo
    profile = energy.sum(axis=0 if horizontal else 1)
    total_len = sw if horizontal else sh
    win_len = max(1, round((ww / pw if horizontal else wh / ph) * total_len))
    csum = np.concatenate([[0.0], np.cumsum(profile)])
    best, best_pos = -1.0, 0
    last = max(0, total_len - win_len)
    for pos in sorted(range(last + 1), key=lambda q: abs(q + win_len / 2 - total_len / 2)):  # ties go to the most central window
        score = csum[pos + win_len] - csum[pos]
        middle = (pos + win_len / 2) / total_len
        score *= 1 - CENTRE_PULL * abs(middle - 0.5) * 2
        if score > best:
            best, best_pos = score, pos
    frac = best_pos / total_len
    if horizontal:
        x0 = _clamp(frac * pw, 0, pw - ww)
        return round(x0), 0, round(x0 + ww), ph
    y0 = _clamp(frac * ph, 0, ph - wh)
    return 0, round(y0), pw, round(y0 + wh)


def plan_window(img: Image.Image, frame: tuple[int, int], faces: list[Face]) -> Window:
    aspect = frame[0] / frame[1]
    return face_window(img.size, aspect, faces) if faces else smart_window(img, aspect)


def render_variant(img: Image.Image, frame: tuple[int, int], faces: list[Face]) -> bytes:
    """JPEG of this photo cut for one frame. Never larger than its own pixels (no fake upscaling; JSON2Video scales the rest)."""
    box = plan_window(img, frame, faces)
    crop = img.crop(box)
    scale = min(1.0, crop.width / frame[0])
    size = (max(2, round(frame[0] * scale)), max(2, round(frame[1] * scale)))
    if crop.size != size:
        crop = crop.resize(size, Image.LANCZOS)
    out = io.BytesIO()
    crop.convert("RGB").save(out, "JPEG", quality=JPEG_QUALITY, subsampling=0, optimize=False, progressive=False)
    return out.getvalue()


def plain_jpeg(img: Image.Image, max_side: int = 1920) -> bytes:
    """A clean, upright, baseline JPEG of the whole photo (the safe fallback when a frame cannot be cut)."""
    copy = img.convert("RGB")
    copy.thumbnail((max_side, max_side), Image.LANCZOS)
    out = io.BytesIO()
    copy.save(out, "JPEG", quality=JPEG_QUALITY, subsampling=0, progressive=False)
    return out.getvalue()
