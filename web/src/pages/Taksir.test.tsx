import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StageContext } from "../scene/SceneCanvas";
import { WalletContext, type WalletApi } from "../wallet/WalletProvider";
import Taksir from "./Taksir";

vi.mock("../chain/rpc", () => ({ view: vi.fn() }));
import { view } from "../chain/rpc";

const PARAMS = {
  appraisal_fee: "50000000000000000000",
  challenge_stake: "25000000000000000000",
  min_rows: 5,
  max_rows: 100,
  max_data_bytes: 2000,
  exec_deposit: "7100000000000000000000",
  storage_fee: "50000000000000000000000",
};

beforeEach(() => {
  vi.mocked(view).mockImplementation(async (method: string) => {
    if (method === "get_params") return PARAMS;
    if (method === "get_stats") return { appraisal_count: 4 };
    if (method === "ft_balance_of") return "425000000000000000000";
    throw new Error(method);
  });
});

function renderTaksir(wallet?: Partial<WalletApi>, trigger = vi.fn()) {
  const api: WalletApi = {
    accountId: null,
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    call: vi.fn(async () => ({ txHash: "h" })),
    ...wallet,
  };
  render(
    <MemoryRouter>
      <WalletContext.Provider value={api}>
        <StageContext.Provider value={{ setPage: vi.fn(), trigger }}>
          <Taksir />
        </StageContext.Provider>
      </WalletContext.Provider>
    </MemoryRouter>,
  );
  return { api, trigger };
}

test("shows_connect_without_wallet", async () => {
  renderTaksir();
  expect(await screen.findByRole("button", { name: "CONNECT WALLET" })).toBeEnabled();
});

test("submit_disabled_until_valid", async () => {
  renderTaksir({ accountId: "me.testnet" });
  const submit = await screen.findByRole("button", { name: "APPRAISE (50 $TAKSIR)" });
  expect(submit).toBeEnabled();
  fireEvent.change(screen.getByLabelText(/one item per line/i), { target: { value: "a\nb\nc" } });
  expect(screen.getByRole("button", { name: "APPRAISE (50 $TAKSIR)" })).toBeDisabled();
  expect(screen.getByText("Needs at least 5 lines.")).toBeInTheDocument();
});

test("taksir_returns_to_idle_on_cancel", async () => {
  const trigger = vi.fn();
  renderTaksir({ accountId: "me.testnet", call: vi.fn(async () => Promise.reject(new Error("User closed the window"))) }, trigger);
  fireEvent.click(await screen.findByRole("button", { name: "APPRAISE (50 $TAKSIR)" }));
  expect(await screen.findByText("Cancelled in wallet.")).toBeInTheDocument();
  await waitFor(() => expect(screen.getByRole("button", { name: "APPRAISE (50 $TAKSIR)" })).toBeEnabled());
  expect(trigger.mock.calls.map((c) => c[0])).toEqual(["thinking", "idle"]);
});
