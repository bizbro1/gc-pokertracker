"use client";

import { useState, useTransition } from "react";
import { addPlayer } from "@/lib/actions";
import { Button, Input } from "@/components/ui";

export function AddPlayerForm({ sessionId }: { sessionId: string }) {
  const [name, setName] = useState("");
  const [pending, startTransition] = useTransition();

  function submit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    startTransition(async () => {
      const res = await addPlayer(sessionId, trimmed);
      if (res.ok) setName("");
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Input
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Add player by name"
        className="h-8 w-44 text-xs"
      />
      <Button size="sm" variant="outline" disabled={pending || !name.trim()} onClick={submit}>
        Add
      </Button>
    </div>
  );
}
