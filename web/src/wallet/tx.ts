import { contractErrorMessage } from "../chain/format";

const REJECTED = /reject|cancel|closed|denied/i;
const RAW_MAX = 140;

/** The message the UI shows for a failed wallet call. */
export function txErrorMessage(err: unknown): string {
  const text = err instanceof Error ? err.message : typeof err === "string" ? err : JSON.stringify(err);
  const known = contractErrorMessage(text);
  if (known) return known;
  if (REJECTED.test(text)) return "Cancelled in wallet.";
  return `Transaction failed: ${text.slice(0, RAW_MAX)}`;
}
