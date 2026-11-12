import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Overview from "./Overview";

vi.mock("../chain/rpc", () => ({ view: vi.fn() }));
import { view } from "../chain/rpc";

// v2 after the S4 e2e runs.
const STATS = {
  total_supply: "99999750000000000000000000",
  burned_total: "250000000000000000000",
  treasury: "59999700000000000000000000",
  faucet_pool: "39999500000000000000000000",
  escrow: "0",
  epoch_index: 1,
  epoch_by_time: 1,
  budget: "299998500000000000000",
  budget_left: "199998500000000000000",
  epoch_challenges: 2,
  epoch_catches: 2,
  clean_streak: 0,
  best_streak: 0,
  appraisal_count: 4,
  challenge_count: 4,
  log_count: 12,
};

function renderHome() {
  return render(
    <MemoryRouter>
      <Overview />
    </MemoryRouter>,
  );
}

// Reset before each test: an afterEach reset can run before the previous render unmounts.
beforeEach(() => {
  vi.mocked(view).mockReset();
});

test("overview_renders_live_stats", async () => {
  vi.mocked(view).mockImplementation(async (method: string) => {
    if (method === "get_stats") return STATS;
    if (method === "get_params") return { epoch_ms: 600000, challenge_window_ms: 3600000 };
    if (method === "get_log") return [{ kind: "Mint", ts_ms: 1794384000000, amount: "0", account_id: null, ref_id: null }];
    if (method === "get_appraisals") return [];
    throw new Error(method);
  });
  renderHome();
  expect(await screen.findByText("99,999,750")).toBeInTheDocument();
  expect(screen.getByText("250")).toBeInTheDocument();
  expect(screen.getByText("MINTED SINCE LAUNCH").nextElementSibling).toHaveTextContent("0");
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("OVERVIEW");
});

const CASE = {
  owner: "spade-taksir.testnet",
  data: "warung price list\nb\nc\nd\ne",
  created_ms: 0,
  priced_ms: 0,
  active_challenges: 1,
};

test("overview_shows_streak_board_and_last_bust", async () => {
  vi.mocked(view).mockImplementation(async (method: string) => {
    if (method === "get_stats") return { ...STATS, clean_streak: 3, best_streak: 7 };
    if (method === "get_params") return { epoch_ms: 600000, challenge_window_ms: 3600000 };
    if (method === "get_log") return [{ kind: "Mint", ts_ms: 1794384000000, amount: "0", account_id: null, ref_id: null }];
    if (method === "get_appraisals")
      return [
        { ...CASE, id: 2, status: "Caught", price: 10000, challenge_ids: [2] },
        { ...CASE, id: 3, status: "Priced", price: 2500, challenge_ids: [3] },
      ];
    throw new Error(method);
  });
  renderHome();
  const board = await screen.findByRole("region", { name: "EPOCHS SINCE MR. X GOT BUSTED" });
  expect(within(board).getByText("03")).toBeInTheDocument();
  expect(within(board).getByText("LONGEST CLEAN RUN").nextElementSibling).toHaveTextContent("07");
  expect(within(board).getByText(/1 EPOCH = 10 MIN/)).toBeInTheDocument();
  expect(await within(board).findByRole("link", { name: /LAST BUST · CASE #2/ })).toHaveAttribute("href", "/case/2");
});

test("overview_lists_case_prices_with_thousands", async () => {
  vi.mocked(view).mockImplementation(async (method: string) => {
    if (method === "get_stats") return STATS;
    if (method === "get_params") return { epoch_ms: 600000, challenge_window_ms: 3600000 };
    if (method === "get_log") return [];
    if (method === "get_appraisals") return [{ ...CASE, id: 2, status: "Caught", price: 10000, challenge_ids: [2] }];
    throw new Error(method);
  });
  renderHome();
  expect(await screen.findByText("10,000")).toBeInTheDocument();
});

test("overview_points_newcomers_to_how_it_works", () => {
  vi.mocked(view).mockRejectedValue(new Error("network: down"));
  renderHome();
  expect(screen.getByRole("link", { name: "HOW IT WORKS IN ONE MINUTE" })).toHaveAttribute("href", "/how");
  // The explanation lives in one place: no second copy of the steps here.
  expect(screen.queryByText("VERDICT")).toBeNull();
});

test("overview_shows_retry_when_rpc_fails", async () => {
  vi.mocked(view).mockRejectedValue(new Error("network: down"));
  renderHome();
  expect(await screen.findByText("Can't reach NEAR testnet. Retrying…")).toBeInTheDocument();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("OVERVIEW");
});
