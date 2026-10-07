"use client";

import { geoNaturalEarth1 } from "d3-geo";
import { MapPin, Plane, RotateCw, X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type FormEvent,
  type ReactNode,
  type RefObject,
} from "react";
import type { Airport, LiveAircraft } from "@/lib/types";
import { getAirline } from "@/data/airlines";
import { getAirport, searchAirports } from "@/data/airports";
import { AirlineTail, RadarRings } from "@/components/art";
import {
  AirportCombobox,
  Badge,
  Button,
  Divider,
  EmptyState,
  Field,
  IconButton,
  Panel,
  SearchInput,
  SegmentedControl,
  Sheet,
  SheetContent,
  SourceBadge,
  Spinner,
  Switch,
  focusRing,
  useMediaQuery,
} from "@/components/ui";
import {
  NumberRoll,
  PLANE_PATH,
  WorldMap,
  useElementSize,
  useThemeColors,
  type MapAircraft,
  type MapBBox,
  type MapHit,
  type MapMarker,
  type MapRoute,
  type MapView,
  type WorldMapHandle,
} from "@/components/viz";
import { clamp, cn, fmtDate, fmtInt, haversineMiles, todayISO } from "@/lib/utils";
import { AircraftPanel } from "./aircraft-panel";
import { ArrivalsBoard } from "./arrivals-board";
import { FlightStatusCard, FlightStatusError, FlightStatusSkeleton } from "./flight-status-card";
import {
  altitudeFt,
  deriveFlight,
  displayFlight,
  fmtAgo,
  fmtAltitude,
  fmtHeading,
  normaliseFlightInput,
  phaseOf,
  routeForFlight,
  routeFromStatus,
  secondsAgo,
  speedKt,
  type RouteEnds,
} from "./live-utils";
import { isNotFound, useFlightStatus, type FlightStatusQuery } from "./use-flight-status";
import { useLiveAircraft } from "./use-live-aircraft";

/**
 * <LiveExperience> — the Live page. A full-height <WorldMap> polls OpenSky (or the simulator)
 * for the visible box every 10 s; floating panels give flight lookup, airport jumps, layer
 * toggles, a stats strip with carrier filters and a legend; clicking an aircraft opens a side
 * panel (bottom sheet on phones) with readouts and the flight's status; a split-flap board under
 * the map lists the aircraft nearest the selected airport or the view centre.
 */

export interface LiveExperienceProps {
  /** `?flight=SQ22` — open the status panel for this flight. */
  initialFlight?: string;
  /** `?airport=JFK` — jump to this airport and anchor the board on it. */
  initialAirport?: string;
}

const AIRPORT_ZOOM = 9;
const TRACK_ZOOM = 7;
const QUICK_AIRPORTS = ["JFK", "LHR", "CDG", "DXB", "SIN", "HND", "LAX", "SYD"];
const PANEL_WIDTH = 400;

type Focus = { center: [number, number]; zoom?: number };
type Lookup = { flight: string; date: string };
type Selection = { id: string; snapshot: LiveAircraft };

// ─── Small pieces ─────────────────────────────────────────────

const noopSubscribe = () => () => {};
/** False during SSR + hydration, true afterwards — so viewport-dependent overlays never mount in the wrong mode. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}

function useTicker(ms: number): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), ms);
    return () => window.clearInterval(id);
  }, [ms]);
  return now;
}

/** "3s ago" — ticks on its own so the rest of the page doesn't re-render every second. */
function Ago({ at, fetching, paused }: { at: number | null; fetching: boolean; paused: boolean }) {
  const now = useTicker(1000);
  const s = secondsAgo(now, at);
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[11px] tnum text-fg-subtle" aria-live="off">
      {fetching ? (
        <Spinner size="xs" className="text-aurora" label="" />
      ) : (
        <span className={cn("size-1.5 rounded-full", paused ? "bg-fg-faint" : "bg-aurora/80")} aria-hidden="true" />
      )}
      {paused && at != null ? "paused" : s == null ? "scanning…" : fmtAgo(s)}
    </span>
  );
}

function PlaneGlyph({ color, size = 14, ring }: { color: string; size?: number; ring?: boolean }) {
  return (
    <svg viewBox="-8 -8 16 16" width={size} height={size} aria-hidden="true" className="shrink-0">
      {ring && <circle r={7} fill="none" stroke="var(--aurora)" strokeWidth={1} opacity={0.8} />}
      <path d={PLANE_PATH} fill={color} transform="scale(0.95)" />
    </svg>
  );
}

function AircraftTooltip({ ac }: { ac: LiveAircraft }) {
  const airline = ac.carrier ? getAirline(ac.carrier) : undefined;
  const flight = deriveFlight(ac);
  const kt = speedKt(ac);
  return (
    <div className="flex min-w-[190px] flex-col gap-1.5">
      <div className="flex items-center gap-2">
        {airline ? (
          <AirlineTail code={airline.iata} color={airline.color} size={20} showCode={false} />
        ) : (
          <Plane className="size-4 text-fg-subtle" aria-hidden="true" />
        )}
        <span className="font-mono text-[13px] font-semibold tracking-wider text-fg">{ac.callsign ?? ac.icao24.toUpperCase()}</span>
        {flight && <span className="font-mono text-[11px] text-fg-subtle">{flight.display}</span>}
      </div>
      <div className="truncate text-[11px] text-fg-muted">
        {airline?.name ?? "Unknown operator"} · {ac.originCountry}
      </div>
      <dl className="grid grid-cols-3 gap-x-3 font-mono text-[11px] tnum">
        <div>
          <dt className="text-[9.5px] uppercase tracking-[0.16em] text-fg-subtle">Alt</dt>
          <dd className="text-fg">{fmtAltitude(altitudeFt(ac))}</dd>
        </div>
        <div>
          <dt className="text-[9.5px] uppercase tracking-[0.16em] text-fg-subtle">Spd</dt>
          <dd className="text-fg">{kt == null ? "—" : `${kt} kt`}</dd>
        </div>
        <div>
          <dt className="text-[9.5px] uppercase tracking-[0.16em] text-fg-subtle">Hdg</dt>
          <dd className="text-fg">{fmtHeading(ac.heading)}</dd>
        </div>
      </dl>
      <div className="text-[10.5px] text-fg-subtle">{phaseOf(ac).toLowerCase()} · click for details</div>
    </div>
  );
}

/**
 * Radar rings that follow the selected aircraft. The map only exposes zoom + centre, so we
 * rebuild its fitted projection for the same box and position a DOM node with a rAF loop
 * (no React state per frame).
 */
function SelectedHalo({
  mapRef,
  containerRef,
  lonlat,
}: {
  mapRef: RefObject<WorldMapHandle | null>;
  containerRef: RefObject<HTMLDivElement | null>;
  lonlat: [number, number] | null;
}) {
  const size = useElementSize(containerRef);
  const ref = useRef<HTMLDivElement>(null);
  const proj = useMemo(() => geoNaturalEarth1(), []);

  useEffect(() => {
    const el = ref.current;
    if (!lonlat || !el || size.width < 2 || size.height < 2) return;
    const PAD = 8;
    proj.fitExtent(
      [
        [PAD, PAD],
        [size.width - PAD, size.height - PAD],
      ],
      { type: "Sphere" },
    );
    let raf = 0;
    const tick = () => {
      const map = mapRef.current;
      if (map) {
        const { zoom, center } = map.getView();
        const c = proj(center);
        const p = proj(lonlat);
        if (c && p) {
          const x = (p[0] - c[0]) * zoom + size.width / 2;
          const y = (p[1] - c[1]) * zoom + size.height / 2;
          const visible = x > -60 && y > -60 && x < size.width + 60 && y < size.height + 60;
          el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%)`;
          el.style.opacity = visible ? "1" : "0";
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [lonlat, size, mapRef, proj]);

  if (!lonlat) return null;
  return (
    <div ref={ref} className="pointer-events-none absolute left-0 top-0 z-[5] opacity-0 transition-opacity duration-200" aria-hidden="true">
      <RadarRings size={128} tone="aurora" rings={2} period={2.4} sweep />
    </div>
  );
}

// ─── Lookup panel (the ?flight= / search result) ──────────────

function LookupPanel({
  lookup,
  status,
  onDateChange,
  onTrack,
  onClose,
  inSheet,
}: {
  lookup: Lookup;
  status: FlightStatusQuery;
  onDateChange: (date: string) => void;
  onTrack: (position: { lat: number; lon: number }) => void;
  onClose?: () => void;
  inSheet?: boolean;
}) {
  const airline = getAirline(lookup.flight.slice(0, 2));
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3">
        {airline ? (
          <AirlineTail code={airline.iata} color={airline.color} size={40} showCode={false} className="mt-0.5" />
        ) : (
          <span className="mt-0.5 grid size-10 shrink-0 place-items-center rounded-full border border-panel-border bg-bg-elev-2 text-fg-subtle">
            <Plane className="size-4" aria-hidden="true" />
          </span>
        )}
        <div className="min-w-0 flex-1">
          <h2 className="font-mono text-2xl font-semibold tracking-wider text-fg">{displayFlight(lookup.flight)}</h2>
          <p className="truncate text-sm text-fg-muted">
            {airline?.name ?? "Flight status"} · {fmtDate(lookup.date)}
          </p>
        </div>
        {!inSheet && onClose && (
          <IconButton label="Close" size="sm" onClick={onClose} className="-mr-2 -mt-1 shrink-0">
            <X />
          </IconButton>
        )}
      </div>
      {status.isPending ? (
        <FlightStatusSkeleton />
      ) : status.data ? (
        <FlightStatusCard status={status.data} onTrack={onTrack} />
      ) : (
        <FlightStatusError
          flight={lookup.flight}
          date={lookup.date}
          kind={isNotFound(status.error) ? "not-found" : "error"}
          onDateChange={onDateChange}
          onRetry={() => void status.refetch()}
        />
      )}
    </div>
  );
}

// ─── Controls (search · airport · layers) ─────────────────────

function Controls({
  compact,
  query,
  onQueryChange,
  onSubmit,
  searchError,
  airportCode,
  onAirport,
  colourByAirline,
  onColourByAirline,
  showRoute,
  onShowRoute,
}: {
  compact?: boolean;
  query: string;
  onQueryChange: (v: string) => void;
  onSubmit: (e?: FormEvent) => void;
  searchError: string | null;
  airportCode: string | null;
  onAirport: (code: string | null) => void;
  colourByAirline: boolean;
  onColourByAirline: (v: boolean) => void;
  showRoute: boolean;
  onShowRoute: (v: boolean) => void;
}) {
  const fetcher = useCallback((q: string) => searchAirports(q, 8), []);
  const quick = useMemo(() => QUICK_AIRPORTS.map((c) => getAirport(c)).filter((a): a is Airport => Boolean(a)), []);
  return (
    <div className={cn("flex flex-col", compact ? "gap-2.5" : "gap-3")}>
      <form onSubmit={onSubmit} role="search" aria-label="Flight status lookup" className="flex flex-col gap-1.5">
        <Field label="Flight number" labelHidden error={searchError} className="gap-1">
          <SearchInput
            mono
            value={query}
            onChange={onQueryChange}
            onClear={() => onQueryChange("")}
            placeholder="Flight number (UA1, SQ 22)"
            aria-label="Flight number"
            enterKeyHint="search"
            shortcut={compact ? undefined : ["↵"]}
          />
        </Field>
      </form>

      <div className="flex flex-col gap-2">
        <Field label="Jump to airport" labelHidden>
          <AirportCombobox
            value={airportCode ? [airportCode] : []}
            onChange={(codes) => onAirport(codes[0] ?? null)}
            fetcher={fetcher}
            placeholder="Jump to an airport"
            label="Jump to airport"
          />
        </Field>
        <div className="flex flex-wrap items-center gap-1.5">
          {quick.map((ap) => {
            const active = ap.iata === airportCode;
            return (
              <button
                key={ap.iata}
                type="button"
                onClick={() => onAirport(active ? null : ap.iata)}
                aria-pressed={active}
                title={`${ap.city} · ${ap.name}`}
                className={cn(
                  "h-7 rounded-full border px-2.5 font-mono text-[11px] font-semibold tracking-wider transition-colors",
                  active
                    ? "border-signal/40 bg-signal-soft text-signal"
                    : "border-panel-border bg-bg-elev-2/80 text-fg-muted hover:border-panel-border-strong hover:text-fg",
                  focusRing,
                )}
              >
                {ap.iata}
              </button>
            );
          })}
          {airportCode && (
            <button
              type="button"
              onClick={() => onAirport(null)}
              className={cn("ml-auto inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] text-fg-subtle hover:text-fg", focusRing)}
            >
              <X className="size-3" aria-hidden="true" /> Clear
            </button>
          )}
        </div>
      </div>

      <div className={cn("grid gap-x-4", compact ? "grid-cols-2" : "grid-cols-1 border-t border-panel-border pt-1")}>
        <Switch
          size="sm"
          label="Airline colours"
          description={compact ? undefined : "Tint each aircraft with its carrier"}
          checked={colourByAirline}
          onCheckedChange={onColourByAirline}
          className="min-h-10"
        />
        <Switch
          size="sm"
          label="Route for selected"
          description={compact ? undefined : "Draw origin → destination when known"}
          checked={showRoute}
          onCheckedChange={onShowRoute}
          className="min-h-10"
        />
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────

export function LiveExperience({ initialFlight, initialAirport }: LiveExperienceProps) {
  const hydrated = useHydrated();
  const desktop = useMediaQuery("(min-width: 1024px)", false);
  const colors = useThemeColors();
  const mapRef = useRef<WorldMapHandle | null>(null);
  const mapWrapRef = useRef<HTMLDivElement>(null);

  // ── State ──
  const [viewport, setViewport] = useState<{ bbox: MapBBox; view: MapView } | null>(null);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [selStatusDate, setSelStatusDate] = useState(() => todayISO());
  const [lookup, setLookup] = useState<Lookup | null>(() => {
    const f = initialFlight ? normaliseFlightInput(initialFlight) : null;
    return f ? { flight: f, date: todayISO() } : null;
  });
  const [query, setQuery] = useState(() => {
    const f = initialFlight ? normaliseFlightInput(initialFlight) : null;
    return f ? displayFlight(f) : "";
  });
  const [searchError, setSearchError] = useState<string | null>(null);
  const [airportCode, setAirportCode] = useState<string | null>(() => {
    const ap = initialAirport ? getAirport(initialAirport) : undefined;
    return ap ? ap.iata : null;
  });
  const [focus, setFocus] = useState<Focus | null>(() => {
    const ap = initialAirport ? getAirport(initialAirport) : undefined;
    return ap ? { center: [ap.lon, ap.lat], zoom: AIRPORT_ZOOM } : null;
  });
  const [colourByAirline, setColourByAirline] = useState(true);
  const [showRoute, setShowRoute] = useState(true);
  const [carrierFilter, setCarrierFilter] = useState<string | null>(null);
  const [mobileTab, setMobileTab] = useState<"board" | "carriers">("board");

  const airport = useMemo(() => (airportCode ? (getAirport(airportCode) ?? null) : null), [airportCode]);

  // ── Data ──
  const live = useLiveAircraft({ bbox: viewport?.bbox ?? null });

  const byId = useMemo(() => new Map(live.aircraft.map((a) => [a.icao24, a] as const)), [live.aircraft]);
  const byIdRef = useRef(byId);
  byIdRef.current = byId;

  // Keep the selected aircraft's snapshot fresh while it stays in frame.
  useEffect(() => {
    if (!selection) return;
    const fresh = byId.get(selection.id);
    if (fresh && fresh !== selection.snapshot) setSelection({ id: selection.id, snapshot: fresh });
  }, [byId, selection]);

  const selected = selection?.snapshot ?? null;
  const selectedInView = selection ? byId.has(selection.id) : false;
  const selectedFlight = useMemo(() => (selected ? deriveFlight(selected) : null), [selected]);
  const selectedAirline = selected?.carrier ? getAirline(selected.carrier) : undefined;

  const selStatus = useFlightStatus(selectedFlight?.flight ?? null, selStatusDate);
  const lookupStatus = useFlightStatus(lookup?.flight ?? null, lookup?.date ?? todayISO());

  const lookupAircraft = useMemo(() => {
    if (!lookup) return null;
    return live.aircraft.find((a) => deriveFlight(a)?.flight === lookup.flight) ?? null;
  }, [live.aircraft, lookup]);

  // ── Derived map props ──
  const carriers = useMemo(() => {
    const counts = new Map<string, number>();
    for (const a of live.aircraft) if (a.carrier) counts.set(a.carrier, (counts.get(a.carrier) ?? 0) + 1);
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, 7)
      .map(([code, count]) => ({ code, count, airline: getAirline(code) }));
  }, [live.aircraft]);

  const mapAircraft = useMemo<MapAircraft[]>(
    () =>
      live.aircraft.map((a) => {
        const airline = a.carrier ? getAirline(a.carrier) : undefined;
        const dim = carrierFilter != null && a.carrier !== carrierFilter;
        const color = dim ? colors.fgFaint : colourByAirline ? (airline?.color ?? colors.fgMuted) : colors.aurora;
        return { id: a.icao24, lon: a.lon, lat: a.lat, heading: a.heading ?? 0, color, label: a.callsign ?? undefined };
      }),
    [live.aircraft, carrierFilter, colourByAirline, colors],
  );

  const selectedRoute = useMemo<RouteEnds | null>(() => {
    if (!selected) return null;
    const r = routeForFlight(selectedFlight?.flight) ?? routeFromStatus(selStatus.data);
    return r?.from && r.to ? r : null;
  }, [selected, selectedFlight, selStatus.data]);

  const lookupRoute = useMemo<RouteEnds | null>(() => {
    const r = routeFromStatus(lookupStatus.data);
    return r?.from && r.to ? r : null;
  }, [lookupStatus.data]);

  const showLookupPanel = !selected && lookup != null;

  const routes = useMemo<MapRoute[]>(() => {
    const out: MapRoute[] = [];
    if (showRoute && selected && selectedRoute?.from && selectedRoute.to) {
      const { from, to } = selectedRoute;
      const total = haversineMiles(from.lat, from.lon, to.lat, to.lon);
      const flown = haversineMiles(from.lat, from.lon, selected.lat, selected.lon);
      const progress = selStatus.data?.progress ?? (total > 0 ? clamp(flown / total, 0, 1) : 0.5);
      out.push({ id: "selected", from: [from.lon, from.lat], to: [to.lon, to.lat], color: selectedAirline?.color ?? colors.aurora, progress });
    }
    if (showLookupPanel && lookupRoute?.from && lookupRoute.to && lookupStatus.data) {
      const { from, to } = lookupRoute;
      const s = lookupStatus.data;
      const airline = getAirline(s.carrier);
      out.push({
        id: "lookup",
        from: [from.lon, from.lat],
        to: [to.lon, to.lat],
        color: airline?.color ?? colors.signal,
        progress: s.status === "landed" ? 1 : (s.progress ?? 0),
      });
    }
    return out;
  }, [showRoute, selected, selectedRoute, selStatus.data, selectedAirline, showLookupPanel, lookupRoute, lookupStatus.data, colors]);

  const markers = useMemo<MapMarker[]>(() => {
    const out: MapMarker[] = [];
    const seen = new Set<string>();
    if (airport) {
      seen.add(airport.iata);
      out.push({ id: `airport:${airport.iata}`, lon: airport.lon, lat: airport.lat, label: airport.iata, color: colors.signal, size: 4 });
    }
    const ends: RouteEnds[] = [];
    if (showRoute && selected && selectedRoute) ends.push(selectedRoute);
    if (showLookupPanel && lookupRoute) ends.push(lookupRoute);
    for (const r of ends) {
      for (const ap of [r.from, r.to]) {
        if (!ap || seen.has(ap.iata)) continue;
        seen.add(ap.iata);
        out.push({ id: `end:${ap.iata}`, lon: ap.lon, lat: ap.lat, label: ap.iata, color: colors.fgMuted, size: 2.5 });
      }
    }
    const pos = lookupStatus.data?.position;
    if (showLookupPanel && lookup && pos && !lookupAircraft) {
      out.push({
        id: `lookup:${lookup.flight}`,
        lon: pos.lon,
        lat: pos.lat,
        label: displayFlight(lookup.flight),
        color: getAirline(lookup.flight.slice(0, 2))?.color ?? colors.signal,
        size: 4,
      });
    }
    return out;
  }, [airport, showRoute, selected, selectedRoute, showLookupPanel, lookupRoute, lookupStatus.data, lookup, lookupAircraft, colors]);

  // ── Handlers ──
  const handleViewport = useCallback((bbox: MapBBox, view: MapView) => setViewport({ bbox, view }), []);

  const selectAircraft = useCallback((ac: LiveAircraft) => {
    setSelection((cur) => (cur?.id === ac.icao24 ? cur : { id: ac.icao24, snapshot: ac }));
    setSelStatusDate(todayISO());
    setLookup(null);
  }, []);

  const clearSelection = useCallback(() => setSelection(null), []);

  const closePanel = useCallback(() => {
    setSelection(null);
    setLookup(null);
  }, []);

  const handleMapClick = useCallback(
    (hit: MapHit | null) => {
      if (hit?.kind === "aircraft") {
        const ac = byIdRef.current.get(hit.item.id);
        if (ac) selectAircraft(ac);
        return;
      }
      if (!hit) clearSelection();
    },
    [selectAircraft, clearSelection],
  );

  const renderTooltip = useCallback(
    (hit: MapHit): ReactNode => {
      if (hit.kind === "aircraft") {
        const ac = byIdRef.current.get(hit.item.id);
        return ac ? <AircraftTooltip ac={ac} /> : hit.item.label;
      }
      const ap = hit.item.label ? getAirport(hit.item.label) : undefined;
      return (
        <span className="flex items-center gap-1.5">
          <MapPin className="size-3.5 text-signal" aria-hidden="true" />
          <span className="font-mono font-semibold">{hit.item.label}</span>
          {ap && <span className="text-fg-muted">{ap.city}</span>}
        </span>
      );
    },
    [],
  );

  const trackPosition = useCallback((lonlat: [number, number], zoom = TRACK_ZOOM) => {
    const cur = mapRef.current?.getView().zoom ?? 1;
    setFocus({ center: lonlat, zoom: Math.max(cur, zoom) });
  }, []);

  const trackLookup = useCallback(
    (pos: { lat: number; lon: number }) => {
      trackPosition([pos.lon, pos.lat]);
      if (lookupAircraft) selectAircraft(lookupAircraft);
    },
    [trackPosition, lookupAircraft, selectAircraft],
  );

  const jumpToAirport = useCallback((code: string | null) => {
    const ap = code ? getAirport(code) : undefined;
    setAirportCode(ap ? ap.iata : null);
    if (ap) setFocus({ center: [ap.lon, ap.lat], zoom: AIRPORT_ZOOM });
  }, []);

  const submitSearch = useCallback(
    (e?: FormEvent) => {
      e?.preventDefault();
      const f = normaliseFlightInput(query);
      if (!f) {
        setSearchError(query.trim() ? "Use a flight number like UA1 or SQ 22" : "Type a flight number first");
        return;
      }
      setSearchError(null);
      setQuery(displayFlight(f));
      setSelection(null);
      setLookup({ flight: f, date: todayISO() });
    },
    [query],
  );

  const onQueryChange = useCallback((v: string) => {
    setQuery(v);
    setSearchError(null);
  }, []);

  // ── Effects ──
  // Keep ?flight= / ?airport= shareable without a navigation.
  useEffect(() => {
    const url = new URL(window.location.href);
    if (lookup) url.searchParams.set("flight", lookup.flight);
    else url.searchParams.delete("flight");
    if (airportCode) url.searchParams.set("airport", airportCode);
    else url.searchParams.delete("airport");
    const next = `${url.pathname}${url.search}`;
    if (next !== `${window.location.pathname}${window.location.search}`) {
      window.history.replaceState(window.history.state, "", next);
    }
  }, [lookup, airportCode]);

  // Fly to a looked-up flight the first time its position is known.
  const focusedLookup = useRef<string | null>(null);
  useEffect(() => {
    const s = lookupStatus.data;
    if (!lookup || !s?.position || focusedLookup.current === lookup.flight) return;
    focusedLookup.current = lookup.flight;
    setFocus({ center: [s.position.lon, s.position.lat], zoom: TRACK_ZOOM });
  }, [lookup, lookupStatus.data]);

  // Escape closes the desktop side panel (popovers get first refusal).
  const panelOpen = Boolean(selected) || showLookupPanel;
  useEffect(() => {
    if (!panelOpen || !desktop) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      closePanel();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [panelOpen, desktop, closePanel]);

  // ── Render helpers ──
  const sourceLabel = live.source === "live" ? "OpenSky Network" : live.source === "simulated" ? "Kestrel simulator" : "connecting";
  const empty = !live.isLoading && live.aircraft.length === 0;
  const boardCenter = viewport?.view.center ?? null;
  const ago = <Ago at={live.fetchedAt} fetching={live.isFetching} paused={live.paused} />;

  const panelBody = selected ? (
    <AircraftPanel
      aircraft={selected}
      inView={selectedInView}
      source={live.source}
      status={selStatus}
      statusDate={selStatusDate}
      onStatusDateChange={setSelStatusDate}
      onTrack={(lonlat) => trackPosition(lonlat)}
      onClose={closePanel}
      inSheet={!desktop}
    />
  ) : lookup ? (
    <LookupPanel
      lookup={lookup}
      status={lookupStatus}
      onDateChange={(date) => setLookup({ flight: lookup.flight, date })}
      onTrack={trackLookup}
      onClose={closePanel}
      inSheet={!desktop}
    />
  ) : null;

  const carrierChips = (
    <div className="flex flex-wrap gap-1.5 lg:justify-end">
      {carriers.map(({ code, count, airline }) => {
        const active = carrierFilter === code;
        return (
          <button
            key={code}
            type="button"
            aria-pressed={active}
            title={`${airline?.name ?? code} · ${fmtInt(count)} in view`}
            onClick={() => setCarrierFilter(active ? null : code)}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-full border bg-bg-elev-1/90 pl-1.5 pr-2 text-[11px] font-medium backdrop-blur transition-colors",
              active
                ? "border-panel-border-strong text-fg shadow-panel"
                : carrierFilter
                  ? "border-panel-border text-fg-subtle hover:text-fg"
                  : "border-panel-border text-fg-muted hover:border-panel-border-strong hover:text-fg",
              focusRing,
            )}
          >
            <span className="size-2 shrink-0 rounded-full" style={{ background: airline?.color ?? colors.fgMuted }} aria-hidden="true" />
            <span className="font-mono tracking-wider">{code}</span>
            <span className="font-mono tnum text-fg-subtle">{fmtInt(count)}</span>
          </button>
        );
      })}
      {carrierFilter && (
        <button
          type="button"
          onClick={() => setCarrierFilter(null)}
          className={cn("inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] text-fg-subtle hover:text-fg", focusRing)}
        >
          <X className="size-3" aria-hidden="true" /> All
        </button>
      )}
    </div>
  );

  const legend = (
    <div className="flex flex-col gap-1.5 text-[11px] text-fg-muted">
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">Legend</div>
      <div className="flex items-center gap-2">
        <PlaneGlyph color={colourByAirline ? (carriers[0]?.airline?.color ?? colors.signal) : colors.aurora} />
        {colourByAirline ? "Carrier colour" : "Aircraft"}
      </div>
      {colourByAirline && (
        <div className="flex items-center gap-2">
          <PlaneGlyph color={colors.fgMuted} /> Unknown operator
        </div>
      )}
      {carrierFilter && (
        <div className="flex items-center gap-2">
          <PlaneGlyph color={colors.fgFaint} /> Not {carrierFilter}
        </div>
      )}
      <div className="flex items-center gap-2">
        <PlaneGlyph color={colors.fg} ring /> Selected
      </div>
      {airport && (
        <div className="flex items-center gap-2">
          <span className="grid size-3.5 place-items-center">
            <span className="size-2 rounded-full bg-signal ring-2 ring-signal/30" />
          </span>
          Airport
        </div>
      )}
      <div className="hairline my-0.5" />
      <div className="font-mono text-[10px] text-fg-subtle">Every 10 s · {sourceLabel}</div>
    </div>
  );

  const controlsProps = {
    query,
    onQueryChange,
    onSubmit: submitSearch,
    searchError,
    airportCode,
    onAirport: jumpToAirport,
    colourByAirline,
    onColourByAirline: setColourByAirline,
    showRoute,
    onShowRoute: setShowRoute,
  };

  return (
    <div className="flex flex-col">
      {/* ── Mobile controls (stacked above the map) ── */}
      <div className="px-4 pt-3 lg:hidden">
        <Panel strong padding="sm" className="bg-bg-elev-1/90">
          <div className="mb-3 flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-signal">Kestrel radar</p>
              <h1 className="font-display text-xl leading-tight tracking-tight">Live flights</h1>
            </div>
            <div className="flex flex-col items-end gap-1">
              {live.source ? <SourceBadge source={live.source} /> : <Badge variant="outline" size="sm" caps>Connecting</Badge>}
              {ago}
            </div>
          </div>
          <Controls compact {...controlsProps} />
        </Panel>
      </div>

      {/* ── Map ── */}
      <section
        className="relative mt-3 h-[52dvh] min-h-[380px] overflow-hidden border-y border-panel-border lg:mt-0 lg:h-[calc(100dvh-4rem)] lg:border-t-0"
        aria-label="Live aircraft map"
      >
        <div ref={mapWrapRef} className="absolute inset-0">
          <WorldMap
            ref={mapRef}
            aircraft={mapAircraft}
            markers={markers}
            routes={routes}
            selectedId={selection?.id ?? null}
            focus={focus}
            onViewportChange={handleViewport}
            onClick={handleMapClick}
            renderTooltip={renderTooltip}
            ariaLabel="Live aircraft map — drag to pan, scroll to zoom, click an aircraft for details"
          />
          <SelectedHalo mapRef={mapRef} containerRef={mapWrapRef} lonlat={selected ? [selected.lon, selected.lat] : null} />
        </div>

        {/* Desktop: control panel */}
        <div className="absolute left-3 top-3 z-20 hidden w-80 lg:block">
          <Panel strong padding="sm" rise className="bg-bg-elev-1/85">
            <div className="mb-3">
              <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-signal">Kestrel radar</p>
              <h1 className="font-display text-2xl leading-tight tracking-tight">Live flights</h1>
              <p className="mt-1 text-[13px] text-fg-muted">Every aircraft in view, refreshed every 10 seconds.</p>
            </div>
            <Controls {...controlsProps} />
          </Panel>
        </div>

        {/* Desktop: stats strip */}
        <div
          className={cn(
            "absolute top-3 z-20 hidden max-w-[34rem] flex-col items-end gap-2 transition-[right] duration-300 ease-out lg:flex",
            panelOpen && desktop ? "right-[calc(var(--live-panel)+1.5rem)]" : "right-3",
          )}
          style={{ "--live-panel": `${PANEL_WIDTH}px` } as React.CSSProperties}
        >
          <div className="panel panel-strong flex items-center gap-4 bg-bg-elev-1/85 px-4 py-2.5">
            <div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-fg-subtle">Aircraft in view</div>
              <div className="flex items-baseline gap-2">
                <NumberRoll value={live.total} className="text-2xl font-medium text-fg" animateOnMount />
                {live.total > live.aircraft.length && (
                  <span className="font-mono text-[10px] text-fg-subtle">showing {fmtInt(live.aircraft.length)}</span>
                )}
              </div>
            </div>
            <Divider orientation="vertical" className="h-8" />
            <div className="flex flex-col items-start gap-1">
              {live.source ? <SourceBadge source={live.source} /> : <Badge variant="outline" size="sm" caps>Connecting</Badge>}
              {ago}
            </div>
            <IconButton label="Refresh now" size="sm" onClick={live.refetch} className="-mr-1.5">
              <RotateCw className={cn(live.isFetching && "animate-spin")} />
            </IconButton>
          </div>
          {carriers.length > 0 && carrierChips}
        </div>

        {/* Mobile: mini stats */}
        <div className="absolute right-2 top-2 z-20 flex items-center gap-2 rounded-full border border-panel-border bg-bg-elev-1/85 px-3 py-1.5 backdrop-blur lg:hidden">
          <Plane className="size-3.5 text-fg-subtle" aria-hidden="true" />
          <NumberRoll value={live.total} className="text-sm font-medium text-fg" />
          <span className="text-[11px] text-fg-subtle">in view</span>
        </div>

        {/* Desktop: legend */}
        <div className="absolute bottom-3 left-3 z-20 hidden lg:block">
          <div className="panel bg-bg-elev-1/85 px-3 py-2.5">{legend}</div>
        </div>

        {/* First load */}
        {live.isLoading && (
          <div className="pointer-events-none absolute inset-x-0 top-2 z-10 flex justify-center lg:top-3">
            <div className="flex items-center gap-2.5 rounded-full border border-panel-border bg-bg-elev-1/90 px-4 py-2 text-sm text-fg-muted shadow-panel backdrop-blur">
              <Spinner variant="radar" size="sm" className="text-aurora" label="" />
              Scanning airspace…
            </div>
          </div>
        )}

        {/* Empty / error */}
        {empty && (
          <div className="pointer-events-none absolute inset-0 z-10 grid place-items-center p-4">
            <div className="pointer-events-auto w-full max-w-sm">
              <Panel strong rise padding="sm" className="bg-bg-elev-1/92">
                <EmptyState
                  compact
                  title={live.error ? "Couldn't reach the live feed" : "No aircraft in this view"}
                  description={
                    live.error
                      ? "The aircraft feed didn't answer. We'll keep retrying every 10 seconds."
                      : live.source === "simulated"
                        ? "Live data is unreachable right now and the demo simulator has no scheduled flights to draw yet — its route table is still being filled in. Aircraft appear automatically once either source reports."
                        : "Nothing is reporting a position inside this box. Pan or zoom out to a busier patch of sky."
                  }
                  action={
                    <Button size="sm" variant="secondary" onClick={() => mapRef.current?.reset()}>
                      Reset view
                    </Button>
                  }
                  secondaryAction={
                    <Button size="sm" variant="ghost" leading={<RotateCw />} onClick={live.refetch} loading={live.isFetching}>
                      Retry now
                    </Button>
                  }
                />
              </Panel>
            </div>
          </div>
        )}

        {/* Desktop: side panel */}
        {desktop && panelOpen && panelBody && (
          <aside
            className="panel panel-strong absolute bottom-3 right-3 top-3 z-20 flex flex-col overflow-hidden bg-bg-elev-1/95 animate-rise"
            style={{ width: PANEL_WIDTH, maxWidth: "calc(100% - 1.5rem)" }}
            aria-label={selected ? "Selected aircraft" : "Flight status"}
          >
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-4 scrollbar-thin">{panelBody}</div>
          </aside>
        )}
      </section>

      {/* Mobile: bottom sheet */}
      <Sheet
        open={hydrated && !desktop && panelOpen}
        onOpenChange={(o) => {
          if (!o) closePanel();
        }}
      >
        <SheetContent
          side="bottom"
          title={selected ? (selected.callsign ?? "Aircraft") : lookup ? displayFlight(lookup.flight) : "Details"}
          eyebrow={selected ? "Selected aircraft" : "Flight status"}
          bodyClassName="pb-6"
        >
          {panelBody}
        </SheetContent>
      </Sheet>

      {/* ── Under the map: board (desktop) / tabs (mobile) ── */}
      <div className="mx-auto w-full max-w-7xl px-4 pb-8 pt-4 sm:px-6">
        <div className="mb-3 flex items-center justify-between gap-3 lg:hidden">
          <SegmentedControl
            size="sm"
            value={mobileTab}
            onChange={setMobileTab}
            aria-label="Below the map"
            options={[
              { value: "board", label: "Nearby board" },
              { value: "carriers", label: "Carriers & legend" },
            ]}
          />
        </div>

        <ArrivalsBoard
          aircraft={live.aircraft}
          airport={airport}
          center={boardCenter}
          limit={8}
          selectedId={selection?.id ?? null}
          onSelect={(ac) => {
            selectAircraft(ac);
            trackPosition([ac.lon, ac.lat]);
          }}
          collapsible={desktop}
          trailing={ago}
          size={desktop ? "md" : "sm"}
          className={cn(mobileTab !== "board" && "max-lg:hidden")}
        />

        <div className={cn("lg:hidden", mobileTab !== "carriers" && "hidden")}>
          <Panel padding="sm" title="Carriers in view" description={carriers.length ? "Tap a carrier to spotlight it on the map." : "Carriers appear once aircraft are in view."}>
            {carriers.length > 0 && carrierChips}
            <Divider className="my-4" />
            {legend}
          </Panel>
        </div>
      </div>
    </div>
  );
}
