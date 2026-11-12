// Mr. X card art. Front: Mr. X holding the padlock, a black-and-white engraving
// (texture of MrX_gembok.glb). Back: original vector spade (Card.dc.html), rendered
// to a canvas texture, so its text uses system fonts: an SVG drawn as an image
// cannot load web fonts.
import frontUrl from "./mrx-gembok.png";

export const CARD_W = 1024;
export const CARD_H = 1434;

export const FRONT_URL: string = frontUrl;

export const INK = [20, 20, 20] as const;
export const PAPER = [242, 240, 233] as const;

/** Snaps the grey edges of upscaled line art back to ink or paper, so the small source stays crisp. */
export function inkLevels(px: Uint8ClampedArray): void {
  for (let i = 0; i < px.length; i += 4) {
    const l = (0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2]) / 255;
    const x = Math.min(1, Math.max(0, (l - 0.35) / 0.35));
    const t = x * x * (3 - 2 * x);
    for (let c = 0; c < 3; c++) px[i + c] = INK[c] + (PAPER[c] - INK[c]) * t;
  }
}

const SPADE = "M0,-14 C5,-8 14,-3 14,4 C14,10 8,13 3,9 C3,12 4,15 7,17 L-7,17 C-4,15 -3,12 -3,9 C-8,13 -14,10 -14,4 C-14,-3 -5,-8 0,-14 Z";
const FONT = "'Arial Black', Arial, Helvetica, sans-serif";

const open = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 250 350" width="${CARD_W}" height="${CARD_H}">`;

const index = (rotate: boolean) => `
<g ${rotate ? 'transform="rotate(180 125 175)"' : ""} font-family="${FONT}" font-weight="900" font-size="17" fill="#1A1A1A" text-anchor="middle">
<text x="24" y="38">M</text>
<text x="24" y="60">R</text>
<circle cx="24" cy="69" r="2.2"/>
<text x="24" y="92" fill="#C8102E">X</text>
</g>`;

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
