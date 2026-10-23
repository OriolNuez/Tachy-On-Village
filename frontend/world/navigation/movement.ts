import { spawn, type LocationId, type Point } from '../model';
import { distance } from './geometry';
import { NavigationGrid } from './grid';

export class Walker {
  position: Point = { ...spawn };
  route: Point[] = [];
  destination: Point | null = null;
  pending: LocationId | null = null;
  direction: Point = { x: 0, y: 1 };
  constructor(readonly grid: NavigationGrid) {}
  go(target: Point, location: LocationId | null = null): boolean {
    // A new command always cancels the old entrance action, even if unreachable.
    this.pending = null;
    const route = this.grid.find(this.position, target);
    if (!route) return false;
    this.route = route; this.destination = { ...target }; this.pending = location;
    return true;
  }
  cancel() { this.route = []; this.destination = null; this.pending = null; }
  update(seconds: number): LocationId | null {
    let travel = Math.min(Math.max(seconds, 0), .05) * 165;
    while (travel > 0 && this.route.length) {
      const next = this.route[0], d = distance(this.position, next);
      if (d > .001) this.direction = { x: (next.x - this.position.x) / d, y: (next.y - this.position.y) / d };
      if (d <= travel) { this.position = { ...next }; this.route.shift(); travel -= d; }
      else { this.position.x += this.direction.x * travel; this.position.y += this.direction.y * travel; travel = 0; }
    }
    if (!this.route.length) { const arrived = this.pending; this.pending = null; this.destination = null; return arrived; }
    return null;
  }
}
