import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { SceneCanvas } from "./SceneCanvas";

vi.mock("./webgl", () => ({ hasWebGL: () => false }));

test("falls_back_to_static_card_without_webgl", () => {
  const { container } = render(
    <MemoryRouter>
      <SceneCanvas>
        <p>content</p>
      </SceneCanvas>
    </MemoryRouter>,
  );
  expect(screen.getByAltText("Mr. X card")).toBeInTheDocument();
  expect(container.querySelector("canvas")).toBeNull();
  expect(screen.getByText("content")).toBeInTheDocument();
});
