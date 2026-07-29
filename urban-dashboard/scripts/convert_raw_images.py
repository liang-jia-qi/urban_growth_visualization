"""Convert per-city per-year height .tif rasters to PNGs for the web app.

Reads band 2 (height) from each .tif, applies the turbo colormap with
black-mapped zero and 2nd/98th percentile normalization (matching the
original matplotlib visualization), and writes a plain PNG per city/year.

Also writes public/data/image_meta.json with each city's physical extent
(km, accounting for latitude-dependent longitude shrinkage), so the web app
can draw remoteness rings (r = 1000 * D_km / sqrt(population)) as an SVG
overlay at render time rather than baking them into the image.

Usage: python scripts/convert_raw_images.py
"""

import csv
import glob
import json
import math
import os
import re

import numpy as np
import rasterio
from matplotlib import colors
from PIL import Image

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
DASHBOARD_DIR = os.path.dirname(SCRIPT_DIR)  # .../urban-dashboard

SRC_DIR = r"C:\Research_Local\Urban_Growth\Python_codes\images"
OUT_DIR = os.path.join(DASHBOARD_DIR, "public", "data", "raw_images")
CITIES_CSV = os.path.join(DASHBOARD_DIR, "public", "data", "CitiesDB_new.csv")
META_OUT = os.path.join(DASHBOARD_DIR, "public", "data", "image_meta.json")
THUMB_SIZE = 900  # output px, downsized from the 4001x4001 source

os.makedirs(OUT_DIR, exist_ok=True)

KM_PER_DEG_LAT = 111.32


def load_city_lats():
    lats = {}
    with open(CITIES_CSV, newline="", encoding="utf-8") as f:
        for row in csv.DictReader(f):
            try:
                lats[row["Name"]] = float(row["Cy(lat)"])
            except (KeyError, ValueError):
                pass
    return lats


cmap = __import__("matplotlib.pyplot", fromlist=["colormaps"]).colormaps.get_cmap("turbo")
newcolors = cmap(np.linspace(0, 1, 256))
newcolors[0] = [0, 0, 0, 1]
custom_cmap = colors.ListedColormap(newcolors)


def render(image_path):
    with rasterio.open(image_path) as src:
        image = src.read(2)
        res_x_deg, res_y_deg = src.res

    # `~(image >= 0.5)` (not `image == 0`) so NaN nodata sentinels are also
    # masked out — any comparison with NaN is False, so NaN pixels land in
    # the mask automatically. Feeding raw `image == 0` masking into
    # np.percentile let stray NaNs poison vmin/vmax to NaN, blanking the
    # entire image (e.g. Cali_2016, Karachi_2023) even though NaNs were a
    # tiny fraction of pixels.
    mask_bg = ~(image >= 0.5)
    valid = image[~mask_bg]
    if valid.size == 0:
        vmin, vmax = 0, 1
    else:
        vmin = np.percentile(valid, 2)
        vmax = np.percentile(valid, 98)
        if vmax <= vmin:
            vmax = vmin + 1

    norm = colors.Normalize(vmin=vmin, vmax=vmax)
    rgba = custom_cmap(norm(np.nan_to_num(image, nan=0.0)))
    rgba[mask_bg] = [0, 0, 0, 1]
    rgb = (rgba[:, :, :3] * 255).astype(np.uint8)
    height_px, width_px = image.shape
    return Image.fromarray(rgb, mode="RGB"), res_x_deg, res_y_deg, width_px, height_px


def main():
    tifs = sorted(glob.glob(os.path.join(SRC_DIR, "*.tif")))
    print(f"Found {len(tifs)} tif files")
    lats = load_city_lats()
    meta = {}

    for idx, path in enumerate(tifs):
        base = os.path.splitext(os.path.basename(path))[0]  # "City_2016"
        m = re.match(r"^(.*)_(\d{4})$", base)
        if not m:
            print(f"skip (no year match): {base}")
            continue
        city, year = m.group(1), m.group(2)
        lat = lats.get(city)
        if lat is None:
            print(f"warning: no lat for '{city}' in CitiesDB, using 0")
            lat = 0.0

        img, res_x, res_y, width_px, height_px = render(path)

        thumb = img.copy()
        thumb.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.LANCZOS)
        thumb.save(os.path.join(OUT_DIR, f"{city}_{year}.png"))

        if city not in meta:
            km_per_px_x = res_x * KM_PER_DEG_LAT * math.cos(math.radians(lat))
            km_per_px_y = res_y * KM_PER_DEG_LAT
            meta[city] = {
                "total_km_x": km_per_px_x * width_px,
                "total_km_y": km_per_px_y * height_px,
            }

        if (idx + 1) % 20 == 0:
            print(f"{idx + 1}/{len(tifs)} done")

    with open(META_OUT, "w", encoding="utf-8") as f:
        json.dump(meta, f, indent=2)

    print("Done. Images ->", OUT_DIR)
    print("Metadata ->", META_OUT)


if __name__ == "__main__":
    main()
