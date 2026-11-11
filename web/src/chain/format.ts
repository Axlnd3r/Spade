import type { AppraisalStatus, ChallengeStatus, LogKind } from "./types";

const ONE = 10n ** 18n;
const YOCTO_NEAR = 10n ** 24n;

function withCommas(n: bigint): string {
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function decimal(value: bigint, unit: bigint, unitDigits: number, digits: number): string {
  const whole = value / unit;
  const frac = (value % unit).toString().padStart(unitDigits, "0").slice(0, digits).replace(/0+$/, "");
  return frac ? `${withCommas(whole)}.${frac}` : withCommas(whole);
}

/** A TAKSIR amount (18 decimals) for display. */
export function taksir(yocto: string, digits = 2): string {
  return decimal(BigInt(yocto), ONE, 18, digits);
}

export function near(yocto: string, digits = 4): string {
  return `${decimal(BigInt(yocto), YOCTO_NEAR, 24, digits)} NEAR`;
}

export function diffPct(p1: number, p2: number): number {
  const max = Math.max(p1, p2);
  return max === 0 ? 0 : (Math.abs(p1 - p2) / max) * 100;
}

/** M-11, the contract's rule: (max − min) × 10000 > threshold_bps × max. */
export function isBusted(p1: number, p2: number, thresholdBps: number): boolean {
  const max = Math.max(p1, p2);
  const min = Math.min(p1, p2);
  return (max - min) * 10000 > thresholdBps * max;
}

const APPRAISAL: Record<AppraisalStatus, string> = {
  Pending: "THINKING",
  Priced: "PRICED",
  Caught: "BUSTED",
  Failed: "NO ANSWER, FEE REFUNDED",
};

const CHALLENGE: Record<ChallengeStatus, string> = {
  Pending: "THINKING",
  Caught: "BUSTED",
  Survived: "HELD",
  Failed: "NO ANSWER, STAKE REFUNDED",
  Voided: "ALREADY BUSTED, STAKE REFUNDED",
};

export const appraisalLabel = (s: AppraisalStatus) => APPRAISAL[s];
export const challengeLabel = (s: ChallengeStatus) => CHALLENGE[s];

const LOG: Record<LogKind, string> = {
  Mint: "Mint (genesis)",
  BurnFee: "Fee burned",
  BurnStake: "Stake burned",
  BurnEpoch: "Epoch budget burned",
  Reward: "Reward",
  Faucet: "Faucet",
};

export const logKindLabel = (k: LogKind) => LOG[k];

const ERRORS: Array<[RegExp, string]> = [
  [/deposit_low/, "Not enough NEAR attached."],
  [/too_few_rows/, "Needs at least 5 lines."],
  [/too_many_rows/, "Max 100 lines."],
  [/too_large/, "Max 2,000 bytes."],
  [/already_appraised/, "Mr. X already priced these lines, in some order. Open that case and call his bluff instead."],
  [/not_priced/, "This case can't be inspected (not priced yet, or already busted)."],
  [/window_closed/, "The 1-hour SIDAK window has closed."],
  [/max_challenges/, "This case already has 3 inspections."],
  [/same_order/, "Change the order of the lines first."],
  [/not_equivalent/, "SIDAK must use exactly the same lines."],
  [/faucet_claimed/, "This account already claimed the faucet."],
  [/faucet_empty/, "The faucet is empty."],
  [/gas_low/, "Not enough gas attached."],
  [/is not registered|doesn't have enough balance|not enough balance/i, "You need $TAKSIR: claim the faucet first."],
];

/** The UI message for a contract panic found anywhere in `text`, or null. */
export function contractErrorMessage(text: string): string | null {
  for (const [re, msg] of ERRORS) if (re.test(text)) return msg;
  return null;
}
