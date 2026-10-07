/**
 * Ambient types for the pre-built TopoJSON shipped by `world-atlas`.
 * The files are plain JSON; we only need enough shape to hand them to topojson-client.
 */
declare module "world-atlas/*.json" {
  interface WorldAtlasTopology {
    type: "Topology";
    objects: Record<string, unknown>;
    arcs: number[][][];
    transform?: { scale: [number, number]; translate: [number, number] };
    bbox?: number[];
  }
  const topology: WorldAtlasTopology;
  export default topology;
}
