import { Application, Container, Graphics } from 'pixi.js';
// Pixi's CSP compatibility extension uses static uniform synchronization.
import 'pixi.js/unsafe-eval';
import { Camera } from './camera';
import { landmarks, palette as P, props, type Landmark, type LocationId, type Point } from './model';
import { NavigationGrid } from './navigation/grid';
import { Walker } from './navigation/movement';
import { project, unproject } from './navigation/geometry';
import { makeTerrain, makeFountain } from './art/terrain';
import { makeBuilding } from './art/buildings';
import { makeBoat, makeCharacter, makeProp } from './art/props';
import { label, line, seeded } from './art/primitives';

export interface SceneCallbacks {
  location: (id: LocationId) => void;
  status: (message: string) => void;
  camera: (zoom: number, follow: boolean) => void;
  hover: (value: { name: string; subtitle: string; x: number; y: number } | null) => void;
}

export class VillageScene {
  readonly camera = new Camera();
  readonly walker = new Walker(new NavigationGrid());
  private world = new Container();
  private objects = new Container();
  private marker = new Graphics();
  private entrances = new Graphics();
  private paused = false;
  private reducedMotion = false;
  private hovered: Landmark | null = null;
  private time = 0;
  private cleanups: (() => void)[] = [];
  private buildingArt = new Map<LocationId, Container>();
  private held = new Set<string>();
  private pointer: { id: number; start: Point; last: Point; drag: boolean; pan: boolean } | null = null;
  private stopped = false;

  static async create(host: HTMLElement, callbacks: SceneCallbacks, signal: AbortSignal) {
    const app = new Application();
    await app.init({ preference: 'webgl', background: 0x7fb6af, antialias: true, resolution: Math.min(window.devicePixelRatio || 1, 2), autoDensity: true, resizeTo: host });
    if (signal.aborted) { app.destroy(true, { children: true }); return null; }
    host.appendChild(app.canvas);
    app.canvas.setAttribute('aria-hidden', 'true');
    return new VillageScene(app, host, callbacks);
  }

  private constructor(private app: Application, private host: HTMLElement, private callbacks: SceneCallbacks) {
    this.world.eventMode = 'none'; this.objects.sortableChildren = true;
    app.stage.addChild(this.world);
    const terrain = makeTerrain(); this.world.addChild(terrain.root);
    this.world.addChild(this.marker, this.objects, this.entrances);
    this.objects.addChild(makeFountain());
    for (const b of landmarks) {
      const art = makeBuilding(b), p = project(b);
      art.position.set(p.x, p.y); art.zIndex = b.y + b.depth / 2;
      this.objects.addChild(art); this.buildingArt.set(b.id, art);
      const entry = project(b.entrance);
      const short = { dock: 'FISHERMAN’S DOCK', restaurant: 'LANTERN HOUSE', arena: 'COOK’S COURT', calendar: 'CALENDAR SQUARE', wardrobe: 'CHANGING ROOM', shrine: 'WINDBELL SHRINE' }[b.id];
      const text = label(short, entry.x, entry.y + 25, 11, 0x62564c);
      const plate = new Graphics().roundRect(entry.x - text.width / 2 - 10, entry.y + 15, text.width + 20, 21, 4).fill({ color: P.cream, alpha: .85 });
      terrain.root.addChild(plate, text);
    }
    for (const prop of props) {
      const art = makeProp(prop), p = project(prop); art.position.set(p.x, p.y); art.zIndex = prop.y + 4; this.objects.addChild(art);
    }
    // Player-specific ring makes the explorer distinct from ambient villagers.
    const player = makeCharacter(P.terracotta, true);
    this.objects.addChild(player.root);
    const npcs = [
      { x: 410, y: 420, shirt: P.mauve }, { x: 1125, y: 730, shirt: P.cream },
      { x: 285, y: 685, shirt: P.sage }, { x: 920, y: 1030, shirt: P.red },
    ].map((p, i) => {
      const art = makeCharacter(p.shirt); art.root.scale.set(.8); const q = project(p);
      art.root.position.set(q.x, q.y); art.root.zIndex = p.y;
      this.objects.addChild(art.root); return { art, offset: i * 1.7 };
    });
    const boat = makeBoat(), boatPosition = project({ x: 95, y: 760 });
    boat.position.set(boatPosition.x, boatPosition.y); boat.zIndex = 760; this.objects.addChild(boat);
    const rope = new Graphics();
    line(rope, [project({ x: 70, y: 698 }), { x: boatPosition.x - 38, y: boatPosition.y - 17 }], P.cream, 1.5, .8); terrain.root.addChild(rope);
    const steam = Array.from({ length: 6 }, (_, i) => {
      const g = new Graphics().circle(0, 0, 4 + i * .6).fill({ color: P.cream, alpha: .38 });
      this.world.addChild(g); return g;
    });
    const chimney = project({ x: 1138, y: 555 }, 150);
    const random = seeded(47);
    const sparkle = new Graphics(); this.world.addChild(sparkle);
    const fireflies = Array.from({ length: 12 }, () => ({ x: 480 + random() * 500, y: 210 + random() * 370, phase: random() * 8 }));

    const update = () => {
      if (this.stopped) return;
      const dt = Math.min(app.ticker.deltaMS / 1000, .05);
      if (!this.reducedMotion) this.time += dt;
      const moving = this.walker.route.length > 0 && !this.paused;
      if (!this.paused) {
        const arrived = this.walker.update(dt);
        if (arrived) { this.callbacks.status('You’ve arrived. Stay a little while.'); this.callbacks.location(arrived); }
        else if (moving && this.walker.route.length === 0) this.callbacks.status('A little village. All yours to explore.');
      }
      const foot = project(this.walker.position);
      player.root.position.set(foot.x, foot.y); player.root.zIndex = this.walker.position.y + 3;
      player.pose(this.time, moving && !this.reducedMotion, this.walker.direction);
      for (const npc of npcs) npc.art.pose(this.reducedMotion ? 0 : this.time + npc.offset, false, { x: .1, y: 1 });
      boat.y = boatPosition.y + (this.reducedMotion ? 0 : Math.sin(this.time * 1.1) * 2);
      boat.rotation = this.reducedMotion ? 0 : Math.sin(this.time * .7) * .012;
      terrain.water.clear();
      for (let i = 0; i < terrain.glints.length; i++) {
        const p = terrain.glints[i];
        const wave = this.reducedMotion ? .3 : .25 + Math.sin(this.time * .7 + i) * .15;
        line(terrain.water, [{ x: p.x, y: p.y }, { x: p.x + 11, y: p.y }], P.cream, 1.5, wave);
      }
      for (let i = 0; i < steam.length; i++) {
        const phase = this.reducedMotion ? (i / 6) : (this.time * .17 + i / 6) % 1;
        steam[i].position.set(chimney.x + Math.sin(phase * 5 + i) * 7 + phase * 16, chimney.y - phase * 58);
        steam[i].scale.set(.6 + phase); steam[i].alpha = (1 - phase) * .65;
      }
      sparkle.clear();
      for (const p of fireflies) {
        const alpha = this.reducedMotion ? 0 : Math.max(0, Math.sin(this.time * .6 + p.phase)) * .45;
        sparkle.circle(p.x, p.y + Math.sin(this.time + p.phase) * 4, 1.5).fill({ color: P.butter, alpha });
      }
      if (!this.paused && document.activeElement === this.host) {
        const x = +(this.held.has('ArrowLeft')) - +(this.held.has('ArrowRight'));
        const y = +(this.held.has('ArrowUp')) - +(this.held.has('ArrowDown'));
        if (x || y) { this.camera.pan(x * dt * 430, y * dt * 430); this.reportCamera(); }
      }
      if (this.camera.follow && !this.paused) {
        const t = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 5);
        this.camera.center.x += (foot.x - this.camera.center.x) * t;
        this.camera.center.y += (foot.y - 35 - this.camera.center.y) * t;
        this.camera.clamp();
      }
      this.drawMarkers(); this.syncCamera();
    };
    app.ticker.add(update); this.cleanups.push(() => app.ticker.remove(update));
    this.bindInputs();
    const resize = new ResizeObserver(() => {
      app.resize(); this.camera.resize(host.clientWidth, host.clientHeight); this.syncCamera(); this.reportCamera();
    });
    resize.observe(host); this.cleanups.push(() => resize.disconnect());
    this.camera.resize(host.clientWidth, host.clientHeight); this.syncCamera(); this.reportCamera();
  }

  private syncCamera() {
    this.world.scale.set(this.camera.zoom);
    this.world.position.set(this.camera.width / 2 - this.camera.center.x * this.camera.zoom, this.camera.height / 2 - this.camera.center.y * this.camera.zoom);
  }
  private reportCamera() { this.callbacks.camera(Math.round(this.camera.zoom / this.camera.fitZoom * 100), this.camera.follow); }
  overview() { this.camera.overview(); this.reportCamera(); this.clearHover(); }
  zoom(factor: number) { this.camera.zoomAt(factor, { x: this.camera.width / 2, y: this.camera.height / 2 }); this.reportCamera(); this.clearHover(); }
  follow() {
    this.camera.follow = !this.camera.follow; this.camera.overviewMode = false;
    if (this.camera.follow) this.camera.zoom = Math.max(this.camera.zoom, this.camera.fitZoom * 1.65);
    this.reportCamera();
  }
  setReducedMotion(value: boolean) { this.reducedMotion = value; }
  setPaused(value: boolean) { this.paused = value; if (value) { this.held.clear(); this.clearHover(); } }
  cancel() { this.walker.cancel(); this.callbacks.status('A little village. All yours to explore.'); }
  visit(id: LocationId) {
    const b = landmarks.find(b => b.id === id)!;
    if (this.walker.go(b.entrance, id)) this.callbacks.status(`Walking to ${b.name}…`);
    else this.callbacks.status('That entrance isn’t reachable from here. Try another path.');
  }
  private drawMarkers() {
    this.marker.clear(); this.entrances.clear();
    const target = this.walker.destination;
    if (target) {
      const p = project(target), pulse = this.reducedMotion ? 0 : Math.sin(this.time * 5) * 2;
      this.marker.ellipse(p.x, p.y, 17 + pulse, 9 + pulse * .5).stroke({ color: P.butter, width: 2.5 });
      this.marker.ellipse(p.x, p.y, 6, 3).fill({ color: P.cream, alpha: .9 });
    }
    const active = this.hovered ?? landmarks.find(b => b.id === this.walker.pending);
    if (active && !this.paused) {
      const p = project(active.entrance);
      this.entrances.ellipse(p.x, p.y, 22, 11).fill({ color: P.butter, alpha: .24 }).stroke({ color: P.butter, width: 2 });
      this.entrances.poly([p.x - 5, p.y - 24, p.x + 5, p.y - 24, p.x, p.y - 17]).fill(P.butter);
    }
  }
  private point(event: PointerEvent | WheelEvent): Point {
    const rect = this.host.getBoundingClientRect(); return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }
  private buildingAt(screen: Point): Landmark | null {
    const world = this.camera.screenToWorld(screen);
    for (const b of [...landmarks].sort((a, b) => b.y - a.y)) {
      const art = this.buildingArt.get(b.id)!, bounds = art.getLocalBounds();
      const x = world.x - art.x, y = world.y - art.y;
      if (x >= bounds.x && x <= bounds.x + bounds.width && y >= bounds.y && y <= bounds.y + bounds.height) return b;
      const entrance = project(b.entrance);
      if (Math.hypot(world.x - entrance.x, (world.y - entrance.y) * 1.5) < 28) return b;
    }
    return null;
  }
  private clearHover() { this.hovered = null; this.callbacks.hover(null); this.app.canvas.style.cursor = 'default'; }
  private bindInputs() {
    const listen = <K extends keyof HTMLElementEventMap>(type: K, listener: (event: HTMLElementEventMap[K]) => void, options?: AddEventListenerOptions) => {
      this.host.addEventListener(type, listener, options); this.cleanups.push(() => this.host.removeEventListener(type, listener, options));
    };
    listen('pointerdown', event => {
      if (this.paused || (event.button !== 0 && event.button !== 1)) return;
      event.preventDefault(); this.host.focus({ preventScroll: true });
      const point = this.point(event);
      this.pointer = { id: event.pointerId, start: point, last: point, drag: false, pan: event.button === 1 || this.held.has(' ') };
      this.host.setPointerCapture(event.pointerId);
    });
    listen('pointermove', event => {
      if (this.paused) return;
      const p = this.point(event);
      if (this.pointer) {
        if (Math.hypot(p.x - this.pointer.start.x, p.y - this.pointer.start.y) > 5) this.pointer.drag = true;
        if (this.pointer.pan && this.pointer.drag) {
          this.camera.pan(p.x - this.pointer.last.x, p.y - this.pointer.last.y); this.clearHover(); this.reportCamera(); this.app.canvas.style.cursor = 'grabbing';
        }
        this.pointer.last = p; return;
      }
      const b = this.buildingAt(p);
      this.hovered = b; this.app.canvas.style.cursor = b ? 'pointer' : 'default';
      this.callbacks.hover(b ? { name: b.name, subtitle: 'Click to visit', x: p.x, y: p.y } : null);
    });
    listen('pointerup', event => {
      const pointer = this.pointer; this.pointer = null;
      if (this.host.hasPointerCapture(event.pointerId)) this.host.releasePointerCapture(event.pointerId);
      if (!pointer || pointer.id !== event.pointerId || pointer.drag || pointer.pan || this.paused) return;
      const p = this.point(event), b = this.buildingAt(p);
      if (b) this.visit(b.id);
      else if (this.walker.go(unproject(this.camera.screenToWorld(p)))) this.callbacks.status('Taking the scenic route…');
      else this.callbacks.status('A little out of reach. Choose open ground or a building entrance.');
    });
    listen('pointercancel', () => { this.pointer = null; this.clearHover(); });
    listen('pointerleave', () => { if (!this.pointer) this.clearHover(); });
    listen('wheel', event => {
      event.preventDefault(); if (this.paused) return;
      this.camera.zoomAt(Math.exp(-Math.max(-100, Math.min(100, event.deltaY)) * .0025), this.point(event)); this.reportCamera(); this.clearHover();
    }, { passive: false });
    listen('keydown', event => {
      if (this.paused || event.target !== this.host) return;
      if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', '+', '-', '='].includes(event.key)) event.preventDefault();
      this.held.add(event.key);
      if (event.key === 'Home') this.overview();
      if (event.key === '+' || event.key === '=') this.zoom(1.15);
      if (event.key === '-') this.zoom(1 / 1.15);
      if (event.key === 'Escape') this.cancel();
    });
    listen('keyup', event => this.held.delete(event.key));
    listen('blur', () => { this.held.clear(); this.pointer = null; });
  }
  destroy() {
    if (this.stopped) return; this.stopped = true;
    for (const cleanup of this.cleanups) cleanup();
    this.app.destroy(true, { children: true, texture: true, textureSource: true });
  }
}
