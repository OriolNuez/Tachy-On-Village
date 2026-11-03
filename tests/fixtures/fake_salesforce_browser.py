"""Invented browser for tests. No Playwright import, network or Chrome launch."""
import sys
import types

contexts = []


class Link:
    def __init__(self, name, account_id):
        self.name, self.account_id = name, account_id

    def inner_text(self):
        return self.name

    def get_attribute(self, attribute):
        assert attribute == "href"
        return "/lightning/r/Account/" + self.account_id + "/view"


class Accounts:
    rows = [Link("Example Existing", "001000000000001"),
            Link("Example New", "001000000000002"),
            Link("Example Duplicate", "001000000000002"),
            Link("", "001000000000003")]

    def count(self):
        return len(self.rows)

    def nth(self, index):
        return self.rows[index]


class Page:
    def goto(self, url, wait_until):
        assert url == "https://ibmsc.lightning.force.com/lightning/n/TerritoryProspecting"
        assert wait_until == "domcontentloaded"

    def locator(self, selector):
        assert selector == 'td[scope="row"] a[href^="/lightning/r/Account/"][href$="/view"]'
        return Accounts()


class Context:
    def __init__(self):
        self.pages = [Page()]
        self.closed = False

    def close(self):
        self.closed = True


class Chromium:
    def launch_persistent_context(self, profile, channel, headless):
        assert channel == "chrome"
        assert headless is False
        context = Context()
        context.profile = profile
        contexts.append(context)
        return context


class Playwright:
    chromium = Chromium()

    def __enter__(self):
        return self

    def __exit__(self, *_):
        pass


def install():
    module = types.ModuleType("playwright.sync_api")
    module.sync_playwright = Playwright
    sys.modules["playwright"] = types.ModuleType("playwright")
    sys.modules["playwright.sync_api"] = module
