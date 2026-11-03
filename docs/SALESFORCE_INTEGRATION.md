# Salesforce accounts integration

Authorized 3 November 2026 after the retro UI milestone. This explicitly supersedes the original Salesforce non-goal; it does not authorize Cognism or Outlook integration or live account tests during development.

## Repository integration plan and implementation

1. Retain the Electron/React app and existing dashboard. Connect **+ Add Accounts** in a cadence; the separate main-menu Salesforce landing page remains a future screen.
2. Keep `backend/scripts/account_exporter.py` in place. The requested `salesforce_exporter.py` did not exist, so `backend/workers/salesforce_exporter.py` is the new desktop entry point. The original exporter's URL, selector, Chrome channel, visible-list extraction and CSV columns remain intact. Optional output/profile, prompt, cancellation and progress hooks plus `finally` browser cleanup preserve standalone `python account_exporter.py` usage. The original CLI still uses its original profile and filename.
3. Run only the allowlisted Salesforce adapter via `child_process.spawn(executable, argumentArray, {shell: false})`. Electron main chooses script/profile/intermediate paths. Expose typed start/current/action/update IPC only; validate the registered top-level frame, exact renderer URL, argument count, cadence name, job ID and allowed action. Cognism and Outlook are not imported or allowlisted.
4. Stage the export under OS app-data, require a valid result and successful Python exit, validate the intermediate CSV, then append new Salesforce IDs using an atomic file replacement. Never merge on cancellation, nonzero exit, malformed/truncated protocol, malformed CSV or worker failure.
5. Verify merge/persistence, process lifecycle, IPC and UI using synthetic data, fake child processes and a fake Playwright browser. Keep live Salesforce verification separate.

## User flow

Open a cadence → **+ Add Accounts** → review confirmation → **Launch Salesforce**. In the external Chrome window, sign in and choose the desired territory/list. In Tachy-on choose **Ready to Export** when the rows are visible. After extraction, choose **Close Browser** to finish and merge. The Accounts table refreshes after saving. Totals distinguish account links found, new accounts added, duplicates skipped and extraction errors.

The original extractor reads the currently rendered account links; it does not paginate or scroll automatically. No API fetching or new selectors were added. A genuinely empty list reports zero; it cannot prove that the correct territory or list finished loading. Confirm list readiness in the browser before exporting.

The task panel shows real stages and processed-row counts. Opening Chrome, waiting for input and saving use indeterminate progress, not invented percentages. stdout protocol messages become readable log entries; stderr diagnostics are streamed with redaction. The latest 250 lines are retained in memory. Errors have a reviewer; there is no automatic retry. **Hide task** and Escape leave the worker running, with a task button available from the menu, cadence screens and village. Refreshing the renderer reconnects to the current main-process job.

## Setup and storage

The desktop uses `python3` from its launch environment on macOS/Linux, or `python` on Windows. Set **`TACHYON_PYTHON` to an absolute Python executable path** if the working Playwright environment differs. This configuration is read only by main; it is not a command string. Python 3.9.6 and installed Playwright were found on the current macOS machine. Playwright import/browser compatibility with the live Salesforce session still needs checking.

The chosen interpreter must have the `playwright` Python package, and Google Chrome must be installed because the original script uses `channel="chrome"`. If using a project virtual environment, setup is:

```sh
python3 -m venv .venv
```

Install Playwright using that environment's Python executable with `-m pip install playwright`, then configure `TACHYON_PYTHON` to its absolute executable path (`.venv/bin/python` on macOS/Linux, `.venv\Scripts\python.exe` on Windows). No dependencies or authenticated browser sessions are installed/launched by ordinary npm checks. The existing standalone exporter remains available with its original defaults.

| Data | Location |
| --- | --- |
| Final accounts | `<repository>/Tachyon/Cadences/<cadence>/Accounts/<cadence>_accounts.csv` in dev/local preview |
| Dedicated Salesforce browser profile | `<Electron userData>/browser_profiles/salesforce/` |
| Per-job intermediate export | `<Electron userData>/jobs/salesforce-<random>/accounts.csv` |
| Partial intermediate | Same job directory, `accounts.partial` |
| Atomic merge temporary/lock | Inside the target Accounts folder; removed after save |

The app does not reuse the exporter's historical `~/.tachyon_salesforce_chrome` profile or a personal Chrome profile. First use may need sign-in. `TACHYON_DATA_ROOT` continues to configure the local Tachyon root. Packaged builds require bundling `backend/scripts/account_exporter.py` and `backend/workers/salesforce_exporter.py` at `<resources>/backend`; an installer/Python bundle is not implemented in this milestone.

## Protocol, locking and cancellation

Worker stdout is versioned NDJSON (`v: 1`): `prompt`, `progress`, `result`, `cancelled`, or `error`. Commands over stdin are `ready`, `close_browser`, and `cancel`. The renderer cannot send raw stdin, choose a script, pass arbitrary arguments or specify paths. Electron parses split UTF-8/NDJSON lines, bounds line length, checks event ordering and count consistency, and never treats exit code zero alone as success. Known errors are mapped to safe messages; browser exceptions are not dumped because they can contain personal data or authentication details. Main also redacts paths, URLs, email addresses and common secret fields in logs.

One active Salesforce job reserves the profile in main, including while it waits for user input and while the result is being committed. A Python OS file lock additionally prevents workers in separate processes from sharing the app's profile. Electron uses a single-instance lock for its user-data directory. The short CSV commit has its own exclusive lock file to prevent competing app saves.

Cancel sends a structured command. A control reader sets a cancellation flag; browser operations remain on the Playwright thread. Checks occur before browser work, between row reads and before publishing the intermediate output. Browser cleanup runs in `finally`; the parent waits for actual process close before releasing the job. End-of-stdin also cancels, so loss of the app connection does not leave an invisible prompt. App quit requests cancellation and waits; closing a window during a task offers Keep open or Cancel task and quit.

If a blocking browser operation does not return within the 45-second grace period, main kills the worker, reports forced termination, and prevents further profile use in that app session. The external Chrome window may need to be closed manually before restarting. Once the atomic merge begins, cancellation is disabled until it finishes; the UI says it is saving. This is a short commit boundary, not a partially cancellable file write.

References: [Node spawn and process signals](https://nodejs.org/api/child_process.html), [Electron sender validation](https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages). Windows signals are not a substitute for graceful stdin-based cancellation.

## Merge and recovery guarantees

New IDs are appended; existing rows and extra columns are retained byte-for-byte, including an existing UTF-8 BOM and original row text. Added rows follow the existing column order, leaving extra columns blank. ID comparison supports Salesforce 15/18-character forms. Imported account names, IDs, HTTPS Salesforce URLs, CSV dimensions, size and worker row counts must validate. Files are limited to 5 MB / 10,000 account rows, matching the dashboard. Existing files without account IDs cannot be safely deduplicated and are rejected without modification; IDs are not guessed from names.

Intermediate files are written privately, flushed and atomically published before the Close Browser prompt. Only a completed worker can trigger the merge. Main writes a unique temporary file in the Accounts directory, flushes it, checks that the destination and directory have not changed, and renames it atomically. A final CSV is therefore either the old complete file or the new complete file. A cleanup or disconnected UI listener cannot change a committed job into a failed job. No other cadence CSV or outreach JSON is touched.

Normal completion, failure and cancellation remove the per-job temporary directory. An abrupt OS/app crash may leave intermediate directories, a merge temporary or `.accounts-merge.lock`; none is automatically resumed or merged. If a stale merge lock blocks saving, close other app instances and review/remove only that lock before retrying. A crash after atomic replacement may leave a successfully updated CSV without an in-memory completion message; re-export is deduplicated by ID. Task logs/history are session-only, not a durable job database. File-editor changes are checked before commit, but simultaneous edits by unrelated programs are not a supported multi-writer workflow.

## Tests and live-session checklist

```sh
npm run check
python3 -m unittest discover -s tests -p 'test_salesforce_worker.py' -v
npm run test:jobs
npm run test:cadences
npm run test:desktop
```

The Python test suite installs a fake Playwright module in its own process. The jobs Electron smoke test uses a separate test-only main entry point and executes the real adapter with that fake browser. Production has no mock-mode flag. Test records and profiles are temporary; the source tree receives no account data. Unit tests cover duplicates, byte preservation, malformed files, ID forms, symlinks, save locks, IPC sender/argument rejection, protocol framing, failures, graceful/forced cancellation and shutdown. No Cognism/Outlook execution occurs.

Still requires an explicitly authorized Salesforce run:

1. Chrome launch and any SSO/MFA flow using the dedicated profile; reopening should retain only that profile's session.
2. Territory/list selection and visibility with the existing selector, including whether pagination/virtualization limits the visible rows.
3. A small export with known account IDs, then a repeat export to verify zero added IDs and duplicate counts against the real list.
4. Ready to Export / Close Browser behavior, cancellation while waiting and while extracting, and app-quit cleanup with real Chrome.
5. Real filesystem permissions in the chosen cadence directory. Windows/Windows DPI, browser process cleanup on Windows, and installers remain unverified.

No live Salesforce session was launched during implementation. The village UI/navigation and Cognism/Outlook sources remain unchanged.
