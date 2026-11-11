import * as THREE from "three";
import { BACK_SVG, CARD_H, CARD_W, FRONT_SVG, svgDataUrl } from "./cardArt";

export const CARD_WIDTH = 2.5;
export const CARD_HEIGHT = 3.5;
const THICKNESS = 0.03;
/** Matches the art's rounded corner (rx 16 of 250). */
const CORNER = (16 / 250) * CARD_WIDTH;

export interface Card {
  group: THREE.Group;
  /** 0 = whole card, 1 = front fully burned away (dissolve shader). */
  burn: { value: number };
  setGlow(intensity: number): void;
  dispose(): void;
}

function svgTexture(svg: string): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = CARD_W;
  canvas.height = CARD_H;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const img = new Image();
  img.onload = () => {
    canvas.getContext("2d")?.drawImage(img, 0, 0, CARD_W, CARD_H);
    tex.needsUpdate = true;
  };
  img.src = svgDataUrl(svg);
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

/** Burns the face away from a value-noise front with a glowing orange rim. */
function addDissolve(mat: THREE.MeshStandardMaterial, burn: { value: number }) {
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
  if (e < 0.07) gl_FragColor.rgb = mix(vec3(4.0, 1.4, 0.25), gl_FragColor.rgb, e / 0.07);
}`,
      );
  };
}

export function makeCard(): Card {
  const group = new THREE.Group();
  const burn = { value: 0 };
  const frontTex = svgTexture(FRONT_SVG);
  const backTex = svgTexture(BACK_SVG);

  const face = (map: THREE.Texture) =>
    new THREE.MeshStandardMaterial({
      map,
      emissiveMap: map,
      emissive: new THREE.Color(0xffffff),
      emissiveIntensity: 0.16,
      roughness: 0.42,
      metalness: 0.05,
      alphaTest: 0.5,
      side: THREE.FrontSide,
    });
  const frontMat = face(frontTex);
  const backMat = face(backTex);
  addDissolve(frontMat, burn);

  const plane = new THREE.PlaneGeometry(CARD_WIDTH, CARD_HEIGHT);
  const front = new THREE.Mesh(plane, frontMat);
  front.position.z = THICKNESS / 2 + 0.001;
  const back = new THREE.Mesh(plane, backMat);
  back.rotation.y = Math.PI;
  back.position.z = -THICKNESS / 2 - 0.001;

  const edgeGeo = new THREE.ExtrudeGeometry(roundedRect(CARD_WIDTH, CARD_HEIGHT, CORNER), {
    depth: THICKNESS,
    bevelEnabled: false,
    curveSegments: 6,
  });
  edgeGeo.translate(0, 0, -THICKNESS / 2);
  const edgeMat = new THREE.MeshStandardMaterial({ color: 0xe9e4d6, roughness: 0.6 });
  // Group 0 is the two caps (covered by the faces), group 1 the sides.
  const edge = new THREE.Mesh(edgeGeo, [new THREE.MeshBasicMaterial({ visible: false }), edgeMat]);

  group.add(edge, front, back);

  return {
    group,
    burn,
    setGlow(intensity) {
      frontMat.emissiveIntensity = intensity;
      backMat.emissiveIntensity = intensity;
    },
    dispose() {
      plane.dispose();
      edgeGeo.dispose();
      for (const m of [frontMat, backMat, edgeMat]) m.dispose();
      frontTex.dispose();
      backTex.dispose();
    },
  };
}
