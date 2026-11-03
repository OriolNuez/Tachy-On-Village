"""Synthetic Cognism harness. Never imports real Playwright or opens a browser."""
import sys
import types
from unittest.mock import patch

contexts = []
records = [
    {'Name': 'Alex Example', 'Company': 'Example Labs', 'Email': 'alex@example.test',
     'Email Verified': 'Yes', 'Diamond Verified': 'Yes', 'Mobile Phone': '+44 0000 000001'},
    {'Name': 'Alex Example', 'Company': 'Example Labs', 'Email': 'second@example.test',
     'Email Verified': 'No', 'Diamond Verified': 'No', 'Direct Phone': '001234'},
    {'Name': 'Missing Email', 'Company': 'Example Labs', 'Email': '',
     'Email Verified': 'Unknown', 'Diamond Verified': 'Unknown'},
    None,
]

class Rows:
    first = property(lambda self: self)
    def wait_for(self, **_kwargs):
        pass
    def count(self):
        return len(records)
    def nth(self, index):
        return index

class Page:
    def goto(self, url, **_kwargs):
        assert url == 'https://app.cognism.com/'
    def wait_for_timeout(self, _milliseconds):
        pass

class Context:
    def __init__(self, profile):
        self.pages = [Page()]
        self.profile = profile
        self.closed = False
        contexts.append(self)
    def close(self):
        self.closed = True

class Playwright:
    def __enter__(self):
        return self
    def __exit__(self, *_args):
        pass
    chromium = property(lambda self: self)
    def launch_persistent_context(self, user_data_dir, channel, headless):
        assert channel == 'chrome' and headless is False
        return Context(user_data_dir)


def install():
    module = types.ModuleType('playwright.sync_api')
    module.sync_playwright = Playwright
    module.TimeoutError = TimeoutError
    sys.modules['playwright'] = types.ModuleType('playwright')
    sys.modules['playwright.sync_api'] = module


def patches(exporter):
    def parse(index):
        if records[index] is None:
            raise RuntimeError('Synthetic row failure with private details that must not be logged')
        row = dict.fromkeys(exporter.HEADERS, '')
        row.update(records[index])
        return row
    return [patch.object(exporter, 'sync_playwright', Playwright),
            patch.object(exporter, 'visible_rows', lambda _page: Rows()),
            patch.object(exporter, 'page_signature', lambda _page: ('synthetic-page',)),
            patch.object(exporter, 'advance_page', lambda *_args: False),
            patch.object(exporter, 'parse_row', parse)]
