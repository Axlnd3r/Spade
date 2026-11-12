import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";

export const FLOOR_Y = -1.75;

export interface Floor {
  group: THREE.Group;
  setSize(width: number, height: number): void;
  /** Per frame: seconds, the card's x, the colour of its light, and how strongly it shines. */
  update(t: number, x: number, color: THREE.Color, power: number): void;
  dispose(): void;
}

// Not a mirror but dark water, in the ohzi manner: what it shows of the card is a blurred, rippling
// smear that survives only in patches, over a pool of the card's own light. The sheet has no edge:
// it fades into the dark with distance from the card.
const water = {
  name: "WaterShader",
  uniforms: {
    color: { value: null },
    tDiffuse: { value: null },
    textureMatrix: { value: null },
    uTime: { value: 0 },
    uGlow: { value: new THREE.Color() },
    uCenter: { value: new THREE.Vector2() },
    uPower: { value: 1 },
  },
  vertexShader: /* glsl */ `
    uniform mat4 textureMatrix;
    varying vec4 vUv;
    varying vec2 vWorld;
    void main() {
      vUv = textureMatrix * vec4(position, 1.0);
      vWorld = (modelMatrix * vec4(position, 1.0)).xz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 color;
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform vec3 uGlow;
    uniform vec2 uCenter;
    uniform float uPower;
    varying vec4 vUv;
    varying vec2 vWorld;

    float h21(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p) {
      vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y);
    }
    float fbm(vec2 p) { return 0.55 * vnoise(p) + 0.3 * vnoise(p * 2.1 + 3.7) + 0.15 * vnoise(p * 4.3 + 1.3); }

    void main() {
      vec2 q = vWorld * 0.9;
      // Two slow, drifting ripple fields push the reflection around.
      float n1 = fbm(q + vec2(uTime * 0.05, uTime * 0.03));
      float n2 = fbm(q * 1.7 - vec2(uTime * 0.04, uTime * 0.06) + 9.1);
      vec2 off = (vec2(n1, n2) - 0.5) * 0.07;
      vec2 uv = vUv.xy / vUv.w + off;

      // A wide blur: a ring of taps around the pushed position.
      float r = 0.007 + 0.014 * n1;
      vec3 acc = texture2D(tDiffuse, uv).rgb * 2.0;
      for (int i = 0; i < 8; i++) {
        float a = 6.2831853 * float(i) / 8.0;
        acc += texture2D(tDiffuse, uv + vec2(cos(a), sin(a) * 1.6) * r).rgb;
      }
      vec3 refl = acc / 10.0 * color * 2.6;

      // The reflection survives only in patches; the rest is black water.
      float keep = smoothstep(0.36, 0.64, fbm(q * 1.4 + uTime * 0.02));
      refl *= mix(0.12, 1.0, keep);

      // The pool of the card's light, and a few glints in it.
      vec2 d = (vWorld - uCenter) * vec2(0.4, 0.68);
      float pool = exp(-dot(d, d) * 1.5);
      float glint = pow(smoothstep(0.78, 1.0, vnoise(q * 5.0 + vec2(uTime * 0.2, 0.0))), 3.0);
      vec3 col = refl + uGlow * pool * (0.12 + 0.4 * n1 + 0.3 * glint) * uPower;

      // No visible edge: the water dissolves into the dark.
      float fade = smoothstep(8.5, 2.5, length(vWorld - vec2(uCenter.x, 0.0)));
      gl_FragColor = vec4(col, fade);

      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`,
};

export function makeFloor(width: number, height: number): Floor {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(40, 40);
  const mirror = new Reflector(geo, {
    clipBias: 0.003,
    textureWidth: width * 0.5,
    textureHeight: height * 0.5,
    color: 0x9a9a9a,
    shader: water,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = FLOOR_Y;
  // Drawn over the dark background, fading out.
  const mat = mirror.material as THREE.ShaderMaterial;
  mat.transparent = true;
  mat.depthWrite = false;

  group.add(mirror);
  const u = mat.uniforms;
  return {
    group,
    setSize(w, h) {
      mirror.getRenderTarget().setSize(w * 0.5, h * 0.5);
    },
    update(t, x, color, power) {
      u.uTime.value = t;
      u.uCenter.value.set(x, 0);
      u.uGlow.value.copy(color);
      u.uPower.value = power;
    },
    dispose() {
      geo.dispose();
      mirror.dispose();
    },
  };
}
