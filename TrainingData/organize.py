"""
Reorganizes the Fruits-360 dataset into {fruit}_{ripeness} folders
that Create ML can consume directly.

Fruits-360 is mostly "ripe" shots on white backgrounds, so most
folders map to {fruit}_ripe.  The few ripeness-labelled exceptions
(Avocado / Avocado ripe, Tomato not Ripened, Tomato Maroon) are
split into unripe / ripe / overripe as appropriate.

After running this script the TrainingData/ folder will contain
everything needed to train in Create ML.
"""

import os
import shutil

FRUITS360 = "/home/user/Story/Fruits360/Training"
OUT       = "/home/user/Story/TrainingData"

# ─── Mapping: (source folder in Fruits360, destination label) ────────────────
# Combine multiple apple varieties → apple_ripe for maximum data diversity.
# Green-skinned varieties (Granny Smith, Golden) are still ripe fruit so they
# stay in apple_ripe — the model will learn shape, not just colour.

MAPPINGS = [
    # ── Apple ────────────────────────────────────────────────────────
    ("Apple Braeburn",      "apple_ripe"),
    ("Apple Crimson Snow",  "apple_ripe"),
    ("Apple Golden 1",      "apple_ripe"),
    ("Apple Golden 2",      "apple_ripe"),
    ("Apple Golden 3",      "apple_ripe"),
    ("Apple Granny Smith",  "apple_ripe"),
    ("Apple Pink Lady",     "apple_ripe"),
    ("Apple Red 1",         "apple_ripe"),
    ("Apple Red 2",         "apple_ripe"),
    ("Apple Red 3",         "apple_ripe"),
    ("Apple Red Delicious", "apple_ripe"),
    ("Apple Red Yellow 1",  "apple_ripe"),
    ("Apple Red Yellow 2",  "apple_ripe"),

    # ── Apricot ──────────────────────────────────────────────────────
    ("Apricot",             "apricot_ripe"),

    # ── Avocado — the dataset actually labels ripeness here! ─────────
    ("Avocado",             "avocado_unripe"),   # bright green, unripe
    ("Avocado ripe",        "avocado_ripe"),     # dark/black skin, ripe

    # ── Banana ───────────────────────────────────────────────────────
    ("Banana",              "banana_ripe"),
    ("Banana Lady Finger",  "banana_ripe"),
    ("Banana Red",          "banana_ripe"),

    # ── Blueberry ────────────────────────────────────────────────────
    ("Blueberry",           "blueberry_ripe"),

    # ── Cantaloupe ───────────────────────────────────────────────────
    ("Cantaloupe 1",        "cantaloupe_ripe"),
    ("Cantaloupe 2",        "cantaloupe_ripe"),

    # ── Cherry ───────────────────────────────────────────────────────
    ("Cherry 1",            "cherry_ripe"),
    ("Cherry 2",            "cherry_ripe"),
    ("Cherry Rainier",      "cherry_ripe"),
    ("Cherry Wax Red",      "cherry_ripe"),
    ("Cherry Wax Black",    "cherry_overripe"),  # very dark = overripe
    ("Cherry Wax Yellow",   "cherry_unripe"),    # pale yellow = unripe

    # ── Coconut ──────────────────────────────────────────────────────
    ("Cocos",               "coconut_ripe"),

    # ── Fig ──────────────────────────────────────────────────────────
    ("Fig",                 "fig_ripe"),

    # ── Grape ────────────────────────────────────────────────────────
    ("Grape Blue",          "grape_ripe"),
    ("Grape Pink",          "grape_ripe"),
    ("Grape White",         "grape_ripe"),
    ("Grape White 2",       "grape_ripe"),
    ("Grape White 3",       "grape_ripe"),
    ("Grape White 4",       "grape_ripe"),

    # ── Guava ────────────────────────────────────────────────────────
    ("Guava",               "guava_ripe"),

    # ── Kiwi ─────────────────────────────────────────────────────────
    ("Kiwi",                "kiwi_ripe"),

    # ── Lemon ────────────────────────────────────────────────────────
    ("Lemon",               "lemon_ripe"),
    ("Lemon Meyer",         "lemon_ripe"),

    # ── Lychee ───────────────────────────────────────────────────────
    ("Lychee",              "lychee_ripe"),

    # ── Mango ────────────────────────────────────────────────────────
    ("Mango",               "mango_ripe"),
    ("Mango Red",           "mango_ripe"),

    # ── Orange ───────────────────────────────────────────────────────
    ("Orange",              "orange_ripe"),

    # ── Papaya ───────────────────────────────────────────────────────
    ("Papaya",              "papaya_ripe"),

    # ── Peach ────────────────────────────────────────────────────────
    ("Peach",               "peach_ripe"),
    ("Peach 2",             "peach_ripe"),
    ("Peach Flat",          "peach_ripe"),

    # ── Pear ─────────────────────────────────────────────────────────
    ("Pear",                "pear_ripe"),
    ("Pear 2",              "pear_ripe"),
    ("Pear Abate",          "pear_ripe"),
    ("Pear Forelle",        "pear_ripe"),
    ("Pear Kaiser",         "pear_ripe"),
    ("Pear Monster",        "pear_ripe"),
    ("Pear Red",            "pear_ripe"),
    ("Pear Stone",          "pear_ripe"),
    ("Pear Williams",       "pear_ripe"),

    # ── Pineapple ────────────────────────────────────────────────────
    ("Pineapple",           "pineapple_ripe"),
    ("Pineapple Mini",      "pineapple_ripe"),

    # ── Plum ─────────────────────────────────────────────────────────
    ("Plum",                "plum_ripe"),
    ("Plum 2",              "plum_ripe"),
    ("Plum 3",              "plum_ripe"),

    # ── Pomegranate ──────────────────────────────────────────────────
    ("Pomegranate",         "pomegranate_ripe"),

    # ── Raspberry ────────────────────────────────────────────────────
    ("Raspberry",           "raspberry_ripe"),

    # ── Strawberry ───────────────────────────────────────────────────
    ("Strawberry",          "strawberry_ripe"),
    ("Strawberry Wedge",    "strawberry_ripe"),

    # ── Tomato — ripeness labels present in the dataset! ─────────────
    ("Tomato 1",            "tomato_ripe"),
    ("Tomato 2",            "tomato_ripe"),
    ("Tomato 3",            "tomato_ripe"),
    ("Tomato 4",            "tomato_ripe"),
    ("Tomato Cherry Red",   "tomato_ripe"),
    ("Tomato Heart",        "tomato_ripe"),
    ("Tomato Yellow",       "tomato_ripe"),
    ("Tomato not Ripened",  "tomato_unripe"),   # green tomato = unripe
    ("Tomato Maroon",       "tomato_overripe"), # dark maroon = overripe

    # ── Watermelon ───────────────────────────────────────────────────
    ("Watermelon",          "watermelon_ripe"),
]

# ─── Copy ────────────────────────────────────────────────────────────────────

def copy_class(src_name, dest_label):
    src = os.path.join(FRUITS360, src_name)
    dst = os.path.join(OUT, dest_label)

    if not os.path.isdir(src):
        print(f"  ⚠️  Source not found: {src_name}")
        return 0

    os.makedirs(dst, exist_ok=True)

    existing = {f for f in os.listdir(dst)}
    copied = 0
    for fname in os.listdir(src):
        if not fname.lower().endswith(('.jpg', '.jpeg', '.png')):
            continue
        # Prefix with source folder name to avoid collisions when merging varieties
        safe_prefix = src_name.replace(" ", "_").lower()
        dest_name = f"{safe_prefix}_{fname}"
        dest_path = os.path.join(dst, dest_name)
        if dest_name not in existing:
            shutil.copy2(os.path.join(src, fname), dest_path)
            copied += 1
    return copied

def count_images(label):
    d = os.path.join(OUT, label)
    if not os.path.isdir(d):
        return 0
    return len([f for f in os.listdir(d)
                if f.lower().endswith(('.jpg', '.jpeg', '.png'))])

# ─── Main ────────────────────────────────────────────────────────────────────

totals = {}
print("\n📁 Organizing Fruits-360 → TrainingData/\n")

for src_name, dest_label in MAPPINGS:
    n = copy_class(src_name, dest_label)
    totals[dest_label] = totals.get(dest_label, 0) + n
    if n:
        print(f"  {n:>4}  {src_name}  →  {dest_label}")

print("\n─────────────────────────────────────────────────────")
print("Final image counts per class:\n")

all_labels = sorted(set(totals))
total_images = 0
for label in all_labels:
    n = count_images(label)
    total_images += n
    bar = "█" * (n // 50)
    print(f"  {n:>5}  {label:<30}  {bar}")

print(f"\n  Total images ready for Create ML: {total_images}")
print(f"\n  ℹ️  Classes with only 'ripe' images need unripe/overripe")
print(f"     examples added manually for best accuracy.")
print(f"\n  ✅ Drag TrainingData/ into Create ML → Image Classifier")
