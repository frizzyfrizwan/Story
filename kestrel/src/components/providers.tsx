"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@radix-ui/react-tooltip";
import { Toaster } from "sonner";
import { useState } from "react";

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, refetchOnWindowFocus: false, retry: 1 },
        },
      }),
  );
  return (
    <QueryClientProvider client={client}>
      <TooltipProvider delayDuration={200}>{children}</TooltipProvider>
      <Toaster
        position="bottom-right"
        theme="system"
        toastOptions={{
          classNames: {
            toast: "!bg-bg-elev-2 !text-fg !border !border-panel-border !shadow-panel !rounded-[14px]",
            description: "!text-fg-muted",
          },
        }}
      />
    </QueryClientProvider>
  );
}
