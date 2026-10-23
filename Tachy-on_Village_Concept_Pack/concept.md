# Tachy-on Village — World & Visual Concept

**Document:** `concept.md`  
**Status:** Approved creative direction for prototype planning; implementation details to validate in-game  
**Companion:** `Tachy-on_Village_PRD.md` (the functional source of truth)  
**Primary visual reference:** [`references/village_reference.png`](references/village_reference.png)  
**Target:** Cross-platform Electron desktop app (macOS and Windows), with a React UI, a 2.5D interactive village scene, and existing Python automation tools behind the scenes.

> **Brief for Codex:** Create a charming, explorable **coastal pixel/voxel village**, not a standard dashboard decorated with pixel icons. The user should see a coherent miniature world, walk a cube-like character through it by clicking, and enter distinct, functional places. The place should feel as welcoming as a cozy Pokémon village, as breezy as a tropical seaside resort reminiscent of *Final Fantasy VII's Costa del Sol*, and as playful as a Japanese food-market street — while using an **original** setting, characters, signs, artwork and music.

---

## 1. Creative north star

**Working tagline:** *A little village where your sales work comes to life.*

Tachy-on Village converts routine sales operations into an animated village simulation:

- **Fishing at the dock** represents discovering/importing contacts through Cognism.
- **Preparing and serving dishes at a late-night Japanese kitchen/bar** represents composing and saving Outlook **drafts**.
- **A friendly cooking-competition arena** represents cadence performance and contact management.
- **A giant physical calendar in the town square** represents due follow-ups and scheduled actions.
- **A changing room** lets the player choose which avatar acts as the village worker in all modules.

The fantasy must never hide the actual work. Animated characters are a fun representation of real Python job states; progress, records processed, failures, and saved outputs remain visible and truthful.

### Desired emotional qualities

1. **Cozy:** soft lighting, approachable architecture, little character routines and environmental details.
2. **Tropical/coastal:** beaches, a harbor, modest surf, boats, palms, rocky shorelines and sea-breeze motion.
3. **Japanese village/food culture:** lanterns, noren-style fabric curtains, ramen/sushi stalls, timber façades, stools, tiled courtyards and an inviting bar.
4. **Whimsical game world:** chibi cube characters, expressive emotes, small environmental jokes and discoveries.
5. **Useful desktop product:** legible labels, predictable controls, visible job status, accessible navigation and no ambiguous sending actions.

### What to draw from the supplied map reference

- One **self-contained island** with water on all sides and a readable network of pathways.
- Distinctive roofs and recognizable building silhouettes at a glance.
- A central shared pedestrian area, smaller shore paths, bridges, decks, docks, boats and palms.
- Small NPCs that make the town feel alive.
- A single broad overhead view showing the important landmarks together.

### What to change from the reference

- Replace the bright blue, high-saturation theme with the **pastel earthy palette below** and a gentle lavender-violet atmosphere.
- Make the buildings **purpose-built for the Tachy-on modules**, not copies of recognizable game locations.
- Use **3D cube/voxel-like characters** with soft, stepped pixel silhouettes rather than flat conventional RPG sprites.
- Make the **bar/restaurant a visual centerpiece** with a glowing interior and animated service activity.
- Give the village more winding paths, planted gardens and layered height without obscuring click targets.

---

## 2. Visual language

### Perspective

- **Camera:** fixed angled bird's-eye/isometric-like orthographic view; approximately 35–45° down toward the island. North stays at the top of the screen.
- **Framing:** on a 16:9 desktop window, the full island should be understandable without scrolling. Allow gentle zoom into a district or interior, then return to the world overview.
- **Style:** hybrid **2.5D / voxel pixel art** — low-poly boxy objects, slightly rounded bevels, subtle low-resolution texture detail, charming cube-headed characters, deliberate pixel edges.
- **Shadows:** soft warm-brown contact shadows, modest ambient occlusion, no harsh black outlines.
- **Clarity:** roofs must identify their buildings; doors, stairs and walkways must be visible enough for navigation.

### Primary palette — use the user's exact colors

| Role | Name | Hex | Examples |
|---|---|---|---|
| Main landscape | Sage Green | `#9CAF78` | Grass, treetops, gardens |
| Secondary landscape | Matcha Green | `#B8C58A` | Shrubs, grass highlights, awnings |
| Reward / warm light | Butter Yellow | `#F5D97C` | Lantern light, windows, celebrations |
| Buildings / UI base | Warm Cream | `#F4E6BA` | Walls, sand highlights, cards, parchment |
| Roof / wood accent | Terracotta | `#D98B45` | Restaurant roofs, signage, pottery |
| Sunlit accent | Peach Orange | `#E9AB67` | Soft highlights, lanterns, food stalls |
| Outlines / structure | Muted Brown | `#8B6045` | Timber, borders, readable dark linework |

### Additional supporting colors (proposed; adjustable)

| Role | Color | Hex |
|---|---|---|
| Purple place / sky haze | Dusty Lavender | `#C6B7DE` |
| Violet shadows / menu accents | Twilight Mauve | `#8E7BAA` |
| Deeper violet contrast | Plum Stone | `#68597D` |
| Tropical shallow water | Sea Glass | `#86C9B8` |
| Deeper bay water | Coastal Teal | `#4E9C98` |
| Dusk/navy details | Deep Blue Slate | `#426B79` |
| Subtle accent | Dusty Red | `#B86D63` |

**Color balance:** approximately 55% earthy greens/creams, 20% warm wood/terracotta, 15% tropical water, and 10% lavender/purple accents and atmosphere. **Purple is the identity of the village atmosphere**, not a neon filter over every object.

### Lighting and mood

- **Default world state:** perpetual warm late afternoon edging into lavender dusk — sun-kissed façades, butter-yellow windows, a mauve ambient sky and luminous sea.
- **Dock:** brighter daylight and reflective sea; gentle cloud shadows.
- **Bar/kitchen:** late evening, golden lanterns, warm amber interior and cozy after-dark energy.
- **Tracker arena:** warm stage lighting with restrained celebratory spotlights.
- **Calendar plaza:** calm daylight, warm paper-grid backdrop with colorful but readable event markers.
- Avoid photorealistic surfaces, excessive bloom, sharp neon and realistic/anime proportions.

---

## 3. World geography and layout

Build a **small resort-like island surrounded by water**. The island should read as a connected walking village, not a disconnected menu grid. The player starts near the center. Main attractions should be visually balanced so their names and doors remain clear.

### Proposed world map (north = top, not to scale)

```text
               OPEN SEA / ROCKS / TROPICAL ISLETS
     ┌──────────────────────────────────────────────┐
     │                                              │
     │ [TRACKER / CHEF ARENA]     [SETTINGS SHRINE]  │
     │          ╲                   ╱   PALMS        │
     │           ╲      GARDEN     ╱                 │
     │            ╲               ╱                  │
     │ [DOCK +     ─── CENTRAL PLAZA ─── [LATE BAR + │
     │ FISHING]          SPAWN           RESTAURANT] │
     │      PIER  ╲      FOUNTAIN       ╱            │
     │             ╲                   ╱             │
     │       BEACH WALK ─────── [CALENDAR PLAZA]    │
     │                ╲               ╱             │
     │                [CHANGING ROOM]                │
     │                                              │
     └──────────────────────────────────────────────┘
              WOODEN PIER / SURF / SMALL BOATS
```

This is a **spatial hierarchy**, not a tile-perfect coordinate specification. Adjust footprints for accessibility and visual appeal while keeping the destinations distinct.

### Suggested normalized landmark anchors

The numbers below are relative positions on the island layout (`x: 0–1`, `y: 0–1`) and may be tuned during blocking:

| Place | Anchor | Silhouette and location |
|---|---|---|
| Central Plaza / spawn | `(0.50, 0.49)` | Open square with circular tiled feature and village noticeboard |
| Dock / Export | `(0.18, 0.52)` | Fishing hut, pier, bobbing boat and crates on west/southwest water |
| Bar / Drafter | `(0.78, 0.49)` | Large terracotta-roofed izakaya/bar with glowing windows and service hatch |
| Tracker Arena | `(0.24, 0.19)` | Distinct roofed mini-competition hall with stage and up to 12 contestants |
| Calendar Plaza | `(0.76, 0.77)` | Monumental freestanding calendar with open court and ladders |
| Changing Room | `(0.38, 0.82)` | Small dressing pavilion with outfit icons and mirror |
| Settings Shrine | `(0.79, 0.17)` | Quiet hilltop timber pavilion, wind chimes and lanterns |

### Paths and navigation constraints

- Construct a **continuous connected navigable ground mesh** between all buildings.
- At least two visual path choices should feel possible from the central plaza, even if the underlying navigation graph is simple.
- Use stone tiles, compacted sand paths, short bridges and wooden waterfront decks.
- Avoid blind alleys where the character gets stuck behind trees, umbrellas or props.
- Show a subtle destination marker when the player clicks; highlight a building entry hotspot on hover.
- Include simple obstacle avoidance; the avatar must not walk through stalls, tables, water or buildings.
- Place the water boundary beyond the walkable navigation graph, except for scripted boat sequences.

### Ambient village details

Beach umbrellas; lifebuoys; gentle palm sway; koi/sea-fish motifs; flower beds; lantern strings; sleepy cats; a ramen cart; low timber benches; small shore rocks; ripples; moored skiffs; market crates; a tiny lighthouse/beacon; hanging signs; cooking steam; soft firefly-like evening particles.

**Do not clutter the main walking routes.** Ambient scenery reinforces the village but should never compete with the primary modules.

---

## 4. Buildings and their product functions

### A. Dock — Cognism Exporter / “Start Fishing”

**Exterior:** a humble timber harbor hut, terracotta roof, nets, fish crates and a short pier leading to a small boat; bright shallows and nearby rocks.

**User journey:** click dock → avatar walks to pier → dock menu opens → choose **New Cadence**, **Resume Cadence**, or **Import Without Cadence** → for new cadence enter name → choose platform (**Cognism only** in v1) → instruction to prepare contact list in the external Cognism browser → **Start Fishing** to trigger the existing permitted Python workflow.

**Fishing animation states:** `idle_at_pier → embark → sail_out → fishing_loop → catch_success / wobble / slip_and_swim → return_to_pier → reward_emote`.

**Live UI:** contacts processed / total (when known), records saved, verified emails, explicitly verified mobile numbers, skipped records, errors, current stage, elapsed time, View Log, Stop/Resume (only if backend supports safe resumption).

**Completion card:** **Contacts retrieved**, **verified emails**, **verified mobile phones**, and **Open CSV**. Use a **new original celebratory fanfare**, not the actual Zelda Master Sword sound recording.

**Accuracy rule:** distinguish *email present* from *email verified*; do not infer mobile verification just from a phone number being present.

### B. Late-night bar & Japanese restaurant — Outlook Drafter

**Exterior:** the village's most inviting building — warm terracotta tiled roof, timber bar, glazed frontage, outdoor seating, hanging cream lanterns and a noren-style entrance. In the evening, the restaurant glows against the purple village ambience.

**Interior:** a combined **cocktail bar, sushi/ramen preparation counter and intimate restaurant** with visible seating. The main avatar acts as chef/bartender while NPCs mix cocktails, do small bottle flips, chop, plate meals, serve guests, wash glassware and polish cutlery. It should feel bustling, not chaotic.

**User journey:** choose CSV from local approved data folder → select `.txt` message template or create/edit a template → show supported variables `{first_name}`, `{company}`, `{job_title}` → set Outlook signature On/Off and signature name → choose draft count (All or a number) and optionally retry a specific contact → Preview → **Create Drafts**.

**Cooking animation states:** `prep → chopping → cocktail_shake / bottle_trick → cook → plate → waiter_collects → repeat → completion_toast`.

**Live UI:** drafts created / contacts selected, skipped, failures, current contact, View Logs, Review Errors.

**Completion language is strictly:** **“X drafts created — check your Outlook Drafts.”** Never say “emails sent.” The current Python tool does **not** send emails.

**Safety:** signature must not be inserted twice; show and store the template used; retain draft checkpoint/progress state; prompt review before any external sending (outside this app).

### C. Cooking-competition arena — Cadence Tracker

**Exterior:** a small friendly competition hall with a cream-and-terracotta marquee, signboard, miniature judging podium and cheerful audience stalls. Original cooking-show atmosphere, not a reproduction of any TV program's set or branding.

**Interior:** up to **12 contestants visible at once**, each representing a **cadence**, not an individual contact. Extra cadences live in an accessible roster/pagination view.

**On selecting a contestant:** open cadence dashboard: name, goals, status, contacts, drafts created, actual emails sent, calls made, LinkedIn touches, replies, meetings, next action dates, overdue tasks, per-contact history, manual notes, call outcome and callback entry, **Open in Excel** / **Export XLSX**.

**Critical distinction:** `draft_created` and `email_sent` are separate events. Drafts do **not** advance email-sent cadences until a sent date is confirmed. Don't infer sends merely from opening a draft.

**Visual behavior:** contestants cook, look to judges, celebrate completed actions and appear thoughtful when a follow-up is overdue. These are symbolic states tied to tracker data, not fabricated performance metrics.

### D. Calendar Plaza — Upcoming Actions

**Exterior:** a large playful physical monthly calendar mounted on timber supports, beside a tile courtyard and small book/kiosk pavilion; oversized but integrated with architecture.

**Calendar:** true monthly grid, clear month/year navigation, small colored task chips by category (Email, Call, LinkedIn, Callback, Meeting), multi-cadence filtering, overdue counts, selected-day agenda and accessible text list alternative.

**Interaction:** clicking a date or event opens a detail panel: contact(s), cadence, channel, due date, context, prior actions, template file (if relevant), notes and **Start Now**. Email tasks route into the drafter with the appropriate context; calls and LinkedIn tasks become manual action panels.

**Character loops:** carefully timed climbing, painting date markers, pretending to nibble at a corner, dozing, and playful slips. These must **not** obscure the text or block clicks. Add reduced-motion mode.

### E. Changing Room — Avatar Customisation

**Exterior:** a little timber dressing house with a mirror/window, hanging fabric flags and a friendly sign.

**Avatar roster:**

1. **Young orange-clad ninja-inspired adventurer**, original design rather than a direct Naruto copy.
2. **Golden-haired martial-arts hero archetype**, original design rather than a direct Goku copy.
3. **Brown-curly-haired smiling avatar**, very light-brown skin, brown eyes, upbeat expression, blue/red football-inspired jersey (avoid unlicensed real club crest for redistribution).
4. **Black-curly-haired avatar**, light-brown skin, brown eyes, calm/nonchalant expression, black leather jacket.

Selecting an avatar changes **both the controllable village character and the main working character shown during dock/kitchen/calendar animations**. Background NPCs can remain unchanged.

### F. Settings Shrine

Ambient music On/Off and volume; SFX On/Off and volume; fullscreen/windowed; resolution/pixel-scale; reduced motion; data/output directories; performance quality; preferred Outlook signature settings; view logs. All settings are local and persisted.

---

## 5. Controls, onboarding and UI behavior

### Login/start

- Start screen shows the island in the background with gentle water, lantern and NPC animation.
- Primary action: **Enter Village** (one local profile for v1); secondary: Settings and Quit.
- No cloud authentication required just to enter the local village. External services open their own authorised login windows when needed.

### Movement (LoL-like click to move)

- Left-click a reachable ground position: avatar travels there using pathfinding.
- Click a building: avatar walks to its entry point; when in range, the relevant area screen/overlay opens.
- Hover building: small readable nameplate + purpose; keyboard-focus equivalent.
- Optional Escape: close panels, return to village.
- Camera zoom: smooth focus transition to interiors, with **Return to Village** visible.
- Avoid default drag-to-move; the requested primary mechanic is **click-to-move**.

### Interface aesthetics

- Pixel-art cream parchment panels framed with muted-brown wood outlines.
- Flat-ish large readable labels, 9-slice pixel borders, modest drop shadows and rounded-square buttons.
- Use a highly legible UI font for data; a pixel/retro font is acceptable for display headings only.
- Buttons have visible keyboard focus; progress is not conveyed only by animation or color.
- Color-coded states: `running`, `waiting_for_user`, `completed`, `needs_review`, `failed`, `cancelled`.

### Persistent mini-HUD

At the edges of the world: current avatar, active jobs, counts, next due task, muted audio toggle, settings icon. Avoid a heavy corporate sidebar that overwhelms the village.

---

## 6. Animation system — synced to real jobs

**Never simulate progress as if work has been completed when it hasn't.** Characters may idle and loop while an API/browser/CSV operation is pending, but count changes only after actual backend events.

Suggested backend event contract (illustrative):

```json
{
  "job_id": "job-123",
  "module": "cognism",
  "state": "running",
  "stage": "reading_contacts",
  "completed": 20,
  "total": 140,
  "errors": 1,
  "message": "Processing page 2",
  "timestamp": "2026-10-23T13:00:00Z"
}
```

Recommended event states: `idle`, `awaiting_login`, `awaiting_user_selection`, `running`, `saving`, `complete`, `needs_review`, `failed`, `cancelled`.

For the dock: `running` maps to casting/catching fish; `saving` maps to sorting the catch; `complete` triggers boat return and emote. For the kitchen: `running` maps to cooking/plating; `saving` maps to sending dishes to the pass; `complete` triggers chef presentation and the **Drafts Created** summary.

**Failure UX:** pause the happy animation, show a small clear alert, preserve processed work, offer **Inspect Error** and safe Retry where possible. Never hide browser errors under a celebratory animation.

---

## 7. Blender & 2.5D asset production rules

### Model language

- Low-poly, cubic / chibi geometry with deliberately blocky proportions, soft bevels and a clean silhouette.
- Oversized cube heads; short box-like arms and legs; clear facial expressions readable even at small scale.
- Warm material roughness; painted low-resolution textures; subtle stepped shadows.
- No realistic human anatomy, complex PBR realism or high-poly geometry.

### Recommended production pipeline

1. Block out island topography and architecture at low detail in **Blender**.
2. Establish **one orthographic camera angle** and one consistent world lighting rig.
3. Build the four avatars with compatible skeleton/rig and proportions.
4. Animate character states with small readable gestures.
5. Render alpha-backed sprite sheets / layered PNGs from Blender for the game view; use live 3D only if performance and tooling justify it.
6. Implement world interactions and effects in a suitable scene renderer (PixiJS or Phaser). React handles forms, lists, tracker panels and file selectors.
7. Keep the original Blender `.blend` projects in source assets and export optimized runtime assets separately.

### Minimum environment assets

Island terrain, shallow/deep water, surf edge, rocks, dock boards, boat, fishing poles and fish; walkable ground tile variants, bridge, foliage, grass, palms, lanterns and benches; central plaza; tracker arena; izakaya/bar + counter + tables + neon-free warm signage; calendar wall and date chips; changing house; settings shrine; accessory props and NPCs.

### Minimum character animation clips

`idle`, `walk_4_or_8_direction`, `interact`, `celebrate`, `confused`, `fishing_cast`, `fishing_reel`, `boat_wobble`, `swim`, `chop`, `stir`, `cocktail_shake`, `serve_plate`, `calendar_climb`, `calendar_paint`, `sleep`.

**Keep scale consistent** among exported characters, doors and furniture. Create one art style guide and a reusable asset naming convention before producing many props.

---

## 8. Sound & music direction

Reference pieces supplied for mood (these are **directional references**, not approved redistribution assets):

- **Main village:** cozy, melodic early-Pokémon-village-like music.
- **Dock and sea:** relaxed surf/travel feeling inspired by *Pokémon Diamond & Pearl — Surf*.
- **Kitchen/bar:** bouncy, friendly hospitality energy inspired by *Club Penguin — Pizza Parlor / Charlie's Here* **and** *Pokémon X/Y — Coiffure Clips*.
- **Tracker arena:** playful competitive energy inspired by *Pokémon Black/White — Gym Leader Battle*.
- **Completion emote:** a charming original retro triumph chime, evoking the emotion of receiving a prized item in an adventure game.

**Release requirement:** commission/create original loopable compositions and SFX or license audio with the necessary rights. Do not package ripped game/YouTube music, recognizable signature melodies, or copyrighted character sound recordings in the desktop app.

Implement separate per-location music buses, transitions/crossfades, SFX/music sliders, mute, and a sensible low default volume.

---

## 9. Product/data boundaries

- In v1 there is **no merge building or merge tool**.
- Cognism import and Outlook drafting remain driven by existing authorised Python scripts; integrate them via a safe bridge, do not rewrite them blindly.
- A draft being created/saved is **not** evidence of a sent email. Track actual sends separately.
- Cadence schedules should depend on real confirmed sent timestamps, with manual override, and stop when a contact opts out/replies as appropriate.
- User can **open/export** a cadence to Excel; two-way Excel sync is **out of scope** for v1.
- Data stays local on each installation, one user profile per installation. Contact CSVs, browser profiles, logs and credentials must be excluded from Git and installation demo bundles.
- Python execution should remain visible, supervised when external website logins are necessary, and must not obscure permissions or compliance checks.

---

## 10. Build sequence for Codex

### Milestone 1 — Visual playable prototype (build this first)

- Electron app boots on macOS and Windows-targeted architecture.
- Render **one cohesive island** approximately following the supplied image's composition and the zoning above.
- Use placeholder original low-poly/pixel assets if Blender art isn't ready; do not block the prototype on finished art.
- Spawn one blocky avatar in Central Plaza.
- Click-to-move with pathfinding / collision avoidance.
- Click each named building and show a themed placeholder panel; Escape returns to world.
- Implement basic camera zoom/focus and resize handling.
- Show the palette and cozy purple dusk atmosphere from the outset.
- No live Python automation triggered in this milestone.

### Milestone 2 — Art vertical slice

- Produce Blender-quality Dock, avatar and boat with coordinated styling.
- Dock interaction transitions and idle/working/completion loops.
- Add low-volume original test music/SFX or silence placeholders.
- Validate visual readability at 1440×900 and 1920×1080.

### Milestone 3 — Dock and kitchen workflow integrations

- Connect real Python job events to animations and counters.
- Add cadence association and browser wait-for-user steps at Dock.
- Add file/template picker, signature selection, quantity and retry in Kitchen.
- Surface output file paths, results and failure logs.

### Milestone 4 — Tracker & Calendar

- Local cadence/contact/activity/task persistence (SQLite recommended internally, while continuing CSV/XLSX import/export).
- Cooking-contestant selection with per-cadence views and manual activity editing.
- Calendar monthly view with due tasks and Start Now actions.

### Milestone 5 — Polishing

- Four switchable avatars used in gameplay and module animations.
- Full buildings, ambient NPCs, soundscape, UI transitions, settings, motion accessibility and QA.
- Windows and Mac packaging and safe local data directories.

---

## 11. Acceptance checklist for the village concept

- [ ] The **whole coastal island** and all six destinations are recognizable in the main overview.
- [ ] The scene looks like **one explorable village**, not unrelated UI cards on a game background.
- [ ] The user's seven primary palette colors are prominent and accurate.
- [ ] The lavender/purple ambience complements warm cream/terracotta rather than overpowering them.
- [ ] Cube/chibi avatar is visible and can click-to-move around obstacles.
- [ ] Every building has a clear hover affordance, path entry and functional panel.
- [ ] Dock visually communicates fishing/contact collection.
- [ ] Kitchen visually communicates **late-night bar + working restaurant**, not only a generic kitchen.
- [ ] Tracker communicates the chef-competition metaphor and supports 12 visible cadence contestants.
- [ ] Calendar reads as a **real functional monthly calendar**, despite character animations.
- [ ] Changing avatar changes the active worker appearance in module animations.
- [ ] Real backend status is never misrepresented by a fake progress bar or success emote.
- [ ] Drafting completion wording is **“drafts created — check your drafts”**, never “emails sent.”
- [ ] The source image is treated as a **composition reference**; all production art and audio are original/licensed.
- [ ] Milestone 1 can be launched and demonstrated independently of Cognism/Outlook logins.

---

## 12. Initial prompt to Codex after placing this file in the repo

> Read `Tachy-on_Village_PRD.md` and this `concept.md`, and inspect `references/village_reference.png`. Treat the PRD as functional scope and `concept.md` as the authoritative **visual world design brief**. First propose a folder structure, scene graph, collision/pathfinding approach, camera strategy and asset pipeline for an Electron + React + PixiJS (or Phaser, with justification) app. Then build **only Milestone 1**: a playable, visually coherent 2.5D coastal village overview with placeholder original assets, click-to-move avatar navigation, and clickable entrances for Dock, Bar/Drafter, Arena/Tracker, Calendar, Changing Room and Settings. Keep all current Python exporters/drafters untouched; do not start real external automations. Include run commands and acceptance checks. Prioritize the coastal village composition, the warm pastel palette, and the cozy purple-dusk mood over generic UI scaffolding.
