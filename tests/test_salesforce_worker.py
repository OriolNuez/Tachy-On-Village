import contextlib
import csv
import importlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tests/fixtures"))
sys.path.insert(0, str(ROOT / "backend/workers"))
from fake_salesforce_browser import install, contexts, Page, Accounts

install()
worker = importlib.import_module("salesforce_exporter")


class AutomaticControls(worker.Controls):
    def __init__(self, cancel_on=None):
        super().__init__()
        self.received = []
        self.cancel_on = cancel_on

    def wait(self, action):
        self.received.append(action)
        if action == self.cancel_on:
            self.cancelled.set()
        else:
            self.actions.put(action)
        super().wait(action)


class SalesforceWorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="tachyon-python-test-")
        self.root = Path(self.temp.name)
        self.output = self.root / "accounts.csv"
        self.profile = self.root / "profile"
        self.stdout = io.StringIO()
        self.stderr = io.StringIO()

    def tearDown(self):
        self.temp.cleanup()

    def run_export(self, controls):
        with contextlib.redirect_stdout(self.stdout), contextlib.redirect_stderr(self.stderr):
            return worker.run(self.output, self.profile, controls)

    def test_same_selector_browser_and_cli_csv_shape_with_explicit_actions(self):
        controls = AutomaticControls()
        counts = self.run_export(controls)
        self.assertEqual(controls.received, ["ready", "close_browser"])
        self.assertTrue(contexts[-1].closed)
        self.assertEqual(contexts[-1].profile, str(self.profile))
        self.assertEqual(counts, {"found": 4, "exported": 2, "duplicates": 1, "errors": 1})
        with self.output.open(encoding="utf-8-sig", newline="") as file:
            reader = csv.DictReader(file)
            self.assertEqual(reader.fieldnames, ["Account Name", "Salesforce Account ID", "Salesforce URL"])
            self.assertEqual(len(list(reader)), 2)
        events = [json.loads(line) for line in self.stdout.getvalue().splitlines()]
        self.assertTrue(all(event["v"] == 1 for event in events))
        self.assertEqual([event["action"] for event in events if event["type"] == "prompt"], ["ready", "close_browser"])
        self.assertNotIn("Example Existing", self.stdout.getvalue())
        self.assertFalse(self.output.with_suffix(".partial").exists())

    def test_cancellation_while_waiting_closes_browser_without_an_export(self):
        with self.assertRaises(worker.Cancelled):
            self.run_export(AutomaticControls("ready"))
        self.assertTrue(contexts[-1].closed)
        self.assertFalse(self.output.exists())

    def test_cancel_after_export_leaves_only_intermediate_for_main_to_discard(self):
        with self.assertRaises(worker.Cancelled):
            self.run_export(AutomaticControls("close_browser"))
        self.assertTrue(contexts[-1].closed)
        self.assertTrue(self.output.exists())

    def test_selector_failure_closes_browser_and_writes_no_export(self):
        original = Page.locator
        Page.locator = lambda *_: (_ for _ in ()).throw(RuntimeError("fake selector failure"))
        try:
            with self.assertRaises(RuntimeError):
                self.run_export(AutomaticControls())
            self.assertTrue(contexts[-1].closed)
            self.assertFalse(self.output.exists())
        finally:
            Page.locator = original

    def test_empty_visible_list_is_reported_as_zero_not_invented_success_counts(self):
        original = Accounts.rows
        Accounts.rows = []
        try:
            self.assertEqual(self.run_export(AutomaticControls()), {"found": 0, "exported": 0, "duplicates": 0, "errors": 0})
        finally:
            Accounts.rows = original

    def test_profile_lock_prevents_two_workers_sharing_a_profile(self):
        with worker.profile_lock(self.profile):
            with self.assertRaises(OSError):
                with worker.profile_lock(self.profile):
                    self.fail("profile lock was not exclusive")

    def test_eof_and_invalid_commands_cancel_instead_of_leaving_hidden_prompts(self):
        for text in ["", '{"v":2,"action":"ready"}\n', '{"v":1,"action":"cancel"}\n']:
            controls = worker.Controls()
            previous = sys.stdin
            try:
                sys.stdin = io.StringIO(text)
                controls.read()
            finally:
                sys.stdin = previous
            self.assertTrue(controls.cancelled.is_set())


if __name__ == "__main__":
    unittest.main()
