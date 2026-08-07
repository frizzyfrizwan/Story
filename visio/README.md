# Maintenance, end to end — Visio process map

The lifecycle process map built as a real Visio drawing: teams down the rows,
lifecycle stages across the columns, arrows for every handoff.

## What to open

| File | Use it for |
| --- | --- |
| `dist/maintenance-process-map.vsdx` | Open and edit in Visio. |
| `dist/maintenance-process-map.html` | Put it on the web. One self-contained file. |
| `dist/MaintenanceProcessMap.bas` | Fallback — a VBA module that draws the same map through Visio's object model. |

The `.vsdx` carries no masters and references no stencils, so every shape is
self-contained and the file renders identically on any Visio install. Page is
34 × 19 in; print with **Fit to 1 × 1 page** for tabloid, or send it to a
plotter at full size.

### Putting it on the web

A `.vsdx` does not render in a browser — only Visio for the web, or a
SharePoint page with a Visio licence behind it, can display one. Use the HTML
build instead. It has no external fonts, scripts or images, so it works from a
file share, a static host, or a document library with nothing else alongside it.

For SharePoint specifically: upload the `.html` to **Site Assets** and point an
**Embed** web part at its URL, or link to it from a page. Tenants that block
inline HTML rendering will download it rather than display it — in that case
host it wherever your other static intranet content lives and link out.

The page is one fixed-proportion canvas that scales to its container, so it
stays in proportion at any width. Below about 1100px it scrolls sideways
rather than reflowing; a six-stage map is inherently wide, and squeezing the
columns into a phone would break the read-across-the-row reading it is for.
Text is real text, so it is selectable, searchable and translatable, and
Ctrl+P prints it at the full 34 × 19 in page size.

### Using the VBA fallback

If a locked-down Visio build won't open a file it didn't author, or you'd
rather grow the map from code:

1. Visio → `Alt+F11` → **File › Import File…** → pick `MaintenanceProcessMap.bas`
2. Put the cursor in `BuildMaintenanceProcessMap` and press `F5`

It creates a new drawing and draws all 158 shapes. Macros must be enabled.

## Regenerating

```
python3 visio/build.py [output-dir]     # defaults to visio/dist
```

No third-party packages — standard library only.

To change what the map says, edit `content.py` and rebuild. All three outputs
are generated from that one source, so they cannot drift apart.

| Module | Responsibility |
| --- | --- |
| `content.py` | Every string, every owner credit, and which stage each process sits in |
| `layout.py` | Grid metrics, palette, type scale; turns content into positioned boxes and polylines |
| `vsdx_writer.py` | Emits the OPC package Visio opens |
| `web_writer.py` | Emits the self-contained HTML page |
| `vba_writer.py` | Emits the equivalent VBA module |

`layout.py` works in top-left-origin inches — which is already the web's
convention, so `web_writer` uses the numbers as they come. Visio's page origin
is bottom-left, so the two Visio writers flip y exactly once on the way out.

The HTML build sizes everything in percentages of the page and sets type in
container query units, so the geometry is the same numbers the Visio drawing
uses. Boxes are real elements, so the browser wraps their text rather than us
guessing at font metrics; connectors go into one SVG overlay sharing the
page's coordinate space.

## Notes on fidelity to the source diagram

Text, owner credits, stage assignments, the legend, the enabling-services band
and both dashed loops are transcribed from the source.

Two things about the arrows are worth knowing, since the source is a picture
and not a data file:

- **Forward arrows are derived, not traced.** Each row declares the stages its
  work passes through (`FLOWS` in `content.py`) and consecutive pairs become
  arrows. That reproduces every handoff visible in the source, and it means
  adding a process automatically re-wires the row.
- **The vertical trunk lines are omitted.** The source shows two faint vertical
  runs in the gutters before stage 4 and stage 6, gathering several rows at
  once. What they connect isn't unambiguous from the image, so rather than
  invent structure the per-row arrows carry the flow. Add them to `FLOWS` or as
  a new primitive if the original intent is confirmed.

The source is page one of a deck — its own footer promises six stage-detail
pages after it. Only this overview page is built here.
