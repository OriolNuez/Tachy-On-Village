import contextlib
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
from fake_outlook_browser import install, patches, contexts, calls
install()
worker = importlib.import_module('outlook_worker')
original = importlib.import_module('outlook_drafter')

class Controls(worker.Controls):
    def __init__(self, cancel_on=None):
        super().__init__()
        self.prompts = []
        self.cancel_on = cancel_on
    def wait(self, action):
        self.prompts.append(action)
        if action == self.cancel_on:
            self.cancelled.set()
        else:
            self.actions.put(action)
        super().wait(action)

class OutlookWorkerTests(unittest.TestCase):
    def setUp(self):
        calls.clear()
        self.temp = tempfile.TemporaryDirectory(prefix='tachyon-outlook-worker-')
        self.root = Path(self.temp.name)
        self.request = self.root / 'request.json'
        self.ledger = self.root / 'attempts.json'
        self.draft = dict(id='a' * 64, name='Alex Example', email='alex@example.test', university='Example Labs', subject='Example subject', body='Hi Alex, synthetic body.')
        self.request.write_text(json.dumps(dict(v=1, cadence='Example', signature=True, drafts=[self.draft])))
        self.stdout, self.stderr = io.StringIO(), io.StringIO()
        self.stack = contextlib.ExitStack()
        for item in patches(original):
            self.stack.enter_context(item)
        self.stack.enter_context(contextlib.redirect_stdout(self.stdout))
        self.stack.enter_context(contextlib.redirect_stderr(self.stderr))
    def tearDown(self):
        self.stack.close()
        self.temp.cleanup()
    def run_batch(self, controls=None):
        return worker.run(self.request, self.ledger, self.root / 'profile', controls or Controls())
    def test_original_function_order_ready_close_and_subject_only_status(self):
        controls = Controls()
        counts = self.run_batch(controls)
        self.assertEqual(controls.prompts, ['ready', 'close_browser'])
        self.assertEqual(calls, ['goto', 'create_one', 'signature', 'save', 'verify_subject', 'inbox', 'close'])
        self.assertEqual(counts, dict(total=1, processed=1, subjectVisible=1, uncertain=0, skipped=0))
        self.assertEqual(worker.read_ledger(self.ledger)[self.draft['id']]['status'], 'subject_visible_review_required')
        events = [json.loads(line) for line in self.stdout.getvalue().splitlines()]
        self.assertEqual(events[-2]['counts'], counts)
        self.assertNotIn('alex@example.test', self.stdout.getvalue() + self.stderr.getvalue())
    def test_persists_explicit_step_and_batch_without_changing_status(self):
        data = json.loads(self.request.read_text())
        data.update(step=2, batchId='synthetic-batch')
        self.request.write_text(json.dumps(data))
        self.run_batch()
        row = worker.read_ledger(self.ledger)[self.draft['id']]
        self.assertEqual(row['step'], 2)
        self.assertEqual(row['batchId'], 'synthetic-batch')
        self.assertEqual(row['status'], 'subject_visible_review_required')

    def test_attempt_is_durable_before_first_compose_action(self):
        def create(_page, _draft):
            self.assertEqual(worker.read_ledger(self.ledger)[self.draft['id']]['status'], 'attempt_started')
            raise RuntimeError('Private browser exception token=secret')
        with patch.object(original, 'create_one', create):
            result = self.run_batch()
        self.assertEqual(result['uncertain'], 1)
        self.assertNotIn('secret', self.stdout.getvalue() + self.stderr.getvalue())
        self.assertTrue(contexts[-1].closed)
    def test_uncertain_attempt_blocks_new_template_and_does_not_retry(self):
        with patch.object(original, 'verify_draft_subject', return_value=False):
            self.assertEqual(self.run_batch()['uncertain'], 1)
        self.draft['id'] = 'b' * 64
        self.draft['subject'] = 'Changed template'
        self.request.write_text(json.dumps(dict(v=1, cadence='Other cadence', signature=True, drafts=[self.draft])))
        calls.clear()
        self.assertEqual(self.run_batch()['skipped'], 1)
        self.assertNotIn('create_one', calls)
    def test_cancellation_before_ready_writes_no_attempt(self):
        with self.assertRaises(worker.Cancelled):
            self.run_batch(Controls('ready'))
        self.assertFalse(self.ledger.exists())
        self.assertTrue(contexts[-1].closed)
    def test_cancellation_during_compose_keeps_uncertain_attempt(self):
        controls = Controls()
        with patch.object(original, 'create_one', side_effect=lambda *_: controls.cancelled.set()):
            with self.assertRaises(worker.Cancelled):
                self.run_batch(controls)
        self.assertEqual(worker.read_ledger(self.ledger)[self.draft['id']]['status'], 'uncertain')
        self.assertTrue(contexts[-1].closed)
    def test_cancellation_after_subject_check_retains_history(self):
        with self.assertRaises(worker.Cancelled):
            self.run_batch(Controls('close_browser'))
        self.assertEqual(worker.read_ledger(self.ledger)[self.draft['id']]['status'], 'subject_visible_review_required')
    def test_disk_failure_before_attempt_prevents_compose(self):
        with patch.object(worker, 'save_ledger', side_effect=OSError('disk full')):
            with self.assertRaises(OSError):
                self.run_batch()
        self.assertNotIn('create_one', calls)
        self.assertTrue(contexts[-1].closed)
    def test_invalid_history_fails_closed(self):
        self.ledger.write_text('{broken')
        with self.assertRaises(ValueError):
            self.run_batch()
        self.assertNotIn('goto', calls)
    def test_batch_stops_after_uncertain_first_contact(self):
        second = dict(self.draft, id='b' * 64, email='second@example.test')
        self.request.write_text(json.dumps(dict(v=1, cadence='Example', signature=False, drafts=[self.draft, second])))
        with patch.object(original, 'verify_draft_subject', return_value=False):
            result = self.run_batch()
        self.assertEqual(result['processed'], 1)
        self.assertEqual(len(worker.read_ledger(self.ledger)), 1)
        self.assertNotIn('signature', calls)

if __name__ == '__main__':
    unittest.main()
