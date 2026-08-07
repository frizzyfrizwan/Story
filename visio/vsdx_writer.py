"""Writes a .vsdx (Visio 2013+ Open Packaging Convention) file from primitives.

A .vsdx is a zip of XML parts. We emit the smallest package Visio accepts:
content types, the package relationships, a document part, a pages collection
and one page of shapes. No masters and no stencils — every shape carries its
own geometry and formatting, so the file has no external dependencies and
opens the same on any install.

Visio's page origin is bottom-left with y growing up, so every y coming out of
the layout module is flipped here exactly once, in ``_fy``.
"""

import zipfile
from xml.sax.saxutils import escape

import layout as L

NS = "http://schemas.microsoft.com/office/visio/2012/main"
NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships"
NS_PKG_REL = "http://schemas.openxmlformats.org/package/2006/relationships"
NS_CT = "http://schemas.openxmlformats.org/package/2006/content-types"
VREL = "http://schemas.microsoft.com/visio/2010/relationships"

XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n'

ALIGN_H = {0: "0", 1: "1", 2: "2"}
ALIGN_V = {0: "0", 1: "1", 2: "2"}


def n(value: float) -> str:
    """Visio wants plain decimals, not scientific notation."""
    return f"{value:.6f}".rstrip("0").rstrip(".") or "0"


class _Page:
    def __init__(self, page_h: float):
        self.page_h = page_h
        self.shapes = []
        self.next_id = 1

    def _fy(self, y: float) -> float:
        return self.page_h - y

    def _id(self) -> int:
        i = self.next_id
        self.next_id += 1
        return i

    # -- text ------------------------------------------------------------

    def _text_parts(self, runs):
        """Return (character section xml, text element xml) for a run list."""
        if not runs:
            return "", ""

        rows, text = [], []
        for ix, (chunk, style_key) in enumerate(runs):
            font, size_pt, color, bold = L.STYLES[style_key]
            tracking = L.TRACKING.get(style_key, 0.0)
            rows.append(
                f'<Row IX="{ix}">'
                f'<Cell N="Font" V="{escape(font)}"/>'
                f'<Cell N="Color" V="{color}"/>'
                f'<Cell N="Size" V="{n(size_pt / 72.0)}"/>'
                f'<Cell N="Style" V="{1 if bold else 0}"/>'
                f'<Cell N="Letterspace" V="{n(tracking)}"/>'
                f"</Row>"
            )
            text.append(f'<cp IX="{ix}"/>{escape(chunk)}')

        section = f'<Section N="Character">{"".join(rows)}</Section>'
        return section, f'<Text>{"".join(text)}</Text>'

    # -- shapes ----------------------------------------------------------

    def add_box(self, box: L.Box):
        sid = self._id()
        cx = box.x + box.w / 2
        cy = self._fy(box.y + box.h / 2)

        cells = [
            ("PinX", n(cx)), ("PinY", n(cy)),
            ("Width", n(box.w)), ("Height", n(box.h)),
            ("LocPinX", n(box.w / 2)), ("LocPinY", n(box.h / 2)),
            ("Angle", "0"), ("FlipX", "0"), ("FlipY", "0"),
            ("ResizeMode", "0"),
            ("LineWeight", n(box.weight)),
            ("LineColor", box.line or "#000000"),
            ("LinePattern", "1" if box.line else "0"),
            ("Rounding", n(box.rounding)),
            ("LineCap", "0"),
            ("FillForegnd", box.fill or "#FFFFFF"),
            ("FillBkgnd", "#FFFFFF"),
            ("FillPattern", "1" if box.fill else "0"),
            ("ShdwPattern", "0"),
            ("LeftMargin", n(box.margin)), ("RightMargin", n(box.margin)),
            ("TopMargin", n(box.margin)), ("BottomMargin", n(box.margin)),
            ("VerticalAlign", ALIGN_V[box.valign]),
        ]

        char_section, text = self._text_parts(box.runs)
        para = (
            f'<Section N="Paragraph"><Row IX="0">'
            f'<Cell N="HorzAlign" V="{ALIGN_H[box.halign]}"/>'
            f'<Cell N="SpLine" V="-1.15"/>'
            f'<Cell N="SpBefore" V="0"/><Cell N="SpAfter" V="0"/>'
            f"</Row></Section>"
        )

        # Text-only shapes get no geometry at all; Visio renders them as a
        # plain text block, which is exactly what labels and captions want.
        geometry = "" if (box.fill is None and box.line is None) else _rect_geometry()

        self.shapes.append(
            f'<Shape ID="{sid}" NameU="{escape(box.name)}" '
            f'Name="{escape(box.name)}" Type="Shape" '
            f'LineStyle="0" FillStyle="0" TextStyle="0">'
            + "".join(f'<Cell N="{k}" V="{v}"/>' for k, v in cells)
            + char_section + para + geometry + text
            + "</Shape>"
        )

    def add_poly(self, poly: L.Poly):
        sid = self._id()
        pts = [(x, self._fy(y)) for x, y in poly.pts]
        xs = [p[0] for p in pts]
        ys = [p[1] for p in pts]
        x0, y0 = min(xs), min(ys)
        w = max(max(xs) - x0, 0.0001)
        h = max(max(ys) - y0, 0.0001)

        rows = []
        for i, (px, py) in enumerate(pts):
            kind = "MoveTo" if i == 0 else "LineTo"
            rows.append(
                f'<Row T="{kind}" IX="{i + 1}">'
                f'<Cell N="X" V="{n(px - x0)}"/>'
                f'<Cell N="Y" V="{n(py - y0)}"/>'
                f"</Row>"
            )

        cells = [
            ("PinX", n(x0 + w / 2)), ("PinY", n(y0 + h / 2)),
            ("Width", n(w)), ("Height", n(h)),
            ("LocPinX", n(w / 2)), ("LocPinY", n(h / 2)),
            ("Angle", "0"), ("FlipX", "0"), ("FlipY", "0"),
            ("LineWeight", n(poly.weight)),
            ("LineColor", poly.color),
            ("LinePattern", "2" if poly.dashed else "1"),
            ("LineCap", "1"),
            ("Rounding", "0.06" if len(pts) > 2 else "0"),
            ("BeginArrow", "0"),
            ("EndArrow", "4" if poly.end_arrow else "0"),
            ("EndArrowSize", "2"),
            ("FillPattern", "0"),
            ("ShdwPattern", "0"),
        ]

        self.shapes.append(
            f'<Shape ID="{sid}" NameU="{escape(poly.name)}" '
            f'Name="{escape(poly.name)}" Type="Shape" '
            f'LineStyle="0" FillStyle="0" TextStyle="0">'
            + "".join(f'<Cell N="{k}" V="{v}"/>' for k, v in cells)
            + f'<Section N="Geometry" IX="0">'
              f'<Cell N="NoFill" V="1"/><Cell N="NoLine" V="0"/>'
              f'<Cell N="NoShow" V="0"/><Cell N="NoSnap" V="0"/>'
            + "".join(rows) + "</Section></Shape>"
        )

    def xml(self) -> str:
        return (
            XML_DECL
            + f'<PageContents xmlns="{NS}" xmlns:r="{NS_R}" xml:space="preserve">'
            + f'<Shapes>{"".join(self.shapes)}</Shapes>'
            + "</PageContents>"
        )


def _rect_geometry() -> str:
    corners = [(0, 0), (1, 0), (1, 1), (0, 1), (0, 0)]
    rows = []
    for i, (x, y) in enumerate(corners):
        kind = "RelMoveTo" if i == 0 else "RelLineTo"
        rows.append(
            f'<Row T="{kind}" IX="{i + 1}">'
            f'<Cell N="X" V="{x}"/><Cell N="Y" V="{y}"/></Row>'
        )
    return (
        '<Section N="Geometry" IX="0">'
        '<Cell N="NoFill" V="0"/><Cell N="NoLine" V="0"/>'
        '<Cell N="NoShow" V="0"/><Cell N="NoSnap" V="0"/>'
        + "".join(rows) + "</Section>"
    )


# --------------------------------------------------------------------------
# Static parts
# --------------------------------------------------------------------------

CONTENT_TYPES = XML_DECL + f"""<Types xmlns="{NS_CT}">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/>
<Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>
<Override PartName="/visio/document.xml" ContentType="application/vnd.ms-visio.drawing.main+xml"/>
<Override PartName="/visio/pages/pages.xml" ContentType="application/vnd.ms-visio.pages+xml"/>
<Override PartName="/visio/pages/page1.xml" ContentType="application/vnd.ms-visio.page+xml"/>
<Override PartName="/visio/windows.xml" ContentType="application/vnd.ms-visio.windows+xml"/>
</Types>"""

ROOT_RELS = XML_DECL + f"""<Relationships xmlns="{NS_PKG_REL}">
<Relationship Id="rId1" Type="{VREL}/document" Target="visio/document.xml"/>
<Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/>
<Relationship Id="rId3" Type="{NS_R}/extended-properties" Target="docProps/app.xml"/>
</Relationships>"""

DOC_RELS = XML_DECL + f"""<Relationships xmlns="{NS_PKG_REL}">
<Relationship Id="rId1" Type="{VREL}/pages" Target="pages/pages.xml"/>
<Relationship Id="rId2" Type="{VREL}/windows" Target="windows.xml"/>
</Relationships>"""

# Visio desktop invents a window when this part is missing; Visio for the web
# is stricter about the package looking like something Visio wrote, so it is
# cheaper to ship one than to find out.
WINDOWS = XML_DECL + f"""<Windows xmlns="{NS}" xmlns:r="{NS_R}" ClientWidth="1876" ClientHeight="1069">
<Window ID="0" WindowType="Drawing" WindowState="1073741824" WindowLeft="-8" WindowTop="-31"
 WindowWidth="1892" WindowHeight="1107" ContainerType="Page" Page="0" ViewScale="-1"
 ViewCenterX="{{cx}}" ViewCenterY="{{cy}}">
<ShowRulers>1</ShowRulers>
<ShowGrid>1</ShowGrid>
<ShowPageBreaks>0</ShowPageBreaks>
<ShowGuides>1</ShowGuides>
<ShowConnectionPoints>0</ShowConnectionPoints>
<GlueSettings>9</GlueSettings>
<SnapSettings>65847</SnapSettings>
<SnapExtensions>34</SnapExtensions>
<DynamicGridEnabled>1</DynamicGridEnabled>
<TabSplitterPos>0.5</TabSplitterPos>
</Window>
</Windows>"""

PAGES_RELS = XML_DECL + f"""<Relationships xmlns="{NS_PKG_REL}">
<Relationship Id="rId1" Type="{VREL}/page" Target="page1.xml"/>
</Relationships>"""

DOCUMENT = XML_DECL + f"""<VisioDocument xmlns="{NS}" xmlns:r="{NS_R}" xml:space="preserve">
<DocumentSettings TopPage="0" DefaultTextStyle="0" DefaultLineStyle="0" DefaultFillStyle="0" DefaultGuideStyle="0">
<GlueSettings>9</GlueSettings>
<SnapSettings>65847</SnapSettings>
<SnapExtensions>34</SnapExtensions>
<DynamicGridEnabled>1</DynamicGridEnabled>
<ProtectStyles>0</ProtectStyles>
<ProtectShapes>0</ProtectShapes>
<ProtectMasters>0</ProtectMasters>
</DocumentSettings>
<Colors/>
<FaceNames>
<FaceName NameU="Calibri" UnicodeRanges="-536859905 -1073732485 9 0" CharSets="536871327 0" Panos="2 15 5 2 2 2 4 3 2 4" Flags="325"/>
<FaceName NameU="Segoe UI" UnicodeRanges="-469750017 -1073683329 9 0" CharSets="1073742335 -65536" Panos="2 11 5 2 4 2 4 2 2 3" Flags="325"/>
</FaceNames>
<StyleSheets>
<StyleSheet ID="0" NameU="No Style" Name="No Style">
<Cell N="EnableLineProps" V="1"/><Cell N="EnableFillProps" V="1"/><Cell N="EnableTextProps" V="1"/>
<Cell N="LineWeight" V="0.01"/><Cell N="LineColor" V="#000000"/><Cell N="LinePattern" V="1"/>
<Cell N="Rounding" V="0"/><Cell N="BeginArrow" V="0"/><Cell N="EndArrow" V="0"/><Cell N="LineCap" V="0"/>
<Cell N="FillForegnd" V="#FFFFFF"/><Cell N="FillBkgnd" V="#FFFFFF"/><Cell N="FillPattern" V="1"/>
<Cell N="ShdwPattern" V="0"/>
<Cell N="LeftMargin" V="0.05"/><Cell N="RightMargin" V="0.05"/>
<Cell N="TopMargin" V="0.05"/><Cell N="BottomMargin" V="0.05"/>
<Cell N="VerticalAlign" V="1"/>
<Section N="Character"><Row IX="0"><Cell N="Font" V="Calibri"/><Cell N="Color" V="#000000"/><Cell N="Size" V="0.166667"/><Cell N="Style" V="0"/><Cell N="Letterspace" V="0"/></Row></Section>
<Section N="Paragraph"><Row IX="0"><Cell N="HorzAlign" V="1"/><Cell N="SpLine" V="-1.2"/></Row></Section>
</StyleSheet>
</StyleSheets>
<DocumentSheet NameU="TheDocument" Name="TheDocument">
<Cell N="OutputFormat" V="0"/><Cell N="LockPreview" V="0"/><Cell N="AddMarkup" V="0"/>
<Cell N="ViewMarkup" V="0"/><Cell N="PreviewQuality" V="0"/><Cell N="PreviewScope" V="0"/>
<Cell N="DocLangID" V="1033"/>
</DocumentSheet>
</VisioDocument>"""

CORE = XML_DECL + """<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
<dc:title>Maintenance, end to end</dc:title>
<dc:subject>Roadway Maintenance process map</dc:subject>
<dc:description>Lifecycle process map: teams by row, lifecycle stage by column.</dc:description>
</cp:coreProperties>"""

APP = XML_DECL + """<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
<Application>Microsoft Visio</Application>
<Company/>
</Properties>"""


def _pages_xml(page_w: float, page_h: float) -> str:
    cells = [
        ("PageWidth", n(page_w)), ("PageHeight", n(page_h)),
        ("ShdwOffsetX", "0.125"), ("ShdwOffsetY", "-0.125"),
        ("PageScale", "1"), ("DrawingScale", "1"),
        ("DrawingSizeType", "3"), ("DrawingScaleType", "0"),
        ("InhibitSnap", "0"), ("PageLockReplace", "0"),
        ("PageLockDuplicate", "0"), ("UIVisibility", "0"),
        ("ShdwType", "0"), ("ShdwObliqueAngle", "0"), ("ShdwScaleFactor", "1"),
        ("PageLeftMargin", "0.25"), ("PageRightMargin", "0.25"),
        ("PageTopMargin", "0.25"), ("PageBottomMargin", "0.25"),
        ("PrintPageOrientation", "2"), ("PaperKind", "0"),
        ("ScaleX", "1"), ("ScaleY", "1"), ("PagesX", "1"), ("PagesY", "1"),
        ("CenterX", "0"), ("CenterY", "0"), ("OnPage", "0"),
        ("PrintGrid", "0"), ("PaperSource", "7"),
    ]
    return (
        XML_DECL
        + f'<Pages xmlns="{NS}" xmlns:r="{NS_R}" xml:space="preserve">'
        + f'<Page ID="0" NameU="Process Map" Name="Process Map" '
          f'ViewScale="-1" ViewCenterX="{n(page_w / 2)}" '
          f'ViewCenterY="{n(page_h / 2)}">'
        + '<PageSheet LineStyle="0" FillStyle="0" TextStyle="0">'
        + "".join(f'<Cell N="{k}" V="{v}"/>' for k, v in cells)
        + "</PageSheet>"
        + '<Rel r:id="rId1"/>'
        + "</Page></Pages>"
    )


def write(path: str, boxes, polys, page_h: float, page_w: float = L.PAGE_W):
    page = _Page(page_h)
    for box in boxes:
        page.add_box(box)
    for poly in polys:
        page.add_poly(poly)

    parts = {
        "[Content_Types].xml": CONTENT_TYPES,
        "_rels/.rels": ROOT_RELS,
        "docProps/core.xml": CORE,
        "docProps/app.xml": APP,
        "visio/document.xml": DOCUMENT,
        "visio/_rels/document.xml.rels": DOC_RELS,
        "visio/pages/pages.xml": _pages_xml(page_w, page_h),
        "visio/pages/_rels/pages.xml.rels": PAGES_RELS,
        "visio/pages/page1.xml": page.xml(),
        "visio/windows.xml": WINDOWS.format(cx=n(page_w / 2), cy=n(page_h / 2)),
    }

    with zipfile.ZipFile(path, "w", zipfile.ZIP_DEFLATED) as z:
        # [Content_Types].xml must be the first entry in an OPC package.
        z.writestr("[Content_Types].xml", parts.pop("[Content_Types].xml"))
        for name, data in parts.items():
            z.writestr(name, data)

    return page.next_id - 1
