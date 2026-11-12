import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { VerdictDemo } from "./VerdictDemo";

function renderDemo() {
  render(
    <MemoryRouter>
      <VerdictDemo stake="25" reward="50" thresholdBps={7500} />
    </MemoryRouter>,
  );
  return screen.getByRole("slider", { name: "Second answer" });
}

const verdict = () => screen.getByRole("status");

test("verdict_starts_on_the_real_bust_and_pays_the_reward", () => {
  renderDemo();
  expect(verdict()).toHaveTextContent("BUSTED");
  expect(verdict()).toHaveTextContent("99.99% apart (limit 75%)");
  expect(verdict()).toHaveTextContent("You get your 25 $TAKSIR back plus 50 $TAKSIR from the treasury: net +50.");
});

test("verdict_flips_just_past_the_limit_and_not_on_it", () => {
  const slider = renderDemo();
  // 10,000 vs 2,500 is exactly 75% apart: the contract needs MORE than the limit.
  fireEvent.change(slider, { target: { value: "2500" } });
  expect(verdict()).toHaveTextContent("HELD");
  expect(verdict()).toHaveTextContent("75.00% apart (limit 75%)");
  expect(verdict()).toHaveTextContent("your 25 $TAKSIR stake is burned: net −25");
  fireEvent.change(slider, { target: { value: "2499" } });
  expect(verdict()).toHaveTextContent("BUSTED");
});

test("verdict_presets_move_the_slider", () => {
  const slider = renderDemo();
  fireEvent.click(screen.getByRole("button", { name: "HE HOLDS" }));
  expect(slider).toHaveValue("9500");
  expect(verdict()).toHaveTextContent("HELD");
  fireEvent.click(screen.getByRole("button", { name: "HE WOBBLES" }));
  expect(slider).toHaveValue("4000");
  expect(verdict()).toHaveTextContent("HELD");
  fireEvent.click(screen.getByRole("button", { name: "HE'S FOOLED" }));
  expect(slider).toHaveValue("1");
  expect(verdict()).toHaveTextContent("BUSTED");
});

test("verdict_shows_both_answers_as_bars", () => {
  const slider = renderDemo();
  fireEvent.change(slider, { target: { value: "5000" } });
  expect(screen.getByTestId("second-answer")).toHaveTextContent("5,000");
  expect(screen.getByTestId("second-bar")).toHaveStyle({ width: "50%" });
  // The shaded busted zone ends where 75% below the first answer is.
  expect(screen.getByTestId("busted-zone")).toHaveStyle({ width: "25%" });
});
