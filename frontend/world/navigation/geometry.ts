import type { Point, Rect } from '../model';

export const GROUND_SCALE = .70;
export const GROUND_SHEAR = .18;
export const project = (p: Point, height = 0): Point => ({ x: p.x + (p.y - 600) * GROUND_SHEAR, y: p.y * GROUND_SCALE - height });
export const unproject = (p: Point): Point => ({ x: p.x - (p.y / GROUND_SCALE - 600) * GROUND_SHEAR, y: p.y / GROUND_SCALE });
export const distance = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y);
export function pointInPolygon(p: Point, polygon: Point[]): boolean {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = polygon[i], b = polygon[j];
    if (((a.y > p.y) !== (b.y > p.y)) && p.x < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}
export function inRect(p: Point, rect: Rect, padding = 0) {
  return p.x >= rect.x - padding && p.x <= rect.x + rect.width + padding && p.y >= rect.y - padding && p.y <= rect.y + rect.height + padding;
}
export function segmentDistance(p: Point, a: Point, b: Point) {
  const length2 = (b.x - a.x) ** 2 + (b.y - a.y) ** 2;
  const t = length2 ? Math.max(0, Math.min(1, ((p.x - a.x) * (b.x - a.x) + (p.y - a.y) * (b.y - a.y)) / length2)) : 0;
  return distance(p, { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
}
