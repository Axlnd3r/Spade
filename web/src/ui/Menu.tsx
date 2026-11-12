import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";
import { formForPath } from "../scene/cardArt";
import { useStage } from "../scene/SceneCanvas";

export const MENU_ITEMS = [
  { n: "01", label: "HOME", to: "/", sub: "MEET MR. X" },
  { n: "02", label: "TAKSIR", to: "/taksir", sub: "GET A PRICE" },
  { n: "03", label: "CASES", to: "/cases", sub: "CALL HIS BLUFF" },
  { n: "04", label: "LEDGER", to: "/ledger", sub: "EVERY BURN" },
  { n: "05", label: "VERIFY", to: "/verify", sub: "CHECK THE SEALS" },
] as const;

/** Full-screen menu in the ohzi manner: one big list beside the card, which takes the form of the
 * item under the pointer; the current page white, the rest dimmed. */
export function Menu({ open, onClose }: { open: boolean; onClose(): void }) {
  const nav = useRef<HTMLElement>(null);
  // True while the menu moves focus itself, which must not count as the visitor choosing an item.
  const settling = useRef(false);
  const { setMenu, preview } = useStage();

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
      preview(null);
      setMenu(false);
    };
  }, [open, onClose, setMenu, preview]);

  if (!open) return null;
  return (
    <nav ref={nav} className="menu" aria-label="Main">
      <ol className="menu__list" onMouseLeave={() => preview(null)}>
        {MENU_ITEMS.map((item) => {
          const show = () => {
            if (!settling.current) preview(formForPath(item.to));
          };
          return (
            <li key={item.to}>
              <NavLink
                to={item.to}
                end={item.to === "/"}
                onClick={onClose}
                onMouseEnter={show}
                onFocus={show}
                className="menu__item"
              >
                <span className="caption">
                  {item.n} / 05 — {item.sub}
                </span>
                <span className="menu__label">{item.label}</span>
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
