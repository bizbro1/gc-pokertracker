"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

/**
 * Subscribes to Supabase Realtime for this session's rows and refreshes the
 * server-rendered page when anything changes. Keeps every device in sync.
 */
export function RealtimeRefresher({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();

    const refresh = () => {
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(() => router.refresh(), 250);
    };

    const filter = `session_id=eq.${sessionId}`;
    const channel = supabase
      .channel(`session-${sessionId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "players", filter }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions", filter }, refresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
        refresh
      )
      .subscribe();

    return () => {
      if (timer.current) clearTimeout(timer.current);
      supabase.removeChannel(channel);
    };
  }, [sessionId, router]);

  return null;
}
