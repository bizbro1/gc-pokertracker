"use server";

import { randomInt } from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { supabaseAdmin } from "./supabase/admin";
import { generateJoinCode, generateSecretKey } from "./keys";
import { cashToChips, chipsToCash } from "./derive";
import { structureAsText } from "./blinds";
import { compareScores, evaluate7, PlayingCard, RANKS, SUITS } from "./poker";
import { getPlayerIdByKey } from "./queries";
import { hostCookieName, playerCookieName } from "./cookie-names";
import { BlindPlan, DuelDeal, Session } from "./types";

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

  let blind_schedule: BlindPlan | null = null;
  try {
    const raw = String(formData.get("blind_schedule") ?? "");
    if (raw) {
      const parsed = JSON.parse(raw) as BlindPlan;
      if (Array.isArray(parsed.levels) && parsed.levels.length > 0) blind_schedule = parsed;
    }
  } catch {
    /* a broken schedule never blocks session creation */
  }

  const join_code = generateJoinCode();
  const host_key = generateSecretKey();

  const row = {
    name,
    currency_code,
    cash_per_rate,
    chips_per_rate,
    default_buy_in_cash,
    small_blind,
    big_blind,
    notes,
    join_code,
  };

  const insertRow: Record<string, unknown> = { ...row };
  if (blind_schedule) insertRow.blind_schedule = blind_schedule;

  let { data: session, error } = await db
    .from("sessions")
    .insert(insertRow)
    .select("id")
    .single();

  // Migration 0002 not run yet — fall back to the legacy notes format so the
  // schedule still reaches the TV clock
  if (error && blind_schedule && /blind_schedule/i.test(error.message)) {
    const text = structureAsText(blind_schedule.levels, blind_schedule.levelMin);
    ({ data: session, error } = await db
      .from("sessions")
      .insert({ ...row, notes: notes ? `${notes}\n\n${text}` : text })
      .select("id")
      .single());
  }
  if (error || !session) throw new Error(error?.message ?? "Could not create session");

  const host_code = generateJoinCode();
  let { error: keyError } = await db
    .from("session_keys")
    .insert({ session_id: session.id, host_key, host_code });
  // Migration 0003 not run yet — create without a recovery code
  if (keyError && /host_code/i.test(keyError.message)) {
    ({ error: keyError } = await db
      .from("session_keys")
      .insert({ session_id: session.id, host_key }));
  }
  if (keyError) {
    await db.from("sessions").delete().eq("id", session.id);
    throw new Error(keyError.message);
  }

  const jar = await cookies();
  jar.set(hostCookieName(session.id), host_key, COOKIE_OPTS);

  revalidatePath("/");
  redirect(`/session/${session.id}`);
}

/**
 * Claim host on a new device with the session's host code — the host cookie
 * lives in one browser, so this is the recovery path when the host switches
 * devices or loses the cookie.
 */
export async function claimHost(sessionId: string, code: string): Promise<ActionResult> {
  try {
    const cleaned = code.trim().toUpperCase();
    if (!cleaned) return { ok: false, error: "Enter the host code" };
    const { data, error } = await supabaseAdmin()
      .from("session_keys")
      .select("host_key, host_code")
      .eq("session_id", sessionId)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data?.host_code || data.host_code.toUpperCase() !== cleaned)
      return { ok: false, error: "Wrong host code" };

    const jar = await cookies();
    jar.set(hostCookieName(sessionId), data.host_key, COOKIE_OPTS);
    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
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

  // Same name at this table? Continue as that player instead of duplicating.
  const { data: existingPlayers } = await db
    .from("players")
    .select("id, name")
    .eq("session_id", session.id);
  const match = (existingPlayers ?? []).find(
    (p) => p.name.trim().toLowerCase() === trimmed.toLowerCase()
  );

  let playerId: string;
  if (match) {
    playerId = match.id;
  } else {
    const { data: player, error } = await db
      .from("players")
      .insert({ session_id: session.id, name: trimmed })
      .select("id")
      .single();
    if (error || !player) return { error: error?.message ?? "Could not join" };
    playerId = player.id;
  }

  const player_key = generateSecretKey();
  const { error: keyError } = await db
    .from("player_keys")
    .upsert({ player_id: playerId, player_key });
  if (keyError) {
    if (!match) await db.from("players").delete().eq("id", playerId);
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

// ---------------------------------------------------------------------------
// Poker Duel — a fun side-game between two players, settled by the server
// and showcased on the TV.
// ---------------------------------------------------------------------------

async function getCallerPlayerId(sessionId: string): Promise<string | null> {
  const jar = await cookies();
  return getPlayerIdByKey(jar.get(playerCookieName(sessionId))?.value);
}

/** Crypto-shuffled 52-card deck. */
function shuffledDeck(): PlayingCard[] {
  const deck: PlayingCard[] = [];
  for (const suit of SUITS) for (const rank of RANKS) deck.push({ rank, suit });
  for (let i = deck.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [deck[i], deck[j]] = [deck[j]!, deck[i]!];
  }
  return deck;
}

export async function challengeDuel(
  sessionId: string,
  opponentId: string,
  chipAmount: number
): Promise<ActionResult> {
  try {
    const caller = await getCallerPlayerId(sessionId);
    if (!caller) return { ok: false, error: "Join the session first" };
    if (caller === opponentId) return { ok: false, error: "You can't duel yourself" };

    const amount = Math.round(chipAmount);
    if (!Number.isFinite(amount) || amount <= 0)
      return { ok: false, error: "The wager must be a positive chip amount" };

    const session = await getSession(sessionId);
    if (session.status !== "active")
      return { ok: false, error: "Duels only happen at a live table" };

    const db = supabaseAdmin();
    const { data: fighters, error: playersError } = await db
      .from("players")
      .select("id, status")
      .eq("session_id", sessionId)
      .in("id", [caller, opponentId]);
    if (playersError) throw new Error(playersError.message);
    if (
      (fighters ?? []).length !== 2 ||
      (fighters ?? []).some((p) => p.status !== "active")
    )
      return { ok: false, error: "Both players must be in the game" };

    // One open challenge per player keeps the table sane
    const { data: open, error: openError } = await db
      .from("duels")
      .select("id, challenger_id, opponent_id")
      .eq("session_id", sessionId)
      .eq("status", "pending");
    if (openError) throw new Error(openError.message);
    const busy = (open ?? []).some(
      (d) =>
        [d.challenger_id, d.opponent_id].includes(caller) ||
        [d.challenger_id, d.opponent_id].includes(opponentId)
    );
    if (busy) return { ok: false, error: "There's already an open challenge at the table" };

    const { error } = await db.from("duels").insert({
      session_id: sessionId,
      challenger_id: caller,
      opponent_id: opponentId,
      chip_amount: amount,
    });
    if (error) throw new Error(error.message);
    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function respondToDuel(
  sessionId: string,
  duelId: string,
  accept: boolean
): Promise<ActionResult> {
  try {
    const caller = await getCallerPlayerId(sessionId);
    if (!caller) return { ok: false, error: "Join the session first" };

    const db = supabaseAdmin();
    const { data: duel, error: duelError } = await db
      .from("duels")
      .select("*")
      .eq("id", duelId)
      .eq("session_id", sessionId)
      .maybeSingle();
    if (duelError) throw new Error(duelError.message);
    if (!duel || duel.status !== "pending")
      return { ok: false, error: "This challenge is no longer open" };
    if (duel.opponent_id !== caller)
      return { ok: false, error: "This challenge isn't yours to answer" };

    if (!accept) {
      const { error } = await db
        .from("duels")
        .update({ status: "declined", settled_at: new Date().toISOString() })
        .eq("id", duelId)
        .eq("status", "pending");
      if (error) throw new Error(error.message);
      refresh(sessionId);
      return { ok: true };
    }

    // Deal: 2 hole cards each (holes[0] = challenger) + a full board
    const deck = shuffledDeck();
    const deal: DuelDeal = {
      holes: [
        [deck[0]!, deck[1]!],
        [deck[2]!, deck[3]!],
      ],
      board: deck.slice(4, 9),
    };
    const a = evaluate7([...deal.holes[0], ...deal.board]);
    const b = evaluate7([...deal.holes[1], ...deal.board]);
    const cmp = compareScores(a.score, b.score);
    const winnerId = cmp > 0 ? duel.challenger_id : cmp < 0 ? duel.opponent_id : null;

    // Guard with status=pending so a double-tap can't settle twice
    const { data: settled, error: settleError } = await db
      .from("duels")
      .update({
        status: "settled",
        deal,
        winner_id: winnerId,
        settled_at: new Date().toISOString(),
      })
      .eq("id", duelId)
      .eq("status", "pending")
      .select("id")
      .maybeSingle();
    if (settleError) throw new Error(settleError.message);
    if (!settled) return { ok: false, error: "This challenge is no longer open" };

    if (winnerId) {
      const loserId =
        winnerId === duel.challenger_id ? duel.opponent_id : duel.challenger_id;
      const amount = Number(duel.chip_amount);
      const { error: txError } = await db.from("transactions").insert([
        {
          session_id: sessionId,
          player_id: winnerId,
          type: "adjustment",
          cash_amount: 0,
          chip_amount: amount,
          duel_id: duelId,
        },
        {
          session_id: sessionId,
          player_id: loserId,
          type: "adjustment",
          cash_amount: 0,
          chip_amount: -amount,
          duel_id: duelId,
        },
      ]);
      if (txError) throw new Error(txError.message);
    }

    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function cancelDuel(sessionId: string, duelId: string): Promise<ActionResult> {
  try {
    const caller = await getCallerPlayerId(sessionId);
    if (!caller) return { ok: false, error: "Join the session first" };
    const { error } = await supabaseAdmin()
      .from("duels")
      .update({ status: "cancelled", settled_at: new Date().toISOString() })
      .eq("id", duelId)
      .eq("session_id", sessionId)
      .eq("challenger_id", caller)
      .eq("status", "pending");
    if (error) throw new Error(error.message);
    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---------------------------------------------------------------------------
// Blind clock
// ---------------------------------------------------------------------------

export async function pauseBlindClock(sessionId: string): Promise<ActionResult> {
  try {
    await requireHost(sessionId);
    const { error } = await supabaseAdmin()
      .from("sessions")
      .update({ blind_paused_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("status", "active")
      .is("blind_paused_at", null);
    if (error) throw new Error(error.message);
    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function resumeBlindClock(sessionId: string): Promise<ActionResult> {
  try {
    await requireHost(sessionId);
    const session = await getSession(sessionId);
    if (!session.blind_paused_at) return { ok: true };
    const pausedMs =
      (session.blind_paused_ms ?? 0) +
      Math.max(0, Date.now() - new Date(session.blind_paused_at).getTime());
    const { error } = await supabaseAdmin()
      .from("sessions")
      .update({ blind_paused_at: null, blind_paused_ms: Math.round(pausedMs) })
      .eq("id", sessionId);
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

/** Undo a mistaken entry. Removing a cash-out puts the player back in the game. */
export async function deleteTransaction(sessionId: string, txId: string): Promise<ActionResult> {
  try {
    await requireHost(sessionId);
    const db = supabaseAdmin();
    const { data: tx, error: txError } = await db
      .from("transactions")
      .select("*")
      .eq("id", txId)
      .eq("session_id", sessionId)
      .maybeSingle();
    if (txError) throw new Error(txError.message);
    if (!tx) return { ok: false, error: "Entry not found" };

    const { error } = await db.from("transactions").delete().eq("id", txId);
    if (error) throw new Error(error.message);

    if (tx.type === "cash_out") {
      await db
        .from("players")
        .update({ status: "active" })
        .eq("id", tx.player_id)
        .eq("status", "cashed_out");
    }

    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

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

async function currentChipsOf(playerId: string): Promise<number> {
  const { data, error } = await supabaseAdmin()
    .from("transactions")
    .select("type, chip_amount")
    .eq("player_id", playerId);
  if (error) throw new Error(error.message);
  let chips = 0;
  for (const t of data ?? []) {
    if (t.type === "buy_in" || t.type === "adjustment") chips += Number(t.chip_amount);
    else if (t.type === "cash_out") chips -= Number(t.chip_amount);
  }
  return chips;
}

/** Set a player's counted chip total; stored as an adjustment for the delta. */
async function applyChipCount(sessionId: string, playerId: string, totalChips: number): Promise<ActionResult> {
  if (!Number.isFinite(totalChips) || totalChips < 0)
    return { ok: false, error: "Chip count must be zero or more" };

  const current = await currentChipsOf(playerId);
  const delta = Math.round(totalChips) - current;
  if (delta === 0) return { ok: true };

  const { error } = await supabaseAdmin().from("transactions").insert({
    session_id: sessionId,
    player_id: playerId,
    type: "adjustment",
    cash_amount: 0,
    chip_amount: delta,
  });
  if (error) throw new Error(error.message);
  refresh(sessionId);
  return { ok: true };
}

export async function setChipCount(
  sessionId: string,
  playerId: string,
  totalChips: number
): Promise<ActionResult> {
  try {
    await requireHost(sessionId);
    return await applyChipCount(sessionId, playerId, totalChips);
  } catch (e) {
    return fail(e);
  }
}

async function playerIdFromCookie(sessionId: string): Promise<string | null> {
  const jar = await cookies();
  const playerKey = jar.get(playerCookieName(sessionId))?.value;
  if (!playerKey) return null;
  const { data } = await supabaseAdmin()
    .from("player_keys")
    .select("player_id")
    .eq("player_key", playerKey)
    .single();
  return data?.player_id ?? null;
}

/** Player uploads their own profile picture from their phone. */
export async function uploadAvatar(sessionId: string, formData: FormData): Promise<ActionResult> {
  try {
    const playerId = await playerIdFromCookie(sessionId);
    if (!playerId) return { ok: false, error: "You are not seated at this table" };

    const db = supabaseAdmin();
    const { data: player } = await db
      .from("players")
      .select("id, session_id")
      .eq("id", playerId)
      .single();
    if (!player || player.session_id !== sessionId)
      return { ok: false, error: "You are not seated at this table" };

    const file = formData.get("file");
    if (!(file instanceof File) || file.size === 0)
      return { ok: false, error: "No image received" };
    if (file.size > 4 * 1024 * 1024)
      return { ok: false, error: "Image is too large (max 4 MB)" };

    const bytes = await file.arrayBuffer();
    const { error } = await db.storage
      .from("avatars")
      .upload(`${playerId}.jpg`, bytes, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error(error.message);

    refresh(sessionId);
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

/** Player counts their own stack from their phone. Only affects their own row. */
export async function setMyChipCount(
  sessionId: string,
  totalChips: number
): Promise<ActionResult> {
  try {
    const jar = await cookies();
    const playerKey = jar.get(playerCookieName(sessionId))?.value;
    if (!playerKey) return { ok: false, error: "You are not seated at this table" };

    const db = supabaseAdmin();
    const { data: keyRow } = await db
      .from("player_keys")
      .select("player_id")
      .eq("player_key", playerKey)
      .single();
    if (!keyRow) return { ok: false, error: "You are not seated at this table" };

    const { data: player } = await db
      .from("players")
      .select("id, session_id, status")
      .eq("id", keyRow.player_id)
      .single();
    if (!player || player.session_id !== sessionId)
      return { ok: false, error: "You are not seated at this table" };
    if (player.status === "cashed_out")
      return { ok: false, error: "You have already cashed out" };

    const session = await getSession(sessionId);
    if (session.status === "ended") return { ok: false, error: "The session has ended" };

    return await applyChipCount(sessionId, player.id, totalChips);
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
