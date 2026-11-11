import * as THREE from "three";
import { FLOOR_Y } from "./floor";

const COUNT = 40;
const LIFE_S = 2;

export interface Embers {
  points: THREE.Points;
  emit(centerX: number): void;
  update(dt: number): void;
  dispose(): void;
}

/** Sparks rising from the floor when $TAKSIR is burned. */
export function makeEmbers(): Embers {
  const pos = new Float32Array(COUNT * 3);
  const speed = new Float32Array(COUNT);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    color: 0xff7a2a,
    size: 0.07,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const points = new THREE.Points(geo, mat);
  let age = LIFE_S;

  return {
    points,
    emit(centerX) {
      for (let i = 0; i < COUNT; i++) {
        pos[i * 3] = centerX + (Math.random() - 0.5) * 3;
        pos[i * 3 + 1] = FLOOR_Y + Math.random() * 0.2;
        pos[i * 3 + 2] = (Math.random() - 0.5) * 2;
        speed[i] = 0.8 + Math.random() * 0.8;
      }
      geo.attributes.position.needsUpdate = true;
      age = 0;
    },
    update(dt) {
      if (age >= LIFE_S) {
        mat.opacity = 0;
        return;
      }
      age += dt;
      for (let i = 0; i < COUNT; i++) {
        pos[i * 3 + 1] += speed[i] * dt;
        pos[i * 3] += Math.sin(age * 3 + i) * 0.003;
      }
      geo.attributes.position.needsUpdate = true;
      mat.opacity = Math.max(0, 1 - age / LIFE_S);
    },
    dispose() {
      geo.dispose();
      mat.dispose();
    },
  };
}
