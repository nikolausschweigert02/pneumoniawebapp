from __future__ import annotations

import numpy as np
from PIL import Image, ImageOps


def assess_image_quality(image: Image.Image) -> list[str]:
    """Return non-blocking quality warnings for uploaded chest X-rays."""
    warnings: list[str] = []
    oriented = ImageOps.exif_transpose(image)
    width, height = oriented.size
    short_edge = min(width, height)

    if short_edge < 224:
        warnings.append(
            f"Image resolution is low ({width}×{height}px). Results may be less reliable below 224px."
        )

    aspect_ratio = max(width, height) / max(min(width, height), 1)
    if aspect_ratio > 2.5:
        warnings.append("Unusual aspect ratio detected. Check orientation and cropping before relying on the result.")

    gray = np.asarray(ImageOps.grayscale(oriented.resize((224, 224))), dtype=np.float32) / 255.0
    contrast = float(gray.std())
    if contrast < 0.08:
        warnings.append("Very low contrast detected. The image may be underexposed or unsuitable for screening.")
    elif contrast > 0.42:
        warnings.append("Very high contrast detected. Overexposure or artifacts may affect model scores.")

    if width < 400 or height < 400:
        warnings.append("Small image size may reduce Grad-CAM localization quality.")

    return warnings
