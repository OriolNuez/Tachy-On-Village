"""Test process entry point; executes the real adapter with fake Playwright only."""
from pathlib import Path
import runpy
from fake_salesforce_browser import install

install()
runpy.run_path(str(Path(__file__).resolve().parents[2] / "backend/workers/salesforce_exporter.py"), run_name="__main__")
