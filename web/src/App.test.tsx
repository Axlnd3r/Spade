import { render, screen } from "@testing-library/react";
import App from "./App";

test("renders_lockup", () => {
  render(<App />);
  expect(screen.getByText(/SPADE/)).toBeInTheDocument();
});
