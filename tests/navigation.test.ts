import { describe, expect, it } from 'vitest';
import { Camera } from '../frontend/world/camera';
import { landmarks, spawn } from '../frontend/world/model';
import { project, unproject, distance } from '../frontend/world/navigation/geometry';
import { isWalkable, NavigationGrid, segmentClear } from '../frontend/world/navigation/grid';

describe('village navigation', () => {
  const grid = new NavigationGrid();
  it('connects the spawn and every entrance without crossing a blocked segment', () => {
    for (const building of landmarks) {
      expect(isWalkable(building.entrance), building.id).toBe(true);
      const route = grid.find(spawn, building.entrance);
      expect(route, building.id).not.toBeNull();
      let previous = spawn;
      for (const point of route!) { expect(segmentClear(previous, point), building.id).toBe(true); previous = point; }
      expect(distance(previous, building.entrance)).toBeLessThan(.01);
    }
  });
  it('rejects buildings, furniture, water, and off-map targets', () => {
    for (const target of [{ x: 0, y: 0 }, { x: -100, y: 600 }, { x: 1060, y: 580 }, { x: 700, y: 600 }, { x: 1170, y: 710 }]) {
      expect(grid.find(spawn, target)).toBeNull();
    }
  });
  it('does not cut diagonally between two blocked neighboring cells', () => {
    const safe = (p: { x: number; y: number }) => (p.x < 20 && p.y < 20) || (p.x >= 20 && p.y >= 20);
    const corner = new NavigationGrid(2, 2, 20, safe);
    expect(corner.find({ x: 10, y: 10 }, { x: 30, y: 10 })).toBeNull();
    expect(corner.find({ x: 10, y: 10 }, { x: 30, y: 30 })).toBeNull();
  });
  it('can route between every pair of entrances', () => {
    for (const a of landmarks) for (const b of landmarks) expect(grid.find(a.entrance, b.entrance), `${a.id} → ${b.id}`).not.toBeNull();
  });

});

describe('projection and camera', () => {
  it('round-trips ground points after pan, zoom, and resizing', () => {
    const camera = new Camera(); camera.resize(1440, 900);
    camera.zoomAt(1.8, { x: 500, y: 400 }); camera.pan(90, -40); camera.resize(1100, 768);
    for (const p of [spawn, ...landmarks.map(b => b.entrance)]) {
      const roundtrip = unproject(camera.screenToWorld(camera.worldToScreen(project(p))));
      expect(distance(roundtrip, p)).toBeLessThan(.00001);
    }
  });
  it('holds the ground under the pointer during zoom and bounds zoom/pan', () => {
    const camera = new Camera(); camera.resize(1440, 900);
    const pointer = { x: 900, y: 500 }, before = camera.screenToWorld(pointer);
    camera.zoomAt(1.3, pointer);
    expect(distance(camera.screenToWorld(pointer), before)).toBeLessThan(.00001);
    camera.zoomAt(100, pointer); expect(camera.zoom).toBe(camera.fitZoom * 2.8);
    camera.pan(100000, -100000); expect(camera.center.x).toBeGreaterThan(-85); expect(camera.center.y).toBeLessThan(870);
    camera.overview(); expect(camera.zoom).toBe(camera.fitZoom); expect(camera.follow).toBe(false);
  });
});
