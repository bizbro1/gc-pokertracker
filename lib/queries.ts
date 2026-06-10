import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { Player, Session, Tx } from "./types";

export interface SessionListItem extends Session {
  players: { count: number }[];
}

export async function listSessions(statuses?: string[]): Promise<SessionListItem[]> {
  let query = supabaseAdmin()
    .from("sessions")
    .select("*, players(count)")
    .order("created_at", { ascending: false });
  if (statuses?.length) query = query.in("status", statuses);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as SessionListItem[];
}

export interface AllData {
  sessions: Session[];
  players: Player[];
  txs: Tx[];
}

/** Everything in the club's books — used for cross-session rankings. */
export async function getAllData(): Promise<AllData> {
  const db = supabaseAdmin();
  const [sessionsRes, playersRes, txsRes] = await Promise.all([
    db.from("sessions").select("*").order("created_at", { ascending: false }),
    db.from("players").select("*"),
    db.from("transactions").select("*"),
  ]);
  return {
    sessions: (sessionsRes.data ?? []) as Session[],
    players: (playersRes.data ?? []) as Player[],
    txs: (txsRes.data ?? []) as Tx[],
  };
}

export interface SessionBundle {
  session: Session;
  players: Player[];
  txs: Tx[];
  /** playerId -> public avatar URL */
  avatars: Record<string, string>;
}

/** playerId -> public avatar URL (files in the avatars bucket are named <playerId>.jpg) */
export async function getAvatarMap(): Promise<Record<string, string>> {
  const db = supabaseAdmin();
  const { data } = await db.storage.from("avatars").list("", { limit: 1000 });
  const map: Record<string, string> = {};
  for (const f of data ?? []) {
    const id = f.name.replace(/\.[a-z0-9]+$/i, "");
    const { data: pub } = db.storage.from("avatars").getPublicUrl(f.name);
    const v = f.updated_at ? new Date(f.updated_at).getTime() : 0;
    map[id] = `${pub.publicUrl}?v=${v}`;
  }
  return map;
}

export async function getSessionBundle(sessionId: string): Promise<SessionBundle | null> {
  const db = supabaseAdmin();
  const [sessionRes, playersRes, txsRes, avatars] = await Promise.all([
    db.from("sessions").select("*").eq("id", sessionId).maybeSingle(),
    db.from("players").select("*").eq("session_id", sessionId).order("created_at"),
    db.from("transactions").select("*").eq("session_id", sessionId).order("created_at"),
    getAvatarMap(),
  ]);
  if (!sessionRes.data) return null;
  return {
    session: sessionRes.data as Session,
    players: (playersRes.data ?? []) as Player[],
    txs: (txsRes.data ?? []) as Tx[],
    avatars,
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
