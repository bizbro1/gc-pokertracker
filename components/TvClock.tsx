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

/** Big-screen elapsed-time clock for TV mode. */
export function TvClock({ startedAt }: { startedAt: string }) {
  const [text, setText] = useState<string>("");

  useEffect(() => {
    setText(elapsed(startedAt));
    const t = setInterval(() => setText(elapsed(startedAt)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  return (
    <div className="text-right">
      <p className="text-xs uppercase tracking-[0.3em] text-cream-dim">At the table</p>
      <p className="mt-1 font-display text-6xl text-brass tabular-nums leading-none">
        {text || "—"}
      </p>
    </div>
  );
}
