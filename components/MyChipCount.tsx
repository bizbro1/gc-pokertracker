"use client";

import { useState, useTransition } from "react";
import { setMyChipCount } from "@/lib/actions";
import { Collapsible } from "@/components/Collapsible";
import { ChipCounter } from "@/components/ChipCounter";

export function MyChipCount({ sessionId }: { sessionId: string }) {
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  function submit(total: number) {
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const res = await setMyChipCount(sessionId, total);
      if (!res.ok && res.error) setError(res.error);
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    });
  }

  return (
    <Collapsible
      title="Count Your Chips"
      subtitle="Stack them by colour and update your total"
      className="mt-6"
    >
      <div className="px-5 py-4">
        <ChipCounter compact submitLabel={saved ? "Saved" : "Update my chips"} pending={pending} onSubmit={submit} />
        {error && <p className="mt-2 text-xs text-loss">{error}</p>}
      </div>
    </Collapsible>
  );
}
