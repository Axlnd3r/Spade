import { useEffect, useRef, useState } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { formForPath } from "../scene/cardArt";
import { useStage } from "../scene/SceneCanvas";

export const MENU_ITEMS = [
  { n: "01", label: "HOME", to: "/", sub: "MEET MR. X" },
  { n: "02", label: "HOW IT WORKS", to: "/how", sub: "IN ONE MINUTE" },
  { n: "03", label: "OVERVIEW", to: "/overview", sub: "LIVE FROM TESTNET" },
  { n: "04", label: "TAKSIR", to: "/taksir", sub: "GET A PRICE" },
  { n: "05", label: "CASES", to: "/cases", sub: "CALL HIS BLUFF" },
  { n: "06", label: "LEDGER", to: "/ledger", sub: "EVERY BURN" },
  { n: "07", label: "VERIFY", to: "/verify", sub: "CHECK THE SEALS" },
] as const;

/** Full-screen menu in the ohzi manner: one big list beside the card. The item under the pointer
 * stands out at full size, the line above the list names it, and the card takes its form. */
export function Menu({ open, onClose }: { open: boolean; onClose(): void }) {
  const nav = useRef<HTMLElement>(null);
  // True while the menu moves focus itself, which must not count as the visitor choosing an item.
  const settling = useRef(false);
  const { setMenu, preview } = useStage();
  const { pathname } = useLocation();
  const [picked, setPicked] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMenu(true);
    document.body.classList.add("menu-open");
    settling.current = true;
    (nav.current?.querySelector<HTMLElement>('[aria-current="page"]') ?? nav.current?.querySelector("a"))?.focus();
    settling.current = false;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("menu-open");
      setPicked(null);
      preview(null);
      setMenu(false);
    };
  }, [open, onClose, setMenu, preview]);

  if (!open) return null;
  // The item under the pointer, else the page we are on (a case belongs to CASES).
  const base = pathname.startsWith("/case/") ? "/cases" : pathname;
  const active = MENU_ITEMS.find((i) => i.to === picked) ?? MENU_ITEMS.find((i) => i.to === base) ?? MENU_ITEMS[0];
  const pick = (to: string | null) => {
    setPicked(to);
    preview(to === null ? null : formForPath(to));
  };

  return (
    <nav ref={nav} className="menu" aria-label="Main">
      <p className="menu__pretitle caption" aria-live="polite">
        {active.n} / 07 — {active.sub}
      </p>
      <ol className="menu__list" onMouseLeave={() => pick(null)}>
        {MENU_ITEMS.map((item) => {
          const show = () => {
            if (!settling.current) pick(item.to);
          };
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                onClick={onClose}
                onMouseEnter={show}
                onFocus={show}
                className={item === active ? "menu__item menu__item--active" : "menu__item"}
              >
                {item.label}
              </NavLink>
            </li>
          );
        })}
      </ol>
      <button type="button" className="menu__close ghost" onClick={onClose}>
        CLOSE
      </button>
    </nav>
  );
}
