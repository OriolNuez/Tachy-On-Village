"""Test-only process. Real adapter with fake Outlook; never connects to a service."""
import contextlib
from pathlib import Path
import sys
from fake_outlook_browser import install, patches

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'backend/scripts'))
sys.path.insert(0, str(root / 'backend/workers'))
install()
import outlook_drafter
import outlook_worker

with contextlib.ExitStack() as stack:
    for item in patches(outlook_drafter):
        stack.enter_context(item)
    sys.exit(outlook_worker.main())
