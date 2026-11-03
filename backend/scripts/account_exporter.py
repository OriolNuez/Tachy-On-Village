import csv
from pathlib import Path
from typing import Callable, Dict, Optional
from playwright.sync_api import sync_playwright

# Salesforce configuration
URL = "https://ibmsc.lightning.force.com/lightning/n/TerritoryProspecting"

OUTPUT = Path("salesforce_accounts.csv")
PROFILE = str(Path.home() / ".tachyon_salesforce_chrome")

# Extract account links only
ACCOUNT_SELECTOR = (
    'td[scope="row"] '
    'a[href^="/lightning/r/Account/"][href$="/view"]'
)


def main(*, output: Path = OUTPUT, profile: str = PROFILE,
         prompt: Callable[[str], object] = input,
         check_cancel: Callable[[], None] = lambda: None,
         progress: Optional[Callable[[int, Dict[str, int]], None]] = None):
    check_cancel()
    with sync_playwright() as p:

        # Open a normal browser with a saved login profile
        check_cancel()
        context = p.chromium.launch_persistent_context(
            profile,
            channel="chrome",
            headless=False
        )

        try:
            check_cancel()
            page = context.pages[0] if context.pages else context.new_page()

            # Open Salesforce
            page.goto(URL, wait_until="domcontentloaded")

            print("Sign into Salesforce and select your territory.")
            prompt("Press Enter once your account list is visible...")

            # Read account links from the table
            accounts = page.locator(ACCOUNT_SELECTOR)

            check_cancel()
            total = accounts.count()
            counts = {"found": total, "exported": 0, "duplicates": 0, "errors": 0}
            if progress:
                progress(0, counts.copy())
            print(f"Found {total} account links.")

            results = []
            seen = set()

            for i in range(total):
                check_cancel()
                link = accounts.nth(i)

                name = link.inner_text().strip()
                href = link.get_attribute("href")

                if not name or not href:
                    counts["errors"] += 1
                    if progress:
                        progress(i + 1, counts.copy())
                    continue

                account_id = href.split("/Account/")[1].split("/")[0]

                # Avoid duplicate account IDs
                if account_id in seen:
                    counts["duplicates"] += 1
                    if progress:
                        progress(i + 1, counts.copy())
                    continue

                seen.add(account_id)

                results.append({
                    "Account Name": name,
                    "Salesforce Account ID": account_id,
                    "Salesforce URL": "https://ibmsc.lightning.force.com" + href
                })
                counts["exported"] += 1
                if progress:
                    progress(i + 1, counts.copy())

            check_cancel()
            # Save results to CSV
            with output.open("w", newline="", encoding="utf-8-sig") as file:
                writer = csv.DictWriter(
                    file,
                    fieldnames=[
                        "Account Name",
                        "Salesforce Account ID",
                        "Salesforce URL"
                    ]
                )
                writer.writeheader()
                writer.writerows(results)

            print(f"Exported {len(results)} accounts to {output.resolve()}")

            prompt("Press Enter to close the browser...")
            check_cancel()
            return counts
        finally:
            context.close()


if __name__ == "__main__":
    main()
