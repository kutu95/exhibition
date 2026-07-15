#!/usr/bin/env python3
from __future__ import annotations

import argparse
import io
from pathlib import Path

from PIL import Image, ImageCms, ImageOps


def source_profile(image: Image.Image) -> ImageCms.ImageCmsProfile | None:
    embedded = image.info.get("icc_profile")
    if embedded:
        return ImageCms.ImageCmsProfile(io.BytesIO(embedded))
    return None


def flatten_alpha(image: Image.Image) -> Image.Image:
    if image.mode in ("RGBA", "LA") or (image.mode == "P" and "transparency" in image.info):
        rgba = image.convert("RGBA")
        background = Image.new("RGBA", rgba.size, (255, 255, 255, 255))
        background.alpha_composite(rgba)
        return background.convert("RGB")
    return image


def convert_to_srgb(image: Image.Image) -> Image.Image:
    working = flatten_alpha(image)
    if working.mode not in ("RGB", "CMYK", "LAB"):
        working = working.convert("RGB")

    profile = source_profile(image)
    if not profile:
        return working.convert("RGB")

    srgb_profile = ImageCms.createProfile("sRGB")
    transform = ImageCms.buildTransformFromOpenProfiles(
        profile,
        srgb_profile,
        working.mode,
        "RGB",
        renderingIntent=ImageCms.Intent.PERCEPTUAL,
    )
    return ImageCms.applyTransform(working, transform).convert("RGB")


def generate(input_path: Path, output_path: Path, max_edge: int, quality: int) -> None:
    with Image.open(input_path) as image:
        image = ImageOps.exif_transpose(image)
        web_image = convert_to_srgb(image)
        web_image.thumbnail((max_edge, max_edge), Image.Resampling.LANCZOS)
        output_path.parent.mkdir(parents=True, exist_ok=True)
        web_image.save(output_path, "JPEG", quality=quality, optimize=True, progressive=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a public web JPEG from a master TIFF.")
    parser.add_argument("input", type=Path)
    parser.add_argument("output", type=Path)
    parser.add_argument("--max-edge", type=int, default=2400)
    parser.add_argument("--quality", type=int, default=90)
    args = parser.parse_args()

    generate(args.input, args.output, args.max_edge, args.quality)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
