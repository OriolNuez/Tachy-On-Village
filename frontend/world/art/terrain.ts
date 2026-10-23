import { Container, Graphics } from 'pixi.js';
import { fountain, island, palette as P, paths, pier, type Point } from '../model';
import { pointInPolygon, project, segmentDistance } from '../navigation/geometry';
import { box, line, poly, seeded } from './primitives';

const center = { x: 720, y: 640 };
const outline = (scale = 1, dy = 0) => island.map(p => {
  const q = project({ x: center.x + (p.x - center.x) * scale, y: center.y + (p.y - center.y) * scale }); return { x: q.x, y: q.y + dy };
});

export function makeTerrain(): { root: Container; water: Graphics; glints: Point[] } {
  const root = new Container(), g = new Graphics(), water = new Graphics();
  root.addChild(g);
  g.rect(-3000, -2000, 7000, 5000).fill(0x7fb6af);
  // Broad, translucent patches create a gently luminous bay without expensive filters.
  g.ellipse(650, 360, 1700, 1100).fill({ color: P.seaGlass, alpha: .3 });
  g.ellipse(400, 160, 1000, 700).fill({ color: P.lavender, alpha: .08 });
  const random = seeded(721);
  const glints: Point[] = [];
  for (let i = 0; i < 950; i++) {
    const x = random() * 3200 - 900, y = random() * 1900 - 500;
    line(g, [{ x, y }, { x: x + 4 + random() * 17, y }], i % 3 ? P.cream : P.teal, i % 5 ? 1 : 2, i % 3 ? .13 : .2);
    if (i % 18 === 0) glints.push({ x, y });
  }
  root.addChild(water);
  const land = new Graphics(); root.addChild(land);
  poly(land, outline(1.12, 9), P.teal, .15);
  poly(land, outline(1.075, 4), P.seaGlass, .75);
  line(land, [...outline(1.045), outline(1.045)[0]], P.cream, 3, .45);
  poly(land, outline(1, 12), 0xb2b397);
  poly(land, outline(1, 6), 0xd0c29e);
  poly(land, outline(), P.cream);
  line(land, [...outline(), outline()[0]], 0xfff0cd, 3, .8);
  const grassPolygon = island.map(p => ({ x: center.x + (p.x - center.x) * .91, y: center.y + (p.y - center.y) * .9 }));
  poly(land, grassPolygon.map(p => project(p)), 0x90a477);
  poly(land, grassPolygon.map(p => ({ x: project(p).x, y: project(p).y - 3 })), P.sage);
  for (let i = 0; i < 1300; i++) {
    const p = { x: random() * 1250 + 100, y: random() * 1100 + 100 };
    if (!pointInPolygon(p, island)) continue;
    const screen = project(p), grass = pointInPolygon(p, grassPolygon);
    if (grass) {
      land.rect(screen.x, screen.y, 2 + random() * 4, 1).fill({ color: i % 3 ? P.matcha : P.brown, alpha: .3 });
      if (i % 11 === 0) line(land, [{ x: screen.x - 2, y: screen.y }, { x: screen.x - 4, y: screen.y - 4 }, { x: screen.x, y: screen.y }, { x: screen.x + 1, y: screen.y - 5 }], 0x83996b, 1, .45);
    } else land.ellipse(screen.x, screen.y, 1.5, .7).fill({ color: P.brown, alpha: .2 });
  }
  // Courtyards and promenades form one connected village, not separate menu islands.
  for (const path of paths) {
    const points = path.map(p => project(p));
    line(land, points, 0x86956e, 64, .55);
    line(land, points, 0xc3bda0, 59);
    line(land, points, 0xded4b6, 53);
    line(land, points, P.cream, 47, .3);
  }
  const plaza = project({ x: 700, y: 650 });
  land.ellipse(plaza.x, plaza.y, 130, 83).fill(0xc3bda0);
  land.ellipse(plaza.x, plaza.y, 124, 78).fill(0xe4d9b9);
  land.ellipse(plaza.x, plaza.y, 112, 69).stroke({ color: 0xc3b99c, width: 2 });
  for (let y = 180; y < 1120; y += 23) for (let x = 210; x < 1230; x += 23) {
    const p = { x: x + (Math.floor(y / 23) % 2) * 11, y };
    if (!pointInPolygon(p, grassPolygon)) continue;
    const onPath = paths.some(path => path.slice(1).some((b, i) => segmentDistance(p, path[i], b) < 22));
    if (!onPath) continue;
    const a = project({ x: p.x - 8, y: p.y - 9 });
    const b = project({ x: p.x + 9, y: p.y - 9 });
    const c = project({ x: p.x + 9, y: p.y + 9 });
    const d = project({ x: p.x - 8, y: p.y + 9 });
    poly(land, [a, b, c, d], random() > .5 ? 0xeee2c2 : 0xd0c7ad, .65);
    line(land, [d, c], 0xb6ac93, .6, .35);
  }
  // Pier, with posts, warm planking and a gap at the landward end.
  const deck = new Container(), dg = new Graphics(); deck.addChild(dg);
  const base = project({ x: pier.x, y: pier.y }); deck.position.set(base.x, base.y); root.addChild(deck);
  box(dg, 0, 0, pier.width, pier.height, 8, P.brown);
  for (let x = 0; x < pier.width; x += 13) box(dg, x, 0, 11.5, pier.height, 3, x % 26 ? 0xc69b6d : 0xd4aa79, 8);
  for (let x = 0; x < pier.width - 40; x += 52) for (const y of [-3, pier.height - 3]) box(dg, x, y, 8, 8, 25, P.brown);
  for (const y of [0, pier.height]) {
    const points = [];
    for (let x = 0; x <= 208; x += 26) points.push({ x: x + y * .18, y: y * .7 - (x % 52 ? 14 : 23) });
    line(dg, points, P.cream, 1.5, .8);
  }
  return { root, water, glints };
}

export function makeFountain(): Container {
  const c = new Container(), g = new Graphics(); c.addChild(g);
  const p = project(fountain); c.position.set(p.x, p.y); c.zIndex = fountain.y + 48;
  g.ellipse(5, 6, 65, 37).fill({ color: P.plum, alpha: .13 });
  g.ellipse(0, 0, 56, 35).fill(0xb6ac96);
  g.ellipse(0, -6, 56, 35).fill(P.cream);
  g.ellipse(0, -7, 46, 27).fill(P.slate);
  g.ellipse(0, -6, 43, 24).fill(P.seaGlass);
  g.ellipse(0, -6, 33, 18).stroke({ color: P.cream, width: 1, alpha: .5 });
  box(g, -10, -10, 20, 20, 29, 0xcac2a7, 6);
  g.ellipse(0, -39, 23, 12).fill(0xb6ac96);
  g.ellipse(0, -42, 23, 12).fill(P.cream);
  g.ellipse(0, -43, 17, 8).fill(P.seaGlass);
  box(g, -4, -4, 8, 8, 18, P.cream, 42);
  for (const x of [-17, 17]) line(g, [{ x, y: -42 }, { x: x * 1.3, y: -30 }, { x: x * 1.6, y: -11 }], P.cream, 2, .6);
  return c;
}
