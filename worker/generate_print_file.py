#!/usr/bin/env python3
"""Generate a Pixel Perfect–ready TIFF from a master (admin / worker shared path)."""

from __future__ import annotations

import argparse
import shutil
import sys
import tempfile
from dataclasses import dataclass
from pathlib import Path

from PIL import Image

# Masters are trusted local files and often exceed Pillow's default bomb limit.
Image.MAX_IMAGE_PIXELS = None

# Import after MAX_IMAGE_PIXELS so fulfilment_worker sees the raised limit too.
from fulfilment_worker import ImageProcessor, slugify  # noqa: E402


@dataclass(frozen=True)
class PrintOnlyConfig:
    print_output_profile_path: Path
    temp_dir: Path


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate a lab-ready print TIFF from a master.")
    parser.add_argument("--master", type=Path, required=True, help="Absolute path to master TIFF")
    parser.add_argument("--output", type=Path, required=True, help="Absolute path for output TIFF")
    parser.add_argument("--slug", required=True)
    parser.add_argument("--width-mm", type=float, required=True)
    parser.add_argument("--height-mm", type=float, required=True)
    parser.add_argument("--border-mm", type=float, default=0)
    parser.add_argument("--print-dpi", type=int, default=300)
    parser.add_argument("--fit-mode", choices=("custom_size", "cover_crop"), default="custom_size")
    parser.add_argument("--crop-offset", type=float, default=0)
    parser.add_argument(
        "--output-profile",
        type=Path,
        required=True,
        help="Adobe RGB (or lab) ICC profile path",
    )
    parser.add_argument(
        "--temp-dir",
        type=Path,
        default=Path(tempfile.gettempdir()) / "exhibition-admin-print",
    )
    args = parser.parse_args()

    if not args.master.is_file():
        print(f"Master TIFF not found: {args.master}", file=sys.stderr)
        return 1
    if args.width_mm <= 0 or args.height_mm <= 0:
        print("width-mm and height-mm must be positive.", file=sys.stderr)
        return 1

    config = PrintOnlyConfig(
        print_output_profile_path=args.output_profile.expanduser().resolve(),
        temp_dir=args.temp_dir.expanduser().resolve(),
    )
    config.temp_dir.mkdir(parents=True, exist_ok=True)

    item = {
        "order_number": "admin",
        "slug": slugify(args.slug),
        "master_filename": args.master.name,
        "width_mm": args.width_mm,
        "height_mm": args.height_mm,
        "border_mm": args.border_mm,
        "print_dpi": args.print_dpi,
        "fit_mode": args.fit_mode,
        "crop_offset": args.crop_offset,
    }

    processor = ImageProcessor(config)  # type: ignore[arg-type]
    temp_file = processor.generate_print_file(args.master.expanduser().resolve(), item)

    output = args.output.expanduser().resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(temp_file, output)
    try:
        temp_file.unlink(missing_ok=True)
    except OSError:
        pass

    print(str(output))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
