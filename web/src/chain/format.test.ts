import { challengeLabel, contractErrorMessage, diffPct, isBusted, taksir } from "./format";

test("taksir_formats_18_decimals", () => {
  expect(taksir("50000000000000000000")).toBe("50");
  expect(taksir("99999750000000000000000000")).toBe("99,999,750");
  expect(taksir("0")).toBe("0");
});

test("diff_and_bust_rule_match_contract", () => {
  expect(diffPct(10000, 1)).toBeCloseTo(99.99, 2);
  expect(isBusted(100, 401, 7500)).toBe(true);
  expect(isBusted(100, 400, 7500)).toBe(false);
});

test("status_labels", () => {
  expect(challengeLabel("Caught")).toBe("BUSTED");
  expect(challengeLabel("Survived")).toBe("HELD");
});

test("contract_error_messages", () => {
  expect(contractErrorMessage("Smart contract panicked: already_appraised")).toContain("already priced");
  expect(contractErrorMessage("Smart contract panicked: The account bob.testnet is not registered")).toContain(
    "claim the faucet",
  );
  expect(contractErrorMessage("something else entirely")).toBeNull();
});
