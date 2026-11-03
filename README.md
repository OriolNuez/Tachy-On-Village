# Tachy-on Village

A local-first Electron/React desktop application with a retro workspace for cadence folders, a monthly calendar, and supervised Salesforce/Cognism imports and an Outlook draft-only workflow. The existing PixiJS village remains available through **Explore village**; its map, movement and buildings are preserved.

**+ Add Accounts** runs the Salesforce workflow after confirmation. **+ Import Contacts** now runs Cognism with an explicit **Start Import** action after you prepare your list. The main-menu Salesforce page is an isolated viewing prototype; the main-menu Cognism shortcut and Emails remain **Coming Soon**. **+ Draft Emails** now opens a recipient/message preview and supervised Outlook draft task. No email sending is implemented.

## Run locally

Use Node.js 22.12+ and npm (verified here with Node 26.12.1 on macOS). Dependencies are pinned in the existing root package and lockfile.

```sh
npm ci
npm run dev
```

`npm run dev` starts the local renderer and Electron together. Opening the renderer URL in a regular browser cannot access cadence files. To run the built application:

```sh
npm run build
npm start
```

## Salesforce accounts

Open a cadence and select **+ Add Accounts → Launch Salesforce**. Sign in and select the territory/list in external Chrome, then use **Ready to Export** in the app. After extraction, choose **Close Browser** to merge new Salesforce account IDs and refresh Accounts. Existing records and extra CSV columns are preserved. The task panel provides live progress/logs, cancellation and error review.

Python with the `playwright` package and Google Chrome are required. The app uses `python3` on macOS/Linux or `python` on Windows. If your working tools use a different interpreter, set `TACHYON_PYTHON` to that interpreter's **absolute executable path** before launching the app. No shell command string is accepted. The current macOS system Python has Playwright installed, but no live Salesforce test has been run.

The app uses its own profile under Electron's OS app-data directory, so a fresh sign-in may be needed. The standalone account exporter retains its original profile and CLI defaults. See [Salesforce setup, cancellation, data safety and live-test checklist](docs/SALESFORCE_INTEGRATION.md).

## Cognism contacts

Open a cadence and select **+ Import Contacts → Launch Cognism**. Sign in to external Chrome, navigate to your desired contact list, then choose **Start Import** in the app. The task shows actual processed, verified-email, Diamond and error counts; the list total remains unknown. Chrome closes automatically after reading.

New contacts are merged by normalized email, keeping existing records and all Cognism fields. Missing emails and uncertain matches are flagged for review. Successful imports refresh Contacts immediately; cancellation or failed validation leaves the cadence file unchanged. No outreach starts. See [Cognism setup, matching rules and live-test checklist](docs/COGNISM_INTEGRATION.md).

## Outlook drafts

Open a cadence and choose **+ Draft Emails**. Review recipients, edit the subject/body, choose the batch size and signature setting, then approve the preview and **Launch Outlook**. Sign in and open Inbox in Chrome, choose **Start Drafting**, inspect Drafts, and select **Close Browser**.

To load a message from a file, place a UTF-8 `.txt` file in the repository’s `messaging/` folder, select it in **Prepare Outlook Drafts**, and click **Import .txt**. An optional first line `Subject: ...` fills the subject too. Then update and approve the preview.

The Outreach panel lists local draft attempts immediately, with contact search, subject and cadence-step filters. Choose a step number in the draft modal for new batches; older attempts appear as **Unassigned**. This is local history, not mailbox synchronization or Outlook thread detection. Step labels do not enable automatic follow-ups or bypass existing retry protection.

The original script checks only whether the subject appears in Drafts. The UI reports that separately from uncertain attempts; manually check each saved recipient, body and signature. Nothing is sent or scheduled. Durable attempt history prevents automatic retries after failures, cancellations and restarts. Prior standalone CLI logs are not imported. See [Outlook setup, safeguards and live-test checklist](docs/OUTLOOK_INTEGRATION.md).

## Cadence workspace

Development and local build previews use **`Tachyon/Cadences/` inside this repository**, as requested. The folder is created when the first cadence is created; merely listing a missing library does not write anything. A new cadence creates its `Accounts/`, `Contacts/` and `Storage/` directories and opens its dashboard.

```text
Tachyon/Cadences/<name>/
  Accounts/<name>_accounts.csv
  Contacts/<name>_contacts.csv
  Storage/<name>_outreach.json
```

Existing records are read from these files. Missing files show empty sections. Use **Refresh** after editing files outside the app. Calendar and Next Steps use only explicitly recorded events from the outreach JSON; no schedule is generated. See [file formats and boundaries](docs/CADENCE_UI.md).

`Tachyon/Cadences/` is ignored by Git. No sample cadence records are created in this folder. Tests use temporary synthetic libraries. Main-process configuration can override the Tachyon folder with an absolute `TACHYON_DATA_ROOT` environment variable; the renderer cannot change it. A future packaged build defaults to `Documents/Tachyon` because installation directories may be read-only; packaging is not part of this phase.

## Checks

```sh
npm run check          # TypeScript, ESLint, unit tests, production build
npm run test:python    # Python adapter tests with fake Playwright
npm run test:jobs      # Build + Salesforce Electron → real adapter → fake Playwright
npm run test:cognism   # Build + Cognism Electron → real adapter → fake Playwright
npm run test:outlook   # Build + Outlook Electron → real adapter → fake Playwright
npm run test:cadences  # Build + Electron menu/cadence/calendar smoke test
npm run test:desktop   # Build + village UI smoke test (no character walking)
```

Electron smoke tests need access to a desktop session. They isolate app profiles and cadence records, verify Python sources were not changed by the test, and write screenshots under ignored `artifacts/`. The jobs, Cognism and Outlook tests execute real adapters against fake Playwright modules; they do not launch Chrome or access live accounts. The other desktop tests never launch Python tools. macOS checks include the cadence layouts at 1366×768 and 900×650 and the preserved village controls. Windows, signed installers and Windows DPI remain unverified.

## Project structure

- `electron/`: lifecycle, trusted IPC handlers, bounded cadence filesystem service, Python jobs and atomic account/contact merges.
- `shared/`: typed cadence/job bridges and protocol validation.
- `frontend/DesktopApp.tsx`, `frontend/cadences/`: menu, library, modal, dashboard and calendar.
- `frontend/App.tsx`, `frontend/world/`: preserved explorable village and navigation.
- `frontend/jobs/`: confirmation, task progress/logs and error reviewer.
- `backend/scripts/`: standalone tools; Salesforce and Cognism exporters have optional integration hooks; Outlook remains unchanged.
- `backend/workers/`: allowlisted Salesforce, Cognism and Outlook desktop adapters. Outlook uses the unchanged script’s draft-only browser functions.

## Product documents

- [Product requirements](Tachy-on_Village_PRD.md)
- [Architecture, phased plan, and Phase 1 acceptance criteria](docs/IMPLEMENTATION_PLAN.md)
- [Project conventions](AGENTS.md)

Runtime contact files, browser profiles, credentials, and progress logs belong outside the source tree and must never be committed. The repository includes ignore rules for these artifacts.
The explicitly requested repository-local cadence folder is a local user-file workspace and is excluded from version control. Future operational databases and browser profiles still belong in OS app-data storage.

### Salesforce embedded viewing prototype

Open **Salesforce** from the main menu to try Territory Prospecting inside a native Electron WebContentsView. **Open in Chrome** remains visible. This temporary, isolated session does not share the exporter’s Chrome login and is cleared when you leave the screen. No extraction runs from this view.

See [prototype results and manual login checks](docs/SALESFORCE_PREVIEW.md).

## Next steps and editing

In a cadence, open **Next Steps → + Add next step**, choose Email, LinkedIn outreach or Call, and enter a title and date. These manual reminders appear in the cadence and global calendars with an activity icon and the cadence colour; no automation starts. Use the section’s **✎** toggle, then select a step title to edit or **Delete** to remove it. Choose **Done** to leave edit mode. Existing imported outreach events remain read-only.

Accounts and contacts each have one section-level **✎** toggle. In edit mode, select a name to edit it or use its Delete button. Edits preserve other CSV fields, including IDs, email verification and phone strings. Saves reject stale records; refresh if another process changed a file. Editing is blocked while a business job runs.

**Delete cadence** asks for confirmation and moves the entire folder into the hidden `Tachyon/.cadence-bin/<name>--<unique-id>/` recovery directory. It is absent from the app library and calendar. To restore it, close the app and move the archived folder back into `Tachyon/Cadences/`, restoring its original cadence name; do not replace an existing folder. Draft attempt history is retained separately. Individual record deletion does not delete Outlook drafts.

Next steps are saved locally in `Storage/<name>_steps.json`. There is no automatic outreach or scheduling based on draft creation.

Outreach uses the drafted-email list for tracking; the Sent column is removed. Use **✎** in the draft section to tick or untick **Replied** for an individual email. Reply marks persist per draft attempt in `Storage/<name>_replies.json` and appear in the section’s reply count. They are manual records, not Outlook detection; draft creation does not write a sent status.

Ticked emails also appear in the **Replied** section below the draft list, with contact, subject and cadence step. The same search and subject/step filters apply to both lists. Unticking an email removes it from Replied.
