import { accessoryObstacles, footprint, fountain, island, landmarks, pier, props, type Point } from '../model';
import { distance, inRect, pointInPolygon } from './geometry';

export const CELL = 20;
export const AVATAR_RADIUS = 10;
const COLS = 74, ROWS = 62;

export function isWalkable(point: Point): boolean {
  // Probe the shoreline around the character's feet, not just its center.
  for (const offset of [{ x: 0, y: 0 }, { x: AVATAR_RADIUS, y: 0 }, { x: -AVATAR_RADIUS, y: 0 }, { x: 0, y: AVATAR_RADIUS }, { x: 0, y: -AVATAR_RADIUS }]) {
    const p = { x: point.x + offset.x, y: point.y + offset.y };
    if (!pointInPolygon(p, island) && !inRect(p, pier, -4)) return false;
  }
  if (landmarks.some(b => inRect(point, footprint(b), AVATAR_RADIUS))) return false;
  if (accessoryObstacles.some(rect => inRect(point, rect, AVATAR_RADIUS))) return false;
  if (distance(point, fountain) < 52 + AVATAR_RADIUS) return false;
  return !props.some(p => p.radius > 0 && distance(point, p) < p.radius + AVATAR_RADIUS);
}

export function segmentClear(a: Point, b: Point, walkable = isWalkable): boolean {
  const count = Math.max(1, Math.ceil(distance(a, b) / 4));
  let previous = a;
  for (let i = 0; i <= count; i++) {
    const t = i / count;
    const point = { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    if (!walkable(point)) return false;
    // Reject zero-width diagonal gaps, including during visibility smoothing.
    if (!walkable({ x: previous.x, y: point.y }) || !walkable({ x: point.x, y: previous.y })) return false;
    previous = point;
  }
  return true;
}

/** Static grid plus exact segment checks: paths remain safe between cell centers. */
export class NavigationGrid {
  private cells: Uint8Array;
  constructor(readonly cols = COLS, readonly rows = ROWS, readonly size = CELL, readonly walkable = isWalkable) {
    this.cells = new Uint8Array(cols * rows);
    for (let y = 0; y < rows; y++) for (let x = 0; x < cols; x++) {
      this.cells[y * cols + x] = +walkable(this.point(y * cols + x));
    }
  }
  private point(id: number): Point { return { x: (id % this.cols) * this.size + this.size / 2, y: Math.floor(id / this.cols) * this.size + this.size / 2 }; }
  private near(p: Point): number | null {
    let candidate: number | null = null, best = Infinity;
    const cx = Math.floor(p.x / this.size), cy = Math.floor(p.y / this.size);
    for (let y = cy - 2; y <= cy + 2; y++) for (let x = cx - 2; x <= cx + 2; x++) {
      if (x < 0 || y < 0 || x >= this.cols || y >= this.rows) continue;
      const id = y * this.cols + x, q = this.point(id), d = distance(p, q);
      if (this.cells[id] && d < best && segmentClear(p, q, this.walkable)) { best = d; candidate = id; }
    }
    return candidate;
  }
  find(start: Point, end: Point): Point[] | null {
    if (!this.walkable(start) || !this.walkable(end)) return null;
    if (segmentClear(start, end, this.walkable)) return [{ ...end }];
    const a = this.near(start), b = this.near(end);
    if (a === null || b === null) return null;
    const scores = new Float64Array(this.cells.length).fill(Infinity);
    const parents = new Int32Array(this.cells.length).fill(-1);
    const closed = new Uint8Array(this.cells.length);
    const open = new Set<number>([a]); scores[a] = 0;
    while (open.size) {
      let current = -1, best = Infinity;
      for (const id of open) {
        const value = scores[id] + distance(this.point(id), this.point(b));
        if (value < best) { current = id; best = value; }
      }
      if (current === b) {
        const route: Point[] = [end];
        for (let id = b; id !== -1; id = parents[id]) route.unshift(this.point(id));
        route.unshift(start);
        // Greedy visibility smoothing removes stair steps, retaining exact clearance.
        const smooth: Point[] = [];
        let i = 0;
        while (i < route.length - 1) {
          let j = route.length - 1;
          while (j > i + 1 && !segmentClear(route[i], route[j], this.walkable)) j--;
          smooth.push(route[j]); i = j;
        }
        return smooth;
      }
      open.delete(current); closed[current] = 1;
      const x = current % this.cols, y = Math.floor(current / this.cols);
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!dx && !dy) || x + dx < 0 || y + dy < 0 || x + dx >= this.cols || y + dy >= this.rows) continue;
        const next = (y + dy) * this.cols + x + dx;
        if (!this.cells[next] || closed[next]) continue;
        if (dx && dy && (!this.cells[y * this.cols + x + dx] || !this.cells[(y + dy) * this.cols + x])) continue;
        if (!segmentClear(this.point(current), this.point(next), this.walkable)) continue;
        const score = scores[current] + this.size * (dx && dy ? Math.SQRT2 : 1);
        if (score < scores[next]) { scores[next] = score; parents[next] = current; open.add(next); }
      }
    }
    return null;
  }
}
