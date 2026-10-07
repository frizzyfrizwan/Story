# viz — Kestrel's signature visualisations

Canvas/SVG pieces that make the product look like a flight deck. All are self-contained (Tailwind +
`cn` + tokens only), SSR-safe, responsive through `ResizeObserver`, honour `prefers-reduced-motion`,
and read the palette from CSS variables so they repaint correctly in both themes.

```tsx
import {
  Globe,
  GlobeHero,
  WorldMap,
  DepartureBoard,
  SplitFlap,
  BoardingPass,
  RouteLine,
  AvailabilityCalendar,
  AvailabilityStrip,
  ValueMeter,
  CppBar,
  NumberRoll,
} from "@/components/viz";
```

## Globe · GlobeHero

Orthographic globe (d3-geo + world-atlas 110m). Auto-rotates, pauses on hover, drag with inertia,
great-circle arcs with animated "flight" dashes, pulsing markers, plane glyphs. Redraws only while
something moves; back-hemisphere points are culled, so 400+ aircraft hold 60 fps. Fill a sized box.

```tsx
<div className="h-[420px]">
  <Globe
    arcs={[{ from: [-73.78, 40.64], to: [140.39, 35.76], color: "#5eead4", progress: 0.4 }]}
    markers={[{ lon: -73.78, lat: 40.64, label: "JFK", pulse: true }]}
    aircraft={planes.map((p) => ({ lon: p.lon, lat: p.lat, heading: p.heading ?? 0 }))}
    focus={[140.39, 35.76]}           // tween toward; holds until the user drags
    onMarkerClick={(m, i) => …}
  />
</div>
<GlobeHero className="h-[560px]">…headline…</GlobeHero>   // aurora atmosphere + glow, HERO_ARCS by default
```

Props: `arcs?`, `markers?`, `aircraft?`, `focus?`, `autoRotate=true`, `rotateSpeed=3` (°/s),
`initialRotation=[30,-22]`, `graticule=true`, `atmosphere="soft"|"aurora"|"none"`, `inset=12`,
`interactive=true`, `aircraftSize=9`, `landColor?`, `oceanColor?`, `onMarkerClick?`, `onRotate?`.

## WorldMap

Natural Earth projection with wheel / drag / pinch / keyboard pan-zoom (no library). Land is SVG
(moved by one `<g transform>`), routes + markers + aircraft are a canvas layer (1,000 planes is fine).
`onViewportChange` reports the visible box with OpenSky's parameter names.

```tsx
<WorldMap
  className="h-[70vh]"
  aircraft={states.map((s) => ({ id: s.icao24, lon: s.lon, lat: s.lat, heading: s.heading ?? 0, label: s.callsign ?? undefined }))}
  markers={[{ id: "LHR", lon: -0.46, lat: 51.47, label: "LHR" }]}
  routes={[{ from: [-0.46, 51.47], to: [103.99, 1.36] }]}
  selectedId={selected}
  focus={{ center: [2.55, 49.01], zoom: 6 }}
  onViewportChange={(bbox, view) => refetch(bbox)}   // { lamin, lomin, lamax, lomax }
  onHover={(hit, pos) => …}
  onClick={(hit, lonlat) => …}
  renderTooltip={(hit) => hit.kind === "aircraft" ? hit.item.label : hit.item.label}
  ref={mapRef}                                       // { flyTo(center, zoom?), reset(), getView() }
/>
```

## SplitFlap · DepartureBoard

```tsx
<SplitFlap text="SEE EVERY SEAT" size="lg" tone="signal" />
<SplitFlap text="JFK\nLHR" rows={2} cols={5} align="center" />
<DepartureBoard
  title="Award departures" subtitle="Live"
  rows={[{ time: "18:40", flight: "SQ 21", destination: "SINGAPORE", cabin: "F", miles: 132000, status: "AVAILABLE" }]}
  minRows={6}
/>
```

Tiles flip through the charset with a seeded spin and per-tile stagger; changing `text`/`rows`
flips only the tiles that changed. Sizes `xs|sm|md|lg` (md/lg scale up at `sm:`). Tones map to tokens.
`statusTone()` / `cabinTone()` pick colours for board cells. Cabin/miles/status columns collapse on
small screens; the board scrolls horizontally as a last resort.

## BoardingPass · RouteLine · Barcode

```tsx
<BoardingPass
  id={result.itinerary.id}
  carrierColor={airline.color}
  carrier={
    <>
      <AirlineTail code="SQ" color={airline.color} /> Singapore Airlines · SQ 21
    </>
  }
  main={<RouteLine origin="JFK" destination="SIN" durationMin={1115} carrierColor={airline.color} />}
  stub={
    <div className="font-mono text-xs">
      SEAT 2A
      <br />
      GATE B12
    </div>
  }
  footer={<CppBar cpp={4.2} benchmark={1.5} />}
  barcodeText="KSTRL7"
  interactive
/>
```

The stub sits right on `≥sm` (13rem wide) and at the bottom on mobile (6.25rem tall); the notches
are a CSS mask, so keep stub content compact. `RouteLine` takes `stops?`, `progress?` (0–1 moves
the plane and draws the flown part solid) and `caption?`.

## AvailabilityCalendar · AvailabilityStrip

```tsx
<AvailabilityCalendar
  months={2} from="2026-05-01"
  days={days.map((d) => ({ date: d.date, level: levelFor(d), miles: d.miles, seats: d.seats }))}
  selected={date} onSelect={(date, day) => setDate(date)}
  minDate={todayISO()}
/>
<AvailabilityStrip from={date} days={days} count={14} selected={date} onSelect={setDate} />
```

Levels 0–4 map to `bg-avail-*`; arrows / Home / End / PageUp / PageDown / Enter navigate; a
`<AvailabilityLegend />` is included (toggle with `legend`).

## ValueMeter · CppBar

```tsx
<ValueMeter score={fare.valueScore} cpp={fare.cpp ?? 0} benchmark={program.valuationCpp} size={180} />
<CppBar cpp={2.3} benchmark={1.5} />
```

`score` is optional — `scoreFromCpp(cpp, benchmark)` derives one (benchmark → 50, 2× → 100).
`valueVerdict(score)` returns `Good deal` (≥70) / `Fair` (≥40) / `Poor`.

## NumberRoll

```tsx
<NumberRoll value={balance} format="int" className="text-3xl" animateOnMount />
<NumberRoll value={price} format="usd" />     // "int" | "compact" | "usd" | "cpp" | "raw" | (n) => string
```

## Internals

`use-viz.ts` — `useElementSize`, `usePrefersReducedMotion`, `useThemeColors` (re-reads on
`data-theme` change), `withAlpha`, `prepareCanvas` (DPR ≤ 2). `geo.ts` — land/borders loaders,
`destinationPoint`, the plane glyph and label helpers. `world-atlas.d.ts` types the TopoJSON imports.
