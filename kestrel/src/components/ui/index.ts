/**
 * Kestrel design-system primitives — barrel.
 * Import from "@/components/ui" or from the individual file.
 */

export { Button, IconButton, buttonVariants, type ButtonProps, type IconButtonProps } from "./button";
export {
  Field,
  Input,
  Textarea,
  SearchInput,
  useFieldContext,
  type FieldProps,
  type InputProps,
  type TextareaProps,
  type SearchInputProps,
} from "./input";
export {
  Select,
  SelectRoot,
  SelectTrigger,
  SelectContent,
  SelectItem,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
  SelectValue,
  type SelectProps,
  type SelectOption,
  type SelectOptionGroup,
} from "./select";
export {
  SegmentedControl,
  CabinPicker,
  type SegmentedControlProps,
  type SegmentedOption,
  type SegmentAccent,
  type CabinPickerProps,
} from "./segmented";
export { NumberStepper, type NumberStepperProps } from "./stepper";
export { Switch, type SwitchProps } from "./switch";
export { Checkbox, type CheckboxProps } from "./checkbox";
export { Slider, type SliderProps } from "./slider";
export { AirportCombobox, type AirportComboboxProps, type AirportFetcher } from "./airport-combobox";
export {
  Calendar,
  DatePicker,
  DateRangePicker,
  type CalendarProps,
  type DatePickerProps,
  type DateRangePickerProps,
  type DateRange,
  type HeatLevel,
  type HeatMap,
} from "./date-picker";
export { Panel, Card, Section, type PanelProps, type CardProps, type SectionProps } from "./panel";
export {
  Badge,
  CabinBadge,
  SourceBadge,
  ProgramChip,
  badgeVariants,
  type BadgeProps,
  type CabinBadgeProps,
  type SourceBadgeProps,
  type ProgramChipProps,
} from "./badge";
export { Tabs, TabsList, TabsTrigger, TabsContent, type TabsListProps, type TabsTriggerProps } from "./tabs";
export {
  Dialog,
  DialogTrigger,
  DialogClose,
  DialogContent,
  Sheet,
  SheetTrigger,
  SheetClose,
  SheetContent,
  useDialog,
  type DialogProps,
  type DialogContentProps,
  type SheetContentProps,
} from "./dialog";
export {
  Popover,
  PopoverTrigger,
  PopoverAnchor,
  PopoverClose,
  PopoverContent,
  type PopoverContentProps,
} from "./popover";
export { Tooltip, TooltipProvider, type TooltipProps } from "./tooltip";
export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuCheckboxItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
  DropdownMenuGroup,
  DropdownMenuPortal,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
  type DropdownMenuItemProps,
} from "./dropdown";
export { ScrollArea, ScrollBar, type ScrollAreaProps } from "./scroll-area";
export { Skeleton, SkeletonText, SkeletonCard, type SkeletonTextProps, type SkeletonCardProps } from "./skeleton";
export { EmptyState, RadarKestrel, type EmptyStateProps } from "./empty-state";
export { StatTile, Sparkline, type StatTileProps, type SparklineProps, type StatTone } from "./stat";
export { Kbd, useIsMac, type KbdProps } from "./kbd";
export { Marquee, type MarqueeProps } from "./marquee";
export { NumberTicker, type NumberTickerProps } from "./number-ticker";
export { Progress, ProgressRing, type ProgressProps, type ProgressRingProps, type ProgressTone } from "./progress";
export {
  Avatar,
  AvatarGroup,
  avatarGradient,
  initialsOf,
  type AvatarProps,
  type AvatarGroupProps,
  type AvatarSize,
} from "./avatar";
export { Divider, type DividerProps } from "./divider";
export { toast, type ExternalToast } from "./toast";
export { Spinner, type SpinnerProps } from "./spinner";

export { useTheme, setTheme, type Theme } from "./use-theme";
export { useMediaQuery, useIsDesktop, usePrefersReducedMotion } from "./use-media-query";
export { useControllableState } from "./use-controllable";
export {
  focusRing,
  focusField,
  fieldSurface,
  fieldSize,
  popIn,
  floating,
  menuItem,
  menuLabel,
  menuSeparator,
} from "./tokens";
