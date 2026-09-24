"""
開発モード専用: Googleアカウント・実座標なしでも画面の動きを確認できるように、
ハンター(自分)とターゲット(相手)のダミー座標をローカルのworker(wrangler dev)へ送り続ける。

標準ライブラリのみで動く(pip installなし)。本番用ではない。
ここで送る座標はすべてダミー(config.example.jsonと同じ東京駅付近の公開座標)。

停止するには Ctrl+C。
"""
import argparse
import json
import math
import time
import urllib.error
import urllib.request

CENTER_LAT = 35.6580
CENTER_LNG = 139.7016
WALK_RADIUS_M = 150
PERIOD_S = 60  # 開発時にすぐ動きが分かるよう1分周期
HUNTER_OFFSET_M = 80  # ハンター(自分)役は中心から少し離れた固定点に置く


def post_json(base_url, path, payload, timeout):
    req = urllib.request.Request(
        base_url.rstrip("/") + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "ojisan-sagashi-dev-mock/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=timeout) as res:
        return json.loads(res.read().decode())


def mock_target_position(now):
    """時刻ベースの円運動。状態を持たず毎回決定的に同じ軌道を描く(poller/poll.pyと同じ考え方)。"""
    angle = (now % PERIOD_S) / PERIOD_S * 2 * math.pi
    dlat = (WALK_RADIUS_M * math.cos(angle)) / 111320
    dlng = (WALK_RADIUS_M * math.sin(angle)) / (111320 * math.cos(math.radians(CENTER_LAT)))
    return CENTER_LAT + dlat, CENTER_LNG + dlng


def main():
    parser = argparse.ArgumentParser(description="開発用: ダミー座標をローカルworkerへ送り続ける")
    parser.add_argument("--url", required=True, help="ローカルworkerのURL (例: http://127.0.0.1:8787)")
    parser.add_argument("--token", required=True, help="開発用トークン(worker/.dev.varsのSHARED_TOKENと一致させる)")
    parser.add_argument("--interval", type=float, default=2.0, help="送信間隔(秒)")
    args = parser.parse_args()

    hunter_lat = CENTER_LAT + HUNTER_OFFSET_M / 111320
    hunter_lng = CENTER_LNG

    print(f"[dev-mock] {args.url} へダミー座標を送信開始(Ctrl+Cで停止)")
    while True:
        now = time.time()
        lat, lng = mock_target_position(now)
        ts = int(now * 1000)
        try:
            post_json(args.url, "/hunter", {"token": args.token, "lat": hunter_lat, "lng": hunter_lng, "ts": ts}, timeout=5)
            post_json(args.url, "/target", {"token": args.token, "lat": lat, "lng": lng, "source": "mock", "ts": ts}, timeout=5)
        except (urllib.error.URLError, OSError) as e:
            print(f"[dev-mock] 送信失敗(継続します): {type(e).__name__}: {e}")
        time.sleep(args.interval)


if __name__ == "__main__":
    main()
