import { Container, Graphics, Text } from 'pixi.js';
import { palette as P, type Point } from '../model';
import { GROUND_SCALE, GROUND_SHEAR } from '../navigation/geometry';

export const local = (x: number, y: number, z = 0) => ({ x: x + y * GROUND_SHEAR, y: y * GROUND_SCALE - z });
export const shade = (color: number, factor: number) => {
  const r = Math.min(255, Math.round(((color >> 16) & 255) * factor));
  const g = Math.min(255, Math.round(((color >> 8) & 255) * factor));
  const b = Math.min(255, Math.round((color & 255) * factor));
  return (r << 16) | (g << 8) | b;
};
export function poly(g: Graphics, points: Point[], color: number, alpha = 1) {
  g.poly(points.flatMap(p => [p.x, p.y])).fill({ color, alpha });
}
export function line(g: Graphics, points: Point[], color: number, width = 1, alpha = 1) {
  if (!points.length) return;
  g.moveTo(points[0].x, points[0].y);
  for (const p of points.slice(1)) g.lineTo(p.x, p.y);
  g.stroke({ color, width, alpha, cap: 'round', join: 'round' });
}
export function box(g: Graphics, x: number, y: number, width: number, depth: number, height: number, color: number, z = 0) {
  const a = local(x, y, z), b = local(x + width, y, z), c = local(x + width, y + depth, z), d = local(x, y + depth, z);
  const top = [a, b, c, d].map(p => ({ x: p.x, y: p.y - height }));
  poly(g, [b, c, top[2], top[1]], shade(color, .77));
  poly(g, [d, c, top[2], top[3]], shade(color, .91));
  poly(g, top, shade(color, 1.08));
  line(g, [top[3], top[2], top[1]], P.cream, .8, .25);
}
export function groundEllipse(g: Graphics, x: number, y: number, rx: number, ry: number, color: number, alpha = 1) {
  const p = local(x, y); g.ellipse(p.x, p.y, rx, ry * GROUND_SCALE).fill({ color, alpha });
}
export function shadow(g: Graphics, width: number, depth: number) {
  groundEllipse(g, 8, 5, width * .62, depth * .57, P.plum, .13);
  groundEllipse(g, 3, 2, width * .52, depth * .48, P.brown, .12);
}
export function label(text: string, x: number, y: number, size = 12, color = P.brown) {
  const value = new Text({ text, style: { fontFamily: 'Avenir Next, Trebuchet MS, sans-serif', fontSize: size, fontWeight: '600', fill: color, letterSpacing: 1 } });
  value.anchor.set(.5); value.position.set(x, y); return value;
}
export function lantern(g: Graphics, x: number, y: number, z: number, size = 1) {
  const p = local(x, y, z);
  for (let r = 23; r >= 9; r -= 7) g.circle(p.x, p.y, r * size).fill({ color: P.butter, alpha: .025 });
  g.roundRect(p.x - 6 * size, p.y - 9 * size, 12 * size, 18 * size, 4 * size).fill(P.butter);
  g.rect(p.x - 4 * size, p.y - 10 * size, 8 * size, 2 * size).fill(P.brown);
  g.rect(p.x - 4 * size, p.y + 9 * size, 8 * size, 2 * size).fill(P.brown);
  for (let i = -4; i <= 4; i += 4) line(g, [{ x: p.x - 5 * size, y: p.y + i * size }, { x: p.x + 5 * size, y: p.y + i * size }], P.peach, .8, .7);
}
export function addGraphic(container: Container): Graphics { const g = new Graphics(); container.addChild(g); return g; }

export function seeded(seed = 33) {
  return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
}
