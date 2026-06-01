"""
Debug: find the FIRST VISIBLE More actions button and dump ALL dropdown items.
"""
import time, os, sys
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

CHROME_EXE       = r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe"
CHROME_USER_DATA = r"C:\Users\PC\AppData\Local\Google\Chrome\User Data"
CHROME_PROFILE   = "Profile 10"
TEST_PROFILE     = "https://www.linkedin.com/in/bolajiayodeji/"

from playwright.sync_api import sync_playwright

with sync_playwright() as pw:
    ctx = pw.chromium.launch_persistent_context(
        user_data_dir=os.path.join(CHROME_USER_DATA, CHROME_PROFILE),
        executable_path=CHROME_EXE,
        headless=False,
        args=["--no-first-run", "--no-default-browser-check"],
        viewport={"width": 1280, "height": 800},
    )
    page = ctx.new_page()
    page.goto(TEST_PROFILE, wait_until="domcontentloaded", timeout=45000)
    time.sleep(3)

    # Count all More actions buttons (including hidden ones)
    all_more = page.query_selector_all("button[aria-label='More actions']")
    print(f"Total 'More actions' buttons in DOM: {len(all_more)}")
    for i, b in enumerate(all_more):
        print(f"  [{i}] visible={b.is_visible()}")

    # Find the first VISIBLE one
    more = None
    for btn in page.query_selector_all("button[aria-label='More actions']"):
        if btn.is_visible():
            more = btn
            break

    if more:
        print(f"\nClicking first visible More actions button...")
        more.click()
        time.sleep(1.5)

        print("\n=== ALL DROPDOWN ITEMS ===")
        # Get everything that appeared after the click
        for el in page.query_selector_all("li, div[role='option'], div[role='menuitem']"):
            if el.is_visible():
                txt = (el.inner_text() or "").strip().replace("\n", " ")
                cls = (el.get_attribute("class") or "")[:60]
                if txt and len(txt) < 100:
                    print(f"  '{txt}' | class='{cls}'")

        # Also dump the dropdown container HTML
        html = page.evaluate("""() => {
            const d = document.querySelector('.artdeco-dropdown__content--is-open') ||
                      document.querySelector('.artdeco-dropdown__content');
            return d ? d.outerHTML : 'NOT FOUND';
        }""")
        with open(r"C:\Users\PC\fork\OziGi\dropdown_dump.html", "w", encoding="utf-8") as f:
            f.write(html)
        print("\nDropdown HTML saved to dropdown_dump.html")
    else:
        print("No visible More actions button found.")

    time.sleep(2)
    ctx.close()
    print("Done.")
