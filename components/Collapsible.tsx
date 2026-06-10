"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { Card } from "@/components/ui";

export function Collapsible({
  title,
  subtitle,
  defaultOpen = false,
  className,
  children,
}: {
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Card className={cn("overflow-hidden", className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left cursor-pointer"
        aria-expanded={open}
      >
        <div>
          <h2 className="font-display text-xl text-brass tracking-wide">{title}</h2>
          {subtitle && <p className="mt-0.5 text-xs text-cream-dim">{subtitle}</p>}
        </div>
        <span
          className={cn(
            "text-brass-dim transition-transform duration-200",
            open && "rotate-180"
          )}
        >
          &#9662;
        </span>
      </button>
      {open && <div className="border-t hairline">{children}</div>}
    </Card>
  );
}
