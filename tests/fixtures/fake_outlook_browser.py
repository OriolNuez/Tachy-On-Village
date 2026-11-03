"""No real Playwright imports; fake Outlook browser for adapter tests."""
import sys
import types
from unittest.mock import patch

contexts = []
calls = []

class Page:
    def goto(self, url, **_kwargs):
        assert url == 'https://outlook.cloud.microsoft/mail/'
        calls.append('goto')

class Context:
    def __init__(self):
        self.pages = [Page()]
        self.closed = False
        contexts.append(self)
    def close(self):
        self.closed = True
        calls.append('close')

class Playwright:
    chromium = property(lambda self: self)
    def __enter__(self):
        return self
    def __exit__(self, *_args):
        pass
    def launch_persistent_context(self, _profile, **options):
        assert options['channel'] == 'chrome' and options['headless'] is False
        assert options['accept_downloads'] is False
        return Context()


def install():
    module = types.ModuleType('playwright.sync_api')
    module.sync_playwright = Playwright
    module.TimeoutError = TimeoutError
    sys.modules['playwright'] = types.ModuleType('playwright')
    sys.modules['playwright.sync_api'] = module


def patches(original):
    def action(name, result=None):
        def run(*_args):
            calls.append(name)
            return result
        return run
    return [patch.object(original, 'sync_playwright', Playwright),
            patch.object(original, 'outlook_page', lambda context: context.pages[0]),
            patch.object(original, 'create_one', action('create_one')),
            patch.object(original, 'insert_outlook_signature', action('signature')),
            patch.object(original, 'save_draft_shortcut', action('save')),
            patch.object(original, 'verify_draft_subject', action('verify_subject', True)),
            patch.object(original, 'return_to_inbox', action('inbox'))]
