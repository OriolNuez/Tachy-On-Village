"""Desktop adapter: original Cognism UI logic, typed progress, private temp output."""
import argparse
import contextlib
import io
import os
from pathlib import Path
import signal
import sys
import threading
from typing import Dict

from salesforce_exporter import Controls, Cancelled, emit, profile_lock


class SafeDiagnostics(io.TextIOBase):
    """Never forward raw exporter output: it contains names and browser errors."""
    def write(self, value: str) -> int:
        messages = {
            'Last page reached.': 'Cognism confirmed the last page.',
            'Clicking Next; waiting for different contact rows...': 'Waiting for Cognism pagination.',
            'Next-page control not found. Stopping.': 'Review: next-page control was not found; import may be partial.',
            'Next page was not confirmed after 25 seconds; stopping safely.': 'Review: next page could not be confirmed; import may be partial.',
            'No visible contact rows; stopping.': 'Review: no visible contact rows were found.',
            'Page signature did not change; stopping to avoid duplicates.': 'Review: unchanged page detected; import stopped safely.',
        }
        if value.strip() in messages:
            print(messages[value.strip()], file=sys.stderr, flush=True)
        return len(value)


def run(output: Path, profile: Path, controls: Controls, max_pages: int = 100) -> Dict[str, int]:
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
    import cognism_exporter
    controls.check()
    protocol_stdout = sys.stdout
    partial = output.with_suffix('.partial')

    def prompt(_message: str) -> None:
        with contextlib.redirect_stdout(protocol_stdout):
            controls.wait('ready')

    def progress(processed: int, counts: Dict[str, int]) -> None:
        with contextlib.redirect_stdout(protocol_stdout):
            emit('progress', processed=processed, counts=counts)

    args = argparse.Namespace(output=str(partial), profile_dir=str(profile), max_pages=max_pages)
    with contextlib.redirect_stdout(SafeDiagnostics()):
        counts = cognism_exporter.main(args, prompt=prompt, check_cancel=controls.check,
                                       progress=progress, preserve_rows=True)
    controls.check()
    with partial.open('r+b') as handle:
        handle.flush()
        os.fsync(handle.fileno())
    os.replace(partial, output)
    if max_pages == 100:
        print('Cognism uses a 100-page safety limit. Review the selected list for completeness.', file=sys.stderr, flush=True)
    # Original Cognism script closes Chrome automatically after saving.
    return counts


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument('--output', type=Path, required=True)
    parser.add_argument('--profile', type=Path, required=True)
    args = parser.parse_args()
    if not args.output.is_absolute() or not args.profile.is_absolute():
        emit('error', code='protocol')
        return 1
    controls = Controls()
    signal.signal(signal.SIGTERM, lambda *_: controls.cancelled.set())
    signal.signal(signal.SIGINT, lambda *_: controls.cancelled.set())
    threading.Thread(target=controls.read, daemon=True).start()
    try:
        with profile_lock(args.profile):
            counts = run(args.output, args.profile, controls)
            controls.check()
            emit('result', counts=counts)
        return 0
    except Cancelled:
        emit('cancelled')
        return 2
    except ImportError:
        emit('error', code='dependency')
        return 1
    except Exception:
        print('Cognism import failed. Check Chrome, login, visible list and profile availability.', file=sys.stderr, flush=True)
        emit('error', code='browser')
        return 1
    finally:
        args.output.with_suffix('.partial').unlink(missing_ok=True)


if __name__ == '__main__':
    sys.exit(main())
