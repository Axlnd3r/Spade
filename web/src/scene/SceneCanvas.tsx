import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import { BACK_SVG, formForPath, FORMS, svgDataUrl, type CardForm } from "./cardArt";
import type { Stage, StageEvent, StagePage } from "./Stage";
import { hasWebGL } from "./webgl";

export interface StageApi {
  setPage(page: StagePage): void;
  trigger(event: StageEvent): void;
  /** The menu is open: the card comes forward as on Home. */
  setMenu(open: boolean): void;
  /** Show another page's card form (the menu item under the pointer); null returns to this page's. */
  preview(form: CardForm | null): void;
  /** Start the journey to a page whose card form is `form`; returns how long the page being left
   * should stay on screen (ms), 0 when there is no journey. */
  travel(form: CardForm): number;
}

export const StageContext = createContext<StageApi>({
  setPage() {},
  trigger() {},
  setMenu() {},
  preview() {},
  travel: () => 0,
});

/** Commands for the 3D stage; harmless no-ops when WebGL is unavailable. */
export function useStage(): StageApi {
  return useContext(StageContext);
}

/** The fixed 3D background (or a static card image without WebGL) behind the pages. */
export function SceneCanvas({ children }: { children: ReactNode }) {
  const [webgl] = useState(hasWebGL);
  const [menu, setMenu] = useState(false);
  const [preview, setPreview] = useState<CardForm | null>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const { pathname } = useLocation();
  const page: StagePage = menu || pathname === "/" ? "home" : "inner";
  const form = preview ?? formForPath(pathname);
  // What the stage starts with: three.js may finish loading after the page or form has changed.
  const latest = useRef({ page, form });
  latest.current = { page, form };

  useEffect(() => {
    if (!webgl || !canvas.current) return;
    let live = true;
    // three.js loads after the first paint.
    import("./Stage").then(({ Stage }) => {
      if (!live || !canvas.current) return;
      const s = new Stage();
      s.setPage(latest.current.page);
      s.setForm(latest.current.form);
      s.mount(canvas.current);
      stage.current = s;
      if (import.meta.env.DEV) (window as unknown as { __stage: Stage }).__stage = s;
    });
    return () => {
      live = false;
      stage.current?.dispose();
      stage.current = null;
    };
  }, [webgl]);

  useEffect(() => {
    stage.current?.setPage(page);
  }, [page]);

  useEffect(() => {
    stage.current?.setForm(form);
  }, [form]);

  const api = useMemo<StageApi>(
    () => ({
      setPage: (p) => stage.current?.setPage(p),
      trigger: (e) => stage.current?.trigger(e),
      setMenu,
      preview: setPreview,
      travel: (f) => stage.current?.travel(f) ?? 0,
    }),
    [],
  );

  return (
    <StageContext.Provider value={api}>
      {webgl ? (
        <canvas ref={canvas} className={`stage stage--${page}`} aria-hidden="true" />
      ) : (
        <img
          className={`stage-fallback stage-fallback--${page}`}
          src={FORMS[form].art ?? svgDataUrl(BACK_SVG)}
          alt="Mr. X card"
        />
      )}
      {children}
    </StageContext.Provider>
  );
}
