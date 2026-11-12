import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { makeCard, type Card } from "./card";
import { FORMS, type CardForm } from "./cardArt";
import { makeEmbers, type Embers } from "./embers";
import { makeFloor, type Floor } from "./floor";
import { DIVE_S, EMERGE_S, HOLD_S, SWAP_MS } from "./travel";
import { CAMERA_ONLY_LAYER, makeTunnel, type Tunnel } from "./tunnel";
import { prefersReducedMotion } from "./webgl";

export type StagePage = "home" | "inner";
export type StageEvent = "thinking" | "idle" | "reveal" | "held" | "busted" | "burn";

const SPIN_PERIOD_S = 20;
const BOB_AMPLITUDE = 0.08;
const BOB_PERIOD_S = 4;
const HELD = new THREE.Color("#5cc8ff");
const BUSTED = new THREE.Color("#ff6a1a");
/** Dragging: radians per pixel, and the fastest the card may be thrown (rad/s). */
const DRAG = 0.01;
const MAX_VEL = 25;
/** Extra speed dies out at rate 3/s, so this much adds exactly half a turn: a flip. */
const FLIP_VEL = 3 * Math.PI;
/** A press that moves less than this many pixels is a click, not a drag. */
const TAP_PX = 6;
/** Things under the pointer that keep their own click; the card is not grabbed through them. */
const CONTROLS = "a, button, input, textarea, select, label";

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** Where the card sits for a page, for wide and narrow screens. */
function layout(page: StagePage, aspect: number) {
  // Narrow screens: above the headline on Home (10–35% of the height, kept clear by .hero), small and dim
  // behind text elsewhere.
  if (aspect < 1) return page === "home" ? { x: 0, y: 1.72, scale: 0.46, glow: 0.7 } : { x: 0, y: -0.3, scale: 0.42, glow: 0.35 };
  return page === "home" ? { x: 1.8, y: 0.1, scale: 0.9, glow: 1 } : { x: 2.8, y: 0.1, scale: 0.6, glow: 0.6 };
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

/** One persistent three.js scene: Mr. X's glass card over a wet floor. React talks to it through
 * setPage/setForm/travel/trigger; everything else (loop, resize, visibility, dragging) is internal. */
export class Stage {
  private renderer!: THREE.WebGLRenderer;
  private composer!: EffectComposer;
  private scene = new THREE.Scene();
  private camera = new THREE.PerspectiveCamera(35, 1, 0.1, 60);
  private timer = new THREE.Timer();
  private card!: Card;
  private floor!: Floor;
  private embers!: Embers;
  private tunnel!: Tunnel;
  private halo!: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshBasicMaterial>;
  private haloTex = radialTexture();
  private raf = 0;
  private reduced = prefersReducedMotion();
  private page: StagePage = "home";
  private form: CardForm = "gembok";
  /** Seconds into a page change (see travel.ts), or -1 when the card is at rest on a page. */
  private travelT = -1;
  /** Mr. X is thinking: the card steps forward. */
  private focus = false;
  /** A form waiting for the card to turn edge-on, and how long it has waited. */
  private pendingForm: CardForm | null = null;
  private pendingAge = 0;
  private facing = true;
  private angle = 0.35;
  /** Turning speed (rad/s): the base spin plus whatever a drag, a click or a form change added. */
  private vel = 0;
  private tilt = 0;
  /** 1 = the card leans toward the pointer; fades to 0 while it is held. */
  private lean = 1;
  /** A press that started on the card. `turn` is false for touch, where only a tap counts. */
  private drag: { x: number; y: number; moved: number; at: number; turn: boolean } | null = null;
  private raycaster = new THREE.Raycaster();
  private spin = 1;
  private spinTarget = 1;
  /** The light of the current form; events (held, busted) colour it for a while. */
  private idle = new THREE.Color(FORMS.gembok.color);
  private color = this.idle.clone();
  private colorTarget = this.idle.clone();
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
    this.card.setForm(this.form);
    this.floor = makeFloor(w, h);
    this.embers = makeEmbers();
    this.tunnel = makeTunnel();
    this.scene.add(this.halo, this.card.group, this.floor.group, this.embers.points);
    this.camera.layers.enable(CAMERA_ONLY_LAYER);
    this.camera.add(this.tunnel.group);

    this.composer = new EffectComposer(this.renderer);
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.composer.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.6, 0.4, 0.85));
    this.composer.addPass(new OutputPass());

    const onResize = () => this.resize();
    const onVisibility = () => (document.hidden ? this.stop() : this.start());

    // The canvas sits behind the pages, so the card is picked from window events: a press that
    // lands on it, and not on a link or a field above it, grabs it.
    const root = document.documentElement;
    const ndc = new THREE.Vector2();
    const onCard = (e: PointerEvent) => {
      if (e.target instanceof Element && e.target.closest(CONTROLS)) return false;
      ndc.set((e.clientX / window.innerWidth) * 2 - 1, 1 - (e.clientY / window.innerHeight) * 2);
      this.raycaster.setFromCamera(ndc, this.camera);
      return this.raycaster.intersectObject(this.card.body).length > 0;
    };
    const onDown = (e: PointerEvent) => {
      if (e.button !== 0 || !onCard(e)) return;
      // Touch keeps scrolling the page; there a tap flips the card and nothing more.
      const turn = e.pointerType !== "touch";
      this.drag = { x: e.clientX, y: e.clientY, moved: 0, at: performance.now(), turn };
      if (turn) {
        e.preventDefault();
        root.style.cursor = "grabbing";
      }
    };
    const onMove = (e: PointerEvent) => {
      this.pointer.set((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
      const d = this.drag;
      if (!d) {
        if (e.pointerType !== "touch") root.style.cursor = onCard(e) ? "grab" : "";
        return;
      }
      const dx = e.clientX - d.x;
      const dy = e.clientY - d.y;
      d.x = e.clientX;
      d.y = e.clientY;
      d.moved += Math.abs(dx) + Math.abs(dy);
      if (!d.turn) return;
      const now = performance.now();
      this.angle += dx * DRAG;
      this.tilt = clamp(this.tilt + dy * DRAG, -1, 1);
      this.vel = clamp((dx * DRAG) / Math.max((now - d.at) / 1000, 0.008), -MAX_VEL, MAX_VEL);
      d.at = now;
    };
    const onUp = () => {
      const d = this.drag;
      if (!d) return;
      this.drag = null;
      root.style.cursor = "";
      if (d.moved < TAP_PX) this.flip();
      // Held still before letting go: no throw.
      else if (performance.now() - d.at > 80) this.vel = 0;
    };
    const onCancel = () => {
      this.drag = null;
      root.style.cursor = "";
    };
    const onSelect = (e: Event) => {
      if (this.drag?.turn) e.preventDefault();
    };

    window.addEventListener("resize", onResize);
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    document.addEventListener("selectstart", onSelect);
    document.addEventListener("visibilitychange", onVisibility);
    this.disposers.push(
      () => window.removeEventListener("resize", onResize),
      () => window.removeEventListener("pointerdown", onDown),
      () => window.removeEventListener("pointermove", onMove),
      () => window.removeEventListener("pointerup", onUp),
      () => window.removeEventListener("pointercancel", onCancel),
      () => document.removeEventListener("selectstart", onSelect),
      () => document.removeEventListener("visibilitychange", onVisibility),
      onCancel,
    );

    this.resize();
    this.snapToLayout();
    this.start();
  }

  setPage(page: StagePage) {
    this.page = page;
  }

  /** The card turns over and comes back as another form, in that form's light. */
  setForm(form: CardForm) {
    if (form === this.form) return;
    this.form = form;
    this.idle.set(FORMS[form].color);
    if (this.burnTimer < 0) this.colorTarget.copy(this.idle);
    if (!this.card) {
      // Not mounted yet: mount() starts in this form.
      this.color.copy(this.idle);
    } else if (this.reduced) {
      this.card.setForm(form);
    } else {
      this.pendingForm = form;
      this.pendingAge = 0;
      this.vel = clamp(this.vel + FLIP_VEL, -MAX_VEL, MAX_VEL);
    }
  }

  private flip() {
    if (this.reduced) this.angle += Math.PI;
    else this.vel = clamp(this.vel + FLIP_VEL, -MAX_VEL, MAX_VEL);
    this.flash = 0.35;
  }

  /** A page change: the camera dives into the card, a tunnel in the next page's light takes the
   * whole view, and the card is waiting in its new form when the view clears. Returns how long the
   * old page should stay (ms); 0 when there is no journey (reduced motion). */
  travel(form: CardForm): number {
    if (this.reduced || !this.card) {
      this.setForm(form);
      return 0;
    }
    this.form = form;
    this.idle.set(FORMS[form].color);
    if (this.burnTimer < 0) this.colorTarget.copy(this.idle);
    this.pendingForm = form;
    this.pendingAge = 0;
    this.travelT = 0;
    return SWAP_MS;
  }

  trigger(event: StageEvent) {
    switch (event) {
      case "thinking":
        this.spinTarget = this.reduced ? 0 : 4;
        this.focus = true;
        break;
      case "idle":
        this.spinTarget = 1;
        this.focus = false;
        this.colorTarget.copy(this.idle);
        break;
      case "reveal":
        // The answer is in: the card turns over with a flash and steps back.
        this.spinTarget = 1;
        this.focus = false;
        this.colorTarget.copy(this.idle);
        this.flip();
        this.flash = 0.6;
        break;
      case "held":
        this.spinTarget = 1;
        this.focus = false;
        this.color.copy(HELD);
        this.flash = 0.6;
        break;
      case "busted":
        this.spinTarget = 1;
        this.focus = false;
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
    this.tunnel.dispose();
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
    this.tunnel.setView(this.camera.fov, this.camera.aspect);
  }

  private snapToLayout() {
    const l = layout(this.page, this.camera.aspect);
    this.pos.set(l.x, l.y, 0);
    this.scale = l.scale;
    this.glow = l.glow;
  }

  /** Where the card is heading: its place on the page, forward while Mr. X thinks, or straight at
   * the camera while a page change dives into it. */
  private target() {
    const l = layout(this.page, this.camera.aspect);
    if (this.travelT >= 0 && this.travelT < DIVE_S) return { x: 0, y: 0.15, scale: 3.4, glow: 1 };
    if (this.focus && this.camera.aspect >= 1) return { x: l.x - 0.5, y: l.y, scale: l.scale * 1.35, glow: 1 };
    return l;
  }

  private tick(dt: number) {
    const t = this.timer.getElapsed();

    // Page change: dive, hold, emerge. While the tunnel holds the view the card takes its new form
    // and its place on the next page, a little large, so it settles as the view clears.
    let cover = 0;
    if (this.travelT >= 0) {
      const before = this.travelT;
      this.travelT += dt;
      const u = this.travelT;
      const ease = (x: number) => x * x * (3 - 2 * x);
      cover = u < DIVE_S ? ease(u / DIVE_S) : u < DIVE_S + HOLD_S ? 1 : 1 - ease(Math.min(1, (u - DIVE_S - HOLD_S) / EMERGE_S));
      if (before < DIVE_S && u >= DIVE_S) {
        if (this.pendingForm) this.card.setForm(this.pendingForm);
        this.pendingForm = null;
        this.snapToLayout();
        this.scale *= 1.25;
      }
      if (u >= DIVE_S + HOLD_S + EMERGE_S) this.travelT = -1;
    }
    const diving = this.travelT >= 0 && this.travelT < DIVE_S;

    const l = this.target();
    const k = 1 - Math.exp(-dt * 3);
    const move = diving ? 1 - Math.exp(-dt * 9) : k;
    this.pos.x += (l.x - this.pos.x) * move;
    this.pos.y += (l.y - this.pos.y) * move;
    this.scale += (l.scale - this.scale) * move;
    this.glow += (l.glow - this.glow) * k;

    // Spin: a slow base turn (none for reduced motion). A throw, a flip or a form change adds
    // speed that dies out; while the card is held, the pointer alone turns it.
    this.spin += (this.spinTarget - this.spin) * k;
    const base = this.reduced ? 0 : ((Math.PI * 2) / SPIN_PERIOD_S) * this.spin;
    const held = !!this.drag?.turn;
    if (diving) {
      // Turn the nearer face square to the camera: the view goes in through it.
      const face = Math.round(this.angle / Math.PI) * Math.PI;
      this.angle += (face - this.angle) * move;
      this.vel = 0;
      this.tilt -= this.tilt * move;
    } else if (!held) {
      this.vel += (base - this.vel) * k;
      this.angle += this.vel * dt;
      this.tilt -= this.tilt * k;
    }
    this.lean += ((held ? 0 : 1) - this.lean) * k;
    const bob = this.reduced ? 0 : Math.sin((t / BOB_PERIOD_S) * Math.PI * 2) * BOB_AMPLITUDE;
    const turn = this.angle + this.pointer.x * 0.18 * this.lean;

    const g = this.card.group;
    g.position.set(this.pos.x, this.pos.y + bob, 0);
    g.scale.setScalar(this.scale);
    g.rotation.set(this.tilt + this.pointer.y * 0.12 * this.lean, turn, 0);

    // A new form arrives while the card is edge-on, so the art never changes in view.
    const facing = Math.cos(turn) > 0;
    if (this.pendingForm) {
      this.pendingAge += dt;
      if (facing !== this.facing || this.pendingAge > 1.2) {
        this.card.setForm(this.pendingForm);
        this.pendingForm = null;
      }
    }
    this.facing = facing;

    // Burn: 1.6 s away, 0.6 s held, 0.9 s back, then idle colours.
    if (this.burnTimer >= 0) {
      this.burnTimer += dt;
      const b = this.burnTimer;
      this.card.burn.value = b < 1.6 ? b / 1.6 : b < 2.2 ? 1 : Math.max(0, 1 - (b - 2.2) / 0.9);
      if (b > 3.1) {
        this.burnTimer = -1;
        this.card.burn.value = 0;
        this.colorTarget.copy(this.idle);
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
    this.card.setGlow(this.glow);
    this.card.setColor(this.color);

    this.embers.update(dt);
    this.tunnel.update(dt, cover, this.idle);
    this.composer.render(dt);
  }
}
