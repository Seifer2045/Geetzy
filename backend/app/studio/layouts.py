"""Layout presets (table `layouts`): where the user's photos go on the 1080×1920 (9:16) canvas."""
import time
from dataclasses import dataclass

from ..db import db, one

CANVAS = (1080, 1920)
_TTL = 60.0
_cache: dict[str, tuple[float, "Layout"]] = {}


@dataclass(frozen=True)
class Slot:
    x: float
    y: float
    w: float
    h: float
    radius: float = 0.05  # fraction of the shorter side, 0.5 = circle
    rotate: float = 0.0  # degrees, image templates only

    def px(self, size: tuple[int, int] = CANVAS) -> tuple[int, int, int, int]:
        """(left, top, width, height) in pixels."""
        W, H = size
        return round(self.x * W), round(self.y * H), round(self.w * W), round(self.h * H)

    def radius_px(self, size: tuple[int, int] = CANVAS) -> int:
        _, _, w, h = self.px(size)
        return round(min(w, h) * self.radius)


@dataclass(frozen=True)
class Layout:
    id: str
    name: str
    kind: str  # video | image
    slots: tuple[Slot, ...]

    @property
    def photo_count(self) -> int:
        return len(self.slots)


def parse_layout(row: dict) -> Layout:
    slots = tuple(
        Slot(x=float(s["x"]), y=float(s["y"]), w=float(s["w"]), h=float(s["h"]),
             radius=float(s.get("radius", 0.05)), rotate=float(s.get("rotate", 0)))
        for s in row["slots"]
    )
    return Layout(id=row["id"], name=row["name"], kind=row["kind"], slots=slots)


def get_layout(layout_id: str) -> Layout | None:
    hit = _cache.get(layout_id)
    if hit and time.monotonic() - hit[0] < _TTL:
        return hit[1]
    row = one(db().table("layouts").select("*").eq("id", layout_id).execute())
    if not row:
        return None
    layout = parse_layout(row)
    _cache[layout_id] = (time.monotonic(), layout)
    return layout
