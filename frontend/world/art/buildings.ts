import { Container, Graphics } from 'pixi.js';
import { palette as P, type Landmark } from '../model';
import { addGraphic, box, groundEllipse, label, lantern, line, local, poly, shade, shadow } from './primitives';

function roof(g: Graphics, w: number, d: number, h: number, color: number, rise = 37) {
  const x = -w / 2 - 12, y = -d / 2 - 10, width = w + 24, depth = d + 20;
  const a = local(x, y, h), b = local(x + width, y, h), c = local(x + width, y + depth, h), f = local(x, y + depth, h);
  const r1 = local(x, 0, h + rise), r2 = local(x + width, 0, h + rise);
  poly(g, [a, b, r2, r1], shade(color, 1.12));
  poly(g, [r1, r2, c, f], color);
  poly(g, [b, r2, c], shade(color, .76));
  line(g, [f, c, b], shade(color, .73), 6);
  line(g, [r1, r2], shade(color, 1.22), 7);
  line(g, [r1, r2], P.cream, 1, .35);
  for (let row = 1; row <= 5; row++) {
    const t = row / 5;
    const yy = (d / 2 + 10) * t, zz = h + rise * (1 - t);
    line(g, [local(x, yy, zz), local(x + width, yy, zz)], shade(color, .78), 1.4, .7);
    line(g, [local(x, yy, zz + 1.5), local(x + width, yy, zz + 1.5)], P.peach, 1, .6);
    for (let xx = x + (row % 2) * 8; xx < x + width; xx += 17) {
      const prev = Math.max(0, t - .2);
      line(g, [local(xx, (d / 2 + 10) * prev, h + rise * (1 - prev)), local(xx, yy, zz)], shade(color, .85), .85, .8);
    }
  }
}

function frontWindow(g: Graphics, x: number, y: number, width: number, z: number, height: number) {
  const p = local(x, y, z + height);
  g.rect(p.x - 3, p.y - 3, width + 6, height + 6).fill(P.brown);
  g.rect(p.x, p.y, width, height).fill(P.butter);
  g.rect(p.x + 2, p.y + 2, width - 4, height - 4).fill({ color: P.peach, alpha: .24 });
  g.rect(p.x + width / 2 - 1, p.y, 2, height).fill(P.brown);
  g.rect(p.x, p.y + height * .58, width, 2).fill(P.brown);
  g.rect(p.x + 3, p.y + 3, 3, height - 6).fill({ color: P.cream, alpha: .5 });
}

function entrance(g: Graphics, y: number, color = P.slate, x = 0, h = 62) {
  const p = local(x - 18, y, h);
  g.rect(p.x - 5, p.y - 5, 46, h + 8).fill(P.brown);
  g.rect(p.x, p.y, 36, h).fill(0x725342);
  g.rect(p.x + 5, p.y + 15, 26, h - 15).fill({ color: P.butter, alpha: .34 });
  g.rect(p.x - 5, p.y - 3, 46, 23).fill(color);
  for (let i = 0; i < 3; i++) { g.rect(p.x - 4 + i * 16, p.y + 16, 14, 8).fill(color); }
  g.circle(p.x + 18, p.y + 8, 6).stroke({ color: P.cream, width: 1.5 });
}

export function makeBuilding(b: Landmark): Container {
  const c = new Container(), g = addGraphic(c);
  shadow(g, b.width + 35, b.depth + 30);
  const front = b.depth / 2;
  box(g, -b.width / 2 - 10, -b.depth / 2 - 6, b.width + 20, b.depth + 24, 8, 0xc6b7a2);
  // Steps face the promenade; all entrances are outside the collision footprint.
  box(g, -30, front + 13, 60, 14, 4, 0xd6c9ac);
  box(g, -27, front + 7, 54, 14, 7, 0xe2d6b6);
  if (b.id === 'calendar') { calendar(c, g, b); return c; }

  box(g, -b.width / 2, -b.depth / 2, b.width, b.depth, b.height, P.cream, 8);
  const wallY = front + .5;
  for (const x of [-b.width / 2, b.width / 2 - 5]) box(g, x, wallY, 5, 5, b.height, P.brown, 8);
  for (let z = 14; z < b.height - 8; z += 16) line(g, [local(-b.width / 2, wallY + 1, z), local(b.width / 2, wallY + 1, z)], P.brown, .7, .2);
  box(g, -b.width / 2, wallY, b.width, 5, 9, P.brown, 8);

  if (b.id === 'restaurant') {
    frontWindow(g, -98, wallY + 2, 56, 31, 41);
    frontWindow(g, 43, wallY + 2, 55, 31, 41);
    entrance(g, wallY + 3, P.slate, -10, 69);
    box(g, 37, wallY + 6, 68, 13, 5, P.brown, 29);
    for (let x = 45; x < 95; x += 18) { const p = local(x, wallY + 13, 35); g.ellipse(p.x, p.y, 5, 2).fill(P.cream); g.rect(p.x - 3, p.y - 3, 6, 3).fill(P.peach); }
    for (let x = -105; x <= 105; x += 35) lantern(g, x, wallY + 15, 83, .9);
    // Warm pools of light remain local to the restaurant's frontage.
    groundEllipse(g, 0, wallY + 18, 122, 31, P.butter, .13);
  } else if (b.id === 'arena') {
    entrance(g, wallY + 3, P.red, 0, 62);
    frontWindow(g, -78, wallY + 2, 42, 29, 30);
    frontWindow(g, 38, wallY + 2, 42, 29, 30);
    for (let i = 0; i < 10; i++) {
      const a = local(-100 + i * 20, wallY + 8, 74);
      g.rect(a.x, a.y, 20, 12).fill(i % 2 ? P.cream : P.peach);
      g.roundRect(a.x, a.y + 8, 20, 9, 5).fill(i % 2 ? P.cream : P.peach);
    }
  } else if (b.id === 'shrine') {
    entrance(g, wallY + 3, P.mauve, 0, 68);
    for (const x of [-50, 50]) lantern(g, x, wallY + 7, 62, 1.05);
    const rope = [local(-55, wallY + 10, 77), local(0, wallY + 10, 68), local(55, wallY + 10, 77)];
    line(g, rope, P.butter, 2);
    for (const x of [-28, 28]) { const p = local(x, wallY + 10, 70); poly(g, [{ x: p.x, y: p.y }, { x: p.x + 4, y: p.y + 6 }, { x: p.x - 2, y: p.y + 14 }, { x: p.x - 5, y: p.y + 7 }], P.cream); }
  } else {
    entrance(g, wallY + 3, b.id === 'dock' ? P.sage : P.mauve, -12, 56);
    frontWindow(g, 20, wallY + 2, 25, 25, 30);
    lantern(g, -48, wallY + 8, 55, .85);
  }
  const roofColor = b.id === 'wardrobe' || b.id === 'shrine' ? P.mauve : b.id === 'dock' ? P.sage : P.terracotta;
  roof(g, b.width, b.depth, b.height + 8, roofColor, b.id === 'restaurant' ? 44 : 33);

  if (b.id === 'restaurant') {
    box(g, 64, -35, 24, 25, 55, 0xc9ac94, b.height);
    box(g, 61, -38, 30, 31, 7, P.brown, b.height + 51);
    const sign = local(0, front + 7, 96);
    g.roundRect(sign.x - 56, sign.y - 10, 112, 23, 3).fill(P.brown);
    c.addChild(label('LANTERN HOUSE', sign.x, sign.y + 2, 9, P.cream));
  }
  if (b.id === 'arena') {
    const p = local(0, 5, b.height + 42);
    g.roundRect(p.x - 13, p.y - 17, 26, 20, 3).fill(P.butter);
    g.rect(p.x - 3, p.y + 2, 6, 9).fill(P.butter);
    g.rect(p.x - 10, p.y + 10, 20, 4).fill(P.butter);
    g.circle(p.x - 13, p.y - 8, 7).stroke({ color: P.butter, width: 3 });
    g.circle(p.x + 13, p.y - 8, 7).stroke({ color: P.butter, width: 3 });
    g.rect(p.x - 9, p.y - 15, 3, 13).fill({ color: P.cream, alpha: .6 });
  }
  if (b.id === 'dock') {
    // Fishing net, life ring and a tall rod give the dock its own silhouette.
    const p = local(-40, front + 8, 33);
    g.circle(p.x, p.y, 13).stroke({ color: P.cream, width: 5 });
    g.circle(p.x, p.y, 13).arc(p.x, p.y, 13, 0, Math.PI / 2).stroke({ color: P.red, width: 5 });
    line(g, [local(66, 20), local(70, 20, 100), local(100, 20, 112)], P.brown, 3);
    line(g, [local(100, 20, 112), local(106, 20, 35)], P.cream, 1);
    box(g, 56, 35, 28, 25, 20, P.peach);
    box(g, 58, 12, 24, 22, 16, P.brown);
  }
  if (b.id === 'wardrobe') {
    const p = local(43, front + 15, 38);
    g.roundRect(p.x - 11, p.y - 19, 22, 38, 9).fill(P.brown);
    g.roundRect(p.x - 8, p.y - 16, 16, 32, 6).fill(P.seaGlass);
    line(g, [{ x: p.x - 5, y: p.y + 6 }, { x: p.x + 5, y: p.y - 8 }], P.cream, 2, .7);
    line(g, [local(-70, front, 73), local(0, front, 64), local(70, front, 73)], P.brown, 1);
    for (let i = 0; i < 7; i++) { const a = local(-60 + i * 20, front + 2, 67 + Math.abs(i - 3) * 2); poly(g, [a, { x: a.x + 12, y: a.y }, { x: a.x + 6, y: a.y + 12 }], i % 2 ? P.peach : P.lavender); }
  }
  return c;
}

function calendar(c: Container, g: Graphics, b: Landmark) {
  for (const x of [-76, 70]) box(g, x, -8, 9, 20, 125, P.brown);
  box(g, -90, -8, 180, 12, 105, P.brown, 20);
  const p = local(-80, 5, 119);
  g.rect(p.x, p.y, 160, 90).fill(P.cream);
  g.rect(p.x, p.y, 160, 22).fill(P.red);
  c.addChild(label('A LITTLE TIME', p.x + 80, p.y + 11, 10, P.cream));
  for (let row = 0; row < 4; row++) for (let col = 0; col < 7; col++) {
    const xx = p.x + 10 + col * 21, yy = p.y + 31 + row * 13;
    g.roundRect(xx, yy, 15, 9, 1).fill((row === 1 && col === 3) ? P.peach : 0xded4b5);
    if ((row * 7 + col) % 6 === 0) g.circle(xx + 7, yy + 4, 2).fill(P.mauve);
  }
  for (const x of [-50, 50]) { const q = local(x, 3, 125); g.roundRect(q.x - 3, q.y - 7, 6, 15, 3).fill(P.cream); }
  // A small wooden ladder is an ambient prop, not a walkable route through the calendar.
  const a = local(92, 13), top = local(95, -1, 78);
  for (const dx of [-6, 6]) line(g, [{ x: a.x + dx, y: a.y }, { x: top.x + dx, y: top.y }], P.brown, 3);
  for (let t = .1; t < 1; t += .18) line(g, [{ x: a.x + (top.x - a.x) * t - 6, y: a.y + (top.y - a.y) * t }, { x: a.x + (top.x - a.x) * t + 6, y: a.y + (top.y - a.y) * t }], P.peach, 2);
  groundEllipse(g, 0, b.depth / 2 + 15, 50, 14, P.butter, .15);
}
