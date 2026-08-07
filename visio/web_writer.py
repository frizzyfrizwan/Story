"""Writes a self-contained HTML page from the same primitives.

A .vsdx does not render in a browser, so this is the web-facing output: one
file, no external fonts, scripts or images, safe to drop on any intranet.

Geometry matches the Visio drawing exactly, because both read the same layout.
Boxes become absolutely positioned divs sized in percentages of the page, so
the browser wraps their text for real instead of us guessing at font metrics.
Connectors go into a single SVG overlay sharing the page's coordinate space.

Type scales with the page via container query units: 1cqw is one percent of
the page's own width, so the whole map stays in proportion at any size.
"""

from html import escape

import layout as L

# Inches of page width per cqw unit — everything typographic is expressed
# against this so the map scales as one piece.
def _cqw(inches: float) -> float:
    return inches / L.PAGE_W * 100


def _pct_x(v: float) -> float:
    return v / L.PAGE_W * 100


ALIGN_H = {0: "left", 1: "center", 2: "right"}
ALIGN_V = {0: "flex-start", 1: "center", 2: "flex-end"}

PAGE_CSS = """
:root {{ color-scheme: light; }}
* {{ box-sizing: border-box; }}
body {{
  margin: 0;
  background: #FFFFFF;
  color: {ink};
  font-family: "Segoe UI", system-ui, -apple-system, "Helvetica Neue", Arial, sans-serif;
}}
.scroll {{ overflow-x: auto; -webkit-overflow-scrolling: touch; }}
.page {{
  position: relative;
  width: 100%;
  min-width: 1100px;
  aspect-ratio: {pw} / {ph};
  container-type: inline-size;
  background: #FFFFFF;
}}
.b {{
  position: absolute;
  display: flex;
  flex-direction: column;
  overflow: visible;
}}
.b > .t {{ width: 100%; }}
.wires {{
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  pointer-events: none;
}}
@media print {{
  @page {{ size: {pw}in {ph}in; margin: 0; }}
  .scroll {{ overflow: visible; }}
  .page {{ min-width: 0; }}
}}
"""


def _box_html(box: L.Box, index: int, page_h: float):
    """Return (css rule, html element) for one box."""
    sel = f"#s{index}"
    rules = [
        f"left:{_pct_x(box.x):.4f}%",
        f"top:{box.y / page_h * 100:.4f}%",
        f"width:{_pct_x(box.w):.4f}%",
        f"height:{box.h / page_h * 100:.4f}%",
        f"justify-content:{ALIGN_V[box.valign]}",
        f"text-align:{ALIGN_H[box.halign]}",
    ]
    if box.fill:
        rules.append(f"background:{box.fill}")
    if box.line:
        rules.append(f"border:{_cqw(box.weight):.4f}cqw solid {box.line}")
        rules.append(f"border-radius:{_cqw(box.rounding):.4f}cqw")
    if box.margin:
        rules.append(f"padding:{_cqw(box.margin):.4f}cqw")

    spans = []
    for chunk, style_key in box.runs:
        font, size_pt, color, bold = L.STYLES[style_key]
        tracking = L.TRACKING.get(style_key, 0.0)
        style = [
            f"font-size:{_cqw(size_pt / 72):.4f}cqw",
            f"color:{color}",
            f"font-weight:{700 if bold else 400}",
            "line-height:1.15",
        ]
        if tracking:
            style.append(f"letter-spacing:{_cqw(tracking):.4f}cqw")
        spans.append(f'<span style="{";".join(style)}">{escape(chunk)}</span>')

    inner = f'<div class="t">{"".join(spans)}</div>' if spans else ""
    return f"{sel}{{{';'.join(rules)}}}", f'<div class="b" id="s{index}">{inner}</div>'


def _rounded_path(pts, r: float) -> str:
    """Polyline as a path with the corners eased, mirroring Visio's Rounding."""
    if len(pts) < 3 or r <= 0:
        return "M " + " L ".join(f"{x:.4f},{y:.4f}" for x, y in pts)

    def lerp(a, b, t):
        return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)

    def dist(a, b):
        return ((b[0] - a[0]) ** 2 + (b[1] - a[1]) ** 2) ** 0.5

    out = [f"M {pts[0][0]:.4f},{pts[0][1]:.4f}"]
    for i in range(1, len(pts) - 1):
        prev, here, nxt = pts[i - 1], pts[i], pts[i + 1]
        # Never eat more than half of either adjoining segment.
        cut = min(r, dist(prev, here) / 2, dist(here, nxt) / 2)
        if cut <= 0:
            out.append(f"L {here[0]:.4f},{here[1]:.4f}")
            continue
        a = lerp(here, prev, cut / dist(prev, here))
        b = lerp(here, nxt, cut / dist(here, nxt))
        out.append(f"L {a[0]:.4f},{a[1]:.4f}")
        out.append(f"Q {here[0]:.4f},{here[1]:.4f} {b[0]:.4f},{b[1]:.4f}")
    out.append(f"L {pts[-1][0]:.4f},{pts[-1][1]:.4f}")
    return " ".join(out)


def _wires_svg(polys, page_h: float) -> str:
    colors = sorted({p.color for p in polys})
    markers = "".join(
        f'<marker id="ar{i}" viewBox="0 0 10 10" refX="9" refY="5" '
        f'markerWidth="0.13" markerHeight="0.13" markerUnits="userSpaceOnUse" '
        f'orient="auto-start-reverse">'
        f'<path d="M0,0 L10,5 L0,10 Z" fill="{c}"/></marker>'
        for i, c in enumerate(colors)
    )

    paths = []
    for poly in polys:
        d = _rounded_path(poly.pts, 0.06)
        attrs = [
            f'd="{d}"', "fill=\"none\"",
            f'stroke="{poly.color}"',
            f'stroke-width="{poly.weight:.4f}"',
            'stroke-linecap="round"', 'stroke-linejoin="round"',
        ]
        if poly.dashed:
            attrs.append('stroke-dasharray="0.09 0.07"')
        if poly.end_arrow:
            attrs.append(f'marker-end="url(#ar{colors.index(poly.color)})"')
        paths.append(f"<path {' '.join(attrs)}/>")

    return (
        f'<svg class="wires" viewBox="0 0 {L.PAGE_W:g} {page_h:g}" '
        f'role="presentation" aria-hidden="true">'
        f"<defs>{markers}</defs>{''.join(paths)}</svg>"
    )


def write(path: str, boxes, polys, page_h: float, title: str = None):
    rules, elements = [], []
    for i, box in enumerate(boxes):
        rule, element = _box_html(box, i, page_h)
        rules.append(rule)
        elements.append(element)

    import content as C
    heading = title or C.TITLE
    css = PAGE_CSS.format(ink=L.INK, pw=f"{L.PAGE_W:g}", ph=f"{page_h:g}")

    html = (
        "<!doctype html>\n"
        '<html lang="en">\n<head>\n'
        '<meta charset="utf-8">\n'
        '<meta name="viewport" content="width=device-width,initial-scale=1">\n'
        f"<title>{escape(heading)}</title>\n"
        f'<meta name="description" content="{escape(C.SUBTITLE)}">\n'
        f"<style>{css}{chr(10).join(rules)}</style>\n"
        "</head>\n<body>\n"
        f'<div class="scroll"><div class="page">'
        f'<h1 style="position:absolute;left:-9999px">{escape(heading)}</h1>'
        + "".join(elements)
        + _wires_svg(polys, page_h)
        + "</div></div>\n</body>\n</html>\n"
    )

    with open(path, "w", encoding="utf-8") as fh:
        fh.write(html)

    return len(html)
