"use client";

import { createElement } from "react";
import { toast as sonner, type ExternalToast } from "sonner";
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from "lucide-react";

type Message = Parameters<typeof sonner>[0];

const icon = (Icon: LucideIcon, tone: string) =>
  createElement(Icon, { className: `size-4 ${tone}`, "aria-hidden": true, strokeWidth: 2.2 });

/**
 * Themed toasts. Same API as sonner's `toast`, with Kestrel icons:
 * aurora check, sky info, rose error, gold warning.
 * The <Toaster> itself lives in `components/providers.tsx`.
 */
export const toast = Object.assign((message: Message, options?: ExternalToast) => sonner(message, options), {
  success: (message: Message, options?: ExternalToast) =>
    sonner.success(message, { icon: icon(CircleCheck, "text-aurora"), ...options }),
  info: (message: Message, options?: ExternalToast) => sonner.info(message, { icon: icon(Info, "text-sky"), ...options }),
  error: (message: Message, options?: ExternalToast) =>
    sonner.error(message, { icon: icon(CircleAlert, "text-rose"), duration: 6000, ...options }),
  warning: (message: Message, options?: ExternalToast) =>
    sonner.warning(message, { icon: icon(TriangleAlert, "text-gold"), ...options }),
  loading: sonner.loading,
  promise: sonner.promise,
  custom: sonner.custom,
  message: sonner.message,
  dismiss: sonner.dismiss,
  getHistory: sonner.getHistory,
});

export type { ExternalToast };
