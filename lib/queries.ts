import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { Player, Session, Tx } from "./types";

export interface SessionListItem extends Session {
  players: { count: number }[];
}

export async function listSessions(): Promise<SessionListItem[]> {
  const { data, error } = await supabaseAdmin()
    .from("sessions")
    .select("*, players(count)")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as SessionListItem[];
}

export interface SessionBundle {
  session: Session;
  players: Player[];
  txs: Tx[];
}

export async function getSessionBundle(sessionId: string): Promise<SessionBundle | null> {
  const db = supabaseAdmin();
  const [sessionRes, playersRes, txsRes] = await Promise.all([
    db.from("sessions").select("*").eq("id", sessionId).maybeSingle(),
    db.from("players").select("*").eq("session_id", sessionId).order("created_at"),
    db.from("transactions").select("*").eq("session_id", sessionId).order("created_at"),
  ]);
  if (!sessionRes.data) return null;
  return {
    session: sessionRes.data as Session,
    players: (playersRes.data ?? []) as Player[],
    txs: (txsRes.data ?? []) as Tx[],
  };
}

export async function getSessionByJoinCode(code: string): Promise<Session | null> {
  const { data } = await supabaseAdmin()
    .from("sessions")
    .select("*")
    .eq("join_code", code.toUpperCase())
    .maybeSingle();
  return (data as Session) ?? null;
}

export async function isHost(sessionId: string, cookieKey: string | undefined): Promise<boolean> {
  if (!cookieKey) return false;
  const { data } = await supabaseAdmin()
    .from("session_keys")
    .select("host_key")
    .eq("session_id", sessionId)
    .maybeSingle();
  return !!data && data.host_key === cookieKey;
}

export async function getPlayerIdByKey(playerKey: string | undefined): Promise<string | null> {
  if (!playerKey) return null;
  const { data } = await supabaseAdmin()
    .from("player_keys")
    .select("player_id")
    .eq("player_key", playerKey)
    .maybeSingle();
  return data?.player_id ?? null;
}
