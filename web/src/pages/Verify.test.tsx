import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { CONTRACT_CODE_HASH, WASM_HASH } from "../chain/config";
import Verify from "./Verify";

vi.mock("../chain/rpc", () => ({ view: vi.fn(), viewAccount: vi.fn(), accessKeyCount: vi.fn() }));
import { accessKeyCount, view, viewAccount } from "../chain/rpc";

function setup(codeHash: string, keys: number) {
  vi.mocked(viewAccount).mockResolvedValue({ amount: "0", code_hash: codeHash, storage_usage: 1 });
  vi.mocked(accessKeyCount).mockResolvedValue(keys);
  vi.mocked(view).mockImplementation(async (method: string) => {
    if (method === "get_params")
      return { appraisal_fee: "50000000000000000000", threshold_bps: 7500, wasm_hash: WASM_HASH, epoch_ms: 600000 };
    if (method === "get_stats") return { appraisal_count: 0 };
    throw new Error(method);
  });
  render(
    <MemoryRouter>
      <Verify />
    </MemoryRouter>,
  );
}

test("verify_compares_code_hash", async () => {
  setup(CONTRACT_CODE_HASH, 1);
  // Contract code hash and pinned enclave hash both match.
  expect(await screen.findAllByText("MATCHES docs/TESTNET.md")).toHaveLength(2);
  expect(await screen.findByText("1 access key. Becomes 0 after the final lock.")).toBeInTheDocument();
  expect(screen.getAllByText(WASM_HASH).length).toBeGreaterThan(0);
});

test("verify_flags_a_different_code_hash", async () => {
  setup("SomethingElse111", 0);
  expect(await screen.findByText("DOES NOT MATCH")).toBeInTheDocument();
  expect(await screen.findByText("0 access keys. Nobody can change this contract.")).toBeInTheDocument();
});
