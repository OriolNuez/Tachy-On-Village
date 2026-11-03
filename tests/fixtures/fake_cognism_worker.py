"""Test-only process: actual adapter and exporter loop, synthetic browser objects."""
import contextlib
from pathlib import Path
import sys
from fake_cognism_browser import install, patches

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root / 'backend/scripts'))
sys.path.insert(0, str(root / 'backend/workers'))
install()
import cognism_exporter
import cognism_importer

with contextlib.ExitStack() as stack:
    for item in patches(cognism_exporter):
        stack.enter_context(item)
    sys.exit(cognism_importer.main())
