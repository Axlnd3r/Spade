import { useEffect, useRef, useState } from "react";
import { prefersReducedMotion } from "../scene/webgl";

const SIZE = 60;
/** How far the glass bends what is under it, in pixels at the rim. */
const BEND = 26;
const CONTROLS = "a, button, label, summary";
const FIELDS = "input, textarea, select";

type Mode = "hidden" | "lens" | "ring";

function hasFinePointer(): boolean {
  return typeof matchMedia === "function" && matchMedia("(hover: hover) and (pointer: fine)").matches;
}

/** A displacement map for a magnifying glass: red and green say how far to reach toward the centre
 * for each pixel, a little at the middle and much more at the rim, like a ball of glass. */
function lensMap(): string {
  const n = SIZE * 2;
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = n;
  const ctx = canvas.getContext("2d");
  if (!ctx) return "";
  const img = ctx.createImageData(n, n);
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const dx = (x + 0.5) / n - 0.5;
      const dy = (y + 0.5) / n - 0.5;
      const d = Math.min(1, Math.hypot(dx, dy) * 2);
      const pull = 0.45 + 0.55 * d ** 3;
      const i = (y * n + x) * 4;
      img.data[i] = 128 - dx * 2 * pull * 127;
      img.data[i + 1] = 128 - dy * 2 * pull * 127;
      img.data[i + 2] = 128;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return canvas.toDataURL();
}

/** The pointer as a ball of glass, in the ohzi manner: it trails the mouse and magnifies whatever is
 * under it. Over a button or link it shrinks to a ring; over a field it steps out of the way.
 * Mouse only. The bending needs a browser that takes an SVG filter as a backdrop (Chromium);
 * elsewhere it is plain glass. */
export function Lens() {
  const [enabled] = useState(hasFinePointer);
  const [mode, setMode] = useState<Mode>("hidden");
  const [map, setMap] = useState("");
  const el = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!enabled) return;
    setMap(lensMap());
    const root = document.documentElement;
    root.classList.add("has-lens");
    const lag = prefersReducedMotion() ? 1 : 0.22;
    const at = { x: 0, y: 0 };
    const to = { x: 0, y: 0 };
    let placed = false;
    let raf = 0;

    const frame = () => {
      at.x += (to.x - at.x) * lag;
      at.y += (to.y - at.y) * lag;
      if (el.current) el.current.style.transform = `translate3d(${at.x}px, ${at.y}px, 0)`;
      raf = Math.abs(to.x - at.x) + Math.abs(to.y - at.y) > 0.1 ? requestAnimationFrame(frame) : 0;
    };
    const onMove = (e: PointerEvent) => {
      if (e.pointerType === "touch") return;
      to.x = e.clientX;
      to.y = e.clientY;
      if (!placed) {
        // First sight of the pointer: appear under it, not fly in from the corner.
        at.x = to.x;
        at.y = to.y;
        placed = true;
      }
      const over = e.target instanceof Element ? e.target : null;
      setMode(over?.closest(FIELDS) ? "hidden" : over?.closest(CONTROLS) ? "ring" : "lens");
      if (!raf) raf = requestAnimationFrame(frame);
    };
    const onLeave = () => setMode("hidden");

    window.addEventListener("pointermove", onMove);
    document.addEventListener("pointerleave", onLeave);
    window.addEventListener("blur", onLeave);
    return () => {
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("blur", onLeave);
      cancelAnimationFrame(raf);
      root.classList.remove("has-lens");
    };
  }, [enabled]);

  if (!enabled) return null;
  return (
    <>
      <svg className="lens-defs" aria-hidden="true" width="0" height="0">
        <filter id="lens-bend" x="0" y="0" width="100%" height="100%" colorInterpolationFilters="sRGB">
          {map ? <feImage href={map} x="0" y="0" width={SIZE} height={SIZE} result="map" /> : null}
          <feDisplacementMap in="SourceGraphic" in2="map" scale={map ? BEND : 0} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </svg>
      <div ref={el} className="lens" data-testid="lens" data-mode={mode} aria-hidden="true">
        <div className="lens__glass" />
      </div>
    </>
  );
}
