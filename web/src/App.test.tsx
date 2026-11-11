import { render, screen } from "@testing-library/react";
import App from "./App";

vi.mock("@hot-labs/near-connect", () => ({
  NearConnector: class {
    getConnectedWallet = () => Promise.reject(new Error("none"));
    on() {}
  },
}));
vi.mock("./chain/rpc", () => ({ view: () => new Promise(() => {}), viewAccount: vi.fn(), accessKeyCount: vi.fn() }));

test("renders_lockup", () => {
  render(<App />);
  expect(screen.getByText(/SPADE · \$TAKSIR/)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: "Open menu" })).toBeInTheDocument();
});
