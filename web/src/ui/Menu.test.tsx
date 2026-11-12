import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { StageContext } from "../scene/SceneCanvas";
import { MENU_ITEMS, Menu } from "./Menu";

test("menu_lists_five_items_and_marks_active", () => {
  const onClose = vi.fn();
  render(
    <MemoryRouter initialEntries={["/ledger"]}>
      <Menu open onClose={onClose} />
    </MemoryRouter>,
  );
  expect(MENU_ITEMS.map((i) => i.label)).toEqual(["HOME", "TAKSIR", "CASES", "LEDGER", "VERIFY"]);
  const links = screen.getAllByRole("link");
  expect(links).toHaveLength(5);
  for (const item of MENU_ITEMS) expect(screen.getByRole("link", { name: new RegExp(item.label) })).toBeInTheDocument();
  expect(screen.getByRole("link", { name: /LEDGER/ })).toHaveAttribute("aria-current", "page");
  expect(screen.getByRole("link", { name: /HOME/ })).not.toHaveAttribute("aria-current");
  fireEvent.keyDown(document, { key: "Escape" });
  expect(onClose).toHaveBeenCalledTimes(1);
});

test("menu_renders_nothing_when_closed", () => {
  render(
    <MemoryRouter>
      <Menu open={false} onClose={() => {}} />
    </MemoryRouter>,
  );
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});

test("menu_shows_each_items_card_form_on_the_stage", () => {
  const stage = { setPage: vi.fn(), trigger: vi.fn(), setMenu: vi.fn(), preview: vi.fn() };
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
