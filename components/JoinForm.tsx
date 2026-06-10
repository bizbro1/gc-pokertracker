"use client";

import { useState, useTransition } from "react";
import { joinSession } from "@/lib/actions";
import { Button, Input, Label } from "@/components/ui";

export function JoinForm({ joinCode }: { joinCode: string }) {
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await joinSession(joinCode, trimmed);
      if (res?.error) setError(res.error);
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <Label htmlFor="player-name">Your name</Label>
        <Input
          id="player-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          placeholder="As known at the club"
          autoFocus
          maxLength={40}
        />
      </div>
      {error && <p className="text-xs text-loss">{error}</p>}
      <Button size="lg" className="w-full" disabled={pending || !name.trim()} onClick={submit}>
        {pending ? "Taking your seat\u2026" : "Take a seat"}
      </Button>
      <p className="text-center text-[11px] text-cream-faint">
        The host handles all buy-ins and cash-outs at the table.
      </p>
    </div>
  );
}
