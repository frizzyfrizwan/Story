# Kestrel UI primitives

"Flight deck at dusk." Dark by default, warm paper in light mode. Fraunces for display, Geist Sans for UI,
Geist Mono for every number. Signal orange is the one CTA colour per view; aurora teal means availability.
Every colour is a token from `src/app/globals.css` — nothing here hardcodes a hex.

Import from the barrel: `import { Button, Panel } from "@/components/ui"`.

## Actions

| Component    | One-line usage                                                                                                                                                                                                                                          |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Button`     | `<Button variant="primary" size="md" loading leading={<Icon/>} href="/search">Search</Button>` — variants `primary · secondary · ghost · outline · danger · link · aurora`; sizes `sm · md · lg · icon · icon-sm`. Renders a `Link` when `href` is set. |
| `IconButton` | `<IconButton label="Close" size="sm" variant="ghost"><X/></IconButton>` — `label` is the accessible name.                                                                                                                                               |
| `Kbd`        | `<Kbd keys={["mod", "K"]} />` (⌘ on Apple, Ctrl elsewhere) or `<Kbd>Esc</Kbd>`.                                                                                                                                                                         |
| `toast`      | `toast.success("Alert saved", { description: "…" })` — themed sonner wrappers: `success · info · error · warning · promise · loading · dismiss`.                                                                                                        |
| `Spinner`    | `<Spinner size="sm" />` or `<Spinner variant="radar" className="text-aurora" />`.                                                                                                                                                                       |

## Forms

| Component          | One-line usage                                                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Field`            | `<Field label="Email" hint="We never share it" error={err} required><Input type="email"/></Field>` — wires ids, `aria-describedby`, `aria-invalid`.                                                                                        |
| `Input`            | `<Input size="md" leading={<Search/>} trailing={<Kbd>/</Kbd>} mono placeholder="JFK" />`                                                                                                                                                   |
| `Textarea`         | `<Textarea rows={3} autoResize />`                                                                                                                                                                                                         |
| `SearchInput`      | `<SearchInput value={q} onChange={setQ} loading shortcut={["/"]} />` — clear button, Escape clears.                                                                                                                                        |
| `Select`           | `<Select value={v} onValueChange={setV} options={[{ value: "aeroplan", label: "Aeroplan", description: "Star Alliance" }]} />` — or compose `SelectRoot/Trigger/Content/Item`.                                                             |
| `SegmentedControl` | `<SegmentedControl value={v} onChange={setV} options={[{ value: "ow", label: "One way" }, …]} size="sm" />` — sliding pill, per-option `accent`.                                                                                           |
| `CabinPicker`      | `<CabinPicker value={cabin} onChange={setCabin} />` — cabin colour accents, Y/W/J/F on phones.                                                                                                                                             |
| `NumberStepper`    | `<NumberStepper label="Passengers" value={pax} onChange={setPax} min={1} max={9} unit="pax" />`                                                                                                                                            |
| `Switch`           | `<Switch label="Only nonstop" description="Hide connections" checked={v} onCheckedChange={setV} />`                                                                                                                                        |
| `Checkbox`         | `<Checkbox label="Include partners" checked={v} onCheckedChange={setV} />` — supports `checked="indeterminate"`.                                                                                                                           |
| `Slider`           | `<Slider label="Max miles" value={[max]} onValueChange={([m]) => setMax(m)} min={0} max={200000} step={5000} formatValue={fmtCompact} />` — two values = range.                                                                            |
| `AirportCombobox`  | `<AirportCombobox value={codes} onChange={setCodes} multiple max={3} fetcher={(q) => fetch(\`/api/airports?q=\${q}\`).then(r => r.json())} />`— IATA in mono, metro groups (NYC → JFK/EWR/LGA), hub stars, chips. Never imports`src/data`. |
| `DatePicker`       | `<DatePicker value={iso} onChange={setIso} flex={flex} onFlexChange={setFlex} heat={heatMap} />` — flex chips 0/±1/±3/±7; `heat` tints days with `bg-avail-0..4`.                                                                          |
| `DateRangePicker`  | `<DateRangePicker value={{ from, to }} onChange={setRange} showNights />` — two months on desktop, one on phones.                                                                                                                          |
| `Calendar`         | `<Calendar selected={iso} onSelect={setIso} heat={heat} numberOfMonths={2} showHeatLegend />` — inline availability calendar; full keyboard grid.                                                                                          |

## Surfaces & layout

| Component    | One-line usage                                                                                                                                                                           |
| ------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Panel`      | `<Panel grain eyebrow="Sweet spot" title="Aeroplan to Asia" actions={<Button size="sm"/>} footer="…">…</Panel>` — glass panel; `strong`, `interactive`, `rise`, `padding`.               |
| `Card`       | `<Card href="/programs/aeroplan" interactive>…</Card>` — solid elevated card, becomes a Link with `href`.                                                                                |
| `Section`    | `<Section eyebrow="Explore" title="Where can 60k points take you?" description="…" actions={…}>…</Section>`                                                                              |
| `Divider`    | `<Divider label="or" />`, `<Divider variant="tear" />` (boarding-pass perforation), `<Divider orientation="vertical" />`.                                                                |
| `ScrollArea` | `<ScrollArea className="h-72">…</ScrollArea>` — thin token-coloured scrollbar.                                                                                                           |
| `Tabs`       | `<Tabs defaultValue="flights"><TabsList variant="underline"><TabsTrigger value="flights" count={12}>Flights</TabsTrigger></TabsList><TabsContent value="flights">…</TabsContent></Tabs>` |
| `Skeleton`   | `<Skeleton className="h-4 w-32" />`, `<SkeletonText lines={3} />`, `<SkeletonCard variant="boarding-pass" />`.                                                                           |
| `EmptyState` | `<EmptyState title="No seats yet" description="Try ±3 days." action={<Button>Widen search</Button>} />` — kestrel-on-radar illustration.                                                 |

## Overlays

| Component      | One-line usage                                                                                                                                                                                                                                                                                                           |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `Dialog`       | `<Dialog open={o} onOpenChange={setO}><DialogContent title="Create alert" description="…" footer={<Button>Save</Button>}>…</DialogContent></Dialog>` — sizes `sm · md · lg · xl`, `bare` for custom surfaces.                                                                                                            |
| `Sheet`        | `<Sheet><SheetTrigger asChild><Button/></SheetTrigger><SheetContent side="right" title="Filters">…</SheetContent></Sheet>` — side panel on desktop, draggable bottom sheet on phones.                                                                                                                                    |
| `Popover`      | `<Popover><PopoverTrigger asChild><Button/></PopoverTrigger><PopoverContent align="start" matchTrigger>…</PopoverContent></Popover>`                                                                                                                                                                                     |
| `Tooltip`      | `<Tooltip content="Refresh" shortcut={["R"]}><IconButton …/></Tooltip>`                                                                                                                                                                                                                                                  |
| `DropdownMenu` | `<DropdownMenu><DropdownMenuTrigger asChild>…</DropdownMenuTrigger><DropdownMenuContent><DropdownMenuItem icon={<Settings/>} href="/settings" shortcut={["mod", ","]}>Settings</DropdownMenuItem><DropdownMenuSeparator/><DropdownMenuItem destructive>Sign out</DropdownMenuItem></DropdownMenuContent></DropdownMenu>` |

## Data display

| Component      | One-line usage                                                                                                                                                                         |
| -------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `Badge`        | `<Badge variant="aurora" dot pulse caps>Live</Badge>` — variants `neutral · signal · aurora · rose · violet · gold · sky · outline`.                                                   |
| `CabinBadge`   | `<CabinBadge cabin="business" short />`                                                                                                                                                |
| `SourceBadge`  | `<SourceBadge source={fare.source} />` — live (pulsing aurora) · cached (sky) · simulated (gold DEMO DATA).                                                                            |
| `ProgramChip`  | `<ProgramChip id={p.id} name={p.shortName} color={p.color} compact />`                                                                                                                 |
| `StatTile`     | `<StatTile label="Best value" value={4.2} format={fmtCpp} delta={12} deltaLabel="vs last week" trend={[…]} tone="aurora" animate />` — mono value, direction icon + colour, sparkline. |
| `Sparkline`    | `<Sparkline data={[…]} tone="signal" height={32} />`                                                                                                                                   |
| `NumberTicker` | `<NumberTicker value={128400} format={fmtInt} />` — counts up when scrolled into view.                                                                                                 |
| `Progress`     | `<Progress value={64} label="Transfer" showValue tone="aurora" />`; `value={null}` for indeterminate.                                                                                  |
| `ProgressRing` | `<ProgressRing value={fare.valueScore} size={56} tone="signal" />`                                                                                                                     |
| `Avatar`       | `<Avatar seed={user.id} name={user.name} src={user.image} size="sm" status="pro" />` — procedural gradient from a hash of the seed. `AvatarGroup` stacks them.                         |
| `Marquee`      | `<Marquee speed={40} pauseOnHover>{chips}</Marquee>` — seamless ticker, static under reduced motion.                                                                                   |

## Hooks & tokens

| Export                                                                                                  | Purpose                                                                                 |
| ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- |
| `useTheme()`                                                                                            | `{ theme, toggle, setTheme }` — observes `<html data-theme>`, shared by every consumer. |
| `useMediaQuery(q)`, `useIsDesktop()`, `usePrefersReducedMotion()`                                       | SSR-safe media queries.                                                                 |
| `useControllableState()`                                                                                | Controlled/uncontrolled value helper.                                                   |
| `focusRing`, `fieldSurface`, `fieldSize`, `popIn`, `floating`, `menuItem`, `menuLabel`, `menuSeparator` | Class fragments so new components match the system.                                     |

## Rules of the road

- Radix handles keyboard and ARIA; keep `asChild` triggers on real `<button>`s.
- Touch targets are ≥ 44px on `md` sizes; `sm` is for dense desktop toolbars.
- Motion is 150–400 ms, `animate-rise` on mount, nothing loops except live indicators and the marquee.
- Numbers always go through `fmtInt / fmtUsd / fmtCpp / fmtDuration` and sit in `font-mono tnum`.
- Every async list gets a `Skeleton*` and an `EmptyState`.
