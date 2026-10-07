# art — procedural artwork

Everything here is generated: SVG + CSS, seeded with `hash32` so the same input always draws the
same picture, token colours for anything theme-dependent. No images are fetched, ever.
`CityPostcard`, `ProgramLogo`, `AirlineTail`, `ProceduralAvatar` and the patterns have no hooks and
work in server components; `CardArt` is a client component (motion tilt).

```tsx
import {
  CityPostcard,
  ProgramLogo,
  AirlineTail,
  CardArt,
  ProceduralAvatar,
  AuroraBackdrop,
  RadarRings,
  Contrails,
  Starfield,
} from "@/components/art";
```

## CityPostcard

```tsx
<CityPostcard name="Kyoto" motif="mountain" from={hotel.art.from} to={hotel.art.to} size="md" subtitle="Japan" />
```

Motifs: `skyline` (seeded towers with lit windows) · `coast` (headland, waves, sun path) ·
`mountain` (three ridges, snow caps, mist) · `desert` (dunes, low sun, heat haze) · `island`
(sea, mound, palms) · `forest` (conifer layers in fog). Dark `from` colours get stars. Sizes
`sm` (10rem) · `md` (20rem) · `lg` (40rem), all `max-w-full` with a 16:10 box; override with
`className`. `showName={false}` for a bare backdrop, `children` layer on top.

## ProgramLogo · AirlineTail

```tsx
<ProgramLogo id={program.id} name={program.name} color={program.color} size={40} />
<AirlineTail code="SQ" color={airline.color} size={28} />
```

`monogram(name)` derives 2–3 letters ("World of Hyatt" → WH, "KrisFlyer" → KF). Ring detail
(solid / dashed / double / ticks / dots) and the accent dot come from the id hash.

## CardArt

```tsx
<CardArt
  name={card.name}
  issuer={card.issuer}
  from={card.art.from}
  to={card.art.to}
  accent={card.art.accent}
  network={card.network}
  last4="4821"
/>
```

85.6 × 54 ratio, chip, contactless glyph, seeded pattern, pointer-following sheen and 3D tilt
(disabled under reduced motion or `tilt={false}`). Ink colour is chosen from the gradient's
luminance so text stays readable.

## ProceduralAvatar

```tsx
<ProceduralAvatar seed={author.avatarSeed} size={36} alt={author.name} />
```

Fanned kestrel feathers in two token colours; `square` for a rounded square.

## Patterns

Drop inside a `relative` container; all are `absolute inset-0 pointer-events-none` except `RadarRings`.

```tsx
<AuroraBackdrop intensity={1.2} />         // three drifting gradient blobs, transform-only animation
<RadarRings size={240} tone="aurora" />    // concentric guides, travelling rings (animate-radar), sweep
<Contrails angle={-24} opacity={0.08} />   // drifting diagonal hairlines + occasional bright streaks
<Starfield density={1.5} seed="hero" />   // seeded stars, ~30 % twinkle
```

`color.ts` exports the hex helpers (`mix`, `shade`, `tint`, `luminance`, `inkFor`) used across the set.
