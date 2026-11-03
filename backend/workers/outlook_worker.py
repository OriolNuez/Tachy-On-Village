"""Draft-only desktop adapter; uses the preserved Outlook UI functions verbatim."""
import argparse
import contextlib
from datetime import datetime, timezone
import io
import json
import os
from pathlib import Path
import signal
import sys
import threading
import uuid
from typing import Dict
from salesforce_exporter import Controls, Cancelled, emit, profile_lock


def read_ledger(path: Path) -> dict:
    if not path.exists():
        return {}
    if path.is_symlink() or path.stat().st_size > 5 * 1024 * 1024:
        raise ValueError('Unsafe history')
    data = json.loads(path.read_text(encoding='utf-8-sig'))
    if not isinstance(data, dict) or len(data) > 10000:
        raise ValueError('Invalid history')
    for key, row in data.items():
        if not isinstance(key, str) or len(key) != 64 or not isinstance(row, dict) or not all(isinstance(row.get(k), str) for k in ('email', 'name', 'cadence', 'subject', 'status', 'attemptedAt')):
            raise ValueError('Invalid attempt')
    return data


def save_ledger(path: Path, data: dict) -> None:
    # Durable BEFORE browser mutation; never remove attempt records on cancellation.
    if path.is_symlink():
        raise ValueError('Unsafe history')
    text = json.dumps(data, ensure_ascii=False)
    if len(text.encode('utf-8')) > 5 * 1024 * 1024 or len(data) > 10000:
        raise ValueError('History limit exceeded')
    temporary = path.with_name('.attempts-' + uuid.uuid4().hex + '.tmp')
    try:
        fd = os.open(str(temporary), os.O_WRONLY | os.O_CREAT | os.O_EXCL, 0o600)
        with os.fdopen(fd, 'w', encoding='utf-8') as handle:
            handle.write(text)
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        if os.name != 'nt':
            directory = os.open(str(path.parent), os.O_RDONLY)
            try:
                os.fsync(directory)
            finally:
                os.close(directory)
    finally:
        temporary.unlink(missing_ok=True)


class QuietOutput(io.TextIOBase):
    def write(self, value: str) -> int:
        return len(value)


def run(request: Path, ledger: Path, profile: Path, controls: Controls) -> Dict[str, int]:
    # Reviewed source has no top-level browser behavior. Main CLI stays unchanged.
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
    import outlook_drafter as original
    data = json.loads(request.read_text(encoding='utf-8'))
    if data.get('v') != 1 or not isinstance(data.get('signature'), bool) or not isinstance(data.get('cadence'), str):
        raise ValueError('Invalid request')
    step = data.get('step')
    if step is not None and (type(step) is not int or not 1 <= step <= 100):
        raise ValueError('Invalid cadence step')
    drafts = data.get('drafts')
    if not isinstance(drafts, list) or not 1 <= len(drafts) <= 100:
        raise ValueError('Invalid batch')
    for draft in drafts:
        if not isinstance(draft, dict) or not all(isinstance(draft.get(key), str) and draft[key] for key in ('id', 'name', 'email', 'university', 'subject', 'body')):
            raise ValueError('Invalid draft')
    counts = dict(total=len(drafts), processed=0, subjectVisible=0, uncertain=0, skipped=0)
    done = read_ledger(ledger)
    controls.check()
    protocol_stdout = sys.stdout
    def report() -> None:
        with contextlib.redirect_stdout(protocol_stdout):
            emit('outlook_progress', counts=dict(counts))
    with original.sync_playwright() as playwright:
        context = playwright.chromium.launch_persistent_context(
            str(profile), channel='chrome', headless=False,
            viewport={'width': 1440, 'height': 900}, accept_downloads=False)
        try:
            page = context.pages[0] if context.pages else context.new_page()
            page.goto('https://outlook.cloud.microsoft/mail/', wait_until='domcontentloaded', timeout=60000)
            controls.wait('ready')
            report()
            for draft in drafts:
                controls.check()
                # Re-read before every attempt. Any prior attempt blocks this email across cadences/templates.
                done = read_ledger(ledger)
                if any(row['email'].casefold() == draft['email'].casefold() for row in done.values()):
                    counts['skipped'] += 1
                    counts['processed'] += 1
                    report()
                    continue
                attempt = dict(cadence=data['cadence'], name=draft['name'], email=draft['email'], subject=draft['subject'],
                               status='attempt_started', attemptedAt=datetime.now(timezone.utc).isoformat())
                if step is not None:
                    attempt['step'] = step
                if isinstance(data.get('batchId'), str):
                    attempt['batchId'] = data['batchId']
                done[draft['id']] = attempt
                save_ledger(ledger, done)
                stop = False
                try:
                    with contextlib.redirect_stdout(QuietOutput()):
                        page = original.outlook_page(context)
                        original.create_one(page, draft)
                        controls.check()
                        if data['signature']:
                            original.insert_outlook_signature(page)
                        controls.check()
                        original.save_draft_shortcut(page)
                        attempt['status'] = 'save_attempted'
                        save_ledger(ledger, done)
                        controls.check()
                        confirmed_subject = original.verify_draft_subject(page, draft)
                        if confirmed_subject:
                            # Subject alone does not verify recipient, persisted body or signature.
                            attempt['status'] = 'subject_visible_review_required'
                            save_ledger(ledger, done)
                            original.return_to_inbox(page)
                        else:
                            attempt['status'] = 'uncertain'
                            save_ledger(ledger, done)
                            stop = True
                except Cancelled:
                    attempt['status'] = 'uncertain'
                    save_ledger(ledger, done)
                    counts['uncertain'] += 1
                    counts['processed'] += 1
                    report()
                    raise
                except Exception:
                    attempt['status'] = 'uncertain'
                    save_ledger(ledger, done)
                    stop = True
                counts['subjectVisible' if attempt['status'] == 'subject_visible_review_required' else 'uncertain'] += 1
                counts['processed'] += 1
                report()
                if stop:
                    print('Draft outcome uncertain. Batch stopped; inspect Outlook before any further action.', file=sys.stderr, flush=True)
                    break
            controls.check()
            controls.wait('close_browser')
            return counts
        finally:
            context.close()


def main() -> int:
    parser = argparse.ArgumentParser()
    for flag in ('request', 'ledger', 'profile'):
        parser.add_argument('--' + flag, type=Path, required=True)
    args = parser.parse_args()
    if not all(path.is_absolute() for path in (args.request, args.ledger, args.profile)):
        emit('error', code='protocol')
        return 1
    controls = Controls()
    signal.signal(signal.SIGTERM, lambda *_: controls.cancelled.set())
    signal.signal(signal.SIGINT, lambda *_: controls.cancelled.set())
    threading.Thread(target=controls.read, daemon=True).start()
    try:
        with profile_lock(args.profile), profile_lock(args.ledger.parent):
            counts = run(args.request, args.ledger, args.profile, controls)
            controls.check()
            emit('outlook_result', counts=counts)
        return 0
    except Cancelled:
        emit('cancelled')
        return 2
    except ImportError:
        emit('error', code='dependency')
        return 1
    except Exception:
        print('Outlook task stopped. Inspect Outlook and durable attempt history before retrying. Drafts may already exist.', file=sys.stderr, flush=True)
        emit('error', code='browser')
        return 1


if __name__ == '__main__':
    sys.exit(main())
