"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui";
import { Player, Session, Tx } from "@/lib/types";
import { TvDisplay } from "./TvDisplay";

/**
 * TV mode is an overlay on the session page, not a route — opening it mounts
 * the display over the dashboard and requests fullscreen on the click
 * gesture; leaving fullscreen (Esc) unmounts it and you're back where you
 * were.
 */
export function TvModeButton({
  session,
  players,
  txs,
  avatars,
}: {
  session: Session;
  players: Player[];
  txs: Tx[];
  avatars: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);

  const openTv = () => {
    setOpen(true);
    document.documentElement.requestFullscreen?.().catch(() => {});
  };

  const close = () => {
    setOpen(false);
    if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
  };

  useEffect(() => {
    if (!open) return;
    const onFsChange = () => {
      if (!document.fullscreenElement) setOpen(false);
    };
    // Fallback for when fullscreen was denied — Esc still closes the overlay
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !document.fullscreenElement) setOpen(false);
    };
    document.addEventListener("fullscreenchange", onFsChange);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("fullscreenchange", onFsChange);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <>
      <Button variant="outline" size="md" onClick={openTv}>
        ⛶ TV mode
      </Button>
      {open && (
        <div className="fixed inset-0 z-[100] overflow-y-auto bg-ink">
          <TvDisplay
            session={session}
            players={players}
            txs={txs}
            avatars={avatars}
            onExit={close}
          />
        </div>
      )}
    </>
  );
}
