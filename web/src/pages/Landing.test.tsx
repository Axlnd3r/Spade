import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import Landing from "./Landing";

test("landing_is_a_title_a_line_and_one_way_in", () => {
  render(
    <MemoryRouter>
      <Landing />
    </MemoryRouter>,
  );
  expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent("RUG THE AI, NOT THE HOLDERS.");
  expect(screen.getByText(/Mr\. X is an AI sealed inside a TEE/)).toBeInTheDocument();
  expect(screen.getByRole("link", { name: "EXPLORE" })).toHaveAttribute("href", "/how");
  // One screen, no scrolling content: the idea comes first (How it works), the stats after.
  expect(screen.queryByText("SUPPLY")).toBeNull();
});
