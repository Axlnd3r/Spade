import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { FRONT_URL } from "./cardArt";
import type { Stage, StageEvent, StagePage } from "./Stage";
import { hasWebGL } from "./webgl";

export interface StageApi {
  setPage(page: StagePage): void;
  trigger(event: StageEvent): void;
}

export const StageContext = createContext<StageApi>({ setPage() {}, trigger() {} });

/** Commands for the 3D stage; harmless no-ops when WebGL is unavailable. */
export function useStage(): StageApi {
  return useContext(StageContext);
}

/** The fixed 3D background (or a static card image without WebGL) behind the pages. */
export function SceneCanvas({ children }: { children: ReactNode }) {
  const [webgl] = useState(hasWebGL);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const firstRoute = useRef(true);
  const { pathname } = useLocation();
  const page: StagePage = pathname === "/" ? "home" : "inner";

  useEffect(() => {
    if (!webgl || !canvas.current) return;
    let live = true;
    // three.js loads after the first paint.
    import("./Stage").then(({ Stage }) => {
      if (!live || !canvas.current) return;
      const s = new Stage();
      s.setPage(page);
      s.mount(canvas.current);
      stage.current = s;
      if (import.meta.env.DEV) (window as unknown as { __stage: Stage }).__stage = s;
    });
    return () => {
      live = false;
      stage.current?.dispose();
      stage.current = null;
    };
    // The stage is created once; page changes go through the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [webgl]);

  useEffect(() => {
    stage.current?.setPage(page);
    if (firstRoute.current) firstRoute.current = false;
    else stage.current?.warp();
  }, [pathname, page]);

  const api = useMemo<StageApi>(
    () => ({
      setPage: (p) => stage.current?.setPage(p),
      trigger: (e) => stage.current?.trigger(e),
    }),
    [],
  );

  return (
    <StageContext.Provider value={api}>
      {webgl ? (
        <canvas ref={canvas} className={`stage stage--${page}`} aria-hidden="true" />
      ) : (
        <img className={`stage-fallback stage-fallback--${page}`} src={FRONT_URL} alt="Mr. X card" />
      )}
      {children}
    </StageContext.Provider>
  );
}
