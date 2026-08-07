#!/usr/bin/env python3
"""Build the Visio deliverables for the Maintenance process map.

    python3 visio/build.py [output-dir]

Writes:
    maintenance-process-map.vsdx        open straight in Visio
    MaintenanceProcessMap.bas           VBA module that draws the same map
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import layout                     # noqa: E402
import vba_writer                 # noqa: E402
import vsdx_writer                # noqa: E402


def main():
    out_dir = sys.argv[1] if len(sys.argv) > 1 else os.path.join(
        os.path.dirname(os.path.abspath(__file__)), "dist")
    os.makedirs(out_dir, exist_ok=True)

    boxes, polys, page_h = layout.build()

    # Visio refuses a duplicate shape name on a page, and the VBA path sets
    # names explicitly, so catch collisions here rather than at run time.
    names = [s.name for s in boxes] + [s.name for s in polys]
    dupes = sorted({x for x in names if names.count(x) > 1})
    if dupes:
        raise SystemExit(f"duplicate shape names: {', '.join(dupes)}")

    vsdx_path = os.path.join(out_dir, "maintenance-process-map.vsdx")
    shape_count = vsdx_writer.write(vsdx_path, boxes, polys, page_h)

    bas_path = os.path.join(out_dir, "MaintenanceProcessMap.bas")
    sub_count = vba_writer.write(bas_path, boxes, polys, page_h)

    print(f"page      {layout.PAGE_W:g} x {page_h:g} in")
    print(f"shapes    {shape_count} ({len(boxes)} boxes, {len(polys)} connectors)")
    print(f"vsdx      {vsdx_path}")
    print(f"vba       {bas_path} ({sub_count} draw subs)")


if __name__ == "__main__":
    main()
