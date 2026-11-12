import * as THREE from "three";

const STREAKS = 260;
/** Distance in front of the camera; the tunnel is drawn over everything, so only its size matters. */
const DEPTH = 1;
/** Things on this layer are seen by the main camera only, not by the floor's mirror camera. */
export const CAMERA_ONLY_LAYER = 1;

export interface Tunnel {
  group: THREE.Group;
  /** Fit the view: vertical field of view in degrees, and width / height. */
  setView(fovDeg: number, aspect: number): void;
  /** `cover` 0..1 is how much of the view the tunnel takes; `color` is the light of the page ahead. */
  update(dt: number, cover: number, color: THREE.Color): void;
  dispose(): void;
}

/** The passage between two pages: the whole view in the next page's light, darkest at the centre,
 * with streaks of light rushing outward. Attach to the camera. */
export function makeTunnel(): Tunnel {
  const group = new THREE.Group();
  group.position.z = -DEPTH;
  group.visible = false;

  const wallMat = new THREE.ShaderMaterial({
    uniforms: { uColor: { value: new THREE.Color() }, uCover: { value: 0 } },
    vertexShader: `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`,
    fragmentShader: `
uniform vec3 uColor;
uniform float uCover;
varying vec2 vUv;
void main() {
  float d = length(vUv - 0.5) * 2.0;
  vec3 col = mix(uColor * 0.035, uColor * 0.2, smoothstep(0.1, 1.2, d));
  gl_FragColor = vec4(col, uCover);
}`,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const wallGeo = new THREE.PlaneGeometry(2, 2);
  const wall = new THREE.Mesh(wallGeo, wallMat);
  wall.renderOrder = 20;

  const angle = new Float32Array(STREAKS);
  const speed = new Float32Array(STREAKS);
  const offset = new Float32Array(STREAKS);
  const length = new Float32Array(STREAKS);
  const pos = new Float32Array(STREAKS * 6);
  const shade = new Float32Array(STREAKS * 6);
  for (let i = 0; i < STREAKS; i++) {
    angle[i] = Math.random() * Math.PI * 2;
    speed[i] = 0.5 + Math.random() * 0.9;
    offset[i] = Math.random();
    length[i] = 0.06 + Math.random() * 0.28;
    // Each streak is faint at its tail and bright at its head.
    const bright = 0.5 + Math.random() * 0.5;
    shade.set([0.12, 0.12, 0.12, bright, bright, bright], i * 6);
  }
  const lineGeo = new THREE.BufferGeometry();
  lineGeo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  lineGeo.setAttribute("color", new THREE.BufferAttribute(shade, 3));
  const lineMat = new THREE.LineBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthTest: false,
    depthWrite: false,
    fog: false,
  });
  const lines = new THREE.LineSegments(lineGeo, lineMat);
  lines.frustumCulled = false;
  lines.renderOrder = 21;

  group.add(wall, lines);
  group.traverse((o) => o.layers.set(CAMERA_ONLY_LAYER));

  const white = new THREE.Color(0xffffff);
  let time = 0;

  return {
    group,
    setView(fovDeg, aspect) {
      const halfH = Math.tan(THREE.MathUtils.degToRad(fovDeg / 2)) * DEPTH;
      const halfW = halfH * aspect;
      wall.scale.set(halfW, halfH, 1);
      // Streaks are laid out on a unit circle that reaches the corners of the view.
      lines.scale.setScalar(Math.hypot(halfW, halfH));
    },
    update(dt, cover, color) {
      group.visible = cover > 0.001;
      if (!group.visible) return;
      time += dt * (0.5 + cover);
      for (let i = 0; i < STREAKS; i++) {
        const r = 0.14 + ((offset[i] + time * speed[i]) % 1) * 1.1;
        const len = length[i] * (0.5 + r * 1.4);
        const c = Math.cos(angle[i]);
        const s = Math.sin(angle[i]);
        pos.set([c * r, s * r, 0, c * (r + len), s * (r + len), 0], i * 6);
      }
      lineGeo.attributes.position.needsUpdate = true;
      wallMat.uniforms.uColor.value.copy(color);
      wallMat.uniforms.uCover.value = cover;
      lineMat.color.copy(color).lerp(white, 0.15);
      lineMat.opacity = cover;
    },
    dispose() {
      wallGeo.dispose();
      wallMat.dispose();
      lineGeo.dispose();
      lineMat.dispose();
    },
  };
}
