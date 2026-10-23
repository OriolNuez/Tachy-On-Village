import { worldBounds, type Point } from './model';

export class Camera {
  width = 1440; height = 900; zoom = 1; fitZoom = 1;
  center: Point = { x: 712, y: 430 };
  overviewMode = true; follow = false;
  screenToWorld(p: Point): Point { return { x: (p.x - this.width / 2) / this.zoom + this.center.x, y: (p.y - this.height / 2) / this.zoom + this.center.y }; }
  worldToScreen(p: Point): Point { return { x: (p.x - this.center.x) * this.zoom + this.width / 2, y: (p.y - this.center.y) * this.zoom + this.height / 2 }; }
  resize(width: number, height: number) {
    this.width = width; this.height = height;
    this.fitZoom = Math.min((width - 100) / (worldBounds.right - worldBounds.left), (height - 210) / (worldBounds.bottom - worldBounds.top));
    if (this.overviewMode) this.overview(); else { this.zoom = Math.max(this.fitZoom, this.zoom); this.clamp(); }
  }
  overview() {
    this.center = { x: (worldBounds.left + worldBounds.right) / 2, y: (worldBounds.top + worldBounds.bottom) / 2 - 5 };
    this.zoom = this.fitZoom; this.overviewMode = true; this.follow = false;
  }
  zoomAt(factor: number, point: Point) {
    const before = this.screenToWorld(point);
    this.zoom = Math.max(this.fitZoom, Math.min(this.fitZoom * 2.8, this.zoom * factor));
    const after = this.screenToWorld(point);
    this.center.x += before.x - after.x; this.center.y += before.y - after.y;
    this.overviewMode = false; this.clamp();
  }
  pan(x: number, y: number) { this.center.x -= x / this.zoom; this.center.y -= y / this.zoom; this.follow = false; this.overviewMode = false; this.clamp(); }
  clamp() {
    const padX = Math.min(230, this.width / this.zoom * .18), padY = Math.min(150, this.height / this.zoom * .15);
    this.center.x = Math.min(worldBounds.right - padX, Math.max(worldBounds.left + padX, this.center.x));
    this.center.y = Math.min(worldBounds.bottom - padY, Math.max(worldBounds.top + padY, this.center.y));
  }
}
