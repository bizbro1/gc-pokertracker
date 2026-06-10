"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase/admin";
import { generateJoinCode, generateSecretKey } from "./keys";
import { cashToChips, chipsToCash } from "./derive";
import { hostCookieName, playerCookieName } from "./cookie-names";
import { Session } from "./types";

const COOKIE_OPTS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30,
};

type ActionResult = { ok: true } | { ok: false; error: string };

async function requireHost(sessionId: string): Promise<void> {
  const jar = await cookies();
  const key = jar.get(hostCookieName(sessionId))?.value;
  if (!key) throw new Error("Not the host of this session");
  const { data } = await supabaseAdmin()
    .from("session_keys")
    .select("host_key")
    .eq("session_id", sessionId)
    .single();
  if (!data || data.host_key !== key) throw new Error("Not the host of this session");
}

async function getSession(sessionId: string): Promise<Session> {
  const { data, error } = await supabaseAdmin()
    .from("sessions")
    .select("*")
    .eq("id", sessionId)
    .single();
  if (error || !data) throw new Error("Session not found");
  return data as Session;
}

function refresh(sessionId: string) {
  revalidatePath(`/session/${sessionId}`);
  revalidatePath(`/session/${sessionId}/me`);
  revalidatePath(`/session/${sessionId}/summary`);
  revalidatePath("/");
}

function fail(e: unknown): ActionResult {
  return { ok: false, error: e instanceof Error ? e.message : "Something went wrong" };
}

// ---------------------------------------------------------------------------
// Session lifecycle
// ---------------------------------------------------------------------------

export async function createSession(formData: FormData): Promise<void> {
  const db = supabaseAdmin();

  const name = String(formData.get("name") ?? "").trim() || "Club Night";
  const currency_code = (String(formData.get("currency_code") ?? "NOK").trim() || "NOK").toUpperCase();
  const cash_per_rate = Number(formData.get("cash_per_rate")) || 1000;
  const chips_per_rate = Number(formData.get("chips_per_rate")) || 20000;
  const default_buy_in_cash = Number(formData.get("default_buy_in_cash")) || 1000;
  const small_blind = Number(formData.get("small_blind")) || 0;
  const big_blind = Number(formData.get("big_blind")) || 0;
  const notes = String(formData.get("notes") ?? "").trim();

  const join_code = generateJoinCode();
  const host_key = generateSecretKey();

  const { data: session, error } = await db
    .from("sessions")
    .insert({
      name,
      currency_code,
      cash_per_rate,
      chips_per_rate,
      default_buy_in_cash,
      small_blind,
      big_blind,
      notes,
      join_code,
    })
    .select("id")
    .single();
  if (error || !session) throw new Error(error?.message ?? "Could not create session");

  const { error: keyError } = await db
    .from("session_keys")
    .insert({ session_id: session.id, host_key });
  if (keyError) {
    await db.from("sessions").delete().eq("id", session.id);
    throw new Error(keyError.message);
  }

  const jar = await cookies();
  jar.set(hostCookieName(session.id), host_key, COOKIE_OPTS);

  revalidatePath("/");
  redirect(`/session/${session.id}`);
}

export async function startSession(sessionId: string): Promise<ActionResult> {
  try {
    await requireHost(sessionId);
    const { error } = await supabaseAdmin()
      .from("sessions")
      .update({ status: "active", started_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "setup");
    if (error) throw new Error(error.message);
    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function endSession(sessionId: string): Promise<ActionResult> {
  try {
    await requireHost(sessionId);
    const { error } = await supabaseAdmin()
      .from("sessions")
      .update({ status: "ended", ended_at: new Date().toISOString() })
      .eq("id", sessionId);
    if (error) throw new Error(error.message);
    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  await requireHost(sessionId);
  await supabaseAdmin().from("sessions").delete().eq("id", sessionId);
  revalidatePath("/");
  redirect("/");
}

// ---------------------------------------------------------------------------
// Players
// ---------------------------------------------------------------------------

export async function addPlayer(sessionId: string, name: string): Promise<ActionResult> {
  try {
    await requireHost(sessionId);
    const trimmed = name.trim();
    if (!trimmed) return { ok: false, error: "Name is required" };
    const { error } = await supabaseAdmin()
      .from("players")
      .insert({ session_id: sessionId, name: trimmed });
    if (error) throw new Error(error.message);
    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function joinSession(joinCode: string, name: string): Promise<{ error?: string }> {
  const db = supabaseAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { error: "Enter your name" };

  const { data: session } = await db
    .from("sessions")
    .select("id, status")
    .eq("join_code", joinCode.toUpperCase())
    .single();
  if (!session) return { error: "Invalid invite code" };
  if (session.status === "ended") return { error: "This session has ended" };

  const jar = await cookies();

  // Already joined from this phone? Just go back to the table.
  const existingKey = jar.get(playerCookieName(session.id))?.value;
  if (existingKey) {
    const { data: existing } = await db
      .from("player_keys")
      .select("player_id")
      .eq("player_key", existingKey)
      .single();
    if (existing) redirect(`/session/${session.id}/me`);
  }

  const { data: player, error } = await db
    .from("players")
    .insert({ session_id: session.id, name: trimmed })
    .select("id")
    .single();
  if (error || !player) return { error: error?.message ?? "Could not join" };

  const player_key = generateSecretKey();
  const { error: keyError } = await db
    .from("player_keys")
    .insert({ player_id: player.id, player_key });
  if (keyError) {
    await db.from("players").delete().eq("id", player.id);
    return { error: keyError.message };
  }

  jar.set(playerCookieName(session.id), player_key, COOKIE_OPTS);
  refresh(session.id);
  redirect(`/session/${session.id}/me`);
}

export async function removePlayer(sessionId: string, playerId: string): Promise<ActionResult> {
  try {
    await requireHost(sessionId);
    const { error } = await supabaseAdmin()
      .from("players")
      .delete()
      .eq("id", playerId)
      .eq("session_id", sessionId);
    if (error) throw new Error(error.message);
    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function assignSeat(
  sessionId: string,
  playerId: string,
  seat: number | null
): Promise<ActionResult> {
  try {
    await requireHost(sessionId);
    const db = supabaseAdmin();

    if (seat !== null) {
      // Free the seat first if someone else is sitting there
      await db
        .from("players")
        .update({ seat: null })
        .eq("session_id", sessionId)
        .eq("seat", seat)
        .neq("id", playerId);
    }

    const { error } = await db
      .from("players")
      .update({ seat })
      .eq("id", playerId)
      .eq("session_id", sessionId);
    if (error) throw new Error(error.message);
    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Money
// ---------------------------------------------------------------------------

export async function addBuyIn(
  sessionId: string,
  playerId: string,
  cashAmount: number
): Promise<ActionResult> {
  try {
    await requireHost(sessionId);
    if (!Number.isFinite(cashAmount) || cashAmount <= 0)
      return { ok: false, error: "Buy-in must be a positive amount" };

    const session = await getSession(sessionId);
    const chips = cashToChips(session, cashAmount);

    const db = supabaseAdmin();
    const { error } = await db.from("transactions").insert({
      session_id: sessionId,
      player_id: playerId,
      type: "buy_in",
      cash_amount: cashAmount,
      chip_amount: chips,
    });
    if (error) throw new Error(error.message);

    // A re-buy puts a cashed-out player back in the game
    await db
      .from("players")
      .update({ status: "active" })
      .eq("id", playerId)
      .eq("status", "cashed_out");

    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function adjustChips(
  sessionId: string,
  playerId: string,
  chipDelta: number
): Promise<ActionResult> {
  try {
    await requireHost(sessionId);
    if (!Number.isFinite(chipDelta) || chipDelta === 0)
      return { ok: false, error: "Adjustment cannot be zero" };
    const { error } = await supabaseAdmin().from("transactions").insert({
      session_id: sessionId,
      player_id: playerId,
      type: "adjustment",
      cash_amount: 0,
      chip_amount: Math.round(chipDelta),
    });
    if (error) throw new Error(error.message);
    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function cashOutPlayer(
  sessionId: string,
  playerId: string,
  chipsReturned: number
): Promise<ActionResult> {
  try {
    await requireHost(sessionId);
    if (!Number.isFinite(chipsReturned) || chipsReturned < 0)
      return { ok: false, error: "Chips returned must be zero or more" };

    const session = await getSession(sessionId);
    const cash = chipsToCash(session, chipsReturned);

    const db = supabaseAdmin();
    const { error } = await db.from("transactions").insert({
      session_id: sessionId,
      player_id: playerId,
      type: "cash_out",
      cash_amount: cash,
      chip_amount: Math.round(chipsReturned),
    });
    if (error) throw new Error(error.message);

    await db.from("players").update({ status: "cashed_out" }).eq("id", playerId);

    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}
