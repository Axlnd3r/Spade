/** Start of the epoch after the one `nowMs` falls in. Epoch 0 starts at genesis (the Mint log entry). */
export function nextEpochMs(genesisMs: number, epochMs: number, nowMs: number): number {
  const index = Math.floor((nowMs - genesisMs) / epochMs);
  return genesisMs + (index + 1) * epochMs;
}

/** Time left to call SIDAK on an appraisal priced at `pricedMs`. */
export function windowLeftMs(pricedMs: number, windowMs: number, nowMs: number): number {
  return Math.max(0, pricedMs + windowMs - nowMs);
}

export function mmss(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}
