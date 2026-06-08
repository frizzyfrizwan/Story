"""
Fruit ripeness training data downloader.
Downloads images from Bing Image Search into folders named {fruit}_{ripeness},
which is exactly what Create ML expects for image classification.

Usage:
    python3 download.py              # download all fruits
    python3 download.py watermelon   # download one fruit only
"""

import os
import sys
import time
from icrawler.builtin import BingImageCrawler

# ── Configuration ────────────────────────────────────────────────────────────

IMAGES_PER_CLASS = 200   # Bing caps at ~1000; 200 is fast and plenty for Create ML
OUTPUT_DIR = os.path.dirname(os.path.abspath(__file__))

# Each entry: (folder_label, bing_search_query)
# Queries are tuned to return clear, consistent fruit photos.
CLASSES = [
    # ── Watermelon ────────────────────────────────
    ("watermelon_unripe",    "unripe watermelon green hard fruit"),
    ("watermelon_ripe",      "ripe watermelon ready to eat whole fruit"),
    ("watermelon_overripe",  "overripe watermelon soft dark fruit"),

    # ── Apple ─────────────────────────────────────
    ("apple_unripe",         "unripe green apple hard fruit"),
    ("apple_ripe",           "ripe red apple fresh fruit"),
    ("apple_overripe",       "overripe apple wrinkled soft brown spots fruit"),

    # ── Banana ────────────────────────────────────
    ("banana_unripe",        "unripe green banana fruit"),
    ("banana_ripe",          "ripe yellow banana fresh fruit"),
    ("banana_overripe",      "overripe banana brown spots mushy fruit"),

    # ── Orange ────────────────────────────────────
    ("orange_unripe",        "unripe green orange citrus fruit"),
    ("orange_ripe",          "ripe orange fresh juicy citrus fruit"),
    ("orange_overripe",      "overripe orange dry wrinkled citrus fruit"),

    # ── Mango ─────────────────────────────────────
    ("mango_unripe",         "unripe green mango hard fruit"),
    ("mango_ripe",           "ripe yellow orange mango fresh fruit"),
    ("mango_overripe",       "overripe mango dark soft fruit"),

    # ── Strawberry ────────────────────────────────
    ("strawberry_unripe",    "unripe white pink strawberry fruit"),
    ("strawberry_ripe",      "ripe red strawberry fresh fruit"),
    ("strawberry_overripe",  "overripe mushy dark red strawberry fruit"),

    # ── Grape ─────────────────────────────────────
    ("grape_unripe",         "unripe green hard grape fruit"),
    ("grape_ripe",           "ripe purple grape cluster fresh fruit"),
    ("grape_overripe",       "overripe shriveled grape raisin fruit"),

    # ── Pear ──────────────────────────────────────
    ("pear_unripe",          "unripe hard green pear fruit"),
    ("pear_ripe",            "ripe golden yellow pear fresh fruit"),
    ("pear_overripe",        "overripe soft brown pear fruit"),

    # ── Peach ─────────────────────────────────────
    ("peach_unripe",         "unripe hard pale peach fruit"),
    ("peach_ripe",           "ripe peach fresh orange pink fruit"),
    ("peach_overripe",       "overripe soft wrinkled peach fruit"),

    # ── Kiwi ──────────────────────────────────────
    ("kiwi_unripe",          "unripe hard kiwi fruit"),
    ("kiwi_ripe",            "ripe kiwifruit fresh"),
    ("kiwi_overripe",        "overripe mushy kiwi fruit"),

    # ── Avocado ───────────────────────────────────
    ("avocado_unripe",       "unripe bright green hard avocado fruit"),
    ("avocado_ripe",         "ripe dark green avocado ready to eat fruit"),
    ("avocado_overripe",     "overripe black soft avocado fruit"),

    # ── Pineapple ─────────────────────────────────
    ("pineapple_unripe",     "unripe green pineapple fruit"),
    ("pineapple_ripe",       "ripe golden yellow pineapple fresh fruit"),
    ("pineapple_overripe",   "overripe brown soft pineapple fruit"),

    # ── Lemon ─────────────────────────────────────
    ("lemon_unripe",         "unripe green lemon citrus fruit"),
    ("lemon_ripe",           "ripe bright yellow lemon fresh fruit"),
    ("lemon_overripe",       "overripe wrinkled yellow lemon fruit"),

    # ── Cherry ────────────────────────────────────
    ("cherry_unripe",        "unripe pale pink cherry fruit"),
    ("cherry_ripe",          "ripe deep red cherry fresh fruit"),
    ("cherry_overripe",      "overripe dark soft cherry fruit"),

    # ── Plum ──────────────────────────────────────
    ("plum_unripe",          "unripe hard green plum fruit"),
    ("plum_ripe",            "ripe dark purple plum fresh fruit"),
    ("plum_overripe",        "overripe soft wrinkled plum fruit"),

    # ── Blueberry ─────────────────────────────────
    ("blueberry_unripe",     "unripe green pink blueberry fruit"),
    ("blueberry_ripe",       "ripe deep blue blueberry fresh fruit"),
    ("blueberry_overripe",   "overripe shriveled blueberry fruit"),

    # ── Raspberry ─────────────────────────────────
    ("raspberry_unripe",     "unripe pale pink raspberry fruit"),
    ("raspberry_ripe",       "ripe bright red raspberry fresh fruit"),
    ("raspberry_overripe",   "overripe mushy dark red raspberry fruit"),

    # ── Tomato ────────────────────────────────────
    ("tomato_unripe",        "unripe green tomato hard fruit"),
    ("tomato_ripe",          "ripe red tomato fresh fruit"),
    ("tomato_overripe",      "overripe soft wrinkled tomato fruit"),

    # ── Papaya ────────────────────────────────────
    ("papaya_unripe",        "unripe green papaya fruit"),
    ("papaya_ripe",          "ripe yellow orange papaya fresh fruit"),
    ("papaya_overripe",      "overripe dark soft papaya fruit"),

    # ── Pomegranate ───────────────────────────────
    ("pomegranate_unripe",   "unripe hard pink pomegranate fruit"),
    ("pomegranate_ripe",     "ripe deep red pomegranate fresh fruit"),
    ("pomegranate_overripe", "overripe cracked pomegranate fruit"),

    # ── Fig ───────────────────────────────────────
    ("fig_unripe",           "unripe hard green fig fruit"),
    ("fig_ripe",             "ripe dark purple fig fresh fruit"),
    ("fig_overripe",         "overripe split fig fruit"),

    # ── Apricot ───────────────────────────────────
    ("apricot_unripe",       "unripe hard pale apricot fruit"),
    ("apricot_ripe",         "ripe golden orange apricot fresh fruit"),
    ("apricot_overripe",     "overripe soft wrinkled apricot fruit"),

    # ── Cantaloupe ────────────────────────────────
    ("cantaloupe_unripe",    "unripe green cantaloupe melon fruit"),
    ("cantaloupe_ripe",      "ripe cantaloupe melon fresh fruit"),
    ("cantaloupe_overripe",  "overripe soft cantaloupe melon fruit"),

    # ── Coconut ───────────────────────────────────
    ("coconut_unripe",       "young green coconut fruit"),
    ("coconut_ripe",         "mature brown coconut fruit"),

    # ── Dragonfruit ───────────────────────────────
    ("dragonfruit_unripe",   "unripe green pink dragon fruit pitaya"),
    ("dragonfruit_ripe",     "ripe bright pink dragon fruit pitaya"),
    ("dragonfruit_overripe", "overripe brown soft dragon fruit pitaya"),

    # ── Guava ─────────────────────────────────────
    ("guava_unripe",         "unripe hard green guava fruit"),
    ("guava_ripe",           "ripe yellow guava fresh fruit"),
    ("guava_overripe",       "overripe soft brown guava fruit"),

    # ── Lychee ────────────────────────────────────
    ("lychee_unripe",        "unripe green lychee litchi fruit"),
    ("lychee_ripe",          "ripe pink red lychee fresh fruit"),
    ("lychee_overripe",      "overripe brown dried lychee fruit"),
]

# ── Helpers ───────────────────────────────────────────────────────────────────

def count_images(folder):
    if not os.path.exists(folder):
        return 0
    return len([f for f in os.listdir(folder)
                if f.lower().endswith(('.jpg', '.jpeg', '.png', '.webp'))])

def download_class(label, query, target_count):
    folder = os.path.join(OUTPUT_DIR, label)
    existing = count_images(folder)

    if existing >= target_count:
        print(f"  ✓ {label} already has {existing} images — skipping")
        return existing

    need = target_count - existing
    print(f"  ↓ {label}: downloading {need} images (have {existing})")

    os.makedirs(folder, exist_ok=True)

    crawler = BingImageCrawler(
        storage={"root_dir": folder},
        downloader_threads=4,
        parser_threads=2,
    )
    crawler.crawl(
        keyword=query,
        max_num=need,
        min_size=(150, 150),
        file_idx_offset=existing,
    )

    after = count_images(folder)
    print(f"     → {after} images total in {label}")
    return after

# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    filter_fruit = sys.argv[1].lower() if len(sys.argv) > 1 else None

    classes = [c for c in CLASSES
               if filter_fruit is None or c[0].startswith(filter_fruit)]

    if not classes:
        print(f"No classes matched '{filter_fruit}'")
        sys.exit(1)

    print(f"\n🍎 Fruit Ripeness Training Data Downloader")
    print(f"   Classes to process : {len(classes)}")
    print(f"   Target per class   : {IMAGES_PER_CLASS}")
    print(f"   Output directory   : {OUTPUT_DIR}\n")

    total_downloaded = 0
    for i, (label, query) in enumerate(classes, 1):
        print(f"[{i}/{len(classes)}] {label}")
        count = download_class(label, query, IMAGES_PER_CLASS)
        total_downloaded += count
        time.sleep(0.5)   # be polite to the server

    print(f"\n✅ Done! Total images on disk: {total_downloaded}")
    print(f"   Folder: {OUTPUT_DIR}")
    print(f"\nNext step: open Create ML, create an Image Classifier project,")
    print(f"and drag the TrainingData folder in as your training set.")

if __name__ == "__main__":
    main()
