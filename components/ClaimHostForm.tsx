"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { claimHost } from "@/lib/actions";
import { Button, Input } from "@/components/ui";

/** "I'm the host" recovery on the join page — host code → host cookie. */
export function ClaimHostForm({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, startTransition] = useTransition();

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mx-auto block cursor-pointer text-[10px] uppercase tracking-[0.3em] text-cream-faint transition hover:text-brass"
      >
        Hosting? Claim the table
      </button>
    );
  }

  return (
    <form
      className="mx-auto flex max-w-xs items-center gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        setError("");
        startTransition(async () => {
          const res = await claimHost(sessionId, code);
          if (res.ok) router.push(`/session/${sessionId}`);
          else setError(res.error);
        });
      }}
    >
      <Input
        value={code}
        onChange={(e) => setCode(e.target.value.toUpperCase())}
        placeholder="Host code"
        maxLength={6}
        autoFocus
        className="text-center font-display tracking-[0.3em]"
      />
      <Button type="submit" variant="outline" size="md" disabled={pending || !code.trim()}>
        Claim
      </Button>
      {error && <p className="text-xs text-loss">{error}</p>}
    </form>
  );
}
