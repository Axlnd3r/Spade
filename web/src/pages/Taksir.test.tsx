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
  const { unmount } = render(
    <MemoryRouter>
      <WalletContext.Provider value={api}>
        <StageContext.Provider value={{ setPage: vi.fn(), trigger, setMenu: vi.fn(), preview: vi.fn(), travel: vi.fn(() => 0) }}>
          <Taksir />
        </StageContext.Provider>
      </WalletContext.Provider>
    </MemoryRouter>,
  );
  return { api, trigger, unmount };
}

test("shows_connect_without_wallet", async () => {
  renderTaksir();
  expect(await screen.findByRole("button", { name: "CONNECT WALLET" })).toBeEnabled();
});

test("shows_meters_and_what_it_costs", async () => {
  renderTaksir({ accountId: "me.testnet" });
  await screen.findByRole("button", { name: "APPRAISE (50 $TAKSIR)" });
  expect(screen.getByRole("meter", { name: "LINES" })).toHaveAttribute("aria-valuenow", "6");
  expect(screen.getByRole("meter", { name: "LINES" })).toHaveAttribute("aria-valuemax", "100");
  expect(screen.getByRole("meter", { name: "BYTES" })).toHaveAttribute("aria-valuenow", "145");
  expect(screen.getByText("FEE").nextElementSibling).toHaveTextContent("50 $TAKSIR, burned");
  expect(screen.getByText("DEPOSIT").nextElementSibling).toHaveTextContent("0.0571 NEAR");
  expect(screen.getByText("YOUR BALANCE").nextElementSibling).toHaveTextContent("425 $TAKSIR");
  fireEvent.change(screen.getByLabelText(/one item per line/i), { target: { value: "a\nb\nc" } });
  expect(screen.getByRole("meter", { name: "LINES" })).toHaveAttribute("aria-valuenow", "3");
});

test("taksir_scrolls_the_answer_into_view", async () => {
  const data = "a\nb\nc\nd\ne";
  const scrollIntoView = vi.fn();
  Element.prototype.scrollIntoView = scrollIntoView;
  try {
    vi.mocked(view).mockImplementation(async (method: string) => {
      if (method === "get_params") return PARAMS;
      if (method === "get_stats") return { appraisal_count: 4 };
      if (method === "ft_balance_of") return "425000000000000000000";
      if (method === "get_appraisal") return { id: 4, owner: "me.testnet", data, status: "Priced", price: 1234, reason: "because" };
      throw new Error(method);
    });
    renderTaksir({ accountId: "me.testnet" });
    fireEvent.change(screen.getByLabelText(/one item per line/i), { target: { value: data } });
    fireEvent.click(await screen.findByRole("button", { name: "APPRAISE (50 $TAKSIR)" }));
    await screen.findByText("MR. X SAYS · CASE #4");
    // The scroll runs in an effect, a moment after the card is on screen.
    await waitFor(() => expect(scrollIntoView).toHaveBeenCalledTimes(1));
  } finally {
    // jsdom has no scrollIntoView of its own.
    delete (Element.prototype as { scrollIntoView?: unknown }).scrollIntoView;
  }
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

test("taksir_stops_thinking_when_page_is_left", async () => {
  const data = "a\nb\nc\nd\ne";
  vi.mocked(view).mockImplementation(async (method: string) => {
    if (method === "get_params") return PARAMS;
    if (method === "get_stats") return { appraisal_count: 4 };
    if (method === "ft_balance_of") return "425000000000000000000";
    if (method === "get_appraisal") return { id: 4, owner: "me.testnet", data, status: "Pending" };
    throw new Error(method);
  });
  const { trigger, unmount } = renderTaksir({ accountId: "me.testnet" });
  fireEvent.change(screen.getByLabelText(/one item per line/i), { target: { value: data } });
  fireEvent.click(await screen.findByRole("button", { name: "APPRAISE (50 $TAKSIR)" }));
  expect(await screen.findByText("MR. X IS THINKING…")).toBeInTheDocument();
  const reads = () => vi.mocked(view).mock.calls.filter((c) => c[0] === "get_appraisal").length;
  unmount();
  await waitFor(() => expect(trigger).toHaveBeenLastCalledWith("idle"));
  const after = reads();
  await new Promise((r) => setTimeout(r, 3500));
  expect(reads()).toBe(after);
}, 10000);
