import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useNavigate } from "react-router-dom";
import { StageContext, type StageApi } from "../scene/SceneCanvas";
import { PageTransition } from "./PageTransition";

function Go() {
  const navigate = useNavigate();
  return (
    <button type="button" onClick={() => navigate("/ledger")}>
      go
    </button>
  );
}

function renderPages(stage?: Partial<StageApi>) {
  const api: StageApi = { setPage: vi.fn(), trigger: vi.fn(), setMenu: vi.fn(), preview: vi.fn(), travel: vi.fn(() => 0), ...stage };
  render(
    <MemoryRouter initialEntries={["/taksir"]}>
      <StageContext.Provider value={api}>
        <Go />
        <PageTransition>
          {(location) => (
            <Routes location={location}>
              <Route path="/taksir" element={<p>taksir page</p>} />
              <Route path="/ledger" element={<p>ledger page</p>} />
            </Routes>
          )}
        </PageTransition>
      </StageContext.Provider>
    </MemoryRouter>,
  );
  return api;
}

afterEach(() => vi.useRealTimers());

test("old_page_stays_until_the_card_has_travelled", () => {
  vi.useFakeTimers();
  const api = renderPages({ travel: vi.fn(() => 900) });
  fireEvent.click(screen.getByRole("button", { name: "go" }));
  expect(api.travel).toHaveBeenCalledWith("sekop");
  expect(screen.getByText("taksir page")).toBeInTheDocument();
  expect(screen.getByText("taksir page").closest(".route")).toHaveClass("route--out");
  expect(document.body).toHaveClass("travelling");
  act(() => {
    vi.advanceTimersByTime(900);
  });
  expect(screen.queryByText("taksir page")).toBeNull();
  expect(screen.getByText("ledger page").closest(".route")).toHaveClass("route--in");
  expect(document.body).not.toHaveClass("travelling");
});

test("page_changes_at_once_when_the_stage_does_not_travel", () => {
  renderPages();
  fireEvent.click(screen.getByRole("button", { name: "go" }));
  expect(screen.getByText("ledger page")).toBeInTheDocument();
  expect(screen.queryByText("taksir page")).toBeNull();
});
