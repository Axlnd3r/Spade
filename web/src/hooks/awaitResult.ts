import { normalizeLines } from "../chain/data";
import { view } from "../chain/rpc";
import type { Appraisal, Stats } from "../chain/types";

export interface AwaitOptions {
  intervalMs: number;
  softTimeoutMs: number;
  /** Called once when `softTimeoutMs` passes; polling goes on. */
  onSoftTimeout(): void;
  signal: AbortSignal;
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new DOMException("aborted", "AbortError"));
    });
  });
}

/** Polls `read` until `done`, or until `signal` aborts. A failed read is retried. */
export async function awaitResult<T>(
  read: () => Promise<T | undefined>,
  done: (v: T) => boolean,
  opts: AwaitOptions,
): Promise<T> {
  const start = Date.now();
  let warned = false;
  for (;;) {
    try {
      const v = await read();
      if (v !== undefined && done(v)) return v;
    } catch {
      // RPC hiccup: try again on the next tick.
    }
    if (!warned && Date.now() - start >= opts.softTimeoutMs) {
      warned = true;
      opts.onSoftTimeout();
    }
    await sleep(opts.intervalMs, opts.signal);
  }
}

const RECENT = 10;

/** The appraisal a just-sent `appraise` created: id `countBefore` if it is ours, else the newest of the
 * last few with this owner and the same normalized data. */
export async function findNewAppraisal(countBefore: number, owner: string, data: string): Promise<Appraisal | undefined> {
  const joined = normalizeLines(data).join("\n");
  const isOurs = (a: Appraisal | null | undefined) => !!a && a.owner === owner && a.data === joined;
  const first = await view<Appraisal | null>("get_appraisal", { id: countBefore });
  if (isOurs(first)) return first!;
  const { appraisal_count } = await view<Stats>("get_stats");
  const recent = await view<Appraisal[]>("get_appraisals", { from: Math.max(0, appraisal_count - RECENT), limit: RECENT });
  return [...recent].reverse().find(isOurs);
}
