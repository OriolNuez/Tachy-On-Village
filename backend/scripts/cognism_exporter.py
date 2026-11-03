"""Cognism visible-list reader with verified email, Diamond badge and automatic pagination.

Reads contact information available through enabled UI dropdowns. Does not
unlock/redeem information, use internal APIs, or override export permissions.
Use only with explicit authorisation to automate collection under your licence.

Install: python3 -m pip install playwright
         python3 -m playwright install chromium
Run:     python3 cognism_dropdown_export_v6.py --max-pages 1
"""
import argparse
import csv
import re
import time
from pathlib import Path
from typing import Callable, Dict, Optional
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError

HEADERS = ["Name", "Job Title", "Company", "Company Domain", "LinkedIn URL",
           "Email", "Email Verified", "Mobile Phone", "Direct Phone",
           "HQ Phone", "Other Phone", "Diamond Verified"]


def text_lines(locator):
    return [s.strip() for s in locator.inner_text().splitlines() if s.strip()]


def visible_rows(page):
    return page.locator('tr.ant-table-row:visible:not([nz-table-measure-row])')


def read_dropdown(row, kind):
    """Open a Cognism ng-bootstrap dropdown and read actual displayed links."""
    css_icon = 'fa-phone' if kind == 'phone' else 'fa-envelope'
    section = row.locator('._email-phone-area')
    trigger = section.locator(f'button[ngbdropdowntoggle]:has(i.{css_icon})').first
    if not trigger.count() or not trigger.is_visible() or not trigger.is_enabled():
        return [], 'Unknown'
    trigger.click(timeout=5000)
    container = trigger.locator('xpath=..')
    menu = container.locator('[ngbdropdownmenu].show')
    try:
        menu.wait_for(state='visible', timeout=3000)
        entries = []
        if kind == 'phone':
            for item in menu.locator('._phone-container').all():
                link = item.locator('a._number[href^="tel:"]').first
                if not link.count():
                    continue
                value = (link.get_attribute('href') or '').removeprefix('tel:').strip()
                label_el = item.locator('._taxonomy').first
                label = label_el.inner_text().strip(' ()\n') if label_el.count() else 'Other'
                if value:
                    entries.append((value, label))
        else:
            statuses = []
            for item in menu.locator('._email-container').all():
                link = item.locator('a._email-text[href^="mailto:"]').first
                if not link.count():
                    continue
                value = (link.get_attribute('href') or '').removeprefix('mailto:').split('?')[0].strip()
                if not value:
                    continue
                entries.append(value)
                if item.locator('i._verified-email').count():
                    statuses.append('Yes')
                elif item.locator('i._unverified-email').count():
                    statuses.append('No')
                else:
                    statuses.append('Unknown')
        verified = 'Unknown'
        if kind == 'email' and entries:
            # Do not label an email unverified merely because no badge appears.
            verified = statuses[0] if len(set(statuses)) == 1 else 'Mixed/Unknown'
        return entries, verified
    finally:
        # Close dropdown with UI; no access to hidden content.
        if trigger.get_attribute('aria-expanded') == 'true':
            trigger.click(timeout=3000)


def parse_row(row):
    cells = row.locator('td')
    if cells.count() < 5:
        return None
    contact, company = cells.nth(1), cells.nth(3)
    cn, co = text_lines(contact), text_lines(company)
    if not cn:
        return None
    result = dict.fromkeys(HEADERS, '')
    result.update({'Name': cn[0], 'Job Title': ' '.join(cn[1:]),
                   'Company': co[0] if co else '',
                   'Company Domain': co[1] if len(co) > 1 else '',
                   'Email Verified': 'Unknown', 'Diamond Verified': 'Unknown'})
    links = contact.locator('a[href*="linkedin.com/in/"]')
    if links.count():
        result['LinkedIn URL'] = links.first.get_attribute('href') or ''

    # A diamond icon *in the dedicated purple badge* is distinct from an
    # icon in the phone popup (which may also contain fa-gem).
    badge = row.locator('._diamond-sticker:has(i.fa-gem)')
    result['Diamond Verified'] = 'Yes' if badge.count() and badge.first.is_visible() else 'No'

    phone_entries, _ = read_dropdown(row, 'phone')
    keys = {'mobile': 'Mobile Phone', 'direct': 'Direct Phone',
            'hq': 'HQ Phone', 'headquarters': 'HQ Phone'}
    for value, label in phone_entries:
        field = keys.get(label.lower(), 'Other Phone')
        current = result[field].split(' | ') if result[field] else []
        if value not in current:
            result[field] = ' | '.join(current + [value])

    emails, verified = read_dropdown(row, 'email')
    result['Email'] = ' | '.join(dict.fromkeys(emails))
    result['Email Verified'] = verified
    return result


def save(records, path):
    path = Path(path).expanduser()
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open('w', newline='', encoding='utf-8-sig') as handle:
        writer = csv.DictWriter(handle, fieldnames=HEADERS)
        writer.writeheader()
        writer.writerows(records)
    print(f'Saved {len(records)} rows to {path.resolve()}')


def page_signature(page):
    """Read the first page of visible rows to detect a real page transition."""
    rows = visible_rows(page)
    # Include several rows to avoid false changes from transient tooltip content.
    names = []
    for i in range(min(rows.count(), 5)):
        cells = rows.nth(i).locator('td')
        if cells.count() > 1:
            lines = text_lines(cells.nth(1))
            names.append(lines[0] if lines else '')
    return tuple(names)


def advance_page(page, previous_signature):
    """Wait for real, stable contact content after clicking Cognism Next."""
    next_link = page.locator('a[data-cognism="paginate-next-a"]:visible').first
    if not next_link.count():
        print('Next-page control not found. Stopping.')
        return False
    wrapper = next_link.locator('xpath=..')
    if (next_link.get_attribute('disabled') is not None
            or next_link.get_attribute('aria-disabled') == 'true'
            or 'disabled' in (next_link.get_attribute('class') or '').split()
            or 'disabled' in (wrapper.get_attribute('class') or '').split()):
        print('Last page reached.')
        return False

    print('Clicking Next; waiting for different contact rows...')
    next_link.click(timeout=5000)
    deadline = time.monotonic() + 25
    candidate = None
    stable_since = None
    while time.monotonic() < deadline:
        try:
            signature = page_signature(page)
            if signature and signature != previous_signature:
                if signature != candidate:
                    candidate, stable_since = signature, time.monotonic()
                elif time.monotonic() - stable_since >= 1.2:
                    print('New page confirmed: ' + ', '.join(signature[:2]))
                    return True
            else:
                candidate, stable_since = None, None
        except Exception:
            pass
        page.wait_for_timeout(250)
    print('Next page was not confirmed after 25 seconds; stopping safely.')
    return False


def main(args: argparse.Namespace, *, prompt: Callable[[str], object] = input,
         check_cancel: Callable[[], None] = lambda: None,
         progress: Optional[Callable[[int, Dict[str, int]], None]] = None,
         preserve_rows: bool = False) -> Dict[str, int]:
    records, seen, visited = [], set(), set()
    counts = dict(found=0, exported=0, duplicates=0, errors=0,
                  verifiedEmails=0, diamond=0, missingEmails=0)
    def report() -> None:
        if progress:
            progress(counts['found'], dict(counts))
    with sync_playwright() as p:
        context = p.chromium.launch_persistent_context(
            user_data_dir=str(Path(args.profile_dir).expanduser()),
            channel='chrome', headless=False)
        try:
            page = context.pages[0] if context.pages else context.new_page()
            page.goto('https://app.cognism.com/', wait_until='domcontentloaded')
            print('Open your Cognism saved list in this Chrome window.')
            prompt('Press Enter when you can see the contact rows: ')
            check_cancel()
            report()
            number = 1
            while number <= args.max_pages:
                check_cancel()
                rows = visible_rows(page)
                try:
                    rows.first.wait_for(state='visible', timeout=15000)
                except PlaywrightTimeoutError:
                    print('No visible contact rows; stopping.')
                    break
                # Guard against Angular temporarily showing old rows during pagination.
                signature = page_signature(page)
                if signature in visited:
                    deadline = time.monotonic() + 12
                    while time.monotonic() < deadline and signature in visited:
                        page.wait_for_timeout(400)
                        signature = page_signature(page)
                if not signature or signature in visited:
                    print('Page signature did not change; stopping to avoid duplicates.')
                    break
                visited.add(signature)
                count = rows.count()
                for i in range(count):
                    check_cancel()
                    counts["found"] += 1
                    try:
                        record = parse_row(visible_rows(page).nth(i))
                        if not record:
                            counts["errors"] += 1
                            report()
                            continue
                        identity = (record['Name'], record['Company'])
                        if preserve_rows or identity not in seen:
                            seen.add(identity)
                            records.append(record)
                            counts['exported'] += 1
                        else:
                            counts['duplicates'] += 1
                        if not record['Email'].strip():
                            counts['missingEmails'] += 1
                        if record['Email Verified'] == 'Yes':
                            counts['verifiedEmails'] += len(record['Email'].split(' | ')) if record['Email'] else 0
                        if record['Diamond Verified'] == 'Yes':
                            counts['diamond'] += 1
                        print(f'Page {number}, row {i+1}/{count}: {record["Name"]} '
                              f'email={bool(record["Email"])} phone={any(record[k] for k in ("Mobile Phone", "HQ Phone", "Direct Phone", "Other Phone"))} diamond={record["Diamond Verified"]}')
                    except Exception as exc:
                        counts['errors'] += 1
                        print(f'Page {number}, row {i+1}: error reading row: {exc}')
                    report()
                check_cancel()
                save(records, args.output)
                if number == args.max_pages or not advance_page(page, signature):
                    break
                number += 1
            check_cancel()
            return counts
        finally:
            try:
                save(records, args.output)
            finally:
                context.close()


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--output', default='cognism_contacts.csv')
    parser.add_argument('--profile-dir', default='~/.cognism-browser-profile')
    parser.add_argument('--max-pages', type=int, default=100, help='Safety limit; defaults to 100 pages, stops automatically at the final page')
    main(parser.parse_args())
