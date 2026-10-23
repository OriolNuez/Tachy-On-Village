# TACHY-ON VILLAGE

**Product Requirements Document (PRD) — Version 1.0**  
**Product type:** Local-first, game-like sales-workflow desktop application  
**Platforms:** macOS and Windows  
**Date:** 23 October 2026  
**Status:** Product definition / ready for UX and engineering discovery  
**Owner:** Local single-user application; distributable as individually installed desktop copies

> **Product promise:** A whimsical, explorable village where your avatar visibly works while real Python automations import prospects, prepare Outlook drafts and organise outreach cadences. The game never substitutes animation for factual progress, nor does it send outreach without deliberate user action.

## 1. Executive summary

Tachy-on Village is a polished desktop experience that transforms a fragmented prospecting workflow into an interactive Japanese-inspired, cube-character village. Instead of manually running scripts from Terminal, the user controls an avatar by clicking on a top-down/isometric world map, travels between themed locations and launches existing local automations through in-game menus.

The initial village includes **a fishing dock for Cognism imports**, **a lively late-night Japanese bar/restaurant for Outlook drafting**, **a cooking-competition-inspired arena for outreach cadence tracking**, **a giant interactive calendar plaza**, **a changing room for character selection**, and **a settings area**. Background workers and NPCs react to the actual state of tasks: casting a fishing line while contacts are extracted, preparing dishes while Outlook drafts are created, or marking days on the calendar as tasks are scheduled.

Tachy-on Village is **not an automatic email sender**. Its Outlook integration creates, verifies and saves drafts, then tells the user **“Drafts created — check your drafts.”** Sending, reply handling, call outcomes and meeting confirmations must be explicitly recorded or obtained through a separately authorised integration. The app is local-first, offers CSV and Excel-compatible exports, has one local profile, and supports distribution as separate macOS/Windows installations. Initial scope intentionally excludes ZoomInfo, Salesforce extraction, record-merging and automatic LinkedIn messaging.

### 1.1 Product decision summary

| Area | Confirmed direction |
|---|---|
| Product name | **Tachy-on Village** |
| Experience | Actual explorable, Pokémon-village-inspired game map; not merely a themed dashboard |
| Visuals | 3D cube/voxel-like characters, soft pixel aesthetics, Japanese cozy village, Blender-rendered assets |
| Primary interaction | Click-to-move avatar; click building or character to interact |
| Application | Electron desktop for macOS and Windows; local single-user profile |
| V1 tools | Cognism exporter, Outlook drafter, cadence tracker, monthly calendar, avatar changing room, settings, error review |
| Import | Cognism only at launch; manual sign-in and prepared list in browser |
| Outlook output | **Drafts created**; no automatic Send |
| Templates | Local `.txt` messages plus in-game editor; variables supported |
| Tracker editing | In-app edits with open/export Excel; **not** two-way live Excel sync in V1 |
| Audio | Per-location cozy music and ambience; licensed or originally composed alternatives to named references |
| Data model | SQLite operational source of truth; CSV/TXT/Excel as interchangeable user files |
| Expansion | Other exporters and smarter AI personalisation reserved for later |

## 2. Problem, users and desired outcomes

### 2.1 Problem

The current workflow involves separate Python scripts, CSV folders, Outlook browser windows and manually maintained outreach activities. It works, but users must remember Terminal commands, choose files carefully, distinguish drafted versus sent emails, monitor failure logs and manually manage next-touch dates. Progress is not represented in one place, and the experience can feel technical rather than approachable.

### 2.2 Primary user

The initial product is for **one individual sales/prospecting user per local installation**, comfortable reviewing contacts and outreach but not necessarily comfortable editing Python. The person uses IBM-authorised Cognism and Outlook accounts in external browser sessions. Multiple separate installations can share the product, but V1 has no shared cloud workspace, role management or central authentication server.

### 2.3 Product goals

1. Launch working Cognism and Outlook workflows without entering shell commands.
2. Make long-running work engaging while showing truthful counts, current actions and errors.
3. Create/manage named cadences, with contacts and tasks linked to those cadences.
4. Give the user a dependable view of what was drafted, what was actually sent, and what is due next.
5. Enable local data review, manual notes, CSV/Excel exports and safe recovery from failures.
6. Establish a distinctive, expandable game world and a reusable Blender asset pipeline.

### 2.4 Non-goals for V1

- Automatic sending of emails, unsolicited bulk messaging or autonomous call placement.
- Automatic reading of Outlook replies or sent messages without a specifically approved integration.
- Scraping LinkedIn or automating LinkedIn outreach.
- ZoomInfo, Salesforce, merged-source deduplication or duplicate-review module.
- Multi-user cloud database, collaborative editing, team permissions, hosted account login or cross-device sync.
- Live bidirectional Excel database synchronisation.
- Original copyrighted game audio, characters or trademarked show branding bundled without rights.

### 2.5 Initial success measures (targets, not proven results)

| Metric | Acceptance target |
|---|---|
| End-to-end guided pilot | Import a prepared list, create verified drafts, associate contacts with a cadence, view upcoming tasks |
| Status accuracy | Display **drafted**, **sent**, **failed**, **skipped** as separate states; never label drafts as sent |
| Core workflow usability | Pilot user can complete import and draft setup without Terminal |
| Crash recovery | Every completed contact/draft event survives app restart; uncertain Outlook outcomes are flagged |
| Calendar quality | Tasks move or cancel after reply/opt-out/status update; no phantom completed actions |
| Game responsiveness | Aim for 60 FPS on a reasonable supported desktop, with scalable 30 FPS performance option |
| Process transparency | Every running tool has progress counts, current step, last update and accessible error log |
| Release quality | Mac and Windows packaged builds complete the same pilot acceptance suite |

## 3. Experience principles

**World first, utility always:** The map is the primary home screen, but gameplay never hides vital business status. **Real-world state drives animation:** A fish is caught on a genuine extracted record event; the kitchen serves a dish on a confirmed saved-draft event. **Safe by design:** No implicit Send, no automated LinkedIn actions, no silent duplicate retries. **Delight with restraint:** Playful easter eggs and slapstick do not interrupt user input or progress reporting. **Local ownership:** User files are accessible, exportable and stored on device. **Graceful fallback:** If game rendering is slow, all tools remain operable via plain accessible panels.

## 4. World, visual identity and controls

### 4.1 Village composition

The start screen shows a purple-tinged, cozy nighttime/dusk village in the background. On **Continue / Enter Village**, the camera reveals a contiguous, explorable world from a top-down or three-quarter isometric perspective. The landscape includes winding stone paths, bridges, lanterns, vegetation, tiny market stalls, warm interior windows, a coastline, a sushi/ramen restaurant, a small judging arena, a calendar monument and a changing room. The village must be legible in one overview and support camera panning or context-specific zoom for detailed scenes.

**Spatial layout (concept):** Northwest — changing room and quiet garden; northeast — grand calendar plaza; west/coast — Cognism dock and sea; centre — path junction and player spawn; southeast — late-night Japanese restaurant/bar; southwest — cadence competition hall; edge/accessible icon — settings shrine. Final placement is subject to 2.5D readability tests.

### 4.2 Input model

- Single left click/tap on walkable terrain initiates click-to-move; avatar paths around buildings and props using a walkable navigation grid/navmesh.
- Click a building to path to its entrance and interact on arrival. An immediate **Open** action is also available from a keyboard-accessible sidebar as a fallback.
- The pointer changes on interactable objects; hover reveals a concise label and animated highlight.
- Camera smoothly follows within bounds, supports zoom and a **Return to village** action.
- Escape closes modal, Space/Enter confirms focused button, and keyboard navigation supports complete non-game access.
- Character movement is purely interface navigation; **no automation starts merely because the player walks near a building**.
- While a job runs, a compact persistent job HUD remains visible throughout village exploration; users can open its detailed panel anytime.

### 4.3 Visual style and palette

Build cubic, low-poly/voxel-like figures, softened into a pixel-art feel with deliberately limited texture detail, warm dark-brown outlines and clean isometric shadows. Use 3D models and orthographic Blender renders to generate 2.5D sprite sheets. Avoid photorealism. Scale and render UI text natively for legibility, not as tiny bitmap lettering.

| Token | Hex | Primary use |
|---|---|---|
| Sage Green | `#9CAF78` | Landscaping, garden surfaces |
| Matcha Green | `#B8C58A` | Trees, grasses, secondary surfaces |
| Butter Yellow | `#F5D97C` | Lanterns, selected interactions, reward warmth |
| Warm Cream | `#F4E6BA` | Panels, cards, parchment, text backgrounds |
| Terracotta | `#D98B45` | Roofs, wood accents, bar stools |
| Peach Orange | `#E9AB67` | Window glow, signage, animation highlights |
| Muted Brown | `#8B6045` | Soft outlines, earth, typography accents |
| Dusty Red | TBD in art pass | Small priority accent, not errors alone |
| Twilight Lavender | **Proposed:** `#8F82B5` | Purple main-world sky, signage, portals |
| Deep Plum | **Proposed:** `#483E65` | Night shadows, map depth, dark-mode UI |

The requested **purple village** coexists with earthy warm pastels: plum-lavender dusk and selective purple architecture, not uniform saturation. Error/status colours must retain text labels and sufficient contrast; not depend on colour alone.

![User-provided cube-character visual reference](/mnt/data/image(1).png){ width=2.05in }

*Visual reference only: use its chunky cube proportions, simplified faces and gentle lighting as direction; develop original village assets rather than reproducing the image itself.*

### 4.4 Character roster and changing room

Four selectable prebuilt characters, each playable across the world **and serving as the main worker in all task-specific animations**:

1. A young orange-clad ninja-inspired adventurer (reference: early Naruto energy and silhouette).
2. A golden-haired martial hero (reference: Super Saiyan energy and exuberant poses).
3. Original character: light-brown skin, curly brown hair, brown eyes, broad smile, Barça-themed shirt/flag accessory.
4. Original character: light-brown skin, curly black hair, brown eyes, laid-back expression, leather jacket.

The first two are **creative references only**; licensed branded replicas require explicit rights. The distributable version should use original character names, costumes, emblems and hairstyles. Football club logos/crests may similarly need rights; a generic blue-and-red fan shirt is the default safe asset.

Changing-room flow: walk to shop → character carousel with 3D/spinning preview → preview idle/walk/emotes → **Equip** → save per local profile → all scene animations swap to the selected avatar. NPCs remain distinct regardless of player choice. Shared animation rigs and interchangeable meshes/textures reduce asset costs.

### 4.5 Audio direction

Audio references define the **mood**, not permission to redistribute recordings. For distributable builds, commission original tracks, use appropriately licensed music, or let the user import personally licensed local tracks. All SFX and music can be muted separately and volume-adjusted.

| Zone | Requested reference | Desired musical qualities |
|---|---|---|
| Main world | Cozy Pokémon village | Warm exploration melody; soft chiptune/marimba, mellow bells, gentle rhythmic loop |
| Dock / sea | “Surf” — Pokémon Diamond & Pearl | Breezy playful travel theme; water ambience, splashes, rod/boat cues |
| Kitchen/bar | “Coiffure Clips” — Pokémon X & Y | Chic lively lounge/bar energy with Japanese restaurant atmosphere |
| Kitchen/bar alternate | “Pizza Parlor / Charlie's Here” — Club Penguin | Bouncy cheerful food-service groove as selectable alternate inspiration |
| Tracker arena | “Gym Leader Battle” — Pokémon Black/White | Bright competitive tension, podium cues, triumphant stingers |
| Success | Zelda “Master Sword acquired” moment (reference) | **Original** short item-acquired fanfare; celebratory avatar presentation |
| Calendar | Gentle pencil/swoosh/percussion ambience | Small tactile sounds for climb, paint, bite, nap and event completion |

The user-provided video reference: https://www.youtube.com/watch?v=QKgcdV3vykU. Do not bundle/rip that recording absent a licence. Audio sliders: Master, Music, Ambience and SFX; per-scene override, mute persistence and Reduced Animation/Reduced Sound modes.

## 5. Information architecture and screen catalogue

| Screen / world location | Primary purpose | V1 entry |
|---|---|---|
| Welcome / local profile | Press Start, local profile identity, Continue | Initial launch |
| Village map | Discover services, move avatar, see active jobs | Post-welcome |
| Changing room | Equip character and preview animations | Building interaction |
| Fishing dock | Create/resume/no cadence, launch Cognism import | Building interaction |
| Sea/platform selection | Choose data provider (Cognism only) | Boat encounter |
| Fishing job HUD | Show extraction progress, results, pause/cancel and errors | When importer running |
| Japanese late bar / restaurant | Configure source CSV, message template, signature, batch | Building interaction |
| Kitchen job HUD | Show drafts created, skipped, uncertain, retries | When drafter running |
| Competition arena | See up to 12 cadence contestants, stats and due work | Building interaction |
| Cadence detail | View contacts, activities, call notes, next steps and Excel export | Select contestant |
| Calendar plaza | Month grid, due tasks, event detail and Start Now | Building interaction |
| Error reviewer | Redacted logs, failures, retry/safeguard decisions | HUD / settings |
| Settings | Audio, video, folders, privacy, browser sessions, accessibility | Settings icon/shrine |

### 5.1 Welcome screen

The purple village world runs gently behind the title. Display **TACHY-ON VILLAGE**, pixelated but readable title treatment, one local profile/avatar preview, **Enter Village**, Settings and Exit. “Login” is aesthetic/local-profile selection, **not** a false Microsoft/IBM authentication prompt; corporate sign-in happens only in the legitimate Cognism or Outlook browser window. If a future release adds an actual PIN/local profile lock, label it distinctly.

### 5.2 World HUD

Top edge: current character, village area, date, quiet audio settings. Corner HUD: current job and count (`20 / 140`), succeeded, failed, waiting-for-user and **View Log**. Corner tasks: next due call/email/LinkedIn action and count of overdue tasks. Panels appear on demand to preserve the world view; all progress displays are backed by actual backend events.

## 6. Dock / Cognism exporter requirements

### 6.1 Start flow

1. User click-to-moves to Dock; fisherman NPC greets them.
2. Choice: **New Cadence**, **Resume Existing Cadence**, or **Import Without Cadence**.
3. New: prompt for cadence name (required), objective (optional) and default cadence template (optional). Resume: searchable list of existing cadences; show stage, import count and status. No cadence: import contacts into an unassigned folder for later linking.
4. Show browser preparation disclosure: **“Open your authorised Cognism list, apply the filters you want and confirm the results are ready.”**
5. Character boards vessel and selects source at sea: Cognism active; other icons disabled/not yet available.
6. Tool opens authorised Cognism session via existing Python Playwright workflow. User signs in and prepares list in that browser.
7. In-app **Start Fishing** becomes active only after the app detects the intended list/table, or user explicitly confirms readiness when detection is ambiguous.
8. Extractor runs, emits genuine `contact_processed` and `page_advanced` events, checkpoints data, and reports counts. User may view job HUD/log or return to village. Browser manual prompts appear as actionable in-game notices.
9. On completion, boat returns to pier; selected avatar performs original reward pose and a legally cleared fanfare plays. Result overlay shows **contacts retrieved**, **verified emails**, **verified mobile numbers**, **eligible for drafting**, **unverified/unknown**, **failed/duplicates**, CSV location and **Open Contacts**.

### 6.2 Fishing animations

Idle rod cast/float; occasional fish nibble; boat rocking; fish caught and loaded into crate on contact event; gentle near-fall, falling into sea and swimming back (rare cosmetic event); sail home; original held-up prize reward. Cosmetic sequences are interruptible and never artificially delay a completed job. Count increments occur only from parser/job events, never from frame animations.

### 6.3 Extraction requirements

- Reuse the verified selectors and page-processing logic from the user's working Cognism exporter; refactor its prompts/prints to a structured event interface instead of rewriting scraping behaviour.
- Respect browser permission, authentication, licensed entitlements and explicit account/admin authorisation; no attempts to unlock unavailable data.
- Maintain phone values as strings with `+` preserved, avoid Excel numeric conversion errors, keep source metadata and provider-specific verification semantics separate.
- Record whether email is explicitly verified, unknown or absent. **Diamond Verified is not automatically equivalent to verified mobile** unless confirmed by the source's actual meaning.
- Store an import ID, source filename, provider, cadence association, processing time, file hashes and checkpoint state.
- `Start Fishing` must be idempotent per running job and disabled while the same session is already being processed.

### 6.4 Eligibility controls

Offer default **Email available** and optional **Verified email only** filters for drafting. Optionally surface Mobile available / provider-verified categories for call task planning. Users review and approve eligible records before creating Outlook drafts. Missing/uncertain verification is never silently treated as verified.

## 7. Late Japanese bar / Outlook drafter requirements

### 7.1 Environmental direction

Make the drafter a cozy **late-night izakaya/cocktail bar with an active restaurant**, rather than a basic kitchen. Warm lanterns, ceramic ramen bowls, sushi prep counter, wood countertops, cocktails and bar tricks share the space. The selected character is the main chef/bartender; background NPCs wash dishes, polish glassware, mix cocktails, deliver prepared plates, wipe counters and serve customers. Soundtrack direction: Coiffure Clips-inspired lively lounge by default, with optional Pizza Parlor-inspired alternative.

### 7.2 Draft creation flow

1. User walks to restaurant and interacts with bar counter.
2. **Choose CSV** from a themed local file picker scoped initially to the Tachy-on Village contacts/exports folder, with optional external file browse.
3. Show CSV preview: total contacts, valid emails, unknown/verified email status, missing required fields, duplicates and filter controls.
4. **Choose message template** from local `.txt` files, or **Create Your Own**. New template editor supports preview, save-as `.txt`, template title, subject and body. User can pick an existing file to edit (with confirm-before-overwrite).
5. Supported placeholders: `{first_name}`, `{name}`, `{company}`, `{university}`, `{job_title}`, `{email}` and approved optional contact columns. Preview resolved values with a real sample before enabling Start. Missing required values trigger warnings, not invented substitutions.
6. Signature controls: toggle on/off, Outlook signature name text field (default **Default**), test insertion on one draft. Warn if Outlook auto-inserts signatures so users do not duplicate one.
7. Draft quantity selector: **All** or exact N from `1` to eligible count. Also allow **Retry Specific Contact** searchable by name, company and email; require review/removal of uncertain/partial existing draft first.
8. Optional cadence binding: choose existing cadence or leave unassigned. The operation creates **draft events**, not email-sent events.
9. User reviews a confirmation summary (contact count, template, signature and target browser), then clicks **Start Cooking**.
10. Existing Outlook web automation fills To, Subject and Body, optionally inserts the named signature, uses the working save shortcut, verifies draft in the Outlook Drafts folder, and returns to Inbox between contacts.
11. User is prompted in-game for any necessary Microsoft sign-in or to ensure Outlook is ready. The UI can be minimised without silently bypassing this interaction.
12. The job shows progress, uncertain attempts and failure details. Completion displays **“X drafts created — check your drafts”** and **Open Outlook Drafts**.

### 7.3 Kitchen animations

Fish/file arrives as an order ticket, selected avatar chops and cooks; each successfully saved draft becomes a completed plate served by an NPC. Whisking/sushi rolling/cocktail shaking loops while filling. Bar tricks, glass polishing and dishwasher NPC loops continue as ambient scenery. Failed draft generates a non-alarming red order-ticket icon and a link to the Error Reviewer. Completion = celebratory dish presentation, original fanfare, and the exact counts; **never “emails sent”**.

### 7.4 Draft safety rules

- No `.click()` on Send, no automated mass-send, no background sending and no creating new drafts after uncertain failures without review.
- Preserve working Outlook browser selectors by wrapping rather than casually rewriting `outlook_drafter.py`.
- Use a status sequence: `queued → composing → fields_filled → signature_inserted_or_skipped → save_attempted → confirmed_in_drafts`, with failure/uncertain alternatives.
- A subject visible in Drafts is useful but not sufficient proof of correct recipient/body/signature; V1 one-draft acceptance verifies those fields, and full-batch results remain reviewable.
- Prevent accidental duplicate retry based on stable contact + cadence/template context and on-disk attempt logs; specific retry requires explicit action.
- `drafts created` is derived from confirmed draft entries; `sent` requires manual user confirmation or an authorised mailbox integration added later.

## 8. Competition arena / cadence tracker requirements

### 8.1 Concept

An original cooking-competition-inspired hall: contestants stand at preparation stations while stylised judges oversee a scoreboard. **Each contestant represents one cadence**, not one contact. Up to **12 contestants are visible at once**; if more than 12 cadences exist, paginate/change rounds without restricting actual database capacity. Avoid copying MasterChef logos, set design or branding in a distributable app.

### 8.2 Cadence creation and association

Cadences can be created at the Dock, the Arena or while drafting. Each has name, optional objective/goal, owner (single local user), start date, business-day template and status. Contacts can belong to multiple cadences through a junction table, with cadence-specific status and tasks. Importing or drafting does **not** prove a contact has been emailed or start a live follow-up sequence.

### 8.3 Contestant detail view

Opening a contestant shows: cadence name, purpose/goal, contacts count, source import(s), assigned template(s), total **drafts created**, **emails marked sent**, cold calls made, LinkedIn actions logged, replies, meetings booked, pending/overdue tasks, contacted coverage, next due work and overall status. Sections: **Overview**, **People**, **Activities**, **Tasks**, **Notes**, **Files & Export**, **Settings**.

Click a person to open a side sheet with name, title, company, email, available phones, LinkedIn URL, verification indicators, contact state, activity timeline and due tasks. Offer editable notes, call outcome, follow-up priority, next step, callback date, meeting details and opt-out. All manual changes appear in a timestamped activity history. Status categories include `not_started`, `drafted`, `sent`, `active`, `replied`, `meeting_booked`, `not_interested`, `opted_out`, `completed`, and `on_hold`; some are contact-cadence states rather than email states.

### 8.4 Activities and task rules

- **Email:** draft created; manually confirmed sent with date/time; replied; bounced; opted out. Draft creation cannot itself trigger downstream scheduled touchpoints unless the user explicitly starts a date-based cadence manually.
- **Call:** due, completed, no answer, voicemail, connected, wrong number, callback requested, not interested, meeting booked. Record number used, duration optional and notes.
- **LinkedIn:** connection planned, requested, accepted, message sent, replied or skipped. Actions recorded by the user; platform does not automate LinkedIn.
- **Meeting:** booked, occurred, rescheduled, cancelled, outcome notes.
- Reply, booked meeting, opt-out, disqualification and manually paused status stop or suppress remaining outreach tasks according to configured policy. Opt-outs apply across relevant cadences for that contact.
- User can explicitly edit the cadence's schedule and choose whether past tasks remain as historical missed items.
- Every update is reversible through manual correction with an audit event. Avoid silent changes to sent-date history.

### 8.5 Excel interoperability

Buttons **Export to Excel** and **Open in Excel** create a formatted `.xlsx` snapshot of cadence contacts, activities and tasks (separate tabs). In V1, Excel is a readable/editable external artifact **without automatic two-way sync**. The app database is authoritative; edits made outside the app do not silently flow back. A future **Import Changes** wizard may reconcile sheets as a separate, clearly scoped feature.

## 9. Calendar plaza requirements

A giant interactive pixelated monthly calendar is the world prop. The selected character periodically climbs its frame, paints dates, nibbles a corner, naps on top or slides down the side. Animations are background decoration and pause for user interaction.

The functional view is a readable **Monday-start month grid**, with previous/next month, Today, filters for cadence/channel/status, due-task counters and overflow controls. Tasks may be email follow-ups, cold calls, LinkedIn actions, agreed callbacks, meetings or manual to-dos. Each event carries cadence ID, contact(s), channel, due date/time, template `.txt` if relevant, context, prerequisite status and next action.

Click an event for a panel with specific action details and **Start Now**:

- **Email:** open drafter with preselected cadence, eligible people and named template; create drafts for review, no sending.
- **Call:** open person's record, show approved number and logging form; no automatic dialling by default.
- **LinkedIn:** show contact/profile link and manual action checklist; no scraping or automated messaging.
- **Meeting/callback:** view context, due time and note form; use external calendar only if separately approved in a future integration.

When no actual sent date exists, show **Waiting for sent date** instead of scheduling an outreach follow-up automatically. Use configurable weekdays, locale, time zone and optional UK holiday calendar (not all university calendars use the same dates). Overdue actions roll into an Overdue view without rewriting their original due date.

## 10. Recommended cadence template

Default template: **21-business-day university outreach**, editable and optional. “Day 1” means the first **confirmed sent email date**, not the draft date. Business-day offsets are stored as 0-based values.

| Step | Business-day offset | Channel | Task | Automatic action in V1 |
|---|---:|---|---|---|
| 1 | 0 | Email | Initial personalised outreach | Create draft; user confirms sent |
| 2 | 2 | Call | First cold call | Due-task reminder; user logs result |
| 3 | 4 | LinkedIn | Connection request | Manual action task |
| 4 | 7 | Email | Value-led follow-up | Prepopulate Outlook draft |
| 5 | 10 | Call | Second call | Due-task reminder |
| 6 | 13 | LinkedIn | Insight/nudge if connected | Manual action task |
| 7 | 16 | Call | Final call | Due-task reminder |
| 8 | 20 | Email | Close-the-loop | Prepopulate Outlook draft |

The UI may display these as **Days 1, 3, 5, 8, 11, 14, 17 and 21**. These are starting defaults, not universal sales best practices. Cadence automatically pauses for opt-outs, replies or meetings unless the user records an explicit follow-up agreement. UK direct-marketing/TPS/CTPS and corporate outreach rules remain applicable; show opt-out controls and do not assume consent from having contact data.

## 11. Data model and tracker schema

Use **SQLite as the application's local operational database** and maintain user-accessible CSV/TXT files in a predictable directory. This avoids relying on large mutable CSVs for linked states while preserving the user's existing workflows. Model contacts separately from cadence membership; the same person may appear in multiple cadences.

### 11.1 Core relational entities

| Entity | Key fields | Purpose |
|---|---|---|
| `local_profile` | profile_id, display_name, avatar_id, preferences_json | Single local profile and settings |
| `cadences` | cadence_id, name, description, goal, template_id, status, created_at, updated_at | Contestant/campaign record |
| `contacts` | contact_id, name, first_name, title, company, domain, email, mobile, direct, hq, linkedin, source, verification fields, created_at | Canonical people |
| `cadence_contacts` | cadence_id, contact_id, status, joined_at, stopped_at, stop_reason, sent_anchor_at | Many-to-many membership and per-cadence state |
| `templates` | template_id, title, file_path, subject, revision, updated_at | Local `.txt` message definitions |
| `imports` | import_id, provider, source_file, cadence_id (nullable), total, processed, valid_email, verified_email, verified_mobile, failed, started_at, completed_at | Import runs and audit |
| `draft_jobs` | job_id, cadence_id, template_id, source_file, signature_name, signature_enabled, total, success, failed, created_at, finished_at | Outlook run summary |
| `draft_attempts` | attempt_id, job_id, contact_id, recipient, subject, state, last_error, attempted_at, verified_at | Per-contact draft safety/duplicates |
| `activities` | activity_id, cadence_id, contact_id, channel, activity_type, outcome, performed_at, notes, provenance, template_id | Completed or recorded events |
| `tasks` | task_id, cadence_id, contact_id, step_id, due_at, due_date, channel, status, priority, context, template_id, created_at, updated_at | Upcoming actions/calendar |
| `call_notes` | note_id, contact_id, cadence_id, phone_used, outcome, body, callback_at, meeting_at, created_at | Structured call notes |
| `cadence_templates` | template_id, name, time_basis, stop_rules_json, active | Reusable sequence definitions |
| `cadence_steps` | step_id, template_id, step_index, business_day_offset, channel, action_name, message_template_id | Cadence timing |
| `job_runs` | job_id, tool_name, status, phase, current, total, last_event_at, log_path, error_code | Background process state |
| `settings` | key, value_json, updated_at | App and audio preferences |

### 11.2 Contact and cadence state semantics

`drafted` means saved as an Outlook draft; `sent` means user manually marked sent or an authorised integration confirmed a sent-mail event; `replied` means manually recorded or explicitly integrated; `meeting_booked` means a recorded meeting. `opted_out` prevents future outreach tasks; note that suppression must be upheld across cadences. **Do not infer opens, replies or meetings from a draft being present.**

### 11.3 Task shape

Each task stores at least `task_id`, `cadence_id`, `contact_id`, `step_id`, `channel`, `due_date`, `due_at` (optional), `status`, `context`, `template_id` (optional), `completed_at`, `outcome` and `manual_override`. `Start Now` uses these fields to route to the correct tool. When a task gets rescheduled, retain the previous due date in activity history.

### 11.4 CSV and Excel conventions

Cognism source schema remains compatible with the user's working exporter: Name, Job Title, Company, Company Domain, LinkedIn URL, Email, Email Verified, Mobile Phone, Direct Phone, HQ Phone, Other Phone, Diamond Verified. Add source/import metadata internally rather than breaking the existing parser. Export files always contain headers, UTF-8 BOM as appropriate for Excel compatibility, dates in ISO format for interchange, telephone strings preserved as text and explicit blank/Unknown values.

## 12. Architecture and implementation

### 12.1 Recommended technologies

- **Electron** for native desktop shell, OS menus, file dialogs, notifications and packaging.
- **React + TypeScript** for menus, overlays, form fields, calendar/tracker screens and application state.
- **PixiJS** for performant 2.5D village rendering, click-to-move and sprite animation; renderer selection can be revisited after prototype.
- **Blender** for modular low-poly voxel assets, characters and isometric animation exports.
- **Python + Playwright** as independent local worker processes calling the user's existing, authorised Cognism/Outlook logic.
- **SQLite** as canonical local state; CSV/TXT/Excel remain user-visible input/output formats.

### 12.2 Execution topology

```
Electron main process
  ├── secure preload + allowlisted IPC bridge
  ├── window management / native open-file dialogs
  ├── local SQLite access (main or controlled service)
  └── Python job supervisor
        ├── cognism_exporter worker → Chrome persistent profile
        ├── outlook_drafter worker → Chrome persistent profile
        └── cadence scheduler / export workers

React interface
  ├── PixiJS village + avatar sprites
  ├── overlays: dock, restaurant, arena, calendar, settings
  └── task HUD + Error Reviewer

Persistent files
  ├── data/tachyon.sqlite
  ├── imports/*.csv
  ├── templates/*.txt
  ├── exports/*.csv, *.xlsx
  └── logs/* (redacted)
```

### 12.3 Python job communication

Refactor console `input()` interactions into a bidirectional job protocol with newline-delimited JSON (NDJSON) over child-process stdio or an equivalent local IPC channel. Example events:

```json
{"job_id":"job-001","event":"waiting_for_user","step":"prepare_cognism_list","message":"Open the desired list in Chrome"}
{"job_id":"job-001","event":"progress","current":20,"total":140,"verified_emails":11,"failed":1}
{"job_id":"job-001","event":"contact_processed","contact_id":"local-uuid","status":"saved"}
{"job_id":"job-001","event":"complete","created":128,"failed":4,"skipped":8}
```

Commands: `start`, `continue`, `cancel_requested`, `open_log`, `retry_selected`, and `resume_checkpoint` when supported by the worker. Each worker reports process lifecycle separately from business status. `waiting_for_user` is **not** an error; a Chrome sign-in prompt is a genuine actionable event. UI progress counts cannot advance in the absence of matching backend events.

### 12.4 Desktop and browser lifecycle

Browser sessions use isolated per-tool persistent Chrome profiles, not the user's normal personal browser profile. Surface browser-opening events and guidance within the app. Packaging for macOS and Windows must bundle or install a supported Python runtime/worker executable and handle distinct Chrome executable paths. Test Windows shortcut behaviour separately: the user's verified Ctrl+S action is a requirement but should be feature-checked, not assumed cross-platform without testing. Users can keep the app running while an approved automation browser is open; browser prompts pause the game job and do not time out silently.

### 12.5 Security and privacy

Enable Electron `contextIsolation`, disable Node integration in renderer, allowlist IPC actions, validate file paths, and restrict Python execution to bundled worker commands rather than arbitrary shell strings. Do not place login credentials or tokens in game UI files. Support separate local browser profiles, optional OS-protected at-rest storage, controlled log retention, visible purge/export controls and minimal storage of email addresses/phone numbers. Logs must redact authentication artefacts and allow suppression of screenshots; screenshots can include personal information. No unapproved external data sync or bundled copyrighted audio. Corporate IT approval may be necessary for packaged browser automation and local prospect-data storage.

### 12.6 Failure and recovery

When a Python worker crashes, the app catches an exit event, persists the last confirmed checkpoint, paints its building as **Needs Attention** (not “job complete”) and opens Error Reviewer. Uncertain Outlook attempts must remain blocked until explicit manual review, to avoid duplicate messages. A rejected selector or unready webpage stops only that job, not the whole village. Import jobs can resume from saved source IDs/checkpoints; all persisted tasks are idempotent by stable keys. Closing the app while jobs are running requires user choice: Cancel safely or Keep Running? If background processing is not implemented in the packaged build, clearly warn that closing terminates running jobs; no promise of continued work after app exit.

## 13. Game asset / Blender production specification

### 13.1 Art pipeline

Construct modular voxel/cube characters and buildings in Blender with an orthographic/isometric camera. Use a shared rig for four equipable avatars to amortise animation costs. Bake lighting and render transparent sprite sequences for scalable PixiJS display. Use consistent world scale, colour tokens, 8-direction locomotion if budget allows (or 4-direction + mirrored variants in early builds), restrained frame counts and nearest-neighbour sampling for crisp results. Export `.png` sprite sheets with JSON atlases, keeping Blender `.blend` masters in source control or an asset repository.

### 13.2 Environment asset inventory

| Environment | Key assets | Required animation loops |
|---|---|---|
| Village | Paths, vegetation, roofs, lanterns, purple sky, signs, bridge, NPCs | Leaves, water, windows, idling villagers |
| Dock / sea | Pier, boat, fishing rod, crates, fish, water, sea markers | Sail, cast, wobble, catch, slip, fall, swim, return, celebrate |
| Izakaya/bar | Sushi counter, ramen kitchen, stools, cocktail tools, menus, serving hatch, NPCs | Chop, stir, flip, shake drink, bartend trick, plate, serve, wash, polish |
| Arena | 12 contestant stations, scoreboard, judge desk, trophy light | Contestant idle, judging, progress response, celebration |
| Calendar plaza | Giant climbable calendar, brushes, day tiles, signs | Climb, paint, nibble, nap, slide, date highlight |
| Changing room | Wardrobe, mirrors, platform, outfit pedestals | Equip, idle turn, emote preview |
| UX overlays | Warm-cream panels, retro buttons, tooltips, icons, progress HUD | Open/close, toast, success, error without blocking |

### 13.3 Animation-to-event map

| Backend event | Visual reaction |
|---|---|
| `waiting_for_user` | Boat tied at dock; worker looks toward player; explicit Continue prompt |
| `import_started` | Boat launches and fishing loop begins |
| `contact_processed` | Fish caught/collected; count increments once |
| `import_failed` | Fish slips away; failed-count indicator and log link |
| `import_complete` | Boat returns; fanfare + numeric summary |
| `draft_started` | New order ticket in bar kitchen |
| `draft_confirmed` | Dish is plated and served; drafted count increments |
| `draft_uncertain` | Ticket moves to Review tray; process may pause |
| `cadence_updated` | Arena scoreboard/contestant animates briefly |
| `task_due` | Calendar day highlights with small animated brush cue |

Asynchronous animations may finish a current loop before switching, but must never imply a success state until the corresponding event exists. All audio loops require fade-in/fade-out, mute support and reduced-motion alternatives.

## 14. Accessibility, controls and UX details

- Keyboard-accessible equivalent to every world-only interaction; focus indicators in text panels, descriptive tooltips, sensible tab order, accessible labels for icons.
- Scalable UI text, high-contrast mode and Reduce Motion toggle; do not rely on pixel art for essential form labels.
- Reduced Motion stops slapstick and removes camera easing while retaining truthful job progress.
- Support at least common 1366×768 / 1440×900 desktop layouts, window resize and optional fullscreen; test macOS Retina and Windows DPI scaling.
- Localise dates/time zones and use platform-friendly native file pickers styled with in-game framing where feasible. A fully custom file browser is optional; correctness and OS access take priority.
- UI must always distinguish **queued, processing, waiting for user, saved, failed, skipped, not verified**.
- Buttons must not pretend to perform backend actions when their associated worker is unavailable.
- Persistent error inspector includes time, worker, phase, contact identifier (minimised PII), redacted log, and Retry/Ignore controls with clear consequences.

## 15. Functional requirements and acceptance criteria

| ID | Requirement | Minimum acceptance test |
|---|---|---|
| MAP-01 | Click-to-move avatar | Player travels to clicked reachable location without crossing buildings |
| MAP-02 | Enter locations | Clicking Dock/Bar/Arena/Calendar/Changing Room opens correct screen |
| AV-01 | Avatar selection | Equipping new avatar changes map avatar **and** task animations |
| IMP-01 | Cadence choice at Dock | New / Resume / Without cadence all persist correct association |
| IMP-02 | Cognism browser handoff | App waits for signed-in prepared list and user Start Fishing |
| IMP-03 | Truthful progress | Contact event increments processed count exactly once, errors counted separately |
| IMP-04 | CSV output | Imported names, email, phones, verification statuses and provenance retained |
| DRAFT-01 | Source/template selection | CSV/TXT picker and template editor provide accurate previews |
| DRAFT-02 | Personalisation | `{first_name}`, `{company}`, etc. resolve correctly for three sample contacts |
| DRAFT-03 | Signature configuration | On/Off + named Outlook signature tested; no duplicate insertion |
| DRAFT-04 | Save and verify | Draft appears in Outlook Drafts; next operation returns to Inbox safely |
| DRAFT-05 | Safe retry | Failed/uncertain contact not automatically regenerated without explicit approval |
| DRAFT-06 | Honest completion | Success states **“Drafts created — check your drafts”**; no Send action |
| CAD-01 | Contestant view | At most 12 visible at a time; all cadences reachable |
| CAD-02 | Person activity record | Call outcome, callback, reply, sent date and meeting updates persist |
| CAD-03 | Safe stop rules | Opt-out / meeting / reply suppresses future generic cadence tasks |
| CAL-01 | Monthly events | Due tasks appear on accurate business-day dates and can be filtered |
| CAL-02 | Start Now | Email launches prepared drafting; call opens notes; LinkedIn shows manual task |
| DATA-01 | Exports | Contact/cadence `.csv` and Excel `.xlsx` open with text-preserved phone numbers |
| SYS-01 | Crash recovery | Restart restores job checkpoint and pending/manual-review states |
| SYS-02 | Cross-platform | Signed macOS and Windows pilot builds execute all core flows |
| SYS-03 | Data hygiene | Logs redact tokens; local contact files are not sent to unapproved endpoints |
| A11Y-01 | Accessible fallback | Every module operable without physically moving character |

## 16. Release plan and dependencies

### Milestone 0 — Product/design lock

Approve village layout, character originality/licensing position, palette, sound direction, V1 cadence definition and the boundaries between drafts and actual sends. Create screen flows, motion storyboard and acceptance examples using anonymised contact data.

### Milestone 1 — Playable village vertical slice

Electron + React + PixiJS shell; one Blender-rendered world; one selectable avatar; click-to-move/pathfinding; Dock, Restaurant and Calendar clickable; basic HUD and faux event simulator. No live contact data at this stage.

### Milestone 2 — Secure Python bridge + Cognism

Convert real exporter to job events and user-controlled browser handoff; implement contact CSV preview and progress display; render dock fishing/boat animation driven by actual event data. Test permissions, pause and error recovery.

### Milestone 3 — Outlook drafter / bar

Integrate verified `outlook_drafter.py` with template `.txt`, signature toggle/name, counts, retry and progress log. Confirm draft-only behaviour, saved-draft validation, Inbox return and user-visible failure states. Add bar/kitchen gameplay loops.

### Milestone 4 — Tracker and calendar

Ship SQLite schema, contacts/cadences/tasks/activity screens, contestant arena, configurable business-day template, month calendar, manual call notes, meeting/opt-out states, and CSV/Excel export/open. Associate imported contacts and confirmed sent dates correctly.

### Milestone 5 — Avatar pack, polish and packaging

Add all four original/cleared characters, Changing Room, soundscape, NPC detail, extra emotes, accessibility and performance controls. Package macOS and Windows; test update path, first-run onboarding, install permissions and app data migration. Run final acceptance suite on both platforms.

### 16.1 Release gates

A release must not ship if: it can auto-send emails; it counts drafts as sent; it can silently duplicate uncertain Outlook attempts; a user cannot access the same tool without animation; a background process receives credentials insecurely; the package includes unlicensed Pokémon/Naruto/Dragon Ball/Club Penguin/Zelda/MasterChef audio/graphics; or it loses user cadence status on restart.

## 17. Risks, mitigations and unresolved questions

| Risk | Impact | Mitigation / decision |
|---|---|---|
| Outlook UI changes | Draft step breaks | Keep known-good logic, selectors isolated, diagnostic screenshots, single-draft smoke test |
| Cognism browser permissions/changes | Extraction interrupted | Explicit admin authorisation, manual login, progress/error review, no bypass logic |
| Game asset production scale | Expensive multi-avatar animation set | Shared rigs, animation reuse, limited base loops, rendered sprite sheets |
| Music/character/show references are copyrighted | Distribution restrictions | Original/licensed equivalents; named references used for mood only |
| User believes drafts are sent | Wrong cadence timing | Separate statuses, UI copy, manual sent-date confirmation |
| Excel edits diverge from app state | Inconsistent tracker | One-way V1 export/open; label Excel snapshot clearly |
| Mac and Windows automation differences | Parity failures | Platform-specific integration tests and input shortcut validation |
| Browser/network job freezes | Stale progress | Heartbeats, waiting states, timeout diagnostics and safe cancellation |
| PII in local database/screenshots | Privacy/security risk | Local permissions, redacted logs, retention controls, no unapproved cloud sync |
| UI animations cover failures | Misleading delight | Persistent foreground task HUD, errors accessible any time |

**Open for design validation, not blocking V1 PRD:** exact original avatar names/costume concepts; final purple-lavender value and map composition; licensed soundtrack sourcing or original compositions; installed Chrome profile strategy per organisation; whether first-run local profile needs a PIN; and whether holiday calendars are bundled or user-provided.

## 18. Example acceptance walkthrough

1. Start Tachy-on Village on macOS, view animated purple village and press **Enter Village**.
2. Visit Changing Room; equip the leather-jacket avatar and see it update across the map.
3. Click Dock, create cadence **University Student Experience — October**, choose Cognism, prepare the existing authorised list and click **Start Fishing**. Watch boat events track actual records. Complete and inspect valid/verified counts and saved CSV.
4. Click Restaurant; select CSV, open a `.txt` message template, preview resolved placeholders, toggle **Default** Outlook signature and choose three test drafts. Start cooking; confirm three saved Outlook drafts and **“3 drafts created — check your drafts.”** No email is sent.
5. Open Arena and see the new cadence contestant. Record the first email as **sent** manually with the actual send date (only after sending outside the app). Inspect the generated cadence tasks.
6. Visit Calendar; find the upcoming cold call, open **Start Now**, log No Answer with a callback date, and confirm updated future tasks.
7. Open Excel snapshot, return to app, verify manual app status remains authoritative. Restart the app and confirm job counts, avatar and cadence notes persist.
8. Deliberately simulate an Outlook selector failure; verify the job stops, records an uncertain attempt, displays an accessible error and does not automatically recreate the message.

## 19. Appendix: file organisation and naming

```text
Tachy-on-Village/
├── electron/                 # main process, preload, packaging
├── frontend/                 # React UI + PixiJS village
│   ├── world/
│   ├── modules/              # dock, bar, arena, calendar, wardrobe
│   └── components/           # HUD, dialogs, forms, error review
├── python_workers/
│   ├── cognism_exporter.py
│   ├── outlook_drafter.py
│   ├── tracker_engine.py
│   └── worker_protocol.py
├── assets/
│   ├── blender_sources/
│   ├── spritesheets/
│   ├── ui/
│   └── audio_licensed_or_original/
├── templates/                 # shipped example .txt templates
├── tests/
│   ├── fixtures_anonymised/
│   └── integration/
└── README.md

# At runtime, OS-specific app-data directory, not inside read-only install:
user_data/
├── tachyon.sqlite
├── browser_profiles/
├── imports/*.csv
├── messages/*.txt
├── exports/*.csv and *.xlsx
├── checkpoints/
├── logs/
└── preferences.json
```

**Next production artifact:** screen-by-screen UX wireframes and a Blender shot/animation breakdown based on this PRD, followed by a playable Electron vertical slice. This document is the scope baseline for that work.
