# Button-based workspace — Phase 1

Authorized 3 November 2026. This temporary priority adds functional cadence browsing, folder creation, data viewing and a monthly calendar to the existing Electron/React app. The earlier PRD and village design remain the baseline for future integration. The village is preserved and loaded only when **Explore village** is selected.

**Subsequent milestone:** **+ Add Accounts** now opens the [Salesforce integration](SALESFORCE_INTEGRATION.md). It uses an explicit confirmation and supervised Python task. **+ Import Contacts** now opens the [Cognism integration](COGNISM_INTEGRATION.md); **+ Draft Emails** opens the [Outlook draft integration](OUTLOOK_INTEGRATION.md). The rest of this document describes the original file-viewing UI; the integration document governs new account writes and job IPC.

## Implemented behavior

The main menu has Existing Cadences, Salesforce, Cognism, Emails and Calendar. Existing Cadences and Calendar are connected; Salesforce also has an isolated viewing prototype. Cadence details follow the supplied `Plan_menu (1).jpeg`: Accounts on the left with Calendar/Next Steps below, Contacts in the middle and Outreach on the right. Narrower windows stack columns. Tables paginate at 25 rows; recorded events retain their titles and dates. Previous/next cadence buttons browse the folder list.

Create New Cadence creates directories only. It does not create CSVs, JSON records or events, and never overwrites an existing cadence. Names are 1–80 characters, start with a Unicode letter or number, and contain letters, numbers, spaces, underscores or hyphens. Leading/trailing spaces, path separators, dots, control characters and Windows device names are rejected. Duplicate comparison is Unicode-normalized and case-insensitive across platforms; requests in one app instance are serialized.

## Data files

All paths are beneath `Tachyon/Cadences/<name>/`. CSV files are UTF-8 with an optional BOM. Quoted commas, embedded newlines, escaped quotes and CRLF are supported. Headers are matched without case, spaces, underscores or hyphens. Files are capped at 5 MB and tables/events at 10,000 records each. Missing or empty files produce empty sections. Malformed, oversized, inaccessible or linked files display a warning while other sections remain usable. Invalid existing cadence folders are skipped with a warning.

| File | Columns displayed | Accepted source columns |
| --- | --- | --- |
| `Accounts/<name>_accounts.csv` | Account Name, Salesforce Link | Account Name (or Account / Name); Salesforce URL (or Salesforce Link / Link) |
| `Contacts/<name>_contacts.csv` | Name, Account, Position, Contacted | Name (or Contact Name); Company (or Account / Account Name); Job Title (or Position / Title); Contacted |
| `Storage/<name>_outreach.json` | Contact, Sent, Replied; recorded calendar events | JSON shape below |

CSV rows need names. Extra exporter columns remain untouched in the original file. The Salesforce integration appends new account IDs atomically; the Cognism integration appends contacts atomically with email-based matching; outreach remains read only, with no database import. A missing Contacted value displays **Unknown**. Outlook draft progress files are not interpreted as sent/replied data.

The outreach file may be a plain array of outreach records or an object with `outreach` and/or `events` arrays. This invented example illustrates the format; it is not installed as user data:

```json
{
  "outreach": [
    { "contact": "Alex Example", "sent": false, "replied": false }
  ],
  "events": [
    { "title": "Recorded planning session", "date": "2026-11-03", "contact": "Alex Example" }
  ]
}
```

Outreach records require a non-empty `contact` string. `sent` and `replied` accept booleans or recorded strings (including dates); missing/null/empty values display **Unknown**. Booleans display **Yes** or **No**. They are never inferred from contacts or draft data. Additional fields are ignored.

Events require a non-empty `title` and a real `YYYY-MM-DD` date; `contact` is optional. The cadence is derived from its folder, not an untrusted JSON path. Calendar is Monday-first, with previous/next month and Today controls. Each cadence has a distinct colour within the library, with its name also displayed. Next Steps lists explicitly recorded events dated today or later. There is no recurrence, automatic follow-up scheduling, event creation/editing, mailbox connection or external calendar sync in this phase.

## Desktop boundary

Filesystem access stays in Electron main. The preload exposes only `list`, `create`, `read`, `calendar`, and `openSalesforceLink`. Main validates the registered window, top-level sender frame, exact loaded URL, argument count and payload. No arbitrary filesystem path, IPC channel, command or Python entry point can be supplied by the renderer. This follows [Electron's sender-validation guidance](https://www.electronjs.org/docs/latest/tutorial/security#17-validate-the-sender-of-all-ipc-messages).

The cadence library, cadence directories, subdirectories and files reject symbolic links. Reads verify canonical containment and use bounded file reads. Creation never overwrites; failure cleanup removes only newly created empty directories. Account links open only after a user clicks them and only when the URL is HTTPS on `salesforce.com`/`force.com` or their subdomains, without credentials or custom ports. Other URLs are shown as unsupported. This opens a normal browser link; it does not run the Salesforce exporter.

Electron retains context isolation, renderer sandboxing, disabled Node integration, CSP, blocked navigation/window creation and denied permission requests. Native dialogs provide focus containment; Escape closes dialogs and restores focus. Every action is a DOM button. Reduced-motion preferences are respected.

## Verification and limits

Unit coverage includes folder persistence, duplicate/concurrent requests, invalid names/payloads, traversal, symbolic links, missing/malformed/oversized data, original exporter columns, unknown versus explicit status, quoted CSV, calendar leap days and Salesforce URL validation. Electron tests use only temporary invented data and verify the menu, keyboard modal behavior, creation, readback, dashboard stubs, refresh/navigation, recorded calendar events, resizing and reload persistence. The separate village smoke test checks rendering and UI/camera controls without walking the character.

The original UI milestone did not edit or execute Python scripts. The subsequent Salesforce milestone adds optional desktop hooks to the account exporter and tests it with fake Playwright; no live Salesforce session was opened. The later Cognism milestone adds optional hooks and a desktop adapter; the Outlook adapter now calls its unchanged standalone browser functions. Windows verification, packaging, event editing and automatic scheduling remain outside this delivery.
