import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StageContext } from "../scene/SceneCanvas";
import { MENU_ITEMS, Menu } from "./Menu";

test("menu_lists_seven_items_and_marks_active", () => {
  const onClose = vi.fn();
  render(
    <MemoryRouter initialEntries={["/ledger"]}>
      <Menu open onClose={onClose} />
    </MemoryRouter>,
  );
  expect(MENU_ITEMS.map((i) => i.label)).toEqual(["HOME", "HOW IT WORKS", "OVERVIEW", "TAKSIR", "CASES", "LEDGER", "VERIFY"]);
  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(7);
  for (const item of MENU_ITEMS) expect(screen.getByRole("link", { name: new RegExp(item.label) })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /LEDGER/ })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: /HOME/ })).not.toHaveAttribute("aria-current");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("menu_marks_a_case_page_as_cases_and_overview_apart_from_home", () => {
  const { unmount } = render(
    <MemoryRouter initialEntries={["/case/3"]}>
      <Menu open onClose={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: /CASES/ })).toHaveClass("menu__item--active");
  unmount();
  render(
    <MemoryRouter initialEntries={["/overview"]}>
      <Menu open onClose={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.getByRole("link", { name: /OVERVIEW/ })).toHaveClass("menu__item--active");
  expect(screen.getByRole("link", { name: /HOME/ })).not.toHaveClass("menu__item--active");
});

test("menu_renders_nothing_when_closed", () => {
  render(
    <MemoryRouter>
      <Menu open={false} onClose={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});

test("menu_names_the_item_under_the_pointer", () => {
  render(
    <MemoryRouter initialEntries={["/ledger"]}>
      <Menu open onClose={() => {}} />
    </MemoryRouter>,
  );
  // The page we are on, until the pointer picks another item.
  expect(screen.getByText("06 / 07 — EVERY BURN")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /LEDGER/ })).toHaveClass("menu__item--active");
  fireEvent.mouseEnter(screen.getByRole("link", { name: /CASES/ }));
  expect(screen.getByText("05 / 07 — CALL HIS BLUFF")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /CASES/ })).toHaveClass("menu__item--active");
  expect(screen.getByRole("link", { name: /LEDGER/ })).not.toHaveClass("menu__item--active");
  fireEvent.mouseLeave(screen.getByRole("list"));
  expect(screen.getByText("06 / 07 — EVERY BURN")).toBeInTheDocument();
});

test("menu_shows_each_items_card_form_on_the_stage", () => {
  const stage = { setPage: vi.fn(), trigger: vi.fn(), setMenu: vi.fn(), preview: vi.fn(), travel: vi.fn(() => 0) };
  const { unmount } = render(
    <MemoryRouter>
      <StageContext.Provider value={stage}>
        <Menu open onClose={() => {}} />
      </StageContext.Provider>
    </MemoryRouter>,
  );
  expect(stage.setMenu).toHaveBeenLastCalledWith(true);
  fireEvent.mouseEnter(screen.getByRole("link", { name: /CASES/ }));
  expect(stage.preview).toHaveBeenLastCalledWith("pistol");
  fireEvent.focus(screen.getByRole("link", { name: /LEDGER/ }));
  expect(stage.preview).toHaveBeenLastCalledWith("sekop");
  fireEvent.mouseLeave(screen.getByRole("list"));
  expect(stage.preview).toHaveBeenLastCalledWith(null);
  unmount();
  expect(stage.setMenu).toHaveBeenLastCalledWith(false);
});
