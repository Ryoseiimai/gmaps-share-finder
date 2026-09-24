"""
Macポーラー: 60秒ごとに1回呼ばれる想定(run.shがループする)。

やること:
1. config.json の target_display_name_contains に一致する人が
   Googleマップの位置共有(locationsharinglib)に現れているか確認する。
   - 現れていれば実座標(source=real)をWorkerへ送る。
   - 現れていなければ MOCK 座標(source=mock)を送る。
     意図的な簡略化: MOCKは時刻ベースの円運動(サーバ側に状態を持たない)。
     本格的なランダムウォークにする場合はここを拡張する。
2. Workerから距離(GET /state)を取得し、found_distance_m以内なら
   jev-judgeスキルを1回呼び、結果をWorkerへ返す(座標はjev-judgeに渡さない)。

プライバシー: 座標はログに出力しない(取得の成否と更新時刻だけを表示する)。
"""
import json
import math
import subprocess
import sys
import time
from pathlib import Path

BASE = Path(__file__).resolve().parent.parent
CONFIG_PATH = BASE / "config.json"
JEV_SCRIPT = Path.home() / ".claude/skills/jev-judge/scripts/judge.py"


def load_config():
    if not CONFIG_PATH.exists():
        print(f"config.json がありません。config.example.json をコピーして作成してください: {CONFIG_PATH}", file=sys.stderr)
        sys.exit(1)
    return json.loads(CONFIG_PATH.read_text())


def get_real_target(cfg):
    """実際の位置共有から該当者を探す。見つからなければNoneを返す(例外は投げない)。"""
    cookies_file = BASE / cfg.get("cookies_file", "secret/cookies.txt")
    name_needle = (cfg.get("target_display_name_contains") or "").strip().lower()
    if not cookies_file.exists() or not name_needle:
        return None
    try:
        from locationsharinglib import Service

        svc = Service(cookies_file=str(cookies_file), authenticating_account=cfg["google_account"])
        for person in svc.get_all_people():
            name = f"{person.nickname or ''} {person.full_name or ''}".lower()
            if name_needle in name:
                return {"lat": person.latitude, "lng": person.longitude, "source": "real"}
    except Exception as e:
        print(f"実座標の取得に失敗(mockへ切替): {type(e).__name__}", file=sys.stderr)
    return None


def get_mock_target(cfg):
    """時刻ベースの円運動。状態を持たないので毎回決定的に同じ軌道を描く。"""
    m = cfg["mock"]
    period_s = 600  # 10分で1周
    angle = (time.time() % period_s) / period_s * 2 * math.pi
    dlat = (m["walk_radius_m"] * math.cos(angle)) / 111320
    dlng = (m["walk_radius_m"] * math.sin(angle)) / (111320 * math.cos(math.radians(m["center_lat"])))
    return {"lat": m["center_lat"] + dlat, "lng": m["center_lng"] + dlng, "source": "mock"}


def post_json(base_url, path, payload):
    import urllib.request

    req = urllib.request.Request(
        base_url.rstrip("/") + path,
        data=json.dumps(payload).encode(),
        headers={"Content-Type": "application/json", "User-Agent": "ojisan-sagashi-poller/1.0"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read().decode())


def get_json(base_url, path):
    import urllib.request

    req = urllib.request.Request(
        base_url.rstrip("/") + path,
        headers={"User-Agent": "ojisan-sagashi-poller/1.0"},
    )
    with urllib.request.urlopen(req, timeout=15) as res:
        return json.loads(res.read().decode())


def run_jev_judge(distance_m, hunter_ts, target_ts):
    context = (
        f"ハンター(自分)とターゲット(相手)の距離は約{distance_m}mです。"
        f"ハンターの位置更新時刻: {hunter_ts}、ターゲットの位置更新時刻: {target_ts}。"
        "座標そのものは渡していません。この距離感で「見つけた」と言えるか判定してください。"
    )
    result = subprocess.run(
        [
            "python3",
            str(JEV_SCRIPT),
            "--question",
            "ハンターは相手を見つけたと言えるか",
            "--kind",
            "yesno",
            context,
        ],
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        print(f"jev-judge 呼び出し失敗: {result.stderr[:300]}", file=sys.stderr)
        return None
    try:
        return json.loads(result.stdout)
    except json.JSONDecodeError:
        print(f"jev-judge の出力をJSONとして解釈できません: {result.stdout[:300]}", file=sys.stderr)
        return None


def main():
    cfg = load_config()
    worker_url = cfg["worker_url"]
    token = cfg["shared_token"]
    found_distance_m = cfg.get("found_distance_m", 50)

    target = get_real_target(cfg)
    if target is None:
        target = get_mock_target(cfg)

    post_json(worker_url, "/target", {**target, "token": token, "ts": int(time.time() * 1000)})
    print(f"target送信OK source={target['source']} time={time.strftime('%H:%M:%S')}")

    state = get_json(worker_url, f"/state?token={token}")
    if not state.get("has_hunter"):
        print("ハンター(スマホ)の位置がまだありません。スマホ画面を開いてください。")
        return

    distance_m = state.get("distance_m")
    print(f"距離: {distance_m}m")
    if distance_m is not None and distance_m <= found_distance_m:
        judged = run_jev_judge(distance_m, state.get("hunter_updated_at"), state.get("target_updated_at"))
        if judged:
            found = str(judged.get("answer", "")).strip().lower() in ("yes", "true", "1")
            probability = judged.get("probability")
            post_json(
                worker_url,
                "/judge",
                {"token": token, "found": found, "probability": probability},
            )
            print(f"jev判定送信OK found={found}")


if __name__ == "__main__":
    main()
