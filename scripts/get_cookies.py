"""
段階1: コピーしたChromeプロファイル(headless)からgoogle.comのCookieを取り出し、
locationsharinglib用のNetscape形式cookieファイルとして保存する。
本物のChromeには一切触れない(コピーだけを操作)。
"""
import subprocess
import time
import sys
import os
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
PROFILE_DIR = BASE / "secret" / "chrome-copy"
PORT = 9333
COOKIE_OUT = BASE / "secret" / "cookies.txt"

CHROME_BIN = "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"


def netscape_line(c):
    domain = c["domain"]
    flag = "TRUE" if domain.startswith(".") else "FALSE"
    path = c.get("path", "/")
    secure = "TRUE" if c.get("secure") else "FALSE"
    expires = int(c.get("expires", 0)) if c.get("expires", -1) and c.get("expires", -1) > 0 else 0
    return "\t".join([domain, flag, path, secure, str(expires), c["name"], c["value"]])


def main():
    proc = subprocess.Popen([
        CHROME_BIN,
        "--headless=new",
        f"--remote-debugging-port={PORT}",
        f"--user-data-dir={PROFILE_DIR}",
        "--no-first-run",
        "--no-default-browser-check",
        "about:blank",
    ])
    try:
        time.sleep(2)
        from playwright.sync_api import sync_playwright

        with sync_playwright() as p:
            browser = p.chromium.connect_over_cdp(f"http://127.0.0.1:{PORT}")
            ctx = browser.contexts[0] if browser.contexts else browser.new_context()
            page = ctx.new_page()
            page.goto("https://www.google.com/maps/", timeout=30000)
            page.wait_for_timeout(3000)
            url = page.url
            title = page.title()
            if "signin" in url or "ServiceLogin" in url or "accounts.google.com" in url:
                print("BLOCKED: ログイン画面が表示された。パスワード/2FAが必要なため中止。", file=sys.stderr)
                sys.exit(2)
            cookies = ctx.cookies(["https://www.google.com", "https://maps.google.com"])
            with open(COOKIE_OUT, "w") as f:
                f.write("# Netscape HTTP Cookie File\n")
                for c in cookies:
                    f.write(netscape_line(c) + "\n")
            os.chmod(COOKIE_OUT, 0o600)
            print(f"OK: {len(cookies)} cookies saved. page_title={title!r}")
            browser.close()
    finally:
        proc.terminate()
        try:
            proc.wait(timeout=10)
        except subprocess.TimeoutExpired:
            proc.kill()


if __name__ == "__main__":
    main()
