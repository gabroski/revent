#!/usr/bin/env python3
"""Derive the site's logo assets from the full lockup.

Input:  public/logo.png   (the supplied lockup: R mark, wordmark, tagline)
Output: public/logo-mark.png   the R mark alone, trimmed
        public/icon.png        512x512 padded square for the favicon/PWA

Only the mark is used in the UI. The lockup's wordmark is near-black and
would be invisible against the site's plum-black background, so "Revent" is
set in the site's display face instead.

Run after replacing public/logo.png:  python3 scripts/build-logo-assets.py
"""

from pathlib import Path
import sys

from PIL import Image

PUBLIC = Path(__file__).resolve().parent.parent / "public"
SOURCE = PUBLIC / "logo.png"


def trim(image: Image.Image) -> Image.Image:
    """Crop away fully transparent margins."""
    bbox = image.getbbox()
    return image.crop(bbox) if bbox else image


def main() -> int:
    if not SOURCE.exists():
        print(f"missing {SOURCE} — save the logo there first", file=sys.stderr)
        return 1

    logo = Image.open(SOURCE).convert("RGBA")
    logo = trim(logo)
    width, height = logo.size

    # The lockup is mark over wordmark over tagline. The mark occupies roughly
    # the top 60%; trim() then tightens to the true edges, so the ratio only
    # needs to land inside the wordmark's whitespace, not on it exactly.
    mark = trim(logo.crop((0, 0, width, int(height * 0.60))))
    mark.save(PUBLIC / "logo-mark.png")
    print(f"logo-mark.png  {mark.size[0]}x{mark.size[1]}")

    # Square canvas with breathing room, so the icon is not cropped by
    # circular masks on iOS and Android.
    side = max(mark.size)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(mark, ((side - mark.size[0]) // 2, (side - mark.size[1]) // 2), mark)

    padded = Image.new("RGBA", (int(side * 1.18), int(side * 1.18)), (0, 0, 0, 0))
    offset = (padded.size[0] - side) // 2
    padded.paste(canvas, (offset, offset), canvas)

    padded.resize((512, 512), Image.LANCZOS).save(PUBLIC / "icon.png")
    print("icon.png       512x512")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
