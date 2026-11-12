import type { Appraisal } from "../chain/types";
import { awaitResult, findNewAppraisal } from "./awaitResult";

vi.mock("../chain/rpc", () => ({ view: vi.fn() }));
import { view } from "../chain/rpc";

type S = { status: string };
const opts = (onSoftTimeout = () => {}) => ({
  intervalMs: 3000,
  softTimeoutMs: 90000,
  onSoftTimeout,
  signal: new AbortController().signal,
});

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

test("awaitResult_resolves_when_done", async () => {
  const seq: S[] = [{ status: "Pending" }, { status: "Pending" }, { status: "Priced" }];
  const read = vi.fn(async () => seq.shift());
  const p = awaitResult<S>(read, (v) => v.status !== "Pending", opts());
  await vi.advanceTimersByTimeAsync(10000);
  await expect(p).resolves.toEqual({ status: "Priced" });
  expect(read).toHaveBeenCalledTimes(3);
});

test("awaitResult_keeps_polling_after_soft_timeout", async () => {
  const start = Date.now();
  const read = vi.fn(async () => ({ status: Date.now() - start >= 120000 ? "Priced" : "Pending" }));
  const onSoft = vi.fn();
  const p = awaitResult<S>(read, (v) => v.status !== "Pending", opts(onSoft));
  await vi.advanceTimersByTimeAsync(95000);
  expect(onSoft).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(30000);
  await expect(p).resolves.toEqual({ status: "Priced" });
  expect(onSoft).toHaveBeenCalledTimes(1);
});

test("awaitResult_stops_when_aborted_during_a_read", async () => {
  const ctrl = new AbortController();
  let release = () => {};
  const read = vi.fn(() => new Promise<S>((r) => (release = () => r({ status: "Pending" }))));
  const settled = awaitResult<S>(read, (v) => v.status !== "Pending", { ...opts(), signal: ctrl.signal }).catch((e) => e);
  ctrl.abort();
  release();
  await vi.advanceTimersByTimeAsync(10000);
  expect((await settled).name).toBe("AbortError");
  expect(read).toHaveBeenCalledTimes(1);
});

test("findNewAppraisal_falls_back_to_owner_and_data", async () => {
  const mine = { id: 8, owner: "me.testnet", data: "a\nb\nc\nd\ne" } as Appraisal;
  const theirs = { id: 7, owner: "other.testnet", data: "x\ny\nz\nv\nw" } as Appraisal;
  vi.mocked(view).mockImplementation(async (method: string, args?: object) => {
    if (method === "get_appraisal") return (args as { id: number }).id === 7 ? theirs : mine;
    if (method === "get_stats") return { appraisal_count: 9 };
    if (method === "get_appraisals") return [theirs, mine];
    throw new Error(method);
  });
  vi.useRealTimers();
  expect(await findNewAppraisal(7, "me.testnet", " a\nb\r\nc\n\nd\ne ")).toEqual(mine);
});
