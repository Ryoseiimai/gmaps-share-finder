"""
検証用: スマホ幅+ダミーGPSでWorkerのHTML画面を開きスクショを撮る。
座標はダミー(mockのターゲット付近)を使う。本人の実位置は使わない。
"""
import json
from pathlib import Path

from playwright.sync_api import sync_playwright

BASE = Path(__file__).resolve().parent.parent
cfg = json.loads((BASE / "config.json").read_text())
token = cfg["shared_token"]
worker_url = cfg["worker_url"]

# mockターゲット付近のダミー座標(見つけた状態を再現するため)
DUMMY_LAT = 35.65935
DUMMY_LNG = 139.70161

with sync_playwright() as p:
    browser = p.chromium.launch()
    ctx = browser.new_context(
        viewport={"width": 390, "height": 844},
        geolocation={"latitude": DUMMY_LAT, "longitude": DUMMY_LNG, "accuracy": 10},
        permissions=["geolocation"],
        locale="ja-JP",
    )
    page = ctx.new_page()
    page.goto(f"{worker_url}/?token={token}", timeout=30000)
    page.wait_for_timeout(6000)
    out = BASE / "控え" / "phone_screen.png"
    page.screenshot(path=str(out))
    print(f"saved: {out}")
    browser.close()
