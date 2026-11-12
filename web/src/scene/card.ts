import * as THREE from "three";
import { BACK_SVG, CARD_H, CARD_W, engrave, FORMS, svgDataUrl, type CardForm } from "./cardArt";

export const CARD_WIDTH = 2.5;
export const CARD_HEIGHT = 3.5;
const THICKNESS = 0.1;
const BEVEL = 0.02;
/** Rounded corner of the card (rx 16 of 250 in the back art). */
const CORNER = (16 / 250) * CARD_WIDTH;
const WHITE = new THREE.Color(0xffffff);
const LINE_LIGHT = 0.82;

export interface Card {
  group: THREE.Group;
  /** The glass slab: what a pointer has to hit to grab the card. */
  body: THREE.Mesh;
  /** 0 = whole card, 1 = front art fully burned away (dissolve shader). */
  burn: { value: number };
  setGlow(intensity: number): void;
  /** The light caught in the glass. */
  setColor(color: THREE.Color): void;
  setForm(form: CardForm): void;
  dispose(): void;
}

/** Line art as light: white, with the ink as alpha (see `engrave`), corners left clear. */
function lineTexture(url: string, lightInk: boolean): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const img = new Image();
  img.onload = () => {
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingQuality = "high";
    ctx.beginPath();
    ctx.roundRect(0, 0, CARD_W, CARD_H, (CORNER / CARD_WIDTH) * CARD_W);
    ctx.clip();
    ctx.drawImage(img, 0, 0, CARD_W, CARD_H);
    const d = ctx.getImageData(0, 0, CARD_W, CARD_H);
    engrave(d.data, lightInk);
    ctx.putImageData(d, 0, 0);
    tex.needsUpdate = true;
  };
  img.src = url;
  return tex;
}

function roundedRect(w: number, h: number, r: number): THREE.Shape {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

/** Dark glass: nearly clear face-on, catching the light at grazing angles and on the bevelled edges. */
function glassMaterial(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: { uRim: { value: new THREE.Color() }, uGlow: { value: 1 } },
    vertexShader: `
varying vec3 vN;
varying vec3 vV;
void main() {
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalMatrix * normal;
  vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
}`,
    fragmentShader: `
uniform vec3 uRim;
uniform float uGlow;
varying vec3 vN;
varying vec3 vV;
void main() {
  vec3 n = normalize(vN) * (gl_FrontFacing ? 1.0 : -1.0);
  vec3 v = normalize(vV);
  float f = pow(1.0 - abs(dot(n, v)), 2.5);
  float spec = pow(max(dot(reflect(-normalize(vec3(0.35, 0.55, 0.75)), n), v), 0.0), 60.0);
  vec3 col = uRim * (0.12 + 1.1 * f) + vec3(0.9) * spec;
  gl_FragColor = vec4(col * uGlow, 0.18 + 0.5 * f + spec);
}`,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
}

/** Burns the art away from a value-noise front with a glowing orange rim. */
function addDissolve(mat: THREE.MeshBasicMaterial, burn: { value: number }) {
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uBurn = burn;
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
uniform float uBurn;
float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vnoise(vec2 p) {
  vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
}`,
      )
      .replace(
        "#include <dithering_fragment>",
        `#include <dithering_fragment>
if (uBurn > 0.0) {
  float n = 0.65 * vnoise(vMapUv * 7.0) + 0.35 * vnoise(vMapUv * 19.0);
  float e = n - uBurn * 0.85 + 0.04;
  if (e < 0.0) discard;
  if (e < 0.07) {
    // The burning front glows across the glass, not only on the lines.
    gl_FragColor.rgb = mix(vec3(4.0, 1.4, 0.25), gl_FragColor.rgb, e / 0.07);
    gl_FragColor.a = max(gl_FragColor.a, 1.0 - e / 0.07);
  }
}`,
      );
  };
}

export function makeCard(): Card {
  const group = new THREE.Group();
  const burn = { value: 0 };
  const spade = lineTexture(svgDataUrl(BACK_SVG), true);
  const fronts = new Map<CardForm, THREE.CanvasTexture>();
  for (const [form, { art }] of Object.entries(FORMS) as Array<[CardForm, { art: string | null }]>)
    fronts.set(form, art ? lineTexture(art, false) : spade);

  const face = (map: THREE.Texture) =>
    new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, fog: false, side: THREE.FrontSide });
  const frontMat = face(fronts.get("gembok")!);
  const backMat = face(spade);
  addDissolve(frontMat, burn);

  const z = THICKNESS / 2 + BEVEL + 0.002;
  const plane = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
  const front = new THREE.Mesh(plane, frontMat);
  front.position.z = z;
  const back = new THREE.Mesh(plane, backMat);
  back.rotation.y = Math.PI;
  back.position.z = -z;
  front.renderOrder = back.renderOrder = 1;

  const bodyGeo = new THREE.ExtrudeGeometry(roundedRect(CARD_WIDTH - BEVEL * 2, CARD_HEIGHT - BEVEL * 2, CORNER), {
    depth: THICKNESS,
    bevelEnabled: true,
    bevelThickness: BEVEL,
    bevelSize: BEVEL,
    bevelSegments: 3,
    curveSegments: 8,
  });
  bodyGeo.translate(0, 0, -THICKNESS / 2);
  const glass = glassMaterial();
  const body = new THREE.Mesh(bodyGeo, glass);

  group.add(body, front, back);

  const tint = WHITE.clone();
  let glow = 1;
  const paint = () => {
    // Just under the bloom threshold: the lines stay sharp and only their brightest parts glow.
    frontMat.color.copy(tint).multiplyScalar(LINE_LIGHT * glow);
    backMat.color.copy(frontMat.color);
  };

  return {
    group,
    body,
    burn,
    setGlow(intensity) {
      glow = intensity;
      glass.uniforms.uGlow.value = intensity;
      paint();
    },
    setColor(color) {
      glass.uniforms.uRim.value.copy(color);
      // The engraving is white with a breath of the glass's light.
      tint.copy(color).lerp(WHITE, 0.72);
      paint();
    },
    setForm(form) {
      frontMat.map = fronts.get(form)!;
    },
    dispose() {
      plane.dispose();
      bodyGeo.dispose();
      for (const m of [frontMat, backMat, glass]) m.dispose();
      for (const t of new Set([spade, ...fronts.values()])) t.dispose();
    },
  };
}
