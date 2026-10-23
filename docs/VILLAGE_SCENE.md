# Milestone 1 — coastal village scene

The user authorized this milestone on 23 October 2026. The PRD governs functionality; `Tachy-on_Village_Concept_Pack/concept.md` and its map reference govern visual direction. This document supersedes the initial proposal's landmark positions. The supplied reference is composition guidance only and is not included in the runtime artwork.

## Scene and layout

Use a fixed north-up, oblique orthographic projection with approximately 40° downward viewing angle. Model ground coordinates independently of screen coordinates. A small horizontal shear reveals the buildings' side faces without rotating the island into a diamond. All assets share the projection and ground anchor.

One cohesive island fills the initial view: cream beaches and sea-glass shallows around sage gardens, a circular fountain plaza, and two connected path loops. The restaurant on the east shore is the largest and warmest landmark. Six destinations follow the concept's spatial hierarchy:

| Location | Position | Silhouette |
| --- | --- | --- |
| Arena | Northwest | Cream/terracotta competition pavilion, striped awning, trophy |
| Shrine | Northeast | Quiet timber pavilion with lavender roof and lanterns |
| Dock | West | Fishing hut, planked pier, crates and moored skiff |
| Restaurant | East | Broad terracotta roof, glowing windows, noren, outdoor tables |
| Calendar | Southeast | Oversized timber-framed paper calendar in a paved court |
| Wardrobe | South | Small lavender-roofed dressing pavilion and mirror |

Keep the central walking space open. Palms, rounded trees, flowers, benches, market stalls, umbrellas, rocks and shore details form small clusters around routes. Use the seven exact concept palette colors as base materials; lavender appears in shadows, roofs and restrained ambient accents. Water uses the concept's sea glass/teal palette. Avoid a uniform purple wash.

## Scene graph and ownership

```text
React application
  WorldCanvas (owns creation/destruction of one Pixi Application)
    camera container
      water / offshore scenery
      island ground / beach / path tiles / ground shadows
      depth-sorted objects (buildings, props, avatar, ambient villagers)
      destination marker / entry highlights / labels
  DOM HUD, village directory, location dialog, camera controls
```

Pixi owns frame updates. React owns readable text, focus, and coarse location events. The map definition is the single source for island boundary, building footprints, entrances, props and paths. Pure navigation and camera modules can run in unit tests. Animation only depicts ambient village life; there are no job simulations or fictional progress counters.

## Camera and movement

Start at an overview fitted to the viewport with room for the compact HUD. Wheel zoom focuses on the pointer. Middle-button or Space+drag pans; arrow keys pan when the world is focused. Manual pan disables following; a follow control follows the avatar at close zoom. Home/Overview fits the island again. Clamp the camera and zoom and recompute bounds on resize. UI events never pass through to movement.

Rasterize walkable land and pier into a small navigation grid. Inflate obstacles for avatar clearance and use eight-neighbor A* with no diagonal corner cutting. Respect buildings, furniture, fountain, tree trunks and water. Clicks in blocked ground show a short explanation. Building clicks target a reachable front entrance. Move at time-based speed; clamp long frame gaps. Retarget safely from the current segment and cancel stale entrance actions. Arrival opens the location's themed placeholder panel. An accessible directory can open the same panel immediately.

## Original placeholders and Blender replacement contract

Milestone 1 draws original layered geometry: beveled cuboids, tiled gable roofs, timber beams, framed luminous windows, low-poly foliage, and a cube-headed character. Ambient loops include water glints, gentle boat motion, restaurant steam, and restrained idle character movement. Reduced motion freezes these and removes camera easing.

For later Blender production:

1. Keep source `.blend` files in `assets/blender_sources/`; keep optimized PNG/JSON atlases separately in `assets/spritesheets/`. Record author/license and export settings in an asset manifest.
2. Use one orthographic camera matching the prototype projection. Align north and ground axes; validate with a unit cube, doorway and avatar before producing the set. Bake the oblique projection into sprites, never into collision coordinates.
3. Adopt one world unit scale, foot/ground pivots, roof heights, and matching contact-shadow direction. Use the exact seven base colors, warm key light and subtle mauve ambient fill. Render transparent backgrounds with nearest-neighbor-friendly edges.
4. Export ground, contact shadows, building body/roof, and animated details separately where occlusion needs it. Large structures may use multiple depth slices; collision remains authored ground footprints with entrances.
5. Use a shared cube-character rig. Start with four or eight directional idle/walk clips; export named clips with frame durations and a consistent bottom-center foot pivot. Add workflow animations only in later milestones.
6. Atlas metadata records asset ID, image/frame rectangles, pivot, world size, elevation, footprint, entrance offsets, animation names and timing. Replacing a placeholder changes its visual factory/atlas reference, not its navigation or location ID.
7. Check sprite readability at overview and close zoom on standard and high-DPI screens. Keep masters outside runtime bundles; avoid baking labels into tiny artwork.

## Boundary and verification

Implement Electron/React/Pixi, the island, one playable avatar, camera, navigation, entrance panels, accessible equivalents, and reduced motion. No Python imports/execution, integration controls, database, scheduler, final Blender production, or audio is included. Preserve Python script checksums.

Check every entrance is reachable, obstacle and shoreline clearance, camera transform round trips, safe mid-route retargeting, popup cancellation, keyboard dialogs, resize, and actual Electron launch. Inspect screenshots at overview and closer scale before finishing. Report macOS and Windows validation separately.
