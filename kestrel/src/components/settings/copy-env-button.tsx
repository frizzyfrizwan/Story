"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "@/components/ui/toast";

/** Copies a ready-to-paste `.env.local` template with every integration key. */
export function CopyEnvButton({ template, keyCount }: { template: string; keyCount: number }) {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const t = setTimeout(() => setCopied(false), 2200);
    return () => clearTimeout(t);
  }, [copied]);

  async function copy() {
    try {
      await navigator.clipboard.writeText(template);
      setCopied(true);
      toast.success("Copied .env template", { description: `${keyCount} keys, each left blank for you to fill in.` });
    } catch {
      toast.error("Couldn't access the clipboard", { description: "Select the keys in the table and copy them by hand." });
    }
  }

  return (
    <Button type="button" variant="secondary" size="sm" onClick={copy} leading={copied ? <Check className="text-aurora" /> : <Copy />}>
      {copied ? "Copied" : "Copy .env template"}
    </Button>
  );
}
