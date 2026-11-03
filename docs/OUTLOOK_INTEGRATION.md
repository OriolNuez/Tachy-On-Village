# Outlook draft integration

Open an existing cadence and choose **+ Draft Emails**. Review the exact recipients and expanded message, adjust the subject/body and batch size, and approve the preview. Choose **Launch Outlook**, sign in to the external Chrome window and open Inbox, then choose **Start Drafting** in the app. Inspect Outlook Drafts before choosing **Close Browser**.

This integration never sends messages. It does not change Contacted, Sent, Replied, outreach JSON or calendar schedules.

## What is reused

The standalone `backend/scripts/outlook_drafter.py` is unchanged, including its selectors and CLI. Its CLI accepts an optional CSV positional argument, `--create` (otherwise preview only), `--limit` (default 3; standalone 0 means all), `--log`, `--profile-dir`, and `--retry-email`. The desktop adapter calls its existing `outlook_page`, `create_one`, `insert_outlook_signature`, `save_draft_shortcut`, `verify_draft_subject` and `return_to_inbox` functions, preserving their order. The working Ctrl+S shortcut and “Default” signature selector are retained.

The desktop adapter replaces Terminal input with the existing versioned NDJSON/stdin ready/close/cancel protocol. It uses the shared Electron `spawn` runner with shell disabled and a fixed allowlisted adapter path. Only typed preview/start/action methods are exposed through the trusted preload bridge; no script paths, arbitrary files, browser cookies or credentials can be supplied by or returned to the renderer.

Use the existing Python + Playwright + Google Chrome setup. `TACHYON_PYTHON` selects an absolute interpreter path. The Outlook profile is separate under Electron user-data `browser_profiles/outlook`; personal Chrome, Salesforce and Cognism profiles are not reused. A fresh Microsoft/IBM sign-in may be needed.

## Preview and eligibility

The default subject/body are read as source text from the original script constants; preview never imports Python or opens a browser. The editor supports `{first_name}`, `{name}`, `{company}`, `{university}` and `{email}`. Unknown placeholders are rejected. The default body contains the original script’s claims and university-specific wording: review and edit these for the actual recipients. Messages are plain text.

The desktop defaults to three drafts and **Only explicitly verified emails**. Batch size is bounded to 1–100. Disabling that filter deliberately allows other verification states without relabeling them verified. Missing name/company, missing or multiple/invalid emails, Import Review flags, duplicates and opt-outs are excluded. `Opt Out`, `Do Not Contact` and `Unsubscribed` columns with `Yes`, `true`, `1` or `opted out` values suppress that email across cadence contact files. Unreadable contact files prevent preparation rather than silently skipping opt-out checks.

All selected recipients and their personalized subject/body are previewed before launch. Changes to settings invalidate the displayed approval. A short-lived, single-use main-process preview token binds the launch to the reviewed batch. Contacts, opt-outs and history are checked again at launch and when Start Drafting is clicked after login. Once drafting starts, that batch uses its approved snapshot; cancel if you need to change eligibility mid-batch.

Signature insertion is optional and uses the original “Default” selector. Turn it off if Outlook automatically inserts a signature; saved signature content still needs manual inspection. Use **Text files in messaging/ → Import .txt** to replace the message body from a UTF-8 text file in the repository’s root `messaging/` folder. An optional first line `Subject: Your subject` also replaces the subject; body-only files keep the current subject. Click **Refresh files** after adding files. Imports leave source files unchanged and clear the previous preview approval. Update and approve the new preview before launch. Files are limited to 80 KB and message bodies to 20,000 characters; symbolic links and paths outside the folder are rejected. Packaged builds use `Documents/Tachyon/messaging/`. Saving templates and alternate signature names are not included.

## Durable attempt history and cancellation

`<Electron userData>/outlook/attempts.json` stores cadence, name, email, subject, status and attempt time, keyed by a digest of cadence/email/message/signature settings. Python owns the ledger while drafting. It writes an attempt **before the first compose action**, using an exclusive temporary file, fsync and atomic rename. On macOS/Linux the containing directory is also synced. Private request files are removed with the job workspace after exit; the attempt ledger survives success, failure, cancellation and app restart.

States are intentionally distinct:

- `attempt_started`: the browser may have begun composing; a crash may leave an autosaved draft.
- `save_attempted`: Ctrl+S was attempted, but the subsequent draft check has not completed.
- `subject_visible_review_required`: the subject was found in Drafts by the original script; recipient, persisted body and signature still require review.
- `uncertain`: an operation failed or cancellation occurred after starting the attempt. Inspect Outlook before further action.

The original verifier checks **subject text only**. The app does not call this full verification or report these as sent. Completion says **Batch finished — review drafts**, and shows the number of subjects seen in Drafts separately from uncertain and skipped attempts. Full automatic saved-draft verification remains a future change requiring live validation.

Any prior desktop attempt blocks that email across cadences and edited templates. This conservative milestone has no retry/reset controls; it cannot silently retry an uncertain attempt. Reopen + Draft Emails to view durable history for the cadence. The initial desktop history is separate from standalone CLI logs: those logs are not imported. Inspect existing Drafts before the first desktop batch, especially if these contacts were already used with the standalone tool. Do not delete the attempt ledger to bypass review.

Only one job runs at a time. Python also holds OS locks on the Outlook profile and history directory. Cancellation closes the browser after the current operation returns and retains all attempts. A 45-second forced-stop fallback blocks further jobs until app restart; inspect Drafts and close any surviving browser first. Cancellation cannot roll back Outlook’s autosaves. Raw browser exceptions, contact-bearing prints and diagnostic screenshots are not streamed or captured by this adapter.

## Verification

Passed locally on macOS:

- Typecheck, lint, production build and 82 TypeScript tests.
- 26 Python tests using fake browser modules, including write-before-compose, uncertain saves, cancellation, failed history writes, no automatic retry, signature toggle, original function order and closing the context.
- Outlook Electron smoke test using the real adapter with a fake browser: editable preview/approval, explicit ready/close, progress, profile exclusion, persistent history, and retry blocking after app restart.
- Salesforce, Cognism and cadence desktop regressions with synthetic data only.

Commands:

```sh
npm run check
npm run test:python
npm run test:outlook
npm run test:jobs
npm run test:cognism
npm run test:cadences
```

No live Outlook session was used and no real drafts were created during development. Your first authorized live test should use one reviewed contact. Verify login and tenant navigation, recipient acceptance, personalized body/subject, Default signature behavior, actual Ctrl+S saving on your platform, Drafts visibility and returning to Inbox. Inspect the saved recipient/body/signature yourself. Also test cancellation and confirm that a previously attempted recipient is excluded after restart. Windows, packaging and enterprise SSO variations remain unverified.

## Dashboard history and filters

Outreach reads the durable Outlook attempt ledger through a read-only, cadence-scoped IPC method. It refreshes on progress and terminal job events, including failure and cancellation. Draft attempts remain separate from manually recorded sent/replied data. Filters select an exact subject and/or explicit cadence step, with contact/subject search. New batches persist a step and unique batch ID; legacy rows without step metadata remain Unassigned. These labels do not infer Outlook conversation threads, enable automatic follow-up drafts, or relax email-wide retry suppression.
