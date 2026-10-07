"use client";

import * as DM from "@radix-ui/react-dropdown-menu";
import Link from "next/link";
import { Check, ChevronRight, Circle } from "lucide-react";
import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Kbd } from "./kbd";
import { floating, menuItem, menuLabel, menuSeparator, popIn } from "./tokens";

export const DropdownMenu = DM.Root;
export const DropdownMenuTrigger = DM.Trigger;
export const DropdownMenuGroup = DM.Group;
export const DropdownMenuPortal = DM.Portal;
export const DropdownMenuSub = DM.Sub;
export const DropdownMenuRadioGroup = DM.RadioGroup;

const CONTENT =
  "min-w-[220px] max-h-[var(--radix-dropdown-menu-content-available-height)] overflow-y-auto scrollbar-thin rounded-[var(--radius)] p-1.5 text-fg outline-none";

export function DropdownMenuContent({
  className,
  sideOffset = 8,
  align = "end",
  collisionPadding = 12,
  ...props
}: ComponentProps<typeof DM.Content>) {
  return (
    <DM.Portal>
      <DM.Content
        sideOffset={sideOffset}
        align={align}
        collisionPadding={collisionPadding}
        className={cn(floating, CONTENT, popIn, className)}
        {...props}
      />
    </DM.Portal>
  );
}

export function DropdownMenuSubContent({ className, sideOffset = 6, ...props }: ComponentProps<typeof DM.SubContent>) {
  return (
    <DM.Portal>
      <DM.SubContent sideOffset={sideOffset} className={cn(floating, CONTENT, popIn, className)} {...props} />
    </DM.Portal>
  );
}

export interface DropdownMenuItemProps extends ComponentProps<typeof DM.Item> {
  icon?: ReactNode;
  shortcut?: string[];
  /** Rose text for irreversible actions. */
  destructive?: boolean;
  /** Indent to align with checkbox/radio items. */
  inset?: boolean;
  /** Render as a Next Link. */
  href?: string;
  /** Secondary line under the label. */
  description?: ReactNode;
}

function ItemBody({
  icon,
  shortcut,
  description,
  children,
}: Pick<DropdownMenuItemProps, "icon" | "shortcut" | "description" | "children">) {
  return (
    <>
      {icon && (
        <span className="grid size-4 shrink-0 place-items-center text-fg-subtle transition-colors group-data-[highlighted]:text-fg [&_svg]:size-4">
          {icon}
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate">{children}</span>
        {description && <span className="truncate text-xs text-fg-subtle">{description}</span>}
      </span>
      {shortcut && <Kbd keys={shortcut} className="ml-3 shrink-0" />}
    </>
  );
}

export function DropdownMenuItem({
  className,
  icon,
  shortcut,
  destructive,
  inset,
  href,
  description,
  children,
  ...props
}: DropdownMenuItemProps) {
  const classes = cn(
    menuItem,
    "group",
    destructive && "text-rose data-[highlighted]:bg-rose-soft data-[highlighted]:text-rose",
    inset && "pl-9",
    className,
  );
  const body = (
    <ItemBody icon={icon} shortcut={shortcut} description={description}>
      {children}
    </ItemBody>
  );
  if (href) {
    return (
      <DM.Item asChild className={classes} {...props}>
        <Link href={href}>{body}</Link>
      </DM.Item>
    );
  }
  return (
    <DM.Item className={classes} {...props}>
      {body}
    </DM.Item>
  );
}

export function DropdownMenuCheckboxItem({ className, children, ...props }: ComponentProps<typeof DM.CheckboxItem>) {
  return (
    <DM.CheckboxItem className={cn(menuItem, "group pl-9", className)} {...props}>
      <span className="absolute left-2.5 grid size-4 place-items-center">
        <DM.ItemIndicator>
          <Check className="size-4 text-signal" aria-hidden="true" />
        </DM.ItemIndicator>
      </span>
      {children}
    </DM.CheckboxItem>
  );
}

export function DropdownMenuRadioItem({ className, children, ...props }: ComponentProps<typeof DM.RadioItem>) {
  return (
    <DM.RadioItem className={cn(menuItem, "group pl-9", className)} {...props}>
      <span className="absolute left-2.5 grid size-4 place-items-center">
        <DM.ItemIndicator>
          <Circle className="size-2 fill-signal text-signal" aria-hidden="true" />
        </DM.ItemIndicator>
      </span>
      {children}
    </DM.RadioItem>
  );
}

export function DropdownMenuSubTrigger({
  className,
  icon,
  children,
  ...props
}: ComponentProps<typeof DM.SubTrigger> & { icon?: ReactNode }) {
  return (
    <DM.SubTrigger className={cn(menuItem, "group data-[state=open]:bg-fg/6", className)} {...props}>
      {icon && <span className="grid size-4 place-items-center text-fg-subtle [&_svg]:size-4">{icon}</span>}
      <span className="flex-1 truncate">{children}</span>
      <ChevronRight className="size-4 text-fg-subtle" aria-hidden="true" />
    </DM.SubTrigger>
  );
}

export function DropdownMenuLabel({ className, ...props }: ComponentProps<typeof DM.Label>) {
  return <DM.Label className={cn(menuLabel, className)} {...props} />;
}

export function DropdownMenuSeparator({ className, ...props }: ComponentProps<typeof DM.Separator>) {
  return <DM.Separator className={cn(menuSeparator, className)} {...props} />;
}

/** Right-aligned shortcut for custom item bodies. */
export function DropdownMenuShortcut({ keys, className }: { keys: string[]; className?: string }) {
  return <Kbd keys={keys} className={cn("ml-auto", className)} />;
}
