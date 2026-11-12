import { fireEvent, render, screen } from "@testing-library/react";
import { Lens } from "./Lens";

function finePointer(matches: boolean) {
  vi.stubGlobal("matchMedia", (query: string) => ({ matches: matches && query.includes("pointer: fine"), media: query }));
}

beforeEach(() => {
  // jsdom has no canvas; the lens then keeps its plain glass look.
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null);
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function renderLens() {
  render(
    <>
      <p>plain text</p>
      <button type="button">a button</button>
      <textarea aria-label="a field" />
      <Lens />
    </>,
  );
  return screen.getByTestId("lens");
}

test("lens_follows_a_mouse_and_steps_back_over_controls", () => {
  finePointer(true);
  const lens = renderLens();
  expect(lens).toHaveAttribute("data-mode", "hidden");
  fireEvent.pointerMove(screen.getByText("plain text"));
  expect(lens).toHaveAttribute("data-mode", "lens");
  expect(document.documentElement).toHaveClass("has-lens");
  fireEvent.pointerMove(screen.getByRole("button", { name: "a button" }));
  expect(lens).toHaveAttribute("data-mode", "ring");
  fireEvent.pointerMove(screen.getByLabelText("a field"));
  expect(lens).toHaveAttribute("data-mode", "hidden");
});

test("no_lens_on_touch_screens", () => {
  finePointer(false);
  render(<Lens />);
  expect(screen.queryByTestId("lens")).toBeNull();
  expect(document.documentElement).not.toHaveClass("has-lens");
});
