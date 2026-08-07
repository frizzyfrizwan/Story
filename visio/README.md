# Maintenance, end to end — Visio process map

The lifecycle process map built as a real Visio drawing: teams down the rows,
lifecycle stages across the columns, arrows for every handoff.

## What to open

| File | Use it for |
| --- | --- |
| `dist/maintenance-process-map.vsdx` | Open directly in Visio. This is the deliverable. |
| `dist/MaintenanceProcessMap.bas` | Fallback — a VBA module that draws the same map through Visio's object model. |

The `.vsdx` carries no masters and references no stencils, so every shape is
self-contained and the file renders identically on any Visio install. Page is
34 × 19 in; print with **Fit to 1 × 1 page** for tabloid, or send it to a
plotter at full size.

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

To change what the map says, edit `content.py` and rebuild. Both outputs are
generated from that one source, so they cannot drift apart.

| Module | Responsibility |
| --- | --- |
| `content.py` | Every string, every owner credit, and which stage each process sits in |
| `layout.py` | Grid metrics, palette, type scale; turns content into positioned boxes and polylines |
| `vsdx_writer.py` | Emits the OPC package Visio opens |
| `vba_writer.py` | Emits the equivalent VBA module |

`layout.py` works in top-left-origin inches. Visio's page origin is
bottom-left, so each writer flips y exactly once on the way out.

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
