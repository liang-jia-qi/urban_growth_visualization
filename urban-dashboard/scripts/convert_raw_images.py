"""Convert per-city per-year height .tif rasters to PNGs for the web app.

Reads band 2 (height) from each .tif and colors it with a fixed 5-band
palette (0-30m in 6m steps, values above 30m clamped to the top band's
color), matching the discrete GEE-style legend used elsewhere for this
project rather than a per-image percentile stretch. Pixels with no
building (height == 0) render black. Writes a plain PNG per city/year.

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


# Fixed discrete palette — must stay in sync with HEIGHT_PALETTE /
# HEIGHT_MAX_VAL in src/components/CityRawCompare.jsx (the legend there is
# hand-authored to match, since it's cheaper than generating it from here).
HEIGHT_PALETTE = ["#4a90c4", "#24bd7a", "#ffe225", "#f68838", "#ee3e32"]
HEIGHT_MAX_VAL = 30

gee_cmap = colors.ListedColormap(HEIGHT_PALETTE)
gee_cmap.set_bad(color="black")
bounds = np.linspace(0, HEIGHT_MAX_VAL, len(HEIGHT_PALETTE) + 1)
height_norm = colors.BoundaryNorm(bounds, gee_cmap.N)


def render(image_path):
    with rasterio.open(image_path) as src:
        image = src.read(2)
        res_x_deg, res_y_deg = src.res

    # Mask on `image == 0` (no building) same as the reference script, but
    # also explicitly mask NaN nodata sentinels — a comparison with NaN is
    # always False, so `image == 0` alone lets NaNs slip through as "valid"
    # data. BoundaryNorm on a NaN then produces undefined bin assignment,
    # which previously blanked whole images (e.g. Cali_2016, Karachi_2023)
    # when they fed into a percentile calc; guard against the same failure
    # mode here even though this palette is boundary-based, not percentile.
    mask_bg = (image == 0) | np.isnan(image)

    rgba = gee_cmap(height_norm(np.nan_to_num(image, nan=0.0)))
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
        # NEAREST, not LANCZOS: the image is now a categorical 5-band palette
        # (+ black), and any smooth resampling filter blends adjacent bands
        # into invented intermediate colors that don't correspond to any
        # real height value, undermining the whole point of a discrete
        # legend. NEAREST keeps every pixel one of the exact palette colors.
        thumb.thumbnail((THUMB_SIZE, THUMB_SIZE), Image.NEAREST)
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
