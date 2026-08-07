"""Turns the content model into positioned drawing primitives.

Coordinates here are top-left origin, in inches: x grows right, y grows *down*.
Each writer flips y when it emits, because Visio's page origin is bottom-left.

Producing plain primitives (boxes and polylines) rather than writing Visio XML
directly keeps the two writers honest — the .vsdx file and the VBA macro draw
from the same numbers, so they cannot drift.
"""

from dataclasses import dataclass, field
from typing import List, Tuple

import content as C

# --------------------------------------------------------------------------
# Palette
# --------------------------------------------------------------------------

NAVY = "#14346B"
INK = "#1F2D3D"
MUTED = "#8A94A3"
TRIGGER_INK = "#5B6472"
RULE = "#C9CFD8"
TRIGGER_FILL = "#EEF1F5"
TRIGGER_LINE = "#D4D9E0"
BAND_FILL = "#F2F4F7"
WHITE = "#FFFFFF"
ARROW = "#9AA3AF"
LOOP = "#E8891C"
ACCENT = "#D2691E"

STAGE_FILLS = ["#14346B", "#1A4A8F", "#2B6CB8", "#E8891C", "#D4741A", "#A85416"]

# --------------------------------------------------------------------------
# Text styles: (font, size in points, colour, bold)
# --------------------------------------------------------------------------

STYLES = {
    "eyebrow":      ("Segoe UI", 13, ACCENT, True),
    "title":        ("Segoe UI", 42, NAVY, True),
    "subtitle":     ("Segoe UI", 12.5, TRIGGER_INK, False),
    "footer":       ("Segoe UI", 10, MUTED, False),
    "legend":       ("Segoe UI", 10, TRIGGER_INK, False),
    "stage":        ("Segoe UI", 13, WHITE, True),
    "row_label":    ("Segoe UI", 13, NAVY, True),
    "row_people":   ("Segoe UI", 8.5, MUTED, False),
    "trigger":      ("Segoe UI", 10, TRIGGER_INK, False),
    "box_body":     ("Segoe UI", 11, INK, False),
    "box_owner":    ("Segoe UI", 8.5, MUTED, False),
    "enable_lead":  ("Segoe UI", 11, INK, True),
    "enable_item":  ("Segoe UI", 11, TRIGGER_INK, False),
    "loop_label":   ("Segoe UI", 10.5, LOOP, True),
}

# Extra tracking, in inches, for the styles that want a spaced-out small-caps
# look. Visio calls this Char.Letterspace.
TRACKING = {
    "eyebrow": 0.030,
    "stage": 0.016,
}

# --------------------------------------------------------------------------
# Grid metrics (inches)
# --------------------------------------------------------------------------

PAGE_W = 34.0
LEFT = 0.60
LABEL_W = 3.00
COL_X0 = 3.95
COL_W = 4.40
COL_PITCH = 4.95

HEADER_Y = 2.55
HEADER_H = 0.62
TRIGGER_Y = 3.47
TRIGGER_H = 0.80
ROWS_Y = 4.86

ROW_H = 1.10          # a single-band team row
BAND_H = 0.98         # one band inside a two-band row
BAND_GAP = 0.14
ROW_GAP = 0.30

ENABLING_H = 0.74
PAD = 0.07            # clearance between a box edge and an arrow tip
BOTTOM_MARGIN = 0.55

# Roughly how many characters of the 13pt bold row label fit on one line of the
# label column. Only used to park the owner credit just under the team name,
# so being a character or two out costs nothing.
LABEL_CHARS = 23


def _wrapped_lines(text: str, per_line: int) -> int:
    return max(1, -(-len(text) // per_line))


def col_x(stage: int) -> float:
    return COL_X0 + stage * COL_PITCH


def col_cx(stage: int) -> float:
    return col_x(stage) + COL_W / 2


def gap_x(left_stage: int) -> float:
    """Centre of the gutter to the right of ``left_stage``."""
    return col_x(left_stage) + COL_W + (COL_PITCH - COL_W) / 2


# --------------------------------------------------------------------------
# Primitives
# --------------------------------------------------------------------------


@dataclass
class Box:
    x: float
    y: float
    w: float
    h: float
    runs: List[Tuple[str, str]] = field(default_factory=list)
    fill: str = None
    line: str = None
    weight: float = 0.0075
    rounding: float = 0.04
    halign: int = 0        # 0 left, 1 centre, 2 right
    valign: int = 0        # 0 top, 1 middle, 2 bottom
    margin: float = 0.10
    name: str = "Shape"


@dataclass
class Poly:
    pts: List[Tuple[float, float]]
    color: str = ARROW
    weight: float = 0.011
    dashed: bool = False
    end_arrow: bool = True
    name: str = "Connector"


def _text(x, y, w, h, runs, **kw):
    kw.setdefault("margin", 0.0)
    return Box(x, y, w, h, runs, fill=None, line=None, rounding=0.0, **kw)


# --------------------------------------------------------------------------
# Build
# --------------------------------------------------------------------------


def build():
    """Return ``(boxes, polys, page_height)``."""
    boxes: List[Box] = []
    polys: List[Poly] = []

    # ---- title block -----------------------------------------------------
    boxes.append(_text(LEFT, 0.50, 14.0, 0.30,
                       [(C.TITLE_EYEBROW, "eyebrow")], name="Eyebrow"))
    boxes.append(_text(LEFT, 0.82, 20.0, 0.90, [(C.TITLE, "title")], name="Title"))
    boxes.append(_text(LEFT, 1.86, 20.0, 0.32, [(C.SUBTITLE, "subtitle")],
                       name="Subtitle"))

    _legend(boxes, polys)

    # ---- stage headers ---------------------------------------------------
    for i, label in enumerate(C.STAGES):
        boxes.append(Box(col_x(i), HEADER_Y, COL_W, HEADER_H,
                         [(label, "stage")],
                         fill=STAGE_FILLS[i], line=STAGE_FILLS[i],
                         halign=1, valign=1, rounding=0.05,
                         name=f"Stage{i + 1}"))

    # ---- trigger strip ---------------------------------------------------
    boxes.append(Box(LEFT, TRIGGER_Y, LABEL_W, TRIGGER_H, [], fill=BAND_FILL,
                     line=BAND_FILL, rounding=0.04, name="TriggerBand"))
    boxes.append(_text(LEFT + 0.16, TRIGGER_Y + 0.10, LABEL_W - 0.32, 0.26,
                       [(C.TRIGGER_ROW_LABEL, "row_label")], name="TriggerLabel"))
    boxes.append(_text(LEFT + 0.16, TRIGGER_Y + 0.42, LABEL_W - 0.32, 0.24,
                       [(C.TRIGGER_ROW_SUBLABEL, "row_people")],
                       name="TriggerSublabel"))

    for i, text in enumerate(C.TRIGGERS):
        boxes.append(Box(col_x(i), TRIGGER_Y, COL_W, TRIGGER_H,
                         [(text, "trigger")], fill=TRIGGER_FILL,
                         line=TRIGGER_LINE, valign=1, name=f"Trigger{i + 1}"))
        # drop arrow into the stage below
        top = TRIGGER_Y + TRIGGER_H + PAD
        polys.append(Poly([(col_cx(i), top), (col_cx(i), top + 0.32)],
                          name=f"TriggerDrop{i + 1}"))

    # ---- team rows -------------------------------------------------------
    cell_geom = {}          # (row_key, stage, band) -> Box
    y = ROWS_Y

    for row in C.ROWS:
        bands = row["bands"]
        row_h = (BAND_H * bands + BAND_GAP * (bands - 1)) if bands > 1 else ROW_H
        band_h = BAND_H if bands > 1 else ROW_H

        boxes.append(Box(LEFT, y, LABEL_W, row_h, [], fill=BAND_FILL,
                         line=BAND_FILL, rounding=0.04,
                         name=f"Band_{row['key']}"))
        label_lines = _wrapped_lines(row["label"], LABEL_CHARS)
        boxes.append(_text(LEFT + 0.16, y + 0.11, LABEL_W - 0.32,
                           0.24 * label_lines,
                           [(row["label"], "row_label")],
                           name=f"Label_{row['key']}"))
        boxes.append(_text(LEFT + 0.16, y + 0.15 + 0.24 * label_lines,
                           LABEL_W - 0.32, 0.38,
                           [(row["people"], "row_people")],
                           name=f"People_{row['key']}"))

        for (stage, band), (text, owner) in sorted(row["cells"].items()):
            by = y + band * (band_h + BAND_GAP)
            box = Box(col_x(stage), by, COL_W, band_h, [(text, "box_body")],
                      fill=WHITE, line=RULE,
                      name=f"{row['key']}_{stage + 1}_{band + 1}")
            boxes.append(box)
            boxes.append(_text(col_x(stage) + 0.10, by + band_h - 0.30,
                               COL_W - 0.20, 0.24, [(owner, "box_owner")],
                               name=f"{row['key']}_{stage + 1}_{band + 1}_owner"))
            cell_geom[(row["key"], stage, band)] = box

        y += row_h + ROW_GAP

    # ---- enabling services band -----------------------------------------
    enable_y = y
    boxes.append(Box(LEFT, enable_y, LABEL_W, ENABLING_H, [], fill=BAND_FILL,
                     line=BAND_FILL, rounding=0.04, name="Band_enabling"))
    boxes.append(_text(LEFT + 0.16, enable_y + 0.24, LABEL_W - 0.32, 0.30,
                       [(C.ENABLING_LABEL, "row_label")], name="Label_enabling"))

    enable_x = col_x(0)
    enable_w = col_x(5) + COL_W - enable_x
    runs = [(C.ENABLING_LEAD + "   ", "enable_lead")]
    runs.append(("      ·      ".join(C.ENABLING_ITEMS), "enable_item"))
    boxes.append(Box(enable_x, enable_y, enable_w, ENABLING_H, runs,
                     fill=TRIGGER_FILL, line=TRIGGER_LINE, halign=1, valign=1,
                     name="Enabling"))
    enable_bottom = enable_y + ENABLING_H

    # ---- forward handoffs ------------------------------------------------
    for row_key, band, chain in C.FLOWS:
        for a_stage, b_stage in zip(chain, chain[1:]):
            a = cell_geom[(row_key, a_stage, band)]
            b = cell_geom[(row_key, b_stage, band)]
            mid = a.y + a.h / 2
            polys.append(Poly(
                [(a.x + a.w + PAD, mid), (b.x - PAD, mid)],
                name=f"Flow_{row_key}_{band + 1}_{a_stage + 1}_{b_stage + 1}"))

    for a_key, a_stage, a_band, b_key, b_stage, b_band in C.CROSS_FLOWS:
        a = cell_geom[(a_key, a_stage, a_band)]
        b = cell_geom[(b_key, b_stage, b_band)]
        ya = a.y + a.h * 0.78
        yb = b.y + b.h / 2
        gx = gap_x(a_stage)
        polys.append(Poly([(a.x + a.w + PAD, ya), (gx, ya), (gx, yb),
                           (b.x - PAD, yb)],
                          name=f"Cross_{a_key}_{b_key}"))

    # ---- the two loops back ---------------------------------------------
    a_key, a_stage, a_band, b_key, b_stage, b_band = C.FARC_LOOP
    a = cell_geom[(a_key, a_stage, a_band)]
    b = cell_geom[(b_key, b_stage, b_band)]
    gx = gap_x(b_stage)
    polys.append(Poly([(a.x - PAD, a.y + a.h / 2), (gx, a.y + a.h / 2),
                       (gx, b.y + b.h / 2), (b.x + b.w + PAD, b.y + b.h / 2)],
                      color=LOOP, dashed=True, name="FARC_loop"))

    base_y = enable_bottom + 0.78
    polys.append(Poly([(col_cx(5), enable_bottom + PAD), (col_cx(5), base_y),
                       (col_cx(0), base_y), (col_cx(0), base_y - 0.48)],
                      color=LOOP, dashed=True, name="YearEnd_loop"))
    boxes.append(_text(col_x(0) + 0.35, base_y + 0.12, 22.0, 0.30,
                       [(C.LOOP_LABEL, "loop_label")], name="LoopLabel"))

    # ---- footer ----------------------------------------------------------
    footer_y = base_y + 0.62
    boxes.append(_text(LEFT, footer_y, PAGE_W - 2 * LEFT, 0.30,
                       [(C.FOOTER, "footer")], name="Footer"))

    page_h = footer_y + 0.30 + BOTTOM_MARGIN
    page_h = round(page_h * 2 + 0.4999) / 2      # round up to the next half inch

    return boxes, polys, page_h


def _legend(boxes, polys):
    """Key in the top-right corner, aligned with the title block."""
    x1, x2 = 22.8, 28.3
    y1, y2 = 0.62, 1.04
    sample_w = 0.80
    slots = [(x1, y1), (x1, y2), (x2, y1), (x2, y2)]

    for (kind, label), (lx, ly) in zip(C.LEGEND, slots):
        if kind in ("arrow", "dashed"):
            polys.append(Poly([(lx, ly + 0.10), (lx + sample_w, ly + 0.10)],
                              color=LOOP if kind == "dashed" else ARROW,
                              dashed=(kind == "dashed"),
                              name=f"Legend_{kind}"))
        else:
            boxes.append(Box(lx, ly - 0.02, 0.62, 0.26, [],
                             fill=TRIGGER_FILL if kind == "trigger" else WHITE,
                             line=TRIGGER_LINE if kind == "trigger" else RULE,
                             name=f"Legend_{kind}"))
        boxes.append(_text(lx + sample_w + 0.18, ly - 0.02, 3.6, 0.28,
                           [(label, "legend")], valign=1,
                           name=f"LegendText_{kind}"))
