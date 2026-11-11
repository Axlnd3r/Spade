// Mirrors the contract's JSON views (contracts/taksir/src/{params,types}.rs).
// U128 and NearToken values arrive as decimal strings.

export interface Params {
  appraisal_fee: string;
  challenge_stake: string;
  reward_multiplier: number;
  threshold_bps: number;
  budget_ppm: number;
  max_challenges: number;
  faucet_amount: string;
  epoch_ms: number;
  challenge_window_ms: number;
  min_rows: number;
  max_rows: number;
  max_data_bytes: number;
  price_min: number;
  price_max: number;
  outlayer_id: string;
  wasm_url: string;
  wasm_hash: string;
  secrets_profile: string;
  secrets_owner: string;
  exec_deposit: string;
  storage_fee: string;
}

export interface Stats {
  total_supply: string;
  burned_total: string;
  treasury: string;
  faucet_pool: string;
  escrow: string;
  epoch_index: number;
  epoch_by_time: number;
  budget: string;
  budget_left: string;
  epoch_challenges: number;
  epoch_catches: number;
  clean_streak: number;
  best_streak: number;
  appraisal_count: number;
  challenge_count: number;
  log_count: number;
}

export type AppraisalStatus = "Pending" | "Priced" | "Caught" | "Failed";
export type ChallengeStatus = "Pending" | "Caught" | "Survived" | "Failed" | "Voided";
export type LogKind = "Mint" | "BurnFee" | "BurnStake" | "BurnEpoch" | "Reward" | "Faucet";

export interface Appraisal {
  id: number;
  owner: string;
  data: string;
  raw_hash: string;
  canonical_hash: string;
  status: AppraisalStatus;
  price: number | null;
  reason: string;
  model: string;
  chat_id: string;
  signing_address: string;
  signature: string;
  response_hash: string;
  created_ms: number;
  priced_ms: number | null;
  active_challenges: number;
  challenge_ids: number[];
}

export interface Challenge {
  id: number;
  appraisal_id: number;
  challenger: string;
  variant: string;
  raw_hash: string;
  status: ChallengeStatus;
  price: number | null;
  reward: string;
  chat_id: string;
  signing_address: string;
  signature: string;
  response_hash: string;
  created_ms: number;
  resolved_ms: number | null;
}

export interface LogEntry {
  kind: LogKind;
  account_id: string | null;
  amount: string;
  ref_id: number | null;
  epoch_from: number;
  epoch_to: number;
  ts_ms: number;
}
