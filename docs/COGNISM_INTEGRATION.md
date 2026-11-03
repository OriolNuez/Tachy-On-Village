# Cognism contact import

Open an existing cadence and choose **+ Import Contacts → Launch Cognism**. In external Chrome, sign in and navigate to the desired Cognism contact list. When its rows are visible, choose **Start Import** in Tachy-on. The exporter reads available visible information and closes Chrome automatically at the end. Successful validation and saving refresh the Contacts table. No email drafting or sending starts.

## Setup and boundaries

Use the same Python/Playwright/Google Chrome setup as the existing Salesforce integration. `TACHYON_PYTHON`, if provided, must be an absolute interpreter path. The Cognism profile is under Electron user-data `browser_profiles/cognism`, separate from Salesforce and from the standalone script’s default profile. A fresh login may be needed.

The existing runner launches only fixed Salesforce and Cognism adapter paths with `spawn`, argument arrays and `shell: false`. Renderer input supplies a validated cadence name, never a command, output path, profile or arbitrary script. Trusted top-level sender checks protect IPC. One job runs at a time; Python also holds an OS lock on the chosen profile. Neither startup nor navigation starts a job.

The actual standalone Cognism CLI remains:

```sh
python3 backend/scripts/cognism_exporter.py --output cognism_contacts.csv --profile-dir ~/.cognism-browser-profile --max-pages 100
```

This is a live command, not a test. Its argument names, defaults, CSV headers, login URL, selectors and pagination functions are preserved. Focused optional hooks provide the desktop prompt, cancellation and counters. The desktop adapter retains every parsed row for email-based deduplication, instead of applying the standalone name/company deduplication prematurely. Standalone behavior keeps its original deduplication.

## Progress and cancellation

The adapter uses versioned NDJSON and the existing stdin `ready`/`cancel` protocol. The app reports rows actually processed, explicit verified-email counts, explicit Diamond counts, missing emails and row failures. Cognism exposes no reliable total through this script, so the UI says **unknown** and uses an indeterminate indicator. Verified-email counts count addresses on rows whose source verification is exactly `Yes`; mixed/unknown rows are not promoted to verified. Counters describe extraction, including rows later skipped as duplicates.

Raw exporter prints contain contact names and browser exceptions. The adapter replaces them with structured count messages and allowlisted pagination diagnostics. Credentials, profile contents and browser sessions never cross the preload bridge. Local contact identity is shown only in the contact table and uncertain-match review, not in diagnostic logs.

Cancellation is checked between browser operations and before publishing the completed intermediate CSV. The browser closes in `finally`, including login, read and save failures. Slow browser operations may delay cancellation. The existing 45-second forced-stop fallback blocks further jobs until app restart; close any surviving Chrome window before restarting. No failed or cancelled job merges contacts. Once the atomic save begins, cancellation is disabled until it finishes.

## Contact persistence and matching

The source is written to a private job-directory `.partial` file, synced and renamed to an intermediate CSV only after the exporter returns successfully. Electron validates the exit/result and CSV before merging into:

```text
Tachyon/Cadences/<name>/Contacts/<name>_contacts.csv
```

All 12 Cognism columns are preserved: Name, Job Title, Company, Company Domain, LinkedIn URL, Email, Email Verified, Mobile Phone, Direct Phone, HQ Phone, Other Phone, Diamond Verified. Phone values remain strings. Verification strings retain the source meanings. Existing contact rows, Contacted state and custom columns are retained. Older schemas are extended with missing Cognism columns; CSV quoting/newlines may be normalized, but existing cell values are not overwritten.

- Email matching trims whitespace and normalizes Unicode/case. It does not remove dots or plus-tags. Every valid address in a ` | ` list participates in matching.
- Existing email matches are skipped, retaining the original record. Conflicting names/companies or partial multi-email overlaps are flagged for review.
- Missing/invalid email rows and multiple-email rows can be appended with an **Import Review** column. Name/company matches without an email match are flagged, not silently discarded. Exact repeated exported rows are skipped, including repeated email-less rows.
- The completion report shows processed/imported/duplicate/missing-email/failure counts and identifies uncertain rows by name, company, email and source record number. Flags on appended rows persist in the CSV. Details of skipped uncertain rows remain in the current task report until a new job or app restart; there is no durable review queue or automated conflict resolution in this milestone.

Writes use an exclusive merge lock, a same-directory temporary file, fsync, a re-check against concurrent edits and atomic rename. Duplicate-only runs leave existing bytes unchanged. Invalid CSV, unsupported verification, count mismatch, symbolic links, conflicting edits or write failures leave the target untouched. The existing 5 MB / 10,000-row limits apply. Temporary job files are cleaned up after the job. CSVs, merge locks/temp files and browser profiles are ignored by Git.

The existing pagination behavior may stop early if visible rows, a next-page control or a stable next-page signature cannot be found. Diagnostics explicitly flag those cases for review. The 100-page safety limit remains. Completion means the collected rows were saved; it does not guarantee the entire selected list was read. No retries or license/export-permission overrides are introduced.

## Verification and live checks still required

Automated tests use invented contact data and fake Playwright only:

```sh
npm run check
npm run test:python
npm run test:cognism
npm run test:jobs
```

Typecheck, lint, build, 70 TypeScript tests and 16 Python tests passed. The macOS Cognism Electron smoke check passed confirmation, waiting for Start Import, real adapter counters, profile exclusion, contact merge, review/error UI, immediate table refresh, cancellation and opening the existing Salesforce confirmation afterward. The existing Salesforce mock desktop workflow also passed with the shared runner changes.

Before relying on real imports, test your authorized Cognism session: Chrome login and profile reuse; navigation to your saved list; current dropdown selectors; verified/unverified/unknown and Diamond badge meanings; all phone and LinkedIn fields; real pagination and final-page detection; list completeness against the 100-page limit; cancellation during a slow read; a repeated import and review of ambiguous matches. No live Cognism session was executed during development. Windows behavior remains unverified. Salesforce/Outlook Python tools and village code were not changed by this integration.
