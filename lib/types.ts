export type SessionStatus = "setup" | "active" | "ended";
export type PlayerStatus = "active" | "cashed_out";
export type TxType = "buy_in" | "cash_out" | "adjustment";

export interface BlindLevel {
  level: number;
  smallBlind: number;
  bigBlind: number;
  /** minutes from the start of the game */
  startsAtMin: number;
}

export interface BlindPlan {
  levelMin: number;
  levels: BlindLevel[];
}

export interface Session {
  id: string;
  name: string;
  status: SessionStatus;
  currency_code: string;
  cash_per_rate: number;
  chips_per_rate: number;
  default_buy_in_cash: number;
  small_blind: number;
  big_blind: number;
  notes: string;
  join_code: string;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  /** null before migration 0002 or when no schedule was set */
  blind_schedule?: BlindPlan | null;
  blind_paused_at?: string | null;
  blind_paused_ms?: number;
}

export interface Player {
  id: string;
  session_id: string;
  name: string;
  seat: number | null;
  role: "host" | "player";
  status: PlayerStatus;
  created_at: string;
}

export interface Tx {
  id: string;
  session_id: string;
  player_id: string;
  type: TxType;
  cash_amount: number;
  chip_amount: number;
  created_at: string;
}
