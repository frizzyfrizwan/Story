"use client";

import * as SelectPrimitive from "@radix-ui/react-select";
import { Check, ChevronDown, ChevronUp } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { useFieldContext } from "./input";
import { fieldSize, fieldSurface, floating, menuItem, menuLabel, menuSeparator, popIn, type FieldSize } from "./tokens";

export const SelectRoot = SelectPrimitive.Root;
export const SelectGroup = SelectPrimitive.Group;
export const SelectValue = SelectPrimitive.Value;

export interface SelectTriggerProps extends ComponentProps<typeof SelectPrimitive.Trigger> {
  size?: FieldSize;
}

export function SelectTrigger({ className, size = "md", children, ...props }: SelectTriggerProps) {
  return (
    <SelectPrimitive.Trigger
      className={cn(
        fieldSurface,
        fieldSize[size],
        "flex items-center justify-between gap-2 text-left outline-none focus-visible:border-signal/60 focus-visible:ring-[3px] focus-visible:ring-signal/20",
        "data-[placeholder]:text-fg-subtle disabled:cursor-not-allowed disabled:opacity-50 [&>span:first-child]:truncate",
        className,
      )}
      {...props}
    >
      {children}
      <SelectPrimitive.Icon asChild>
        <ChevronDown
          className="size-4 shrink-0 text-fg-subtle transition-transform duration-200 group-data-[state=open]:rotate-180"
          aria-hidden="true"
        />
      </SelectPrimitive.Icon>
    </SelectPrimitive.Trigger>
  );
}

export function SelectContent({
  className,
  children,
  position = "popper",
  sideOffset = 6,
  ...props
}: ComponentProps<typeof SelectPrimitive.Content>) {
  return (
    <SelectPrimitive.Portal>
      <SelectPrimitive.Content
        position={position}
        sideOffset={sideOffset}
        collisionPadding={12}
        className={cn(
          floating,
          "max-h-[var(--radix-select-content-available-height)] min-w-[var(--radix-select-trigger-width)] overflow-hidden rounded-[var(--radius)] text-fg",
          popIn,
          className,
        )}
        {...props}
      >
        <SelectPrimitive.ScrollUpButton className="flex h-6 items-center justify-center text-fg-subtle">
          <ChevronUp className="size-4" aria-hidden="true" />
        </SelectPrimitive.ScrollUpButton>
        <SelectPrimitive.Viewport className="p-1.5">{children}</SelectPrimitive.Viewport>
        <SelectPrimitive.ScrollDownButton className="flex h-6 items-center justify-center text-fg-subtle">
          <ChevronDown className="size-4" aria-hidden="true" />
        </SelectPrimitive.ScrollDownButton>
      </SelectPrimitive.Content>
    </SelectPrimitive.Portal>
  );
}

export interface SelectItemProps extends ComponentProps<typeof SelectPrimitive.Item> {
  icon?: ReactNode;
  description?: ReactNode;
}

export function SelectItem({ className, children, icon, description, ...props }: SelectItemProps) {
  return (
    <SelectPrimitive.Item className={cn(menuItem, "pr-9", className)} {...props}>
      {icon && <span className="grid size-4 shrink-0 place-items-center text-fg-subtle [&_svg]:size-4">{icon}</span>}
      <span className="flex min-w-0 flex-1 flex-col">
        <SelectPrimitive.ItemText>{children}</SelectPrimitive.ItemText>
        {description && <span className="truncate text-xs text-fg-subtle">{description}</span>}
      </span>
      <SelectPrimitive.ItemIndicator className="absolute right-2.5 grid size-4 place-items-center">
        <Check className="size-4 text-signal" aria-hidden="true" />
      </SelectPrimitive.ItemIndicator>
    </SelectPrimitive.Item>
  );
}

export function SelectLabel({ className, ...props }: ComponentProps<typeof SelectPrimitive.Label>) {
  return <SelectPrimitive.Label className={cn(menuLabel, className)} {...props} />;
}

export function SelectSeparator({ className, ...props }: ComponentProps<typeof SelectPrimitive.Separator>) {
  return <SelectPrimitive.Separator className={cn(menuSeparator, className)} {...props} />;
}

export interface SelectOption<T extends string = string> {
  value: T;
  label: ReactNode;
  description?: ReactNode;
  icon?: ReactNode;
  disabled?: boolean;
}

export interface SelectOptionGroup<T extends string = string> {
  label: ReactNode;
  options: SelectOption<T>[];
}

export interface SelectProps<T extends string = string> {
  value?: T;
  defaultValue?: T;
  onValueChange?: (value: T) => void;
  options: (SelectOption<T> | SelectOptionGroup<T>)[];
  placeholder?: string;
  size?: FieldSize;
  disabled?: boolean;
  required?: boolean;
  name?: string;
  id?: string;
  className?: string;
  contentClassName?: string;
  "aria-label"?: string;
}

function isGroup<T extends string>(o: SelectOption<T> | SelectOptionGroup<T>): o is SelectOptionGroup<T> {
  return "options" in o;
}

/** Single-value select. Pass flat options or groups; picks up a surrounding <Field>'s id. */
export function Select<T extends string = string>({
  value,
  defaultValue,
  onValueChange,
  options,
  placeholder = "Select…",
  size = "md",
  disabled,
  required,
  name,
  id,
  className,
  contentClassName,
  "aria-label": ariaLabel,
}: SelectProps<T>) {
  const field = useFieldContext();
  const renderOption = (o: SelectOption<T>) => (
    <SelectItem key={o.value} value={o.value} disabled={o.disabled} icon={o.icon} description={o.description}>
      {o.label}
    </SelectItem>
  );
  return (
    <SelectPrimitive.Root
      value={value}
      defaultValue={defaultValue}
      onValueChange={(v) => onValueChange?.(v as T)}
      disabled={disabled}
      required={required}
      name={name}
    >
      <SelectTrigger
        id={id ?? field?.id}
        size={size}
        className={cn("group", className)}
        aria-label={ariaLabel}
        aria-describedby={field?.describedBy}
        aria-invalid={field?.invalid || undefined}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent className={contentClassName}>
        {options.map((o, i) =>
          isGroup(o) ? (
            <SelectGroup key={i}>
              <SelectLabel>{o.label}</SelectLabel>
              {o.options.map(renderOption)}
            </SelectGroup>
          ) : (
            renderOption(o)
          ),
        )}
      </SelectContent>
    </SelectPrimitive.Root>
  );
}
