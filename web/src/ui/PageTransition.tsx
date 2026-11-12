import { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation, type Location } from "react-router-dom";
import { formForPath } from "../scene/cardArt";
import { useStage } from "../scene/SceneCanvas";

/** How long the arriving page's lines take to rise in (matches .route--in in styles.css). */
const IN_MS = 1100;

type Phase = "idle" | "out" | "in";

/** Moves between pages the way the stage does: the page being left fades while the card carries the
 * view through its tunnel, and the next page is rendered only when the stage says the journey is
 * over. `children` renders the routes for the location it is given. */
export function PageTransition({ children }: { children(location: Location): ReactNode }) {
  const location = useLocation();
  const { travel } = useStage();
  const [shown, setShown] = useState(location);
  const [phase, setPhase] = useState<Phase>("idle");
  const shownPath = useRef(shown.pathname);

  useEffect(() => {
    if (location.pathname === shownPath.current) {
      // Came back to the page still on screen before the journey ended: show it again.
      setPhase((p) => (p === "out" ? "in" : p));
      return;
    }
    const arrive = () => {
      shownPath.current = location.pathname;
      setShown(location);
      setPhase("in");
      document.documentElement.scrollTop = 0;
    };
    const wait = travel(formForPath(location.pathname));
    let swap: ReturnType<typeof setTimeout> | undefined;
    if (wait > 0) {
      setPhase("out");
      swap = setTimeout(arrive, wait);
    } else {
      arrive();
    }
    const rest = setTimeout(() => setPhase("idle"), wait + IN_MS);
    return () => {
      clearTimeout(swap);
      clearTimeout(rest);
    };
  }, [location, travel]);

  // The header steps aside too while the tunnel has the view.
  useEffect(() => {
    document.body.classList.toggle("travelling", phase === "out");
    return () => document.body.classList.remove("travelling");
  }, [phase]);

  return <div className={`route route--${phase}`}>{children(shown)}</div>;
}
