"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { createContext, useContext, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { IconButton } from "./button";
import { useControllableState } from "./use-controllable";
import { useIsDesktop } from "./use-media-query";

// ─── Root (shared by Dialog and Sheet) ────────────────────────

interface DialogContextValue {
  open: boolean;
  setOpen: (open: boolean) => void;
}
const DialogContext = createContext<DialogContextValue>({ open: false, setOpen: () => {} });

export interface DialogProps {
  open?: boolean;
  defaultOpen?: boolean;
  onOpenChange?: (open: boolean) => void;
  children: ReactNode;
}

/** Modal root. Works controlled (`open`/`onOpenChange`) or with a `DialogTrigger`. */
export function Dialog({ open: openProp, defaultOpen = false, onOpenChange, children }: DialogProps) {
  const [open, setOpen] = useControllableState<boolean>({
    value: openProp,
    defaultValue: defaultOpen,
    onChange: onOpenChange,
  });
  return (
    <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
      <DialogContext.Provider value={{ open, setOpen }}>{children}</DialogContext.Provider>
    </DialogPrimitive.Root>
  );
}

export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;
export const Sheet = Dialog;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;

/** Read the open state from inside a Dialog/Sheet (e.g. to close after a form submits). */
export function useDialog() {
  return useContext(DialogContext);
}

// ─── Shared chrome ────────────────────────────────────────────

interface ChromeProps {
  title?: ReactNode;
  description?: ReactNode;
  /** Mono eyebrow above the title. */
  eyebrow?: ReactNode;
  footer?: ReactNode;
  hideClose?: boolean;
  /** Remove body padding for edge-to-edge content (lists, maps). */
  flush?: boolean;
  /** No header/footer chrome at all — the children own the surface (command palette). Title stays for screen readers. */
  bare?: boolean;
  bodyClassName?: string;
}

function Chrome({
  title,
  description,
  eyebrow,
  footer,
  hideClose,
  flush,
  bare,
  bodyClassName,
  children,
  scrollBody,
}: ChromeProps & { children: ReactNode; scrollBody?: boolean }) {
  if (bare) {
    return (
      <>
        <DialogPrimitive.Title className="sr-only">{title ?? "Dialog"}</DialogPrimitive.Title>
        {description && <DialogPrimitive.Description className="sr-only">{description}</DialogPrimitive.Description>}
        {children}
      </>
    );
  }
  return (
    <>
      <div className={cn("flex items-start gap-4 px-5 pt-5 sm:px-6", !title && !description && "pt-3")}>
        <div className="min-w-0 flex-1">
          {eyebrow && (
            <p className="mb-1.5 font-mono text-[10.5px] uppercase tracking-[0.18em] text-signal">{eyebrow}</p>
          )}
          <DialogPrimitive.Title
            className={cn("font-display text-xl leading-tight tracking-tight text-fg sm:text-2xl", !title && "sr-only")}
          >
            {title ?? "Dialog"}
          </DialogPrimitive.Title>
          {description && (
            <DialogPrimitive.Description className="mt-1.5 text-sm text-fg-muted pretty-text">
              {description}
            </DialogPrimitive.Description>
          )}
        </div>
        {!hideClose && (
          <DialogPrimitive.Close asChild>
            <IconButton label="Close" size="sm" className="-mr-2 -mt-1.5 shrink-0">
              <X />
            </IconButton>
          </DialogPrimitive.Close>
        )}
      </div>
      <div
        className={cn(
          "min-h-0 flex-1",
          scrollBody && "overflow-y-auto overscroll-contain scrollbar-thin",
          !flush && "px-5 py-4 sm:px-6",
          flush && "pt-3",
          bodyClassName,
        )}
      >
        {children}
      </div>
      {footer && (
        <div className="flex flex-col-reverse gap-2 border-t border-panel-border px-5 py-4 sm:flex-row sm:justify-end sm:px-6">
          {footer}
        </div>
      )}
    </>
  );
}

const SURFACE = "panel panel-strong bg-bg-elev-1/95 text-fg outline-none";

// ─── Dialog ───────────────────────────────────────────────────

const DIALOG_SIZE = {
  sm: "sm:max-w-sm",
  md: "sm:max-w-lg",
  lg: "sm:max-w-2xl",
  xl: "sm:max-w-4xl",
} as const;

export interface DialogContentProps extends ChromeProps, Omit<ComponentProps<typeof DialogPrimitive.Content>, "title"> {
  size?: keyof typeof DIALOG_SIZE;
  /** Film grain on the surface. */
  grain?: boolean;
}

/** Centered modal. Fades + scales in; the overlay blurs the deck behind it. */
export function DialogContent({
  size = "md",
  grain = true,
  title,
  description,
  eyebrow,
  footer,
  hideClose,
  flush,
  bare,
  bodyClassName,
  className,
  children,
  ...props
}: DialogContentProps) {
  const { open } = useContext(DialogContext);
  const reduce = useReducedMotion();
  // Without a Description, Radix would still emit aria-describedby pointing nowhere.
  const describedBy = description ? {} : { "aria-describedby": undefined };
  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          </DialogPrimitive.Overlay>
          <div className="pointer-events-none fixed inset-0 z-50 flex items-end justify-center p-0 sm:items-center sm:p-6">
            <DialogPrimitive.Content asChild forceMount {...describedBy} {...props}>
              <motion.div
                className={cn(
                  SURFACE,
                  "pointer-events-auto flex max-h-[92dvh] w-full flex-col rounded-t-[var(--radius-lg)] sm:max-h-[85dvh] sm:rounded-[var(--radius-lg)]",
                  grain && "grain",
                  DIALOG_SIZE[size],
                  className,
                )}
                initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={reduce ? { opacity: 0 } : { opacity: 0, y: 16, scale: 0.98 }}
                transition={{ type: "spring", duration: 0.32, bounce: 0.1 }}
              >
                <Chrome
                  title={title}
                  description={description}
                  eyebrow={eyebrow}
                  footer={footer}
                  hideClose={hideClose}
                  flush={flush}
                  bare={bare}
                  bodyClassName={bodyClassName}
                  scrollBody
                >
                  {children}
                </Chrome>
              </motion.div>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}

// ─── Sheet ────────────────────────────────────────────────────

export interface SheetContentProps extends ChromeProps, Omit<ComponentProps<typeof DialogPrimitive.Content>, "title"> {
  /** Desktop side. Below `sm` it is always a bottom sheet. */
  side?: "right" | "left" | "bottom";
  /** Desktop width class, e.g. "sm:max-w-md". */
  width?: string;
}

/** Side panel on desktop; a draggable bottom sheet on phones. */
export function SheetContent({
  side = "right",
  width = "sm:max-w-md",
  title,
  description,
  eyebrow,
  footer,
  hideClose,
  flush,
  bare,
  bodyClassName,
  className,
  children,
  ...props
}: SheetContentProps) {
  const { open, setOpen } = useContext(DialogContext);
  const desktop = useIsDesktop();
  const reduce = useReducedMotion();
  const bottom = !desktop || side === "bottom";
  const describedBy = description ? {} : { "aria-describedby": undefined };

  const hidden = reduce ? { opacity: 0 } : bottom ? { y: "100%" } : side === "right" ? { x: "100%" } : { x: "-100%" };
  const shown = reduce ? { opacity: 1 } : bottom ? { y: 0 } : { x: 0 };

  return (
    <AnimatePresence>
      {open && (
        <DialogPrimitive.Portal forceMount>
          <DialogPrimitive.Overlay asChild forceMount>
            <motion.div
              className="fixed inset-0 z-50 bg-bg/70 backdrop-blur-sm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            />
          </DialogPrimitive.Overlay>
          <div
            className={cn(
              "pointer-events-none fixed inset-0 z-50 flex",
              bottom ? "items-end justify-center" : side === "right" ? "justify-end" : "justify-start",
            )}
          >
            <DialogPrimitive.Content asChild forceMount {...describedBy} {...props}>
              <motion.div
                className={cn(
                  SURFACE,
                  "pointer-events-auto flex w-full flex-col",
                  bottom
                    ? "max-h-[88dvh] rounded-t-[var(--radius-lg)] rounded-b-none border-b-0 pb-[env(safe-area-inset-bottom)]"
                    : cn(
                        "h-full max-h-none rounded-none border-y-0",
                        side === "right"
                          ? "border-r-0 rounded-l-[var(--radius-lg)]"
                          : "border-l-0 rounded-r-[var(--radius-lg)]",
                        width,
                      ),
                  className,
                )}
                initial={hidden}
                animate={shown}
                exit={hidden}
                transition={{ type: "spring", duration: 0.38, bounce: 0.05 }}
                drag={bottom && !reduce ? "y" : false}
                dragConstraints={{ top: 0, bottom: 0 }}
                dragElastic={{ top: 0, bottom: 0.6 }}
                onDragEnd={(_, info) => {
                  if (info.offset.y > 90 || info.velocity.y > 600) setOpen(false);
                }}
              >
                {bottom && (
                  <div className="flex shrink-0 justify-center pt-2.5" aria-hidden="true">
                    <span className="h-1 w-10 rounded-full bg-fg-faint" />
                  </div>
                )}
                <Chrome
                  title={title}
                  description={description}
                  eyebrow={eyebrow}
                  footer={footer}
                  hideClose={hideClose}
                  flush={flush}
                  bare={bare}
                  bodyClassName={bodyClassName}
                  scrollBody
                >
                  {children}
                </Chrome>
              </motion.div>
            </DialogPrimitive.Content>
          </div>
        </DialogPrimitive.Portal>
      )}
    </AnimatePresence>
  );
}
