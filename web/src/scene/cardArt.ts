// Mr. X card art: original vector drawing (Spade UI artifact, Card.dc.html).
// Rendered to a canvas texture, so text uses system fonts: an SVG drawn as an
// image cannot load web fonts.

export const CARD_W = 1024;
export const CARD_H = 1434;

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

export const FRONT_SVG = `${open}
<rect x="1" y="1" width="248" height="348" rx="16" fill="#FBF7EE" stroke="#1A1A1A" stroke-width="1.5"/>
${index(false)}
${index(true)}
<g stroke="#1A1A1A" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round">
<path d="M90,300 l-3,-6 M94,300 l0,-7 M98,300 l3,-6 M152,300 l-3,-6 M156,300 l0,-7 M160,300 l3,-6" fill="none"/>
<line x1="92" y1="200" x2="64" y2="138" stroke="#6B4423" stroke-width="3"/>
<path d="M64,140 q-6,8 -2,16 M64,140 q6,8 2,16" fill="none" stroke="#D22B2B" stroke-width="2"/>
<path transform="translate(63 124)" d="${SPADE}" fill="#1A1A1A"/>
<path d="M106,222 L124,222 L121,290 L109,290 Z" fill="#D22B2B"/>
<path d="M126,222 L144,222 L141,290 L129,290 Z" fill="#F2B91F"/>
<path d="M108,288 L122,288 L121,296 Q102,301 84,293 Q82,289 87,290 Q98,292 108,288 Z" fill="#D22B2B"/>
<path d="M128,288 L142,288 Q151,292 163,289 Q168,289 165,293 Q148,301 129,296 Z" fill="#D22B2B"/>
<circle cx="85" cy="291" r="2.6" fill="#F2B91F"/>
<circle cx="166" cy="291" r="2.6" fill="#F2B91F"/>
<path d="M102,134 Q113,131 125,130 L125,172 L99,172 Z" fill="#1E4FA3"/>
<path d="M125,130 Q137,131 148,134 L151,172 L125,172 Z" fill="#D22B2B"/>
<path d="M99,172 L125,172 L125,208 L96,208 Z" fill="#F2B91F"/>
<path d="M125,172 L151,172 L154,208 L125,208 Z" fill="#1E4FA3"/>
<path d="M96,206 L154,206 L152,214 L146,224 L140,214 L134,224 L128,214 L122,224 L116,214 L110,224 L104,214 L98,224 L96,214 Z" fill="#D22B2B"/>
<circle cx="98" cy="226" r="2.2" fill="#E9B42A"/>
<circle cx="122" cy="226" r="2.2" fill="#E9B42A"/>
<circle cx="146" cy="226" r="2.2" fill="#E9B42A"/>
<circle cx="125" cy="160" r="13" fill="#FBF7EE"/>
<path d="M118,153 L132,167 M132,153 L118,167" stroke="#C8102E" stroke-width="4"/>
<path d="M104,138 C94,150 90,168 88,190 L98,194 C100,174 104,158 112,146 Z" fill="#F2B91F"/>
<circle cx="92" cy="198" r="6" fill="#F8E3CF"/>
<path d="M146,138 C158,132 166,120 170,104 L180,108 C176,124 166,140 152,150 Z" fill="#1E4FA3"/>
<ellipse cx="176" cy="99" rx="6" ry="7" fill="#F8E3CF"/>
<path d="M174.5,93 L175,82 Q177,79.5 178.5,82 L178,93 Z" fill="#F8E3CF"/>
<path d="M102,128 Q125,122 148,128 L144,138 L138,131 L132,140 L125,132 L118,140 L112,131 L106,138 Z" fill="#D22B2B"/>
<ellipse cx="125" cy="104" rx="14" ry="17" fill="#F8E3CF"/>
<path d="M110,100 Q117,95 125,100 Q133,95 140,100 Q140,107 133,107 Q128,106 125,103 Q122,106 117,107 Q110,107 110,100 Z" fill="#1A1A1A"/>
<ellipse cx="117.5" cy="101.5" rx="2.6" ry="1.5" fill="#FBF7EE" stroke="none"/>
<ellipse cx="132.5" cy="101.5" rx="2.6" ry="1.5" fill="#FBF7EE" stroke="none"/>
<path d="M115,111 Q120,117 126,114 Q131,113 135,109" fill="none"/>
<path d="M110,93 C100,82 90,74 76,72 C86,66 104,68 118,86 Z" fill="#1E4FA3"/>
<path d="M116,88 C116,72 120,60 125,48 C131,60 135,72 134,88 Z" fill="#F2B91F"/>
<path d="M132,86 C146,68 162,66 174,70 C160,74 150,82 140,93 Z" fill="#D22B2B"/>
<path d="M109,92 Q125,85 141,92 L141,97 Q125,91 109,97 Z" fill="#1A1A1A"/>
<circle cx="76" cy="72" r="4.2" fill="#E9B42A"/>
<circle cx="125" cy="48" r="4.2" fill="#E9B42A"/>
<circle cx="174" cy="70" r="4.2" fill="#E9B42A"/>
</g>
<g font-family="serif" font-size="11" text-anchor="middle">
<text x="113" y="196" fill="#1A1A1A">&#9827;</text>
<text x="138" y="150" fill="#F2B91F">&#9830;</text>
<text x="114" y="262" fill="#FBF7EE">&#9824;</text>
<text x="135" y="256" fill="#D22B2B">&#9829;</text>
</g>
</svg>`;

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
