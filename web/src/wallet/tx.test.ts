import { txErrorMessage } from "./tx";

test("txErrorMessage_maps_user_rejection", () => {
  expect(txErrorMessage(new Error("User rejected the request"))).toBe("Cancelled in wallet.");
  expect(txErrorMessage(new Error("Wallet closed"))).toBe("Cancelled in wallet.");
});

test("txErrorMessage_maps_contract_code", () => {
  expect(txErrorMessage(new Error("Smart contract panicked: deposit_low"))).toBe("Not enough NEAR attached.");
});

test("txErrorMessage_falls_back_to_short_raw_message", () => {
  const msg = txErrorMessage(new Error("x".repeat(500)));
  expect(msg.startsWith("Transaction failed: ")).toBe(true);
  expect(msg.length).toBeLessThanOrEqual("Transaction failed: ".length + 140);
});
