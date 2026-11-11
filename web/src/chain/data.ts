import type { Params } from "./types";

// Same rules as contracts/taksir/src/data.rs (M-4/M-5, D-2), checked against
// enclave/appraiser/vectors/vectors.json.

export type DataError = "too_large" | "too_few_rows" | "too_many_rows";

/** Split on "\n", trim only space, tab and CR at both ends, drop empty lines. */
export function normalizeLines(text: string): string[] {
  return text
    .split("\n")
    .map((l) => l.replace(/^[ \t\r]+|[ \t\r]+$/g, ""))
    .filter((l) => l.length > 0);
}

/** Size is measured on the raw text in UTF-8 bytes; checks run in the contract's order. */
export function validateData(
  text: string,
  lines: string[],
  p: Pick<Params, "min_rows" | "max_rows" | "max_data_bytes">,
): DataError | null {
  if (new TextEncoder().encode(text).length > p.max_data_bytes) return "too_large";
  if (lines.length < p.min_rows) return "too_few_rows";
  if (lines.length > p.max_rows) return "too_many_rows";
  return null;
}

function compareBytes(a: string, b: string): number {
  const x = new TextEncoder().encode(a);
  const y = new TextEncoder().encode(b);
  for (let i = 0; i < Math.min(x.length, y.length); i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
}

/** Same multiset of lines, in the contract's byte order (canonical_hash equality). */
export function sameLines(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const x = [...a].sort(compareBytes);
  const y = [...b].sort(compareBytes);
  return x.every((l, i) => l === y[i]);
}
