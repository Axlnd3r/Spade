import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { makeCard, type Card } from "./card";
import { makeEmbers, type Embers } from "./embers";
import { makeFloor, type Floor } from "./floor";
import { makeWarp, type Warp } from "./warp";
import { prefersReducedMotion } from "./webgl";

export type StagePage = "home" | "inner";
export type StageEvent = "thinking" | "idle" | "held" | "busted" | "burn";

const SPIN_PERIOD_S = 20;
const BOB_AMPLITUDE = 0.08;
const BOB_PERIOD_S = 4;
const IDLE = new THREE.Color("#6a5cff");
const HELD = new THREE.Color("#5cc8ff");
const BUSTED = new THREE.Color("#ff6a1a");

/** Where the card sits for a page, for wide and narrow screens. */
function layout(page: StagePage, aspect: number) {
  // Narrow screens: below the headline on Home, small and dim behind text elsewhere.
  if (aspect < 1) return page === "home" ? { x: 0, y: -0.75, scale: 0.46, glow: 0.7 } : { x: 0, y: -0.3, scale: 0.42, glow: 0.35 };
  return page === "home" ? { x: 1.7, y: 0.1, scale: 0.78, glow: 1 } : { x: 2.8, y: 0.1, scale: 0.6, glow: 0.6 };
}

function radialTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(128, 128, 0, 128, 128, 128);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.35, "rgba(255,255,255,0.35)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 256, 256);
  return new THREE.CanvasTexture(c);
}

/** One persistent three.js scene: Mr. X's card over a wet floor. React talks to it through
 * setPage/trigger/warp; everything else (loop, resize, visibility) is internal. */
export class Stage {
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  private timer = new THREE.Timer();
  private card!: Card;
  private floor!: Floor;
  private embers!: Embers;
  private warpFx!: Warp;
  private halo!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private haloTex = radialTexture();
  private raf = 0;
  private reduced = prefersReducedMotion();
  private page: StagePage = "home";
  private angle = 0.35;
  private spin = 1;
  private spinTarget = 1;
  private color = IDLE.clone();
  private colorTarget = IDLE.clone();
  private flash = 0;
  private burnTimer = -1;
  private pointer = new THREE.Vector2();
  private pos = new THREE.Vector3(1.6, 0.25, 0);
  private scale = 1;
  private glow = 1;
  private disposers: Array<() => void> = [];

  mount(canvas: HTMLCanvasElement) {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(w, h, false);
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;

    this.scene.background = new THREE.Color(0x000000);
    this.scene.fog = new THREE.Fog(0x000000, 6, 14);
    this.camera.position.set(0, 0.5, 10.5);
    this.camera.lookAt(0, -0.1, 0);
    this.scene.add(this.camera);

    this.scene.add(new THREE.AmbientLight(0xffffff, 0.35));
    const key = new THREE.DirectionalLight(0xffffff, 1.3);
    key.position.set(2, 3, 6);
    const fill = new THREE.DirectionalLight(0x8899ff, 0.3);
    fill.position.set(-3, -2, 4);
    this.scene.add(key, fill);

    this.halo = new THREE.Mesh(
      new THREE.PlaneGeometry(7, 7),
      new THREE.MeshBasicMaterial({
        map: this.haloTex,
        color: this.color,
        transparent: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.halo.position.z = -0.8;
    this.halo.renderOrder = -1;

    this.card = makeCard();
    this.floor = makeFloor(w, h);
    this.embers = makeEmbers();
    this.warpFx = makeWarp();
    this.scene.add(this.halo, this.card.group, this.floor.group, this.embers.points);
    this.camera.add(this.warpFx.lines);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.4, 0.85));
    this.composer.addPass(new OutputPass());

    const onResize = () => this.resize();
    const onPointer = (e: PointerEvent) =>
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    const onVisibility = () => (document.hidden ? this.stop() : this.start());
    window.addEventListener("resize", onResize);
    window.addEventListener("pointermove", onPointer);
    document.addEventListener("visibilitychange", onVisibility);
    this.disposers.push(
      () => window.removeEventListener("resize", onResize),
      () => window.removeEventListener("pointermove", onPointer),
      () => document.removeEventListener("visibilitychange", onVisibility),
    );

    this.resize();
    this.snapToLayout();
    this.start();
  }

  setPage(page: StagePage) {
    this.page = page;
  }

  warp() {
    if (!this.reduced) this.warpFx.start();
  }

  trigger(event: StageEvent) {
    switch (event) {
      case "thinking":
        this.spinTarget = this.reduced ? 0 : 4;
        break;
      case "idle":
        this.spinTarget = 1;
        this.colorTarget.copy(IDLE);
        break;
      case "held":
        this.spinTarget = 1;
        this.color.copy(HELD);
        this.flash = 0.6;
        break;
      case "busted":
        this.spinTarget = 1;
        this.color.copy(BUSTED);
        this.colorTarget.copy(BUSTED);
        this.burnTimer = 0;
        this.embers.emit(this.pos.x);
        break;
      case "burn":
        this.embers.emit(this.pos.x);
        break;
    }
  }

  dispose() {
    this.stop();
    for (const d of this.disposers) d();
    this.card.dispose();
    this.floor.dispose();
    this.embers.dispose();
    this.warpFx.dispose();
    this.halo.geometry.dispose();
    this.halo.material.dispose();
    this.haloTex.dispose();
    this.composer.dispose();
    this.renderer.dispose();
  }

  private start() {
    if (this.raf) return;
    this.timer.reset();
    const loop = (now: number) => {
      this.raf = requestAnimationFrame(loop);
      this.timer.update(now);
      this.tick(Math.min(this.timer.getDelta(), 0.05));
    };
    this.raf = requestAnimationFrame(loop);
  }

  private stop() {
    cancelAnimationFrame(this.raf);
    this.raf = 0;
  }

  private resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    this.composer.setSize(w, h);
    this.floor.setSize(w, h);
  }

  private snapToLayout() {
    const l = layout(this.page, this.camera.aspect);
    this.pos.set(l.x, l.y, 0);
    this.scale = l.scale;
    this.glow = l.glow;
  }

  private tick(dt: number) {
    const t = this.timer.getElapsed();
    const l = layout(this.page, this.camera.aspect);
    const k = 1 - Math.exp(-dt * 3);
    this.pos.x += (l.x - this.pos.x) * k;
    this.pos.y += (l.y - this.pos.y) * k;
    this.scale += (l.scale - this.scale) * k;
    this.glow += (l.glow - this.glow) * k;

    // Spin, slowed to a stop for reduced motion.
    this.spin += (this.spinTarget - this.spin) * k;
    if (!this.reduced) this.angle += dt * ((Math.PI * 2) / SPIN_PERIOD_S) * this.spin;
    const bob = this.reduced ? 0 : Math.sin((t / BOB_PERIOD_S) * Math.PI * 2) * BOB_AMPLITUDE;

    const g = this.card.group;
    g.position.set(this.pos.x, this.pos.y + bob, 0);
    g.scale.setScalar(this.scale);
    g.rotation.set(this.pointer.y * 0.12, this.angle + this.pointer.x * 0.18, 0);

    // Burn: 1.6 s away, 0.6 s held, 0.9 s back, then idle colours.
    if (this.burnTimer >= 0) {
      this.burnTimer += dt;
      const b = this.burnTimer;
      this.card.burn.value = b < 1.6 ? b / 1.6 : b < 2.2 ? 1 : Math.max(0, 1 - (b - 2.2) / 0.9);
      if (b > 3.1) {
        this.burnTimer = -1;
        this.card.burn.value = 0;
        this.colorTarget.copy(IDLE);
      }
    }

    // Halo colour and pulse; the only colour on the page.
    if (this.flash > 0) this.flash = Math.max(0, this.flash - dt);
    else this.color.lerp(this.colorTarget, k * 0.6);
    const pulse = this.spinTarget > 1.5 ? 0.75 + 0.25 * Math.sin(t * 6) : 1;
    const mat = this.halo.material;
    mat.color.copy(this.color).multiplyScalar(this.glow * pulse * (1 + this.flash * 1.5));
    this.halo.position.set(this.pos.x, this.pos.y + bob, -0.8);
    this.halo.scale.setScalar(this.scale);
    this.card.setGlow(0.16 * this.glow);

    this.embers.update(dt);
    this.warpFx.update(dt);
    this.composer.render(dt);
  }
}
