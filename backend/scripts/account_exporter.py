import csv
from pathlib import Path
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


def main():
    with sync_playwright() as p:

        # Open a normal browser with a saved login profile
        context = p.chromium.launch_persistent_context(
            PROFILE,
            channel="chrome",
            headless=False
        )

        page = context.pages[0] if context.pages else context.new_page()

        # Open Salesforce
        page.goto(URL, wait_until="domcontentloaded")

        print("Sign into Salesforce and select your territory.")
        input("Press Enter once your account list is visible...")

        # Read account links from the table
        accounts = page.locator(ACCOUNT_SELECTOR)

        total = accounts.count()
        print(f"Found {total} account links.")

        results = []
        seen = set()

        for i in range(total):
            link = accounts.nth(i)

            name = link.inner_text().strip()
            href = link.get_attribute("href")

            if not name or not href:
                continue

            account_id = href.split("/Account/")[1].split("/")[0]

            # Avoid duplicate account IDs
            if account_id in seen:
                continue

            seen.add(account_id)

            results.append({
                "Account Name": name,
                "Salesforce Account ID": account_id,
                "Salesforce URL": "https://ibmsc.lightning.force.com" + href
            })

        # Save results to CSV
        with OUTPUT.open("w", newline="", encoding="utf-8-sig") as file:
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

        print(f"Exported {len(results)} accounts to {OUTPUT.resolve()}")

        input("Press Enter to close the browser...")
        context.close()


if __name__ == "__main__":
    main()
