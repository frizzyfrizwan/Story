"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  type ChangeEvent,
  type ComponentProps,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { CircleAlert, Search, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fieldSize, fieldSurface, focusField, type FieldSize } from "./tokens";
import { Spinner } from "./spinner";
import { Kbd } from "./kbd";
import { useControllableState } from "./use-controllable";

// ─── Field (label + hint + error) ─────────────────────────────

interface FieldContextValue {
  id: string;
  describedBy?: string;
  invalid: boolean;
}

const FieldContext = createContext<FieldContextValue | null>(null);

/** Read the surrounding Field's id / description wiring (used by every input primitive). */
export function useFieldContext() {
  return useContext(FieldContext);
}

export interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  /** Visually hide the label while keeping it for assistive tech. */
  labelHidden?: boolean;
  /** Something to the right of the label — a "Forgot?" link, a counter. */
  labelAction?: ReactNode;
  id?: string;
  className?: string;
  children: ReactNode;
}

/** Label + control + hint/error, wired with ids and aria-describedby automatically. */
export function Field({
  label,
  hint,
  error,
  required,
  optional,
  labelHidden,
  labelAction,
  id: idProp,
  className,
  children,
}: FieldProps) {
  const autoId = useId();
  const id = idProp ?? autoId;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const describedBy = [error ? errorId : null, hint ? hintId : null].filter(Boolean).join(" ") || undefined;

  return (
    <div className={cn("flex min-w-0 flex-col gap-1.5", className)}>
      {label && (
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={id} className={cn("text-[13px] font-medium text-fg-muted", labelHidden && "sr-only")}>
            {label}
            {required && (
              <span className="ml-1 text-signal" aria-hidden="true">
                *
              </span>
            )}
            {optional && <span className="ml-1.5 font-normal text-fg-subtle">Optional</span>}
          </label>
          {labelAction && <div className="text-[13px] text-fg-subtle">{labelAction}</div>}
        </div>
      )}
      <FieldContext.Provider value={{ id, describedBy, invalid: Boolean(error) }}>{children}</FieldContext.Provider>
      {error ? (
        <p id={errorId} role="alert" className="flex items-start gap-1.5 text-[13px] text-rose">
          <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      ) : hint ? (
        <p id={hintId} className="text-[13px] text-fg-subtle">
          {hint}
        </p>
      ) : null}
    </div>
  );
}

// ─── Input ────────────────────────────────────────────────────

export interface InputProps extends Omit<ComponentProps<"input">, "size"> {
  size?: FieldSize;
  /** Icon or text at the start (e.g. a Search icon, "$"). */
  leading?: ReactNode;
  /** Element at the end (e.g. a clear button, a unit). */
  trailing?: ReactNode;
  /** Geist Mono + uppercase — for IATA codes and confirmation numbers. */
  mono?: boolean;
  invalid?: boolean;
  /** Classes for the outer box; `className` goes to the `<input>` itself. */
  wrapperClassName?: string;
}

const ADORNMENT = "flex shrink-0 items-center text-fg-subtle [&_svg]:size-4";

/** Text input. Adornments live inside the same bordered box so focus/hover treat them as one control. */
export function Input({
  className,
  wrapperClassName,
  size = "md",
  leading,
  trailing,
  mono,
  invalid,
  id,
  disabled,
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  ...props
}: InputProps) {
  const field = useFieldContext();
  const resolvedId = id ?? field?.id;
  const isInvalid =
    invalid ?? (ariaInvalid != null ? ariaInvalid === true || ariaInvalid === "true" : (field?.invalid ?? false));
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div
      data-invalid={isInvalid || undefined}
      data-disabled={disabled || undefined}
      className={cn(
        fieldSurface,
        fieldSize[size],
        focusField,
        "flex items-center gap-2.5 data-[disabled]:cursor-not-allowed data-[disabled]:opacity-50",
        wrapperClassName,
      )}
      onPointerDown={(e) => {
        // Clicking the padding or an adornment should still focus the input.
        if (e.target !== inputRef.current && !(e.target as HTMLElement).closest("button,a")) {
          requestAnimationFrame(() => inputRef.current?.focus());
        }
      }}
    >
      {leading && <span className={ADORNMENT}>{leading}</span>}
      <input
        ref={inputRef}
        id={resolvedId}
        disabled={disabled}
        aria-invalid={isInvalid || undefined}
        aria-describedby={ariaDescribedBy ?? field?.describedBy}
        className={cn(
          "h-full w-full min-w-0 flex-1 bg-transparent text-fg outline-none placeholder:text-fg-subtle disabled:cursor-not-allowed",
          "[&::-webkit-search-cancel-button]:hidden [&::-webkit-search-decoration]:hidden",
          mono && "font-mono uppercase tracking-[0.08em] placeholder:normal-case placeholder:tracking-normal",
          className,
        )}
        {...props}
      />
      {trailing && <span className={cn(ADORNMENT, "-mr-1")}>{trailing}</span>}
    </div>
  );
}

// ─── Textarea ─────────────────────────────────────────────────

export interface TextareaProps extends ComponentProps<"textarea"> {
  /** Grow with content instead of showing a scrollbar. */
  autoResize?: boolean;
  invalid?: boolean;
}

export function Textarea({
  className,
  autoResize,
  invalid,
  id,
  rows = 3,
  onInput,
  "aria-describedby": ariaDescribedBy,
  ...props
}: TextareaProps) {
  const field = useFieldContext();
  const ref = useRef<HTMLTextAreaElement>(null);
  const isInvalid = invalid ?? field?.invalid ?? false;

  const fit = useCallback(() => {
    const el = ref.current;
    if (!el || !autoResize) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight + 2}px`;
  }, [autoResize]);

  useEffect(() => {
    fit();
  }, [fit, props.value, props.defaultValue]);

  return (
    <textarea
      ref={ref}
      id={id ?? field?.id}
      rows={rows}
      aria-invalid={isInvalid || undefined}
      aria-describedby={ariaDescribedBy ?? field?.describedBy}
      onInput={(e) => {
        fit();
        onInput?.(e);
      }}
      className={cn(
        fieldSurface,
        focusField,
        "block min-h-24 px-3.5 py-2.5 text-sm leading-relaxed placeholder:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-50",
        autoResize ? "resize-none overflow-hidden" : "resize-y",
        className,
      )}
      {...props}
    />
  );
}

// ─── SearchInput ──────────────────────────────────────────────

export interface SearchInputProps
  extends Omit<InputProps, "value" | "defaultValue" | "onChange" | "leading" | "trailing" | "type"> {
  value?: string;
  defaultValue?: string;
  /** Called with the plain string — not the event. */
  onChange?: (value: string) => void;
  onClear?: () => void;
  /** Swap the search icon for a spinner. */
  loading?: boolean;
  /** Shortcut hint shown while empty, e.g. ["/"] or ["mod", "K"]. */
  shortcut?: string[];
}

/** Search field with a leading icon, a clear button when non-empty and Escape-to-clear. */
export function SearchInput({
  value: valueProp,
  defaultValue = "",
  onChange,
  onClear,
  loading,
  shortcut,
  placeholder = "Search…",
  onKeyDown,
  ...props
}: SearchInputProps) {
  const [value, setValue] = useControllableState<string>({ value: valueProp, defaultValue, onChange });

  const clear = () => {
    setValue("");
    onClear?.();
  };

  return (
    <Input
      type="search"
      role="searchbox"
      autoComplete="off"
      spellCheck={false}
      placeholder={placeholder}
      value={value}
      onChange={(e: ChangeEvent<HTMLInputElement>) => setValue(e.target.value)}
      onKeyDown={(e: KeyboardEvent<HTMLInputElement>) => {
        if (e.key === "Escape" && value) {
          e.preventDefault();
          clear();
        }
        onKeyDown?.(e);
      }}
      leading={loading ? <Spinner size="sm" className="text-fg-subtle" /> : <Search aria-hidden="true" />}
      trailing={
        value ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Clear search"
            className="grid size-7 place-items-center rounded-full text-fg-subtle transition-colors hover:bg-fg/8 hover:text-fg focus-visible:outline-2 focus-visible:outline-signal"
          >
            <X className="size-3.5" aria-hidden="true" />
          </button>
        ) : shortcut ? (
          <Kbd keys={shortcut} className="pointer-events-none hidden sm:inline-flex" />
        ) : undefined
      }
      {...props}
    />
  );
}
