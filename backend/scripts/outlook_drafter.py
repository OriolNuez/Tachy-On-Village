#!/usr/bin/env python3
"""Cognism CSV -> Outlook Web autosaved drafts (never sends).

After filling each draft, uses Ctrl+S to save in Outlook, then verifies
the subject is visible under Drafts, then returns to Inbox before the next draft.
An uncertain attempt is logged and NOT automatically retried.
"""
import argparse
import csv
import hashlib
import json
import re
from datetime import datetime, timezone
from pathlib import Path
from playwright.sync_api import sync_playwright


COLUMNS = ['Name','Job Title','Company','Company Domain','LinkedIn URL','Email',
           'Email Verified','Mobile Phone','Direct Phone','HQ Phone','Other Phone','Diamond Verified']
SUBJECT = 'Student enquiries at {university}'
SIGN_OFF = '''Best,
<Strong
'''
BODY = '''Hi {first_name},

I was looking at how {university} handles student enquiries during peak admissions periods.

Usually, universities run into massive response-time bottlenecks when high volumes overwhelm support teams. We recently partnered with higher education institutions to solve this—using IBM watsonx orchestrate to automate routine queries.

For example, we helped institutions improve first-time resolution by 40% and shift a massive portion of the administrative workload to automated self-service, heavily easing the pressure on support teams.

I put together a brief, 3-bullet breakdown showing how we scale this specific workflow for UK universities.

Open to a quick look?

Best,

'''
def insert_outlook_signature(page):
    print("  4/4 Inserting Outlook signature...")

    # Step 1: Open the Insert tab
    insert_tab = page.get_by_role(
        "tab",
        name="Insert",
        exact=True
    )
    insert_tab.click(timeout=10000)

    # Step 2: Open the Signature menu
    signature_button = page.get_by_role(
        "button",
        name="Signature",
        exact=True
    )
    signature_button.click(timeout=10000)

    # Step 3: Select your Default signature
    default_button = page.get_by_role(
        "menuitem",
        name="Default",
        exact=True
    )
    default_button.click(timeout=10000)

    print("  Default Outlook signature inserted successfully.")

def contacts(path):
    with path.open('r', encoding='utf-8-sig', newline='') as f:
        rows = list(csv.reader(f))
    if not rows:
        return []
    header = rows[0][0].strip().lower() in {'name', 'contact name', 'full name'}
    keys = [s.strip() for s in rows[0]] if header else COLUMNS
    result, seen = [], set()
    for row in (rows[1:] if header else rows):
        r = dict(zip(keys, row))
        email = (r.get('Email') or '').strip()
        name = re.sub(r'\s+', ' ', (r.get('Name') or '').strip())
        uni = re.sub(r'\s+', ' ', (r.get('Company') or '').strip())
        if not email or not name or not uni or not re.fullmatch(r'[^@\s]+@[^@\s]+\.[^@\s]+', email):
            continue
        if email.casefold() in seen:
            continue
        seen.add(email.casefold())
        result.append({'email': email, 'name': name, 'university': uni,
                       'subject': SUBJECT.format(university=uni),
                       'body': BODY.format(first_name=name.split()[0], university=uni)})
    return result


def first_visible(locators):
    for loc in locators:
        try:
            for i in range(min(loc.count(), 5)):
                obj = loc.nth(i)
                if obj.is_visible():
                    return obj
        except Exception:
            pass
    return None


def outlook_page(context):
    candidates = [p for p in context.pages if not p.is_closed() and 'outlook' in p.url.lower() and '/mail' in p.url.lower()]
    if not candidates:
        raise RuntimeError('Outlook Mail tab not found. Open the inbox in the automation browser.')
    page = candidates[-1]
    page.bring_to_front()
    page.wait_for_load_state('domcontentloaded')
    return page


def recipient_committed(page, address):
    """Recognise recipient chips in Outlook Web without assuming their dimensions.

    Outlook sometimes renders a chip as a wide div or a labelled button;
    the old 500px limit produced false negatives. Only accept non-editable
    elements (not the current text input or people-picker suggestions).
    """
    return page.evaluate("""(email) => {
      const target = email.trim().toLowerCase();
      const visible = el => !!(el.getClientRects().length) &&
        getComputedStyle(el).visibility !== 'hidden';
      const candidates = document.querySelectorAll(
        '[title], [aria-label], [data-testid], [role="listitem"], [role="button"], span, div'
      );
      for (const el of candidates) {
        if (!visible(el) || el.closest('[role="listbox"], [role="option"], [role="menu"]')) continue;
        if (el.matches('input, textarea, [contenteditable="true"]') || el.closest('[contenteditable="true"]')) continue;
        const attrs = [el.getAttribute('title'), el.getAttribute('aria-label'),
          el.getAttribute('data-email'), el.getAttribute('data-address')].filter(Boolean).join(' ');
        const ownText = [...el.childNodes].filter(n => n.nodeType === 3)
          .map(n => n.textContent).join(' ').trim();
        const combined = (attrs + ' ' + ownText).toLowerCase();
        if (!combined.includes(target)) continue;
        // A recipient should be in the upper part of the compose panel,
        // not in an Inbox message body or Drafts sidebar.
        const rect = el.getBoundingClientRect();
        if (rect.top > 420 || rect.top < 60) continue;
        return true;
      }
      return false;
    }""", address)


def recipient_diagnostics(page):
    """Log recipient-field structure without printing email values."""
    return page.evaluate("""() => [...document.querySelectorAll(
      'input, [contenteditable="true"], [role="combobox"], [role="listitem"], [data-testid*="recipient" i]'
    )].filter(el => el.getClientRects().length).slice(0, 25).map(el => ({
      tag: el.tagName, role: el.getAttribute('role'),
      label: el.getAttribute('aria-label'), placeholder: el.getAttribute('placeholder'),
      testid: el.getAttribute('data-testid'), editable: el.getAttribute('contenteditable')
    }))""")


# Recipient entry restored directly from the previously working batch_drafts script.
# The Outlook UI may not expose recipient chips to Playwright even after accepting Enter.
def fill_recipient(page, address):
    loc = first_visible([
        page.locator('[role="combobox"][aria-label*="To" i]'),
        page.locator('[role="textbox"][aria-label*="To" i]'),
        page.locator('input[aria-label*="To" i]'),
        page.locator('input[placeholder*="recipient" i]'),
        page.locator('input[placeholder*="email" i]'),
        page.locator('[aria-label="To"] [contenteditable="true"]'),
        page.locator('[data-testid*="recipient" i] input'),
        page.locator('[contenteditable="true"][data-testid*="recipient" i]'),
        page.locator('[role="combobox"][contenteditable="true"]'),
    ])
    if loc is not None:
        loc.click()
        page.keyboard.type(address, delay=25)
        page.keyboard.press('Enter')
        page.wait_for_timeout(500)
        return
    for labels in [page.get_by_text('To', exact=True), page.locator('[aria-label="To"]')]:
        for i in range(min(labels.count(), 4)):
            label = labels.nth(i)
            if not label.is_visible():
                continue
            r = label.bounding_box()
            if not r or r['width'] > 170 or r['y'] < 110:
                continue
            page.mouse.click(r['x'] + r['width'] + 70, r['y'] + r['height'] / 2)
            page.keyboard.type(address, delay=30)
            page.keyboard.press('Enter')
            page.wait_for_timeout(650)
            if page.get_by_text(address, exact=False).count() > 0:
                return
            raise RuntimeError('Could not confirm recipient entry.')
    raise RuntimeError('Could not locate recipient editor.')


def fill_subject(page, subject):
    loc = first_visible([
        page.locator('input[placeholder="Add a subject"]'),
        page.locator('input[aria-label*="subject" i]'),
        page.locator('input[placeholder*="subject" i]'),
        page.locator('[role="textbox"][aria-label*="subject" i]'),
    ])
    if loc is None:
        raise RuntimeError('Could not locate Subject field.')
    loc.fill(subject)
    if loc.input_value() != subject:
        raise RuntimeError('Subject field verification failed.')


def fill_body(page, body):
    loc = first_visible([
        page.locator('[aria-label="Message body"][contenteditable="true"]'),
        page.locator('[aria-label*="Message body" i][role="textbox"]'),
        page.locator('[contenteditable="true"][aria-label*="body" i]'),
        page.locator('[contenteditable="true"][role="textbox"]'),
        page.locator('[contenteditable="true"][data-testid*="editor" i]'),
        page.locator('[contenteditable="true"][data-placeholder*="message" i]'),
        page.locator('[role="document"][contenteditable="true"]'),
    ])
    if loc is None:
        raise RuntimeError('Could not locate message body editor.')
        loc.click()
    loc.fill(body)

    # Verify the actual email content
    import re

    expected = re.sub(r"\s+", " ", body).strip()
    actual = re.sub(r"\s+", " ", loc.inner_text()).strip()

    if expected not in actual:
        raise RuntimeError("Body verification failed.")

    print("  Email body verified successfully.")


def create_one(page, draft):
    new_mail = first_visible([
        page.get_by_role('button', name=re.compile(r'^new mail$|^new message$', re.I)),
        page.get_by_role('button', name=re.compile(r'new mail|new message|new email|compose', re.I)),
        page.get_by_role('menuitem', name=re.compile(r'new mail|new message|new email', re.I)),
        page.locator('[role="button"][aria-label*="New mail" i]'),
        page.locator('button[title*="New mail" i]'),
        page.locator('[data-testid*="newMail" i]'),
    ])
    if new_mail is None:
        raise RuntimeError('New Mail control not found; navigate to Inbox before retrying.')
    # Prevent a stale compose from being mistaken for a new one.
    if first_visible([page.locator('input[placeholder="Add a subject"]'),
                      page.locator('[aria-label="Message body"][contenteditable="true"]')]) is not None:
        raise RuntimeError('A compose window is already open. Inspect/save/close it manually before starting this contact.')
    new_mail.click()
    # Critical: verify we opened a COMPOSE view, not an Inbox newsletter or any other message.
    try:
        page.locator('input[placeholder="Add a subject"]').wait_for(state='visible', timeout=8000)
        page.locator('[aria-label="Message body"][contenteditable="true"]').wait_for(state='visible', timeout=8000)
    except Exception as e:
        raise RuntimeError('New Mail click did not open an editable compose window; stopped safely.') from e
    print('  1/3 Recipient')
    fill_recipient(page, draft['email'])
    print('  2/3 Subject')
    fill_subject(page, draft['subject'])
    print('  3/3 Body')
    fill_body(page, draft['body'])
    page.wait_for_timeout(2500)
    # Avoid pressing Send, Discard or uncertain Close controls.


def visible_inbox_folder(page):
    """Find Inbox navigation rather than matching random body text."""
    return first_visible([
        page.get_by_role('treeitem', name=re.compile(r'^Inbox(?:\s|$)', re.I)),
        page.get_by_role('link', name=re.compile(r'^Inbox(?:\s|$)', re.I)),
        page.locator('[data-folder-name="Inbox"]'),
        page.get_by_text('Inbox', exact=True),
    ])



def return_to_inbox(page):
    """Navigate using the Inbox *folder*, not an individual email.

    The Home toolbar's New Mail command is exposed in Inbox but may not
    be available when the Drafts folder is open.
    """
    inbox = visible_inbox_folder(page)
    if inbox is None:
        raise RuntimeError('Cannot locate the Inbox folder after verifying draft; stopping before next contact.')
    inbox.click()
    page.wait_for_timeout(1400)
    # The old compose editor must not still be open when starting a new draft.
    if first_visible([
        page.locator('input[placeholder="Add a subject"]'),
        page.locator('[aria-label="Message body"][contenteditable="true"]'),
    ]) is not None:
        raise RuntimeError('Compose editor is still open after returning to Inbox; inspect before continuing.')
    print('  Returned to Inbox; ready for next contact.')


def save_draft_shortcut(page):
    """Save the active Outlook compose message using the user's Ctrl+S shortcut.

    Focus the message editor (not browser chrome) to ensure Outlook receives it.
    This does not click Send or navigate to a message in the Inbox.
    """
    editor = first_visible([
        page.get_by_role('textbox', name='Message body'),
        page.locator('[contenteditable="true"][aria-label="Message body"]'),
        page.locator('[role="textbox"][contenteditable="true"]'),
    ])
    if editor is None:
        raise RuntimeError('Cannot focus message editor before Ctrl+S.')
    editor.click()
    page.keyboard.press('Control+s')
    page.wait_for_timeout(2200)


def verify_draft_subject(page, draft):
    """Conservative UI check; only mark confirmed when subject is in Drafts."""
    folders = [
        page.get_by_role('treeitem', name=re.compile(r'^Drafts(?:\s|$)', re.I)),
        page.get_by_role('link', name=re.compile(r'^Drafts(?:\s|$)', re.I)),
        page.get_by_text('Drafts', exact=True),
    ]
    drafts_folder = first_visible(folders)
    if drafts_folder is None:
        return False
    drafts_folder.click()
    page.wait_for_timeout(1500)
    subject = draft['subject']
    # Draft list may be virtualised; verify displayed subject, not a hidden editor.
    rows = [page.locator('[role="option"]'), page.locator('[data-convid]'),
            page.locator('[role="row"]')]
    for group in rows:
        try:
            for i in range(min(group.count(), 60)):
                row = group.nth(i)
                if row.is_visible() and subject in row.inner_text(timeout=1000):
                    return True
        except Exception:
            pass
    return False


def key(d):
    return hashlib.sha256((d['email'].casefold() + '\n' + d['subject']).encode()).hexdigest()[:24]


def read_log(path):
    if not path.exists():
        return {}
    try:
        obj = json.loads(path.read_text(encoding='utf-8'))
        return obj if isinstance(obj, dict) else {}
    except (ValueError, OSError) as e:
        raise RuntimeError(f'Cannot read progress log ({path}): {e}; fix this before continuing.')


def write_log(path, data):
    path.parent.mkdir(parents=True, exist_ok=True)
    tmp = path.with_suffix('.tmp')
    tmp.write_text(json.dumps(data, indent=2, ensure_ascii=False), encoding='utf-8')
    tmp.replace(path)


def main():
    p = argparse.ArgumentParser(description='Batch-create Outlook web drafts using Ctrl+S; never sends.')
    p.add_argument('csv', nargs='?', type=Path, default=Path('cognism_contacts.csv'))
    p.add_argument('--create', action='store_true', help='Create drafts; otherwise preview only.')
    p.add_argument('--limit', type=int, default=3, help='Maximum drafts this run; default 3, 0 for all remaining.')
    p.add_argument('--log', type=Path, default=Path('outlook_autosave_progress.json'))
    p.add_argument('--profile-dir', type=Path, default=Path.home()/'.outlook_cognism_browser')
    p.add_argument('--retry-email', default=None, help='Retry exactly this email only, AFTER manually removing/reviewing any prior incomplete draft.')
    args = p.parse_args()
    if not args.csv.exists():
        p.error(f'CSV not found: {args.csv}')
    if args.limit < 0:
        p.error('--limit must be 0 or greater')
    data = contacts(args.csv)
    done = read_log(args.log)
    pending = [d for d in data if key(d) not in done]
    if args.retry_email:
        matches = [d for d in data if d['email'].casefold() == args.retry_email.strip().casefold()]
        if not matches:
            p.error('--retry-email address is not in CSV')
        selected = matches
        print('EXPLICIT RETRY: inspect/remove previous partial draft before continuing.')
    else:
        selected = pending[:args.limit] if args.limit else pending
    print(f'Eligible: {len(data)} | Already attempted: {len(data)-len(pending)} | To process: {len(selected)}')
    for i, d in enumerate(selected, 1):
        print(f'  {i}. {d["name"]} <{d["email"]}> — {d["subject"]}')
    uncertain = [v for v in done.values() if v.get('status') != 'confirmed_in_drafts']
    if uncertain:
        print(f'WARNING: {len(uncertain)} attempts in log were not confirmed. Review them in Outlook before retrying.')
    if not args.create:
        print('PREVIEW ONLY. Add --create to run. Nothing is sent.')
        return
    if not selected:
        print('No new contacts to process.')
        return
    print('Creating DRAFTS only; no Send action. Verify IBM authorisation and recipients before use.')
    with sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            str(args.profile_dir.expanduser()), channel='chrome', headless=False,
            viewport={'width': 1440, 'height': 900}, accept_downloads=False)
        page = context.pages[0] if context.pages else context.new_page()
        page.goto('https://outlook.cloud.microsoft/mail/', wait_until='domcontentloaded', timeout=60000)
        input('Sign in if needed and open Outlook Mail. Press Enter once to start the batch...')
        for idx, d in enumerate(selected, 1):
            stamp = datetime.now(timezone.utc).isoformat()
            # Write BEFORE interacting: prevents unattended duplicate retries after crash.
            previous = done.get(key(d))
            done[key(d)] = {'email': d['email'], 'subject': d['subject'],
                            'status': 'attempt_started', 'attempted_at': stamp}
            if previous is not None:
                done[key(d)]['previous_attempt'] = previous
            write_log(args.log, done)
            try:
                page = outlook_page(context)
                print(f'\n[{idx}/{len(selected)}] Creating draft for {d["name"]} <{d["email"]}>')
                create_one(page, d)
                insert_outlook_signature(page)
                print('  Fields filled; pressing Ctrl+S to save draft...')
                save_draft_shortcut(page)
                done[key(d)]['status'] = 'ctrl_s_save_attempted'
                write_log(args.log, done)
                print('  Checking for draft in Drafts folder...')
                confirmed = verify_draft_subject(page, d)
                if confirmed:
                    done[key(d)]['status'] = 'confirmed_in_drafts'
                    done[key(d)]['confirmed_at'] = datetime.now(timezone.utc).isoformat()
                    print('  Confirmed subject visible in Drafts.')
                    write_log(args.log, done)
                    # v6 behaviour preserved; only navigate back to Inbox for the next draft.
                    return_to_inbox(page)
                else:
                    done[key(d)]['status'] = 'draft_not_verified'
                    write_log(args.log, done)
                    print('  Could not verify draft in Drafts. Pausing batch to avoid duplicates.')
                    break
            except Exception as exc:
                done[key(d)]['status'] = 'uncertain_error'
                done[key(d)]['error'] = str(exc)
                write_log(args.log, done)
                print(f'ERROR: {exc}')
                try:
                    debug = Path('outlook_debug'); debug.mkdir(exist_ok=True)
                    page.screenshot(path=str(debug/'outlook_autosave_failure.png'))
                    print(f'Screenshot: {(debug/"outlook_autosave_failure.png").resolve()}')
                except Exception:
                    pass
                print('Stopped. Inspect Outlook Drafts before restarting; this contact is blocked in log to avoid duplicate.')
                break
        print('Finished. No emails sent. Browser left open for review; press Enter to close it.')
        input()
        context.close()

if __name__ == '__main__':
    main()
