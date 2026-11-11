import * as THREE from "three";
import { Reflector } from "three/addons/objects/Reflector.js";

export const FLOOR_Y = -1.75;

export interface Floor {
  group: THREE.Group;
  setSize(width: number, height: number): void;
  dispose(): void;
}

/** Procedural speckle (no texture files): breaks the mirror into a wet-floor sheen. */
function speckleTexture(): THREE.CanvasTexture {
  const size = 512;
  const c = document.createElement("canvas");
  c.width = c.height = size;
  const ctx = c.getContext("2d")!;
  const img = ctx.createImageData(size, size);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = Math.random();
    img.data[i] = img.data[i + 1] = img.data[i + 2] = 0;
    img.data[i + 3] = 140 + v * 115;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(10, 10);
  return tex;
}

export function makeFloor(width: number, height: number): Floor {
  const group = new THREE.Group();
  const geo = new THREE.PlaneGeometry(40, 40);
  const mirror = new Reflector(geo, {
    clipBias: 0.003,
    textureWidth: width * 0.5,
    textureHeight: height * 0.5,
    color: 0x9a9a9a,
  });
  mirror.rotation.x = -Math.PI / 2;
  mirror.position.y = FLOOR_Y;

  const speckle = speckleTexture();
  const sheenMat = new THREE.MeshBasicMaterial({
    color: 0x000000,
    alphaMap: speckle,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  const sheen = new THREE.Mesh(geo, sheenMat);
  sheen.rotation.x = -Math.PI / 2;
  sheen.position.y = FLOOR_Y + 0.002;

  group.add(mirror, sheen);
  return {
    group,
    setSize(w, h) {
      mirror.getRenderTarget().setSize(w * 0.5, h * 0.5);
    },
    dispose() {
      geo.dispose();
      mirror.dispose();
      sheenMat.dispose();
      speckle.dispose();
    },
  };
}
