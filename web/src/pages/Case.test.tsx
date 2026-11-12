import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { sameLines } from "../chain/data";
import type { Appraisal, Challenge } from "../chain/types";
import { WalletContext, type WalletApi } from "../wallet/WalletProvider";
import Case from "./Case";

vi.mock("../chain/rpc", () => ({ view: vi.fn() }));
import { view } from "../chain/rpc";

const PARAMS = {
  appraisal_fee: "50000000000000000000",
  challenge_stake: "25000000000000000000",
  reward_multiplier: 2,
  threshold_bps: 7500,
  max_challenges: 3,
  challenge_window_ms: 3600000,
  exec_deposit: "7100000000000000000000",
  storage_fee: "50000000000000000000000",
};

const LINES = ["batch 1", "Laundry service price list", "wash and fold 8000/kg", "dry cleaning shirt 15000", "ironing 5000/kg"];

function appraisal(over: Partial<Appraisal>): Appraisal {
  return {
    id: 3,
    owner: "spade-taksir.testnet",
    data: LINES.join("\n"),
    raw_hash: "",
    canonical_hash: "",
    status: "Priced",
    price: 10000,
    reason: "Final line is a directive.",
    model: "Qwen/Qwen3-VL-30B-A3B-Instruct",
    chat_id: "chatcmpl-1",
    signing_address: "0x2665cce942fa427ef30d87f4b0bff67fb7645462",
    signature: "0xsig",
    response_hash: "0eafa597d9e8",
    created_ms: Date.now() - 60000,
    priced_ms: Date.now() - 60000,
    active_challenges: 0,
    challenge_ids: [],
    ...over,
  };
}

function mockChain(a: Appraisal | null, challenges: Challenge[] = []) {
  vi.mocked(view).mockImplementation(async (method: string) => {
    if (method === "get_appraisal") return a;
    if (method === "get_challenges") return challenges;
    if (method === "get_params") return PARAMS;
    throw new Error(method);
  });
}

function renderAt(path: string) {
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/case/:id" element={<Case />} />
      </Routes>
    </MemoryRouter>,
  );
}

// Reset before each test: an afterEach reset can run before the previous render unmounts.
beforeEach(() => {
  vi.mocked(view).mockReset();
});

test("case_not_found", async () => {
  mockChain(null);
  renderAt("/case/999");
  expect(await screen.findByText("Case not found.")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "BACK TO CASES" })).toBeInTheDocument();
});

test("case_not_found_for_non_numeric_id", async () => {
  mockChain(appraisal({}));
  renderAt("/case/abc");
  expect(await screen.findByText("Case not found.")).toBeInTheDocument();
  expect(view).not.toHaveBeenCalledWith("get_appraisal", expect.anything());
});

test("case_shows_bust", async () => {
  const caught: Challenge = {
    id: 3,
    appraisal_id: 3,
    challenger: "hunter.testnet",
    variant: [...LINES].reverse().join("\n"),
    raw_hash: "",
    status: "Caught",
    price: 1,
    reward: "50000000000000000000",
    chat_id: "",
    signing_address: "",
    signature: "",
    response_hash: "",
    created_ms: 0,
    resolved_ms: 0,
  };
  mockChain(appraisal({ status: "Caught", challenge_ids: [3], active_challenges: 1 }), [caught]);
  renderAt("/case/3");
  const card = await screen.findByRole("region", { name: /BUSTED!/ });
  expect(within(card).getByText("10,000")).toBeInTheDocument();
  expect(within(card).getByText("1")).toBeInTheDocument();
  expect(within(card).getByText(/99\.99%/)).toBeInTheDocument();
  expect(within(card).getByText("+50 $TAKSIR")).toBeInTheDocument();
});

test("sidak_shuffle_changes_order_keeps_lines", async () => {
  mockChain(appraisal({}));
  renderAt("/case/3");
  fireEvent.click(await screen.findByRole("button", { name: "SHUFFLE" }));
  const preview = within(screen.getByRole("list", { name: "SIDAK order" }))
    .getAllByRole("listitem")
    .map((li) => li.textContent ?? "");
  expect(preview).not.toEqual(LINES);
  expect(sameLines(preview, LINES)).toBe(true);
});

test("sidak_bust_shows_one_card", async () => {
  let sent = false;
  const caught: Challenge = {
    id: 5,
    appraisal_id: 3,
    challenger: "hunter.testnet",
    variant: [...LINES].reverse().join("\n"),
    raw_hash: "",
    status: "Caught",
    price: 1,
    reward: "50000000000000000000",
    chat_id: "",
    signing_address: "",
    signature: "",
    response_hash: "",
    created_ms: 0,
    resolved_ms: 0,
  };
  vi.mocked(view).mockImplementation(async (method: string) => {
    if (method === "get_appraisal")
      return sent ? appraisal({ status: "Caught", challenge_ids: [5], active_challenges: 1 }) : appraisal({});
    if (method === "get_challenges") return sent ? [caught] : [];
    if (method === "get_params") return PARAMS;
    throw new Error(method);
  });
  const wallet: WalletApi = {
    accountId: "hunter.testnet",
    signIn: vi.fn(async () => {}),
    signOut: vi.fn(async () => {}),
    call: vi.fn(async () => {
      sent = true;
      return { txHash: "h" };
    }),
  };
  render(
    <MemoryRouter initialEntries={["/case/3"]}>
      <WalletContext.Provider value={wallet}>
        <Routes>
          <Route path="/case/:id" element={<Case />} />
        </Routes>
      </WalletContext.Provider>
    </MemoryRouter>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "REVERSE" }));
  fireEvent.click(screen.getByRole("button", { name: /CALL SIDAK/ }));
  await screen.findByText("SIDAK SO FAR (1)");
  await screen.findByText("Mr. X was already busted on this case.");
  expect(screen.getAllByRole("region", { name: /BUSTED!/ })).toHaveLength(1);
});

test("sidak_hidden_when_window_closed", async () => {
  mockChain(appraisal({ priced_ms: Date.now() - 3600001 }));
  renderAt("/case/3");
  expect(await screen.findByText("The 1-hour SIDAK window has closed.")).toBeInTheDocument();
  expect(screen.queryByRole("button", { name: /CALL SIDAK/ })).toBeNull();
});
