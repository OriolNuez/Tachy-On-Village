# Tachy-on Village — project conventions

## Scope and current authorization

- Read `Tachy-on_Village_PRD.md` and `docs/IMPLEMENTATION_PLAN.md` before changing the application. The PRD is the product baseline; explicit user instructions determine the currently authorized scope.
- Current status: the user authorized Milestone 1 implementation on 23 October 2026. Implement the visual coastal village only; no further approval is needed for that scope. Read `Tachy-on_Village_Concept_Pack/concept.md` and its reference image for the authoritative visual direction, and `docs/VILLAGE_SCENE.md` for the scene design.
- After Phase 1 approval, implement only the playable village described in the plan. Future workflow integrations are separate milestones.
- Do not execute live Cognism or Outlook automation during setup, development checks, or ordinary tests. Live account tests require explicit authorization for that run.
- Walking, entering a building, launching the app, installing dependencies, and running tests must never start business automation.

## Repository and Python preservation

- The scaffold has `frontend/`, `assets/`, and `backend/scripts/`. Three scripts were added during planning on 23 October 2026 and inspected as source only: `cognism_exporter.py`, `outlook_drafter.py`, and `account_exporter.py`. No live behavior has been validated.
- `account_exporter.py` is a Salesforce exporter. Preserve it, but keep it outside the V1 application and worker allowlist: the PRD excludes Salesforce integration.
- Preserve any existing or subsequently supplied Python automation scripts, their filenames, selectors, input/output formats, and standalone usage. Never delete, move, overwrite, or bulk-format working scripts as part of scaffolding.
- Inspect automation source as text before considering import or execution; top-level code can have browser or account side effects.
- Add integration adapters under `backend/workers/`. Keep original scripts in place. If adapting interactive prompts requires changes, make a focused change in the integration phase, retaining CLI behavior and the known-good browser logic.
- Do not infer missing Cognism or Outlook selectors or replace the user's working automation with a speculative implementation.

## Application boundaries

- Use Electron for desktop lifecycle and native capabilities; React with strict TypeScript for accessible UI; PixiJS for the isometric village; Python for later local data and automation services.
- Keep Electron main/preload in `electron/`, React in `frontend/`, rendering and navigation in `frontend/world/`, Python in `backend/`, and shared IPC types/schemas in `shared/` when needed.
- React owns panels, focus, labels, and UI state. PixiJS owns its scene graph, camera, and frame updates. Do not update React state on every animation frame.
- Keep projection, pathfinding, collision, and movement logic independent of React, Electron, and business jobs so they can be tested without launching a browser.
- Map definitions declare building IDs, footprints, entrances, and walkable terrain. Rendering and navigation use the same definitions.
- Own and clean up PixiJS initialization, tickers, pointer listeners, resize handlers, and GPU resources across unmounts and development reloads.
- Add infrastructure when its phase needs it. Phase 1 has no Python process, SQLite database, job simulator, or live integration.

## Desktop and backend security

- Set `contextIsolation: true`, `sandbox: true`, and `nodeIntegration: false`; keep web security enabled and use a restrictive Content Security Policy.
- Load bundled application content in production and only the exact local development origin during development. Block unexpected navigation, window creation, and permission requests.
- Expose only small, typed, allowlisted preload methods. Validate IPC payloads and sender/frame origin in main. Never expose raw IPC, filesystem access, shell execution, arbitrary URLs, or command strings to the renderer.
- Later, launch only known Python entry points with argument arrays and no shell. Keep worker stdout exclusively for versioned NDJSON messages; send redacted diagnostics to stderr.
- In the proposed backend, a Python coordinator owns SQLite writes and checkpoints. Automation workers report events to it; React and workers do not independently mutate the database.
- Use per-tool browser profiles under the OS app-data directory. Do not reuse a personal browser profile or store credentials in application source.

## Data and workflow invariants

- Never automate Send. Outlook success means a verified saved draft and must use wording such as “Drafts created — check your drafts.”
- Keep drafted, sent, replied, failed, skipped, and uncertain states distinct. Sent/reply/meeting status requires a manual record or a separately authorized integration.
- Uncertain Outlook attempts require explicit review before retry. Preserve durable attempt records and stable idempotency keys.
- Progress and task animations reflect confirmed backend events. Ambient animation must not fabricate business counts or success. Any future developer simulator must be visibly labeled and isolated from real records.
- Draft creation alone does not start follow-up scheduling. Use confirmed sent dates or an explicitly chosen manual schedule. Respect contact opt-outs across cadences and configured reply/meeting stop rules.
- Preserve phone numbers as strings, source verification meanings, and the exporter's existing CSV columns. Unknown verification is not verified.
- Store operational data under Electron's OS-specific user-data location, passed to Python by main. SQLite is authoritative; CSV/TXT/XLSX are user files or snapshots, not bidirectional database synchronization.
- Never commit contact CSVs, spreadsheets containing contacts, databases, browser profiles, cookies, credentials, tokens, checkpoints, progress logs, diagnostic screenshots containing personal data, or runtime exports. Keep `.gitignore` current and inspect staged paths and content before any future commit; ignore rules alone are not a secret scanner.
- Use invented data in tests, preferably small JSON fixtures. Do not copy real contacts into examples, prompts, screenshots, or test reports. No unapproved external data sync.

## Visuals and accessibility

- Follow the PRD's plum/lavender dusk, warm cream, sage, terracotta, and lantern-yellow palette. Use original cube-like placeholders in Phase 1, with consistent ground anchors for later Blender sprite replacements.
- Keep essential text and controls in native DOM elements. Provide keyboard-accessible building controls, visible focus, Escape-to-close, and focus restoration for panels.
- Provide bounded camera pan/zoom and recenter controls. A drag must not also issue a move command; clicks on panels must not pass through to the world.
- Navigation must respect obstacles, water, entrances, and avatar clearance. Prevent diagonal corner cutting and handle unreachable targets without teleporting or entering blocked terrain.
- Respect reduced motion, resizing, and display scaling. Declare performance targets as targets until measured on named hardware.
- Ship only original or appropriately licensed assets. Named games, shows, and characters in the PRD are inspiration, not distributable assets.

## Tooling, changes, and verification

- Use one root npm project and a committed lockfile once scaffolding is approved. Verify supported Node/Electron/PixiJS/build-tool versions before choosing and pinning them; avoid adding dependencies without a concrete need.
- Use strict TypeScript, explicit types at boundaries, small cohesive modules, descriptive names, and centralized visual tokens. Use Python type hints for new backend code without reformatting preserved scripts.
- Keep macOS/Windows compatibility: no hardcoded home directories, shell-specific npm commands, or assumed Chrome paths and keyboard shortcuts.
- Document real setup and development commands in `README.md` once they exist. Do not describe planned commands or tests as already working.
- For Phase 1, run type/lint/build checks, focused navigation/camera tests, and an Electron smoke check. Check real window interactions where the environment permits. Report platform or GUI checks that were unavailable.
- Future worker tests use synthetic fixtures and fake processes. Never attach ordinary tests or install hooks to authenticated Cognism/Outlook sessions.
- Do not run broad rewrites or remove unrelated files. Report what changed, how it was checked, and remaining limitations. Do not claim Windows verification from macOS-only results.
