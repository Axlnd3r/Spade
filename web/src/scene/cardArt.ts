// Mr. X card art. Fronts: four black-and-white engravings of Mr. X (padlock, sceptre,
// pistol, key; textures of the MrX_*.glb models). Back: original vector spade
// (Card.dc.html), rendered to a canvas texture, so its text uses system fonts: an SVG
// drawn as an image cannot load web fonts.
import gembokUrl from "./mrx-gembok.png";
import kunciUrl from "./mrx-kunci.png";
import pistolUrl from "./mrx-pistol.png";
import tongkatUrl from "./mrx-tongkat.png";

export const CARD_W = 768;
export const CARD_H = 1075;

/** The card's form, one per page: what Mr. X holds, or the spade on both sides. */
export type CardForm = "gembok" | "tongkat" | "pistol" | "sekop" | "kunci";

/** Front art (null = the spade, as on the back) and the colour of the light for each form. */
export const FORMS: Record<CardForm, { art: string | null; color: string }> = {
  gembok: { art: gembokUrl, color: "#6a5cff" },
  tongkat: { art: tongkatUrl, color: "#3fb6ff" },
  pistol: { art: pistolUrl, color: "#d24cff" },
  sekop: { art: null, color: "#ffb020" },
  kunci: { art: kunciUrl, color: "#7dffb5" },
};

export function formForPath(pathname: string): CardForm {
  // "/" and "/overview" share the padlock: Mr. X, locked in his TEE.
  if (pathname === "/taksir") return "tongkat";
  if (pathname === "/cases" || pathname.startsWith("/case/")) return "pistol";
  if (pathname === "/ledger") return "sekop";
  if (pathname === "/verify") return "kunci";
  return "gembok";
}

/** Turns line art into light engraved in glass: the ink becomes white with its strength as alpha,
 * the paper becomes clear. `lightInk` is for art drawn light on dark (the spade back). */
export function engrave(px: Uint8ClampedArray, lightInk: boolean): void {
  for (let i = 0; i < px.length; i += 4) {
    const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    const x = Math.min(1, Math.max(0, lightInk ? (l - 0.2) / 0.45 : (0.7 - l) / 0.35));
    const ink = x * x * (3 - 2 * x);
    px[i] = px[i + 1] = px[i + 2] = 255;
    px[i + 3] = Math.round(ink * px[i + 3]);
  }
}

const SPADE = "M0,-14 C5,-8 14,-3 14,4 C14,10 8,13 3,9 C3,12 4,15 7,17 L-7,17 C-4,15 -3,12 -3,9 C-8,13 -14,10 -14,4 C-14,-3 -5,-8 0,-14 Z";
const FONT = "'Arial Black', Arial, Helvetica, sans-serif";

const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 350" width="${CARD_W}" height="${CARD_H}">`;

export const BACK_SVG = `${open}
<defs>
<pattern id="hatch" width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
<line x1="0" y1="0" x2="0" y2="8" stroke="#FFFFFF" stroke-opacity="0.07" stroke-width="2"/>
</pattern>
</defs>
<rect x="1" y="1" width="248" height="348" rx="16" fill="#0E0E10" stroke="#3A3A40" stroke-width="1.5"/>
<rect x="12" y="12" width="226" height="326" rx="8" fill="url(#hatch)" stroke="#FFFFFF" stroke-opacity="0.55" stroke-width="1"/>
<path transform="translate(125 150) scale(4.2)" d="${SPADE}" fill="#FFFFFF"/>
<text x="125" y="262" fill="#FFFFFF" font-family="${FONT}" font-weight="900" font-size="16" letter-spacing="5" text-anchor="middle">SPADE</text>
<text x="125" y="284" fill="#CFCFCF" font-family="${FONT}" font-size="9" letter-spacing="2.4" text-anchor="middle">$TAKSIR · NEAR</text>
</svg>`;

export function svgDataUrl(svg: string): string {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
}
