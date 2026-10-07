/**
 * Shared class fragments for the Kestrel primitives.
 * Everything references globals.css tokens — never raw colours.
 */

/** Visible focus ring in signal orange (matches the global :focus-visible rule). */
export const focusRing = "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal";

/** Focus treatment for text-entry surfaces: border + soft ring instead of an outline. */
export const focusField =
  "focus-visible:outline-none focus-within:border-signal/60 focus-within:ring-[3px] focus-within:ring-signal/20";

/**
 * Enter/exit for floating layers (popover, tooltip, dropdown, select).
 * Re-uses the global `rise` keyframe; the exit plays it in reverse so Radix can
 * wait for the animation before unmounting.
 */
export const popIn =
  "data-[state=open]:animate-[rise_180ms_cubic-bezier(0.2,0.8,0.2,1)_both] data-[state=closed]:animate-[rise_140ms_ease-in_reverse_both] data-[state=delayed-open]:animate-[rise_180ms_cubic-bezier(0.2,0.8,0.2,1)_both] data-[state=instant-open]:animate-[rise_120ms_ease-out_both]";

/** Glass surface for floating layers. */
export const floating = "panel panel-strong z-50 shadow-panel";

/** Base look for text inputs, select triggers, comboboxes. */
export const fieldSurface =
  "w-full min-w-0 rounded-[var(--radius)] border border-panel-border bg-bg-elev-1 text-fg transition-[border-color,box-shadow,background-color] duration-200 hover:border-panel-border-strong aria-invalid:border-rose/60 aria-invalid:focus-within:ring-rose/20 data-[invalid=true]:border-rose/60";

/** Row height per size — keeps 44px targets on md. */
export const fieldSize = {
  sm: "h-9 px-3 text-[13px]",
  md: "h-11 px-3.5 text-sm",
  lg: "h-12 px-4 text-base",
} as const;

export type FieldSize = keyof typeof fieldSize;

/** Menu / list item (dropdown, select, command palette). */
export const menuItem =
  "relative flex min-h-10 w-full cursor-default select-none items-center gap-2.5 rounded-[10px] px-2.5 py-2 text-sm text-fg outline-none transition-colors duration-100 data-[highlighted]:bg-fg/6 data-[highlighted]:text-fg data-[disabled]:pointer-events-none data-[disabled]:opacity-40 data-[selected=true]:bg-fg/6 aria-selected:bg-fg/6";

export const menuLabel = "px-2.5 pb-1 pt-2 font-mono text-[10.5px] uppercase tracking-[0.18em] text-fg-subtle";

export const menuSeparator = "my-1.5 h-px bg-panel-border";
