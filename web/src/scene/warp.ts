import * as THREE from "three";

const LINES = 300;
const DURATION_S = 0.6;

export interface Warp {
  lines: THREE.LineSegments;
  start(): void;
  update(dt: number): void;
  dispose(): void;
}

/** Streaks of light rushing past the camera on a page change. Attach to the camera. */
export function makeWarp(): Warp {
  const angle = new Float32Array(LINES);
  const radius = new Float32Array(LINES);
  const pos = new Float32Array(LINES * 6);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.LineBasicMaterial({
    color: 0x8fb8ff,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const lines = new THREE.LineSegments(geo, mat);
  lines.position.z = -2;
  lines.frustumCulled = false;
  let t = DURATION_S;

  const write = (p: number) => {
    for (let i = 0; i < LINES; i++) {
      const r = radius[i] * (0.4 + p * 3);
      const len = 0.2 + p * 1.6;
      const c = Math.cos(angle[i]);
      const s = Math.sin(angle[i]);
      pos.set([c * r, s * r, 0, c * (r + len), s * (r + len), 0], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
  };

  return {
    lines,
    start() {
      for (let i = 0; i < LINES; i++) {
        angle[i] = Math.random() * Math.PI * 2;
        radius[i] = 0.15 + Math.random() * 0.9;
      }
      t = 0;
    },
    update(dt) {
      if (t >= DURATION_S) {
        mat.opacity = 0;
        return;
      }
      t += dt;
      const p = Math.min(1, t / DURATION_S);
      write(p);
      mat.opacity = Math.sin(p * Math.PI) * 0.9;
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
