"""Bake subtle material identity into KayKit palette atlases without moving UV regions."""

from __future__ import annotations

import argparse
import colorsys
import math
from pathlib import Path

from PIL import Image, ImageChops, ImageFilter


ROLE_CLOTH_TINTS = {
    "guard": (0.88, 0.98, 1.12),
    "vendor": (0.86, 1.05, 0.91),
    "smith": (0.92, 0.94, 0.96),
    "healer": (0.92, 1.03, 1.08),
    "resident": (0.82, 0.96, 0.87),
}


def material_kind(red: int, green: int, blue: int) -> str:
    hue, saturation, value = colorsys.rgb_to_hsv(red / 255, green / 255, blue / 255)
    if red > 170 and red > green > blue and value > 0.76 and saturation < 0.38:
        return "skin"
    if saturation < 0.18 or (0.5 < hue < 0.7 and saturation < 0.34):
        return "metal"
    if (hue < 0.12 or hue > 0.96) and saturation > 0.28 and value < 0.82:
        return "leather"
    return "cloth"


def clamp(value: float) -> int:
    return round(max(0, min(255, value)))


def enhance(source_path: Path, detail_path: Path, output_path: Path, material_path: Path, role: str) -> None:
    source = Image.open(source_path).convert("RGBA")
    detail = Image.open(detail_path).convert("L").resize(source.size, Image.Resampling.LANCZOS)
    blurred = detail.filter(ImageFilter.GaussianBlur(8))
    high_pass = ImageChops.subtract(detail, blurred, scale=1, offset=128)
    source_pixels = source.load()
    detail_pixels = high_pass.load()
    width, height = source.size
    cloth_tint = ROLE_CLOTH_TINTS[role]

    result = Image.new("RGBA", source.size)
    material = Image.new("RGB", source.size)
    result_pixels = result.load()
    material_pixels = material.load()
    for y in range(height):
        for x in range(width):
            red, green, blue, alpha = source_pixels[x, y]
            kind = material_kind(red, green, blue)
            organic = max(-0.09, min(0.09, (detail_pixels[x, y] - 128) / 255))
            if kind == "cloth":
                # A very fine diagonal weave remains readable without shimmering at game distance.
                weave = (math.sin((x + y) * math.pi / 3) + math.sin((x - y) * math.pi / 4)) * 0.006
                variation = organic * 0.42 + weave
                tint = cloth_tint
                roughness, metallic = 224, 0
            elif kind == "leather":
                pores = math.sin(x * 0.17 + math.sin(y * 0.09)) * 0.006
                variation = organic * 0.58 + pores
                tint = (1.04, 0.97, 0.91)
                roughness, metallic = 190, 0
            elif kind == "metal":
                brushed = math.sin(y * 0.42) * 0.004
                variation = organic * 0.34 + brushed
                tint = (0.96, 1.0, 1.04) if role == "guard" else (0.99, 1.0, 1.01)
                roughness, metallic = (112, 205) if role == "guard" else (135, 165)
            else:
                variation = organic * 0.18
                tint = (1.015, 0.995, 0.98)
                roughness, metallic = 205, 0

            multiplier = 1 + variation
            result_pixels[x, y] = (
                clamp(red * tint[0] * multiplier),
                clamp(green * tint[1] * multiplier),
                clamp(blue * tint[2] * multiplier),
                alpha,
            )
            # glTF metallic-roughness: G = roughness, B = metalness. R is unused.
            material_pixels[x, y] = (255, roughness, metallic)

    # The low-poly models occupy a small part of the screen; 512px keeps the new detail while
    # cutting each texture's GPU allocation to one quarter of the original 1024px palette.
    result.resize((512, 512), Image.Resampling.LANCZOS).save(output_path, optimize=True, compress_level=9)
    material.resize((512, 512), Image.Resampling.NEAREST).save(material_path, optimize=True, compress_level=9)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("source", type=Path)
    parser.add_argument("detail", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("material", type=Path)
    parser.add_argument("role", choices=sorted(ROLE_CLOTH_TINTS))
    args = parser.parse_args()
    enhance(args.source, args.detail, args.output, args.material, args.role)


if __name__ == "__main__":
    main()
