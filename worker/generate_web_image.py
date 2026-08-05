#!/usr/bin/env python3
from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

from PIL import Image, ImageCms, ImageOps

# Master TIFFs are trusted local files and often exceed Pillow's default bomb limit.
Image.MAX_IMAGE_PIXELS = None


def source_profile(image: Image.Image) -> ImageCms.ImageCmsProfile | None:
    embedded = image.info.get("icc_profile")
    if not embedded:
        return None
    try:
        return ImageCms.ImageCmsProfile(io.BytesIO(embedded))
    except Exception as exc:
        print(f"Warning: ignoring unreadable ICC profile ({exc})", file=sys.stderr)
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

    try:
        srgb_profile = ImageCms.createProfile("sRGB")
        transform = ImageCms.buildTransformFromOpenProfiles(
            profile,
            srgb_profile,
            working.mode,
            "RGB",
            renderingIntent=ImageCms.Intent.PERCEPTUAL,
        )
        return ImageCms.applyTransform(working, transform).convert("RGB")
    except Exception as exc:
        print(f"Warning: ICC transform failed ({exc}); falling back to plain RGB", file=sys.stderr)
        return working.convert("RGB")


def shrink_for_target(image: Image.Image, max_edge: int) -> Image.Image:
    """
    Downsample huge masters before colour conversion / final thumbnail.

    Exhibition TIFFs are often 1–2GB+. Loading them at full resolution OOMs or
    times out admin thumbnail / web-image requests. Pillow's reduce() uses the
    decoder where possible and keeps peak memory far lower.
    """
    width, height = image.size
    longest = max(width, height)
    if longest <= max_edge * 2:
        return image

    # Decode at ~2× the target edge, then LANCZOS thumbnail for quality.
    factor = max(1, longest // (max_edge * 2))
    if factor <= 1:
        return image

    try:
        return image.reduce(factor)
    except Exception as exc:
        print(f"Warning: reduce({factor}) failed ({exc}); loading full resolution", file=sys.stderr)
        image.load()
        return image


def generate(input_path: Path, output_path: Path, max_edge: int, quality: int) -> None:
    if not input_path.is_file():
        raise FileNotFoundError(f"Master TIFF not found: {input_path}")

    with Image.open(input_path) as image:
        # Preserve ICC bytes before reduce/transpose replaces the image object.
        icc_profile = image.info.get("icc_profile")
        image = shrink_for_target(image, max_edge)
        if icc_profile and "icc_profile" not in image.info:
            image.info["icc_profile"] = icc_profile
        image = ImageOps.exif_transpose(image)
        if icc_profile and "icc_profile" not in image.info:
            image.info["icc_profile"] = icc_profile
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

    try:
        generate(args.input, args.output, args.max_edge, args.quality)
    except Exception as exc:
        print(f"generate_web_image failed: {exc}", file=sys.stderr)
        raise
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
