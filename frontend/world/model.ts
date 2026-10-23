export interface Point { x: number; y: number }
export interface Rect { x: number; y: number; width: number; height: number }
export type LocationId = 'dock' | 'restaurant' | 'arena' | 'calendar' | 'wardrobe' | 'shrine';
export interface Landmark extends Point {
  id: LocationId;
  name: string;
  subtitle: string;
  description: string;
  future: string;
  width: number;
  depth: number;
  height: number;
  entrance: Point;
  color: number;
}
export const palette = {
  sage: 0x9caf78, matcha: 0xb8c58a, butter: 0xf5d97c, cream: 0xf4e6ba,
  terracotta: 0xd98b45, peach: 0xe9ab67, brown: 0x8b6045,
  lavender: 0xc6b7de, mauve: 0x8e7baa, plum: 0x68597d,
  seaGlass: 0x86c9b8, teal: 0x4e9c98, slate: 0x426b79, red: 0xb86d63,
};

export const landmarks: Landmark[] = [
  { id: 'dock', name: 'Fisherman’s Dock', subtitle: 'A little farther out to sea', x: 210, y: 580, width: 112, depth: 88, height: 66, entrance: { x: 230, y: 650 }, color: palette.matcha,
    description: 'Salt on the breeze. A wooden boat rocks in the shallows, and the last of the day’s light falls across the fishing nets.', future: 'The dock will be home to Cognism imports in a later milestone.' },
  { id: 'restaurant', name: 'Lantern House', subtitle: 'Kitchen · bar · good company', x: 1060, y: 580, width: 240, depth: 150, height: 95, entrance: { x: 1050, y: 690 }, color: palette.terracotta,
    description: 'Follow the lanterns. There’s a seat at the counter, something simmering on the stove, and a warm welcome waiting inside.', future: 'Outlook draft preparation will arrive here in a later milestone.' },
  { id: 'arena', name: 'The Cook’s Court', subtitle: 'A friendly little competition', x: 365, y: 300, width: 200, depth: 132, height: 83, entrance: { x: 365, y: 397 }, color: palette.peach,
    description: 'Aprons on, spirits high. This open-air hall is where the village’s cooks gather to share their best ideas.', future: 'The cadence tracker will take its place in this hall in a later milestone.' },
  { id: 'calendar', name: 'Calendar Square', subtitle: 'Make a little room for tomorrow', x: 1015, y: 925, width: 180, depth: 60, height: 118, entrance: { x: 1015, y: 990 }, color: palette.butter,
    description: 'A quiet courtyard, an oversized paper calendar, and a bench with a view. Take a moment to look ahead.', future: 'Your upcoming tasks and follow-ups will appear here in a later milestone.' },
  { id: 'wardrobe', name: 'The Changing Room', subtitle: 'Come as you are', x: 505, y: 990, width: 130, depth: 92, height: 73, entrance: { x: 505, y: 1068 }, color: palette.lavender,
    description: 'Bunting flutters above the door. A little seaside pavilion for a fresh outfit and a new beginning.', future: 'More original playable characters will arrive in a later milestone.' },
  { id: 'shrine', name: 'Windbell Shrine', subtitle: 'A quieter corner of the island', x: 1010, y: 210, width: 140, depth: 100, height: 85, entrance: { x: 1010, y: 290 }, color: palette.mauve,
    description: 'Past the garden, the wind finds a tiny bell. Let the village slow down for a while.', future: 'More village preferences will be available here as the application grows.' },
];

export const island: Point[] = [
  { x: 245, y: 110 }, { x: 450, y: 95 }, { x: 550, y: 135 }, { x: 755, y: 90 },
  { x: 950, y: 115 }, { x: 1110, y: 135 }, { x: 1215, y: 225 }, { x: 1195, y: 360 },
  { x: 1295, y: 435 }, { x: 1320, y: 630 }, { x: 1270, y: 740 }, { x: 1310, y: 880 },
  { x: 1190, y: 1060 }, { x: 1030, y: 1105 }, { x: 890, y: 1155 }, { x: 730, y: 1115 },
  { x: 560, y: 1175 }, { x: 405, y: 1130 }, { x: 310, y: 1050 }, { x: 265, y: 935 },
  { x: 165, y: 840 }, { x: 190, y: 740 }, { x: 120, y: 635 }, { x: 145, y: 475 },
  { x: 215, y: 410 }, { x: 150, y: 280 }, { x: 185, y: 180 },
];
export const pier: Rect = { x: 20, y: 630, width: 310, height: 68 };
export const spawn: Point = { x: 700, y: 730 };
export const fountain: Point = { x: 700, y: 600 };
export const paths: Point[][] = [
  [{ x: 230, y: 650 }, { x: 400, y: 670 }, { x: 570, y: 660 }, { x: 700, y: 680 }, { x: 860, y: 650 }, { x: 1050, y: 690 }],
  [{ x: 365, y: 397 }, { x: 430, y: 470 }, { x: 535, y: 545 }, { x: 570, y: 660 }],
  [{ x: 365, y: 397 }, { x: 560, y: 360 }, { x: 790, y: 375 }, { x: 1010, y: 290 }],
  [{ x: 1010, y: 290 }, { x: 1150, y: 410 }, { x: 1175, y: 470 }],
  [{ x: 790, y: 375 }, { x: 820, y: 510 }, { x: 860, y: 650 }],
  [{ x: 700, y: 680 }, { x: 760, y: 825 }, { x: 720, y: 965 }, { x: 505, y: 1068 }],
  [{ x: 1050, y: 690 }, { x: 1110, y: 790 }, { x: 1015, y: 990 }, { x: 830, y: 1060 }, { x: 720, y: 965 }],
  [{ x: 230, y: 650 }, { x: 350, y: 805 }, { x: 375, y: 945 }, { x: 505, y: 1068 }],
  [{ x: 760, y: 825 }, { x: 910, y: 850 }, { x: 1015, y: 990 }],
];

export type PropKind = 'palm' | 'tree' | 'bush' | 'flowers' | 'bench' | 'lantern' | 'table' | 'rock' | 'umbrella' | 'stall';
export interface Prop extends Point { kind: PropKind; scale: number; variant: number; radius: number }
const prop = (kind: PropKind, x: number, y: number, scale = 1, variant = 0): Prop => ({
  kind, x, y, scale, variant,
  radius: ({ palm: 12, tree: 19, bush: 16, flowers: 0, bench: 34, lantern: 5, table: 40, rock: 25, umbrella: 12, stall: 42 }[kind]) * scale,
});
export const props: Prop[] = [
  prop('palm', 255, 215, 1.1), prop('palm', 545, 210, 1.15), prop('palm', 1210, 555, 1.12),
  prop('palm', 1170, 980, 1.25), prop('palm', 285, 835, 1.1), prop('palm', 775, 1100, 1.05),
  prop('palm', 250, 1030, .85), prop('palm', 1250, 825, .95), prop('palm', 1120, 200, 1.05),
  prop('palm', 320, 170, .8), prop('palm', 570, 1130, .85),
  prop('tree', 620, 255, 1.05), prop('tree', 710, 245, 1.2), prop('tree', 805, 230, .95),
  prop('tree', 875, 285, 1.1), prop('tree', 665, 330, .8), prop('tree', 260, 470, .9),
  prop('tree', 520, 450, .85), prop('tree', 910, 515, .85), prop('tree', 450, 855, 1.1),
  prop('tree', 550, 875, .85), prop('tree', 1130, 860, .95), prop('tree', 1120, 1035, .75),
  prop('bush', 655, 270, 1.2), prop('bush', 745, 270), prop('bush', 845, 255),
  prop('bush', 300, 320), prop('bush', 480, 350), prop('bush', 980, 275),
  prop('bush', 1210, 620), prop('bush', 460, 980), prop('bush', 1150, 915),
  prop('bench', 585, 745, 1, 0), prop('bench', 840, 730, 1, 1), prop('bench', 925, 1020, .9),
  prop('table', 1170, 710), prop('table', 1220, 750, .8), prop('table', 965, 730, .85),
  prop('lantern', 450, 620), prop('lantern', 600, 520), prop('lantern', 780, 560),
  prop('lantern', 900, 675), prop('lantern', 1090, 350), prop('lantern', 1030, 830),
  prop('lantern', 625, 1000), prop('lantern', 400, 745), prop('lantern', 320, 405),
  prop('rock', 140, 365, 1.4), prop('rock', 1240, 335, 1.3), prop('rock', 1370, 720, 1.1),
  prop('rock', 1150, 1130, .9), prop('rock', 335, 1155), prop('rock', 110, 875, 1.2),
  prop('umbrella', 900, 1100, 1, 0), prop('umbrella', 330, 940, .85, 1),
  prop('stall', 480, 560, .85, 0), prop('stall', 860, 920, .85, 1),
  ...[ [610, 760], [870, 755], [1120, 320], [920, 1015], [455, 1060], [420, 385], [540, 475], [850, 485], [365, 885], [1210, 880] ]
    .map(([x, y], i) => prop('flowers', x, y, 1, i % 3)),
];

export function footprint(b: Landmark): Rect {
  return { x: b.x - b.width / 2, y: b.y - b.depth / 2, width: b.width, height: b.depth };
}
// Small solid attachments share the map definition with their visual landmarks.
export const accessoryObstacles: Rect[] = [
  { x: 266, y: 592, width: 28, height: 48 }, // dock crates
  { x: 1097, y: 661, width: 68, height: 13 }, // restaurant service counter
  ...props.filter(p => p.kind === 'umbrella').map(p => ({
    x: p.x + 25 * p.scale, y: p.y + 15 * p.scale, width: 21 * p.scale, height: 45 * p.scale,
  })),
];
export const worldBounds = { left: -85, right: 1510, top: -10, bottom: 870 };
