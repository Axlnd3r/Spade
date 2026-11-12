import { render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import How from "./How";

vi.mock("../chain/rpc", () => ({ view: vi.fn() }));
import { view } from "../chain/rpc";

const PARAMS = {
  appraisal_fee: "50000000000000000000",
  challenge_stake: "25000000000000000000",
  reward_multiplier: 2,
  threshold_bps: 7500,
  max_challenges: 3,
  challenge_window_ms: 3600000,
};

function renderHow() {
  return render(
    <MemoryRouter>
      <How />
    </MemoryRouter>,
  );
}

// Reset before each test: an afterEach reset can run before the previous render unmounts.
beforeEach(() => {
  vi.mocked(view).mockReset();
});

test("how_explains_the_three_steps_with_numbers_from_the_contract", async () => {
  vi.mocked(view).mockImplementation(async (method: string) => {
    if (method === "get_params") return { ...PARAMS, appraisal_fee: "40000000000000000000" };
    if (method === "get_stats") return { budget: "299998500000000000000" };
    throw new Error(method);
  });
  renderHow();
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("HOW IT WORKS");
  const steps = screen.getByRole("list", { name: "The three steps" });
  expect(within(steps).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["TAKSIR", "SIDAK", "VERDICT"]);
  // The fee changed on the contract: the page follows it.
  expect(await within(steps).findByText("COST 40 $TAKSIR · BURNED")).toBeInTheDocument();
  expect(within(steps).getByText("STAKE 25 $TAKSIR")).toBeInTheDocument();
  expect(within(steps).getByText(/within 1 hour/)).toBeInTheDocument();
  expect(within(steps).getByText(/More than 75% apart/)).toBeInTheDocument();
  expect(await screen.findByText(/300 \$TAKSIR per epoch/)).toBeInTheDocument();
});

test("how_says_what_each_role_gets_with_honest_numbers", async () => {
  vi.mocked(view).mockImplementation(async (method: string) => {
    if (method === "get_params") return { ...PARAMS, reward_multiplier: 3 };
    if (method === "get_stats") return { budget: "299998500000000000000" };
    throw new Error(method);
  });
  renderHow();
  const section = screen.getByRole("region", { name: "WHAT YOU GET" });
  expect(within(section).getByText(/pawnshop appraiser/)).toBeInTheDocument();
  expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual(["ASKER", "HUNTER", "HOLDER"]);
  const hunter = within(section).getByRole("heading", { name: "HUNTER" }).closest("li")!;
  // The numbers follow the contract: a 3x reward means breaking even above 1 catch in 4.
  expect(await within(hunter).findByText(/more than 1 in 4 tries/)).toBeInTheDocument();
  expect(within(hunter).getByText(/you get it back plus 75/)).toBeInTheDocument();
  expect(within(hunter).getByText(/farming your own data nets zero/)).toBeInTheDocument();
  const asker = within(section).getByRole("heading", { name: "ASKER" }).closest("li")!;
  expect(within(asker).getByText(/Nothing uses the price yet/)).toBeInTheDocument();
  const holder = within(section).getByRole("heading", { name: "HOLDER" }).closest("li")!;
  expect(within(holder).getByText(/No dividends and no staking/)).toBeInTheDocument();
  expect(await within(section).findByText(/about 300 \$TAKSIR in total each epoch/)).toBeInTheDocument();
  expect(within(section).getByText(/no cash value/)).toBeInTheDocument();
});

test("how_what_you_get_uses_launch_values_when_the_rpc_is_down", () => {
  vi.mocked(view).mockRejectedValue(new Error("network: down"));
  renderHow();
  const hunter = within(screen.getByRole("region", { name: "WHAT YOU GET" })).getByRole("heading", { name: "HUNTER" }).closest("li")!;
  expect(within(hunter).getByText(/more than 1 in 3 tries/)).toBeInTheDocument();
  expect(within(hunter).getByText(/you get it back plus 50/)).toBeInTheDocument();
});

test("how_still_reads_when_the_rpc_is_down", async () => {
  vi.mocked(view).mockRejectedValue(new Error("network: down"));
  renderHow();
  const steps = screen.getByRole("list", { name: "The three steps" });
  // Locked-in launch values stand in, so a judge never sees a blank explanation.
  expect(within(steps).getByText("COST 50 $TAKSIR · BURNED")).toBeInTheDocument();
  expect(screen.getByRole("status")).toHaveTextContent("BUSTED");
});

test("how_says_why_it_is_different_and_how_to_check_each_claim", () => {
  vi.mocked(view).mockRejectedValue(new Error("network: down"));
  renderHow();
  const section = screen.getByRole("region", { name: "WHY IT'S DIFFERENT" });
  expect(within(section).getAllByRole("heading", { level: 3 }).map((h) => h.textContent)).toEqual([
    "SUPPLY ONLY GOES DOWN",
    "NOBODY CAN CHANGE THE RULES",
    "THE REWARD IS EARNED, NOT PRINTED",
    "PROOF, NOT PROMISES",
  ]);
  const checks = within(section).getAllByRole("link");
  expect(checks.map((a) => a.getAttribute("href"))).toEqual(["/ledger", "/verify", "/cases", "/cases"]);
  // Honest about the key that is still there, and about being a testnet demo.
  expect(within(section).getByText(/Verify shows the live count/)).toBeInTheDocument();
  expect(screen.getByText(/testnet demo, not audited/)).toBeInTheDocument();
});

test("how_ends_with_two_ways_in", () => {
  vi.mocked(view).mockRejectedValue(new Error("network: down"));
  renderHow();
  expect(screen.getByRole("link", { name: "GET A PRICE" })).toHaveAttribute("href", "/taksir");
  expect(screen.getByRole("link", { name: "CALL HIS BLUFF" })).toHaveAttribute("href", "/cases");
});
