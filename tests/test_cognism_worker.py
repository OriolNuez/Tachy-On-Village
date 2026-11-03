import argparse
import contextlib
import csv
import importlib
import io
import json
from pathlib import Path
import sys
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'tests/fixtures'))
sys.path.insert(0, str(ROOT / 'backend/workers'))
sys.path.insert(0, str(ROOT / 'backend/scripts'))
from fake_cognism_browser import install, patches, contexts, records, Page
install()
worker = importlib.import_module('cognism_importer')
exporter = importlib.import_module('cognism_exporter')

class Controls(worker.Controls):
    def __init__(self, cancel=False):
        super().__init__()
        self.cancel = cancel
        self.prompts = []
    def wait(self, action):
        self.prompts.append(action)
        if self.cancel:
            self.cancelled.set()
        else:
            self.actions.put(action)
        super().wait(action)

class CognismWorkerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='tachyon-cognism-')
        self.root = Path(self.temp.name)
        self.output = self.root / 'contacts.csv'
        self.stdout, self.stderr = io.StringIO(), io.StringIO()
        self.stack = contextlib.ExitStack()
        for item in patches(exporter):
            self.stack.enter_context(item)
        self.stack.enter_context(contextlib.redirect_stdout(self.stdout))
        self.stack.enter_context(contextlib.redirect_stderr(self.stderr))
    def tearDown(self):
        self.stack.close()
        self.temp.cleanup()
    def test_real_loop_emits_exact_counts_keeps_same_name_rows_and_all_fields(self):
        controls = Controls()
        counts = worker.run(self.output, self.root / 'profile', controls)
        self.assertEqual(controls.prompts, ['ready'])
        self.assertEqual(counts, dict(found=4, exported=3, duplicates=0, errors=1,
                                     verifiedEmails=1, diamond=1, missingEmails=1))
        self.assertTrue(contexts[-1].closed)
        with self.output.open(encoding='utf-8-sig', newline='') as handle:
            reader = csv.DictReader(handle)
            self.assertEqual(reader.fieldnames, exporter.HEADERS)
            rows = list(reader)
        self.assertEqual(len(rows), 3)
        self.assertEqual(rows[1]['Direct Phone'], '001234')
        self.assertEqual(rows[2]['Email Verified'], 'Unknown')
        events = [json.loads(line) for line in self.stdout.getvalue().splitlines()]
        self.assertEqual(events[-1]['processed'], 4)
        self.assertNotIn('Alex Example', self.stdout.getvalue() + self.stderr.getvalue())
        self.assertNotIn('private details', self.stderr.getvalue())
        self.assertFalse(self.output.with_suffix('.partial').exists())
    def test_cancel_at_ready_closes_browser_and_never_promotes_partial(self):
        with self.assertRaises(worker.Cancelled):
            worker.run(self.output, self.root / 'profile', Controls(cancel=True))
        self.assertTrue(contexts[-1].closed)
        self.assertFalse(self.output.exists())
    def test_cancel_during_extraction_does_not_promote_partial(self):
        controls = Controls()
        original = exporter.parse_row
        def cancel_after_row(index):
            result = original(index)
            controls.cancelled.set()
            return result
        with patch.object(exporter, 'parse_row', cancel_after_row):
            with self.assertRaises(worker.Cancelled):
                worker.run(self.output, self.root / 'profile', controls)
        self.assertFalse(self.output.exists())
        self.assertTrue(contexts[-1].closed)
    def test_goto_failure_closes_browser(self):
        with patch.object(Page, 'goto', side_effect=RuntimeError('fake navigation failure')):
            with self.assertRaises(RuntimeError):
                worker.run(self.output, self.root / 'profile', Controls())
        self.assertTrue(contexts[-1].closed)
        self.assertFalse(self.output.exists())
    def test_save_failure_still_closes_browser(self):
        with patch.object(exporter, 'save', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                worker.run(self.output, self.root / 'profile', Controls())
        self.assertTrue(contexts[-1].closed)
        self.assertFalse(self.output.exists())
    def test_standalone_defaults_keep_name_company_deduplication(self):
        args = argparse.Namespace(output=str(self.output), profile_dir=str(self.root / 'profile'), max_pages=1)
        result = exporter.main(args, prompt=lambda _message: None)
        self.assertEqual(result['exported'], 2)
        self.assertEqual(result['duplicates'], 1)
    def test_empty_list_and_unknown_verification_do_not_invent_counts(self):
        original = records[:]
        records.clear()
        try:
            result = worker.run(self.output, self.root / 'profile', Controls())
            self.assertEqual(result['found'], 0)
            self.assertEqual(result['verifiedEmails'], 0)
        finally:
            records.extend(original)
    def test_two_confirmed_pages_report_monotonic_actual_progress(self):
        page_number = [1]
        def advance(_page, _signature):
            if page_number[0] == 1:
                page_number[0] += 1
                return True
            return False
        with patch.object(exporter, 'page_signature', lambda _page: (str(page_number[0]),)), \
                patch.object(exporter, 'advance_page', advance):
            result = worker.run(self.output, self.root / 'profile', Controls())
        self.assertEqual(result['found'], 8)
        self.assertEqual(result['exported'], 6)
        self.assertEqual(result['errors'], 2)
        events = [json.loads(line) for line in self.stdout.getvalue().splitlines()]
        processed = [event['processed'] for event in events if event['type'] == 'progress']
        self.assertEqual(processed, list(range(9)))
        self.assertTrue(contexts[-1].closed)

    def test_profile_lock_is_exclusive(self):
        with worker.profile_lock(self.root / 'profile'):
            with self.assertRaises(OSError):
                with worker.profile_lock(self.root / 'profile'):
                    self.fail('Lock must be exclusive')

if __name__ == '__main__':
    unittest.main()
