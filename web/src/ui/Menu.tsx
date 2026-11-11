import { useEffect, useRef } from "react";
import { NavLink } from "react-router-dom";

export const MENU_ITEMS = [
  { n: "01", label: "HOME", to: "/", sub: "MEET MR. X" },
  { n: "02", label: "TAKSIR", to: "/taksir", sub: "GET A PRICE" },
  { n: "03", label: "CASES", to: "/cases", sub: "CALL HIS BLUFF" },
  { n: "04", label: "LEDGER", to: "/ledger", sub: "EVERY BURN" },
  { n: "05", label: "VERIFY", to: "/verify", sub: "CHECK THE SEALS" },
] as const;

/** Full-screen menu in the ohzi manner: one big list, the current page white, the rest dimmed. */
export function Menu({ open, onClose }: { open: boolean; onClose(): void }) {
  const first = useRef<HTMLAnchorElement>(null);

  useEffect(() => {
    if (!open) return;
    first.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <nav className="menu" aria-label="Main">
      <ol className="menu__list">
        {MENU_ITEMS.map((item, i) => (
          <li key={item.to}>
            <NavLink
              ref={i === 0 ? first : undefined}
              to={item.to}
              end={item.to === "/"}
              onClick={onClose}
              className="menu__item"
            >
              <span className="caption">
                {item.n} / 05 — {item.sub}
              </span>
              <span className="menu__label">{item.label}</span>
            </NavLink>
          </li>
        ))}
      </ol>
      <button type="button" className="menu__close ghost" onClick={onClose}>
        CLOSE
      </button>
    </nav>
  );
}
