"""Face detection for photos (OpenCV YuNet, a 230 KB ONNX model in app/assets). The crop itself lives in framing.py.

Never raises: no face, no OpenCV or any error = an empty list, and the caller uses the smart crop instead.
"""
import logging
from pathlib import Path

from PIL import Image

log = logging.getLogger("geetzy.faces")

MODEL = Path(__file__).resolve().parent.parent / "assets" / "face_detection_yunet_2023mar.onnx"
DETECT_SIDE = 640      # faces are searched on a copy this big (fast); the crop is cut from the full-size photo
MIN_SCORE = 0.6


def find_faces(img: Image.Image) -> list[tuple[float, float, float, float]]:
    """Faces as (x, y, w, h) in the pixels of `img`. Empty list when there is none or detection is not available."""
    try:
        import cv2  # noqa: PLC0415 — heavy import, only when a photo is processed
        import numpy as np  # noqa: PLC0415

        scale = min(1.0, DETECT_SIDE / max(img.size))
        small = img.convert("RGB").resize((max(1, round(img.width * scale)), max(1, round(img.height * scale))), Image.LANCZOS)
        bgr = cv2.cvtColor(np.asarray(small), cv2.COLOR_RGB2BGR)
        detector = cv2.FaceDetectorYN.create(str(MODEL), "", (small.width, small.height), MIN_SCORE, 0.3, 5000)
        _, found = detector.detect(bgr)
        if found is None:
            return []
        return [(float(r[0]) / scale, float(r[1]) / scale, float(r[2]) / scale, float(r[3]) / scale) for r in found if r[2] > 0 and r[3] > 0]
    except Exception:  # noqa: BLE001 — a photo must never fail because of face detection
        log.exception("face detection failed")
        return []
