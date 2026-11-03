"""Desktop-only adapter for the preserved Salesforce account exporter.

Version 1 NDJSON on stdout; redacted diagnostics on stderr. No browser is opened
on import. Paths are supplied by Electron main, never by renderer input.
"""
import argparse
import contextlib
import json
import os
from pathlib import Path
import queue
import signal
import sys
import threading
from typing import Dict, Iterator


class Cancelled(Exception):
    pass


def emit(kind: str, **fields: object) -> None:
    print(json.dumps({"v": 1, "type": kind, **fields}), flush=True)


class Controls:
    def __init__(self) -> None:
        self.cancelled = threading.Event()
        self.actions: queue.Queue = queue.Queue()

    def read(self) -> None:
        for line in sys.stdin:
            try:
                if len(line) > 1024:
                    raise ValueError("oversized command")
                data = json.loads(line)
                if data.get("v") != 1 or data.get("action") not in ("ready", "close_browser", "cancel"):
                    raise ValueError("invalid command")
                if data["action"] == "cancel":
                    self.cancelled.set()
                else:
                    self.actions.put(data["action"])
            except (ValueError, AttributeError):
                self.cancelled.set()
                return
        # Parent shutdown / disconnected pipe must not leave a hidden prompt.
        self.cancelled.set()

    def check(self) -> None:
        if self.cancelled.is_set():
            raise Cancelled()

    def wait(self, action: str) -> None:
        emit("prompt", action=action)
        while True:
            self.check()
            try:
                received = self.actions.get(timeout=0.1)
            except queue.Empty:
                continue
            if received != action:
                raise ValueError("Unexpected desktop action")
            self.check()
            return


@contextlib.contextmanager
def profile_lock(profile: Path) -> Iterator[None]:
    """OS lock survives app disconnect until this worker actually exits."""
    profile.mkdir(parents=True, exist_ok=True)
    with (profile / ".tachyon-worker.lock").open("a+b") as handle:
        if os.name == "nt":
            import msvcrt
            if handle.tell() == 0:
                handle.write(b"0")
                handle.flush()
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        else:
            import fcntl
            fcntl.flock(handle, fcntl.LOCK_EX | fcntl.LOCK_NB)
        yield


def run(output: Path, profile: Path, controls: Controls) -> Dict[str, int]:
    # This reviewed source has no top-level browser execution. Do not import the
    # unrelated Cognism or Outlook tools here.
    sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
    import account_exporter
    controls.check()

    partial = output.with_suffix(".partial")
    prompt_number = 0

    def prompt(_message: str) -> None:
        nonlocal prompt_number
        controls.check()
        prompt_number += 1
        if prompt_number == 1:
            controls.wait("ready")
        elif prompt_number == 2:
            with partial.open("r+b") as file:
                file.flush()
                os.fsync(file.fileno())
            controls.check()
            os.replace(partial, output)
            controls.wait("close_browser")
        else:
            raise ValueError("Unexpected exporter prompt")

    def progress(processed: int, counts: Dict[str, int]) -> None:
        controls.check()
        # Original exporter prints are redirected below; protocol always uses
        # the original stdout pipe, and never includes account names or URLs.
        with contextlib.redirect_stdout(protocol_stdout):
            emit("progress", processed=processed, counts=counts)

    protocol_stdout = sys.stdout

    def desktop_prompt(message: str) -> None:
        with contextlib.redirect_stdout(protocol_stdout):
            prompt(message)

    # Preserve standalone print behavior, but keep the adapter's stdout NDJSON.
    with contextlib.redirect_stdout(sys.stderr):
        return account_exporter.main(output=partial, profile=str(profile),
                                     prompt=desktop_prompt, check_cancel=controls.check,
                                     progress=progress)


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--profile", type=Path, required=True)
    args = parser.parse_args()
    if not args.output.is_absolute() or not args.profile.is_absolute():
        emit("error", code="protocol")
        return 1
    controls = Controls()
    signal.signal(signal.SIGTERM, lambda *_: controls.cancelled.set())
    signal.signal(signal.SIGINT, lambda *_: controls.cancelled.set())
    threading.Thread(target=controls.read, daemon=True).start()
    try:
        controls.check()
        with profile_lock(args.profile):
            counts = run(args.output, args.profile, controls)
            controls.check()
            emit("result", counts=counts)
        return 0
    except Cancelled:
        emit("cancelled")
        return 2
    except ImportError:
        print("Python Playwright is unavailable in the configured interpreter.", file=sys.stderr, flush=True)
        emit("error", code="dependency")
        return 1
    except Exception:
        # Playwright exceptions can contain account text, cookies and URLs.
        print("Salesforce browser/export failed. Check Chrome, login, the selected list and profile availability.", file=sys.stderr, flush=True)
        emit("error", code="browser")
        return 1
    finally:
        args.output.with_suffix(".partial").unlink(missing_ok=True)


if __name__ == "__main__":
    sys.exit(main())
