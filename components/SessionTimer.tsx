"use client";

import { useEffect, useState } from "react";

function elapsed(startedAt: string): string {
  const ms = Date.now() - new Date(startedAt).getTime();
  if (ms < 0) return "0:00";
  const totalSec = Math.floor(ms / 1000);
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  return h > 0
    ? `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${m}:${String(s).padStart(2, "0")}`;
}

export function SessionTimer({ startedAt }: { startedAt: string }) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    setText(elapsed(startedAt));
    const t = setInterval(() => setText(elapsed(startedAt)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  return (
    <div className="text-right">
      <p className="text-[10px] uppercase tracking-[0.2em] text-cream-dim">At the table</p>
      <p className="font-display text-2xl text-brass tabular-nums leading-none mt-0.5">
        {text || "\u2014"}
      </p>
    </div>
  );
}
