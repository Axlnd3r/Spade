import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import type { LogEntry } from "../chain/types";
import Ledger from "./Ledger";

vi.mock("../chain/rpc", () => ({ view: vi.fn() }));
import { view } from "../chain/rpc";

const e = (kind: LogEntry["kind"], amount: string, ref_id: number | null, ts_ms: number): LogEntry => ({
  kind,
  amount,
  ref_id,
  account_id: kind === "BurnEpoch" || kind === "Mint" ? null : "spade-taksir.testnet",
  epoch_from: 0,
  epoch_to: 0,
  ts_ms,
});

const LOG: LogEntry[] = [
  e("Mint", "100000000000000000000000000", null, 1),
  e("Faucet", "500000000000000000000", null, 2),
  e("BurnFee", "50000000000000000000", 0, 3),
  e("BurnStake", "25000000000000000000", 0, 4),
  e("BurnEpoch", "300000000000000000000", null, 5),
  e("BurnFee", "50000000000000000000", 1, 6),
  e("Reward", "50000000000000000000", 1, 7),
  e("BurnFee", "50000000000000000000", 2, 8),
  e("BurnStake", "25000000000000000000", 2, 9),
  e("BurnFee", "50000000000000000000", 3, 10),
  e("Reward", "50000000000000000000", 3, 11),
];

test("ledger_newest_first", async () => {
  vi.mocked(view).mockImplementation(async (method: string) => {
    if (method === "get_stats") return { log_count: 11 };
    if (method === "get_log") return LOG;
    throw new Error(method);
  });
  render(
    <MemoryRouter>
      <Ledger />
    </MemoryRouter>,
  );
  await screen.findByText("Epoch budget burned");
  const rows = screen.getAllByRole("row");
  // rows[0] is the header.
  expect(within(rows[1]).getByText("Reward")).toBeInTheDocument();
  expect(within(rows[1]).getByText("+50")).toBeInTheDocument();
  expect(within(rows[1]).getByText("SIDAK #3")).toBeInTheDocument();
  expect(screen.getByText("Epoch budget burned")).toBeInTheDocument();
  expect(screen.getAllByText("−50").length).toBe(4);
  expect(screen.getByRole("link", { name: "CASE #3" })).toHaveAttribute("href", "/case/3");
  expect(view).toHaveBeenCalledWith("get_log", { from: 0, limit: 11 });
});
