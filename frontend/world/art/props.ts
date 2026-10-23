import { Container } from 'pixi.js';
import { palette as P, type Point, type Prop } from '../model';
import { addGraphic, box, groundEllipse, lantern, line, local, poly, shade, shadow } from './primitives';

export function makeProp(p: Prop): Container {
  const c = new Container(), g = addGraphic(c);
  c.scale.set(p.scale);
  if (p.kind === 'tree') {
    shadow(g, 75, 50);
    box(g, -6, -6, 12, 12, 42, P.brown);
    const canopy = [{ x: -40, y: -40 }, { x: -43, y: -63 }, { x: -30, y: -63 }, { x: -30, y: -80 }, { x: -14, y: -80 }, { x: -14, y: -89 }, { x: 13, y: -89 }, { x: 13, y: -81 }, { x: 29, y: -81 }, { x: 29, y: -65 }, { x: 41, y: -65 }, { x: 41, y: -43 }, { x: 23, y: -34 }, { x: -18, y: -33 }];
    poly(g, canopy, 0x82986b);
    poly(g, canopy.map(q => ({ x: q.x - 5, y: q.y - 6 })), P.sage);
    poly(g, [{ x: -33, y: -66 }, { x: -25, y: -80 }, { x: -10, y: -80 }, { x: -10, y: -88 }, { x: 10, y: -88 }, { x: 10, y: -75 }, { x: 28, y: -75 }, { x: 28, y: -63 }, { x: 2, y: -55 }, { x: -18, y: -57 }], P.matcha);
    for (const [x, y] of [[-25, -61], [12, -68], [-10, -78], [21, -52], [-12, -42]]) g.rect(x, y, 6, 3).fill({ color: P.cream, alpha: .22 });
  } else if (p.kind === 'palm') {
    groundEllipse(g, 10, 8, 39, 22, P.brown, .13);
    line(g, [{ x: 0, y: 0 }, { x: -4, y: -26 }, { x: 0, y: -55 }, { x: 8, y: -86 }], P.brown, 11);
    line(g, [{ x: -3, y: 0 }, { x: -7, y: -26 }, { x: -3, y: -55 }, { x: 5, y: -86 }], P.peach, 4);
    for (let y = -10; y > -80; y -= 9) line(g, [{ x: -6 + (-y / 80) * 9, y }, { x: 3 + (-y / 80) * 9, y: y - 2 }], shade(P.brown, .8), 1.3);
    const center = { x: 8, y: -87 };
    for (let i = 0; i < 8; i++) {
      const angle = i / 8 * Math.PI * 2;
      const end = { x: center.x + Math.cos(angle) * 54, y: center.y + Math.sin(angle) * 28 + 13 };
      const mid = { x: (center.x + end.x) / 2, y: (center.y + end.y) / 2 - 13 };
      poly(g, [center, { x: mid.x - Math.sin(angle) * 10, y: mid.y + Math.cos(angle) * 6 }, end, { x: mid.x + Math.sin(angle) * 9, y: mid.y - Math.cos(angle) * 6 }], i % 2 ? P.matcha : P.sage);
      line(g, [center, mid, end], 0x718a60, 1.3, .7);
    }
    for (const [x, y] of [[3, -84], [13, -82], [8, -77]]) g.circle(x, y, 4).fill(P.brown);
  } else if (p.kind === 'bush') {
    shadow(g, 40, 28);
    box(g, -19, -10, 38, 21, 18, P.sage);
    box(g, -12, -13, 25, 22, 10, P.matcha, 12);
    g.rect(-9, -22, 6, 3).fill({ color: P.butter, alpha: .5 });
  } else if (p.kind === 'flowers') {
    groundEllipse(g, 0, 0, 28, 15, P.sage, .6);
    for (let i = 0; i < 10; i++) {
      const x = Math.sin(i * 13) * 23, y = Math.cos(i * 7) * 8;
      line(g, [{ x, y }, { x, y: y - 10 }], 0x718a60, 1.5);
      const color = [P.peach, P.butter, P.lavender][p.variant];
      g.rect(x - 4, y - 12, 8, 4).fill(color); g.rect(x - 2, y - 14, 4, 8).fill(color);
      g.rect(x - 1, y - 11, 2, 2).fill(P.cream);
    }
  } else if (p.kind === 'lantern') {
    groundEllipse(g, 0, 0, 30, 22, P.butter, .12);
    box(g, -4, -4, 8, 8, 5, 0xb7a68d);
    box(g, -2, -2, 4, 4, 65, P.brown);
    line(g, [local(0, 0, 64), local(18, 0, 64)], P.brown, 3);
    lantern(g, 14, 0, 51, .8);
    line(g, [local(5, 0, 67), local(22, 0, 67)], P.brown, 3);
  } else if (p.kind === 'bench') {
    shadow(g, 63, 25);
    for (const x of [-25, 20]) box(g, x, -7, 5, 15, 17, P.brown);
    for (let y = -10; y <= 10; y += 7) box(g, -32, y, 64, 5, 4, P.peach, 16);
    box(g, -31, -12, 4, 5, 30, P.brown);
    box(g, 27, -12, 4, 5, 30, P.brown);
    box(g, -32, -14, 64, 4, 9, P.peach, 26);
  } else if (p.kind === 'table') {
    shadow(g, 52, 42); box(g, -4, -4, 8, 8, 24, P.brown);
    box(g, -21, -18, 42, 36, 5, P.peach, 24);
    for (const x of [-30, 27]) { box(g, x, -6, 12, 12, 14, P.brown); box(g, x - 2, -8, 16, 16, 3, P.terracotta, 14); }
    const plate = local(0, 0, 30); g.ellipse(plate.x, plate.y, 9, 4).fill(P.cream); g.ellipse(plate.x, plate.y - 2, 5, 3).fill(P.red);
    const cup = local(12, -10, 33); g.rect(cup.x, cup.y, 4, 5).fill(P.cream);
  } else if (p.kind === 'rock') {
    shadow(g, 42, 32);
    poly(g, [{ x: -25, y: -4 }, { x: -18, y: -25 }, { x: 6, y: -31 }, { x: 23, y: -16 }, { x: 25, y: 0 }, { x: 4, y: 9 }], 0x9b9c99);
    poly(g, [{ x: -18, y: -25 }, { x: 6, y: -31 }, { x: 17, y: -15 }, { x: -1, y: -8 }, { x: -25, y: -4 }], 0xc0bfb1);
    poly(g, [{ x: 6, y: -31 }, { x: 23, y: -16 }, { x: 25, y: 0 }, { x: -1, y: -8 }, { x: 17, y: -15 }], 0xacada4);
    line(g, [{ x: -16, y: -24 }, { x: 5, y: -29 }], P.cream, 2, .6);
  } else if (p.kind === 'umbrella') {
    shadow(g, 70, 45); box(g, -2, -2, 4, 4, 51, P.brown);
    for (let i = 0; i < 8; i++) {
      const a = i * Math.PI / 4, b = (i + 1) * Math.PI / 4;
      poly(g, [{ x: 0, y: -65 }, { x: Math.cos(a) * 34, y: Math.sin(a) * 18 - 49 }, { x: Math.cos(b) * 34, y: Math.sin(b) * 18 - 49 }], i % 2 ? P.cream : (p.variant ? P.lavender : P.peach));
    }
    box(g, 25, 15, 21, 45, 6, P.cream);
    for (let y = 19; y < 60; y += 8) line(g, [local(26, y, 7), local(45, y, 7)], P.sage, 3);
  } else if (p.kind === 'stall') {
    shadow(g, 80, 50);
    box(g, -34, -18, 68, 35, 31, P.peach);
    for (const x of [-36, 33]) box(g, x, -15, 4, 35, 72, P.brown);
    for (let i = 0; i < 6; i++) {
      const color = i % 2 ? P.cream : (p.variant ? P.sage : P.red);
      poly(g, [local(-40 + i * 14, -24, 74), local(-26 + i * 14, -24, 74), local(-26 + i * 14, 30, 59), local(-40 + i * 14, 30, 59)], color);
      const a = local(-40 + i * 14, 30, 59); g.roundRect(a.x, a.y, 14, 8, 4).fill(color);
    }
    for (let i = 0; i < 5; i++) { const a = local(-24 + i * 12, 19, 34); g.ellipse(a.x, a.y, 5, 3).fill(P.cream); g.circle(a.x, a.y - 2, 3).fill(i % 2 ? P.sage : P.peach); }
  }
  return c;
}

export interface CharacterArt { root: Container; pose: (time: number, walking: boolean, direction: Point) => void }
export function makeCharacter(shirt = P.terracotta, player = false): CharacterArt {
  const root = new Container(), ground = addGraphic(root);
  shadow(ground, 27, 20);
  if (player) {
    ground.ellipse(0, 1, 20, 9).stroke({ color: P.butter, width: 2, alpha: .95 });
    ground.ellipse(0, 1, 25, 12).stroke({ color: P.cream, width: 1, alpha: .5 });
  }
  const body = new Container(); root.addChild(body);
  const legs = [-1, 1].map(side => {
    const leg = addGraphic(body); box(leg, side < 0 ? -10 : 2, -4, 8, 10, 11, P.slate); box(leg, side < 0 ? -11 : 1, -1, 10, 12, 5, 0x635b5c); return leg;
  });
  const torso = addGraphic(body);
  box(torso, -12, -7, 24, 15, 20, shirt, 10);
  box(torso, -17, -4, 6, 9, 16, shirt, 12); box(torso, 12, -4, 6, 9, 16, shirt, 12);
  box(torso, -17, -3, 6, 8, 5, 0xd8a780, 10); box(torso, 12, -3, 6, 8, 5, 0xd8a780, 10);
  // Cream scarf and cross-body satchel create an original coastal explorer.
  box(torso, -12, -7, 24, 16, 4, P.cream, 27);
  const head = new Container(); body.addChild(head);
  const g = addGraphic(head);
  box(g, -14, -10, 28, 23, 25, 0xe9bb91, 31);
  box(g, -15, -11, 30, 24, 8, 0x665143, 52);
  box(g, -15, -10, 6, 22, 13, 0x665143, 43);
  const face = addGraphic(head);
  const eyes = local(-6, 13, 43);
  face.rect(eyes.x, eyes.y, 3, 4).fill(0x594738); face.rect(eyes.x + 12, eyes.y, 3, 4).fill(0x594738);
  face.rect(eyes.x + 6, eyes.y + 8, 5, 1.5).fill(P.brown);
  face.rect(eyes.x - 3, eyes.y + 6, 4, 2).fill({ color: P.red, alpha: .45 });
  face.rect(eyes.x + 15, eyes.y + 6, 4, 2).fill({ color: P.red, alpha: .45 });
  return { root, pose(time, walking, direction) {
    const step = walking ? Math.sin(time * 14) : 0;
    legs[0].y = step * 3; legs[1].y = -step * 3;
    body.y = walking ? -Math.abs(step) * 2 : Math.sin(time * 1.8) * .65;
    face.visible = direction.y > -.3;
    head.x = direction.x * 1.5;
  } };
}

export function makeBoat(): Container {
  const c = new Container(), g = addGraphic(c);
  groundEllipse(g, 5, 5, 57, 22, P.slate, .13);
  poly(g, [{ x: -55, y: -10 }, { x: -38, y: -22 }, { x: 38, y: -18 }, { x: 60, y: 0 }, { x: 36, y: 16 }, { x: -37, y: 13 }], P.brown);
  poly(g, [{ x: -53, y: -14 }, { x: -35, y: -28 }, { x: 38, y: -24 }, { x: 60, y: -7 }, { x: 35, y: 7 }, { x: -36, y: 5 }], P.cream);
  poly(g, [{ x: -40, y: -14 }, { x: -29, y: -22 }, { x: 33, y: -18 }, { x: 44, y: -7 }, { x: 27, y: 0 }, { x: -29, y: -2 }], P.terracotta);
  for (const x of [-20, 12]) box(g, x, -18, 9, 28, 3, P.peach, 7);
  line(g, [{ x: -10, y: -29 }, { x: 5, y: 14 }], P.brown, 4);
  line(g, [{ x: 4, y: 11 }, { x: 10, y: 24 }], P.peach, 7);
  return c;
}
