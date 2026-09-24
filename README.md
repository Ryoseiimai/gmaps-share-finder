# おじさん探しゲーム (gmaps-share-finder)

Googleマップの「現在地の共有」を使った、リアル鬼ごっこ／かくれんぼ用のちょっとした実験ツールです。
スマホの画面には**距離と方角の矢印だけ**が表示され、座標そのものはどこにも表示されません。

![スマホ画面のスクリーンショット](docs/screenshot.png)

## これは何か

- Mac上の小さなポーラー（Python）が定期的に、Googleマップで現在地共有をしてくれている相手の位置を取得します。
- 座標はCloudflare Workers + KVに一時保存され、TTL（2時間）で自動的に消えます。
- スマホのブラウザ画面は、自分のGPSをWorkerに送り、Workerから「距離(m)」と「方角(度)」だけを受け取って矢印を回転させます。座標そのものはスマホ側にもレスポンスにも含まれません。
- 距離が一定以内に近づくと、「見つけた」かどうかの判定（オプション機能）を行い、画面に表示します。

## 仕組み（構成図）

```
[相手のスマホ]                     [自分(ハンター)のスマホ]
  Googleマップの位置共有               ブラウザでWorkerのURLを開く
       │ (相手が自分で共有した場合のみ)         │ GPS(Geolocation API)
       ▼                                  ▼
[Mac poller (Python, 60秒毎)] ----POST----> [Cloudflare Worker]
   locationsharinglibで取得                    │  座標をKVに保存(TTL 2h)
   相手が見つからなければMOCK座標を送る          │  /state は距離・方角・判定だけを返す
                                               ▼
                                        [Workers KV]
```

- `worker/` — Cloudflare Worker本体（Hono不使用、素のFetch API）。エンドポイントは `POST /hunter`, `POST /target`, `POST /judge`, `GET /state`, `GET /`（スマホ用HTML）。
- `poller/` — Mac側で動かす常駐スクリプト。`run.sh` が `poll.py` を一定間隔で呼び続けます。
- `scripts/get_cookies.py` — （実データを使う場合のみ）コピーしたChromeプロファイルからGoogleのCookieを取り出すヘルパー。本物のChromeプロファイルは操作しません。
- 「見つけた」判定は、距離が近づいたときに任意の判定ロジック（同梱の `poller/poll.py` はClaude Codeの `jev-judge` スキルを呼び出す実装例）で行います。このスキルが無くても、距離と方角の表示自体は動作します。

## セットアップ

1. `cd worker && wrangler kv namespace create OJISAN_KV` でKV名前空間を作成し、出力されたIDを `worker/wrangler.toml` の `id` に設定する。
2. `wrangler secret put SHARED_TOKEN` で共有トークン（自分で好きな文字列を決める）を設定する。
3. `wrangler deploy` でWorkerを配備する。
4. `cp config.example.json config.json` してから、`worker_url`・`shared_token`・`target_display_name_contains` などを自分の環境に合わせて書き換える。
5. `python3 -m venv .venv && ./.venv/bin/pip install locationsharinglib playwright`（実データを使わない場合は`locationsharinglib`は不要）。
6. （実データを使う場合のみ）`./.venv/bin/python3 scripts/get_cookies.py` でCookieを取得し `secret/cookies.txt` に保存する。
7. `bash poller/run.sh` でポーラーを起動する（止めるときは `bash poller/stop.sh`）。
8. スマホのブラウザで `https://<自分のWorkerのURL>/?token=<自分で決めた共有トークン>` を開く。

## 利用条件（必ず読んでください）

**このツールは、相手が自分の意思でGoogleマップの「現在地の共有」機能をONにし、あなたに共有している場合にのみ、実データで動作します。**
相手が共有していない場合は、実際の位置情報は一切取得できず、自動的にダミー座標（MOCK）で動作します。

SNSの投稿・タグ付け・写真のExif情報など、公開情報から他人の居場所を推測・特定する目的での利用は想定していません。そのような目的には使わないでください。本人の同意なしに位置情報を取得・追跡することは、利用しているサービスの規約やプライバシーに関する法令に違反する可能性があります。

## ライセンス

MIT License（`LICENSE` ファイル参照）

---

# gmaps-share-finder (English)

A small experiment for real-life hide-and-seek that uses Google Maps' "Share your real-time location" feature.
The phone screen only ever shows **distance and a direction arrow** — raw coordinates are never displayed.

## What it is

- A small Python poller running on a Mac periodically checks whether the target has shared their real-time location with you via Google Maps.
- Coordinates are stored temporarily in Cloudflare Workers KV with a 2-hour TTL (auto-expire).
- The phone screen sends its own GPS to the Worker and receives back only "distance (m)" and "bearing (degrees)" to rotate an arrow. Raw coordinates are never included in any response sent to the phone.
- When the distance gets close enough, an optional "found" judgment step runs and is shown on screen.

## How it works

```
[Target's phone]                      [Hunter's phone (you)]
  Google Maps location sharing            Open the Worker URL in a browser
       │ (only if the target shared it)          │ GPS (Geolocation API)
       ▼                                         ▼
[Mac poller (Python, every 60s)] --POST--> [Cloudflare Worker]
   fetches via locationsharinglib               │ stores coords in KV (TTL 2h)
   falls back to MOCK coords if not found        │ /state returns distance/bearing/judgment only
                                                  ▼
                                           [Workers KV]
```

- `worker/` — the Cloudflare Worker (plain Fetch API, no framework). Endpoints: `POST /hunter`, `POST /target`, `POST /judge`, `GET /state`, `GET /` (phone HTML page).
- `poller/` — the Mac-side daemon. `run.sh` calls `poll.py` on a fixed interval.
- `scripts/get_cookies.py` — (only needed for real data) extracts Google cookies from a **copied** Chrome profile. It never touches your real Chrome profile.
- The "found" judgment is a pluggable step; the bundled `poller/poll.py` calls a Claude Code skill (`jev-judge`) as an example. The distance/direction display works fine without it.

## Setup

1. `cd worker && wrangler kv namespace create OJISAN_KV`, then put the resulting id into `worker/wrangler.toml`.
2. `wrangler secret put SHARED_TOKEN` to set your own shared secret token.
3. `wrangler deploy` to deploy the Worker.
4. `cp config.example.json config.json` and fill in `worker_url`, `shared_token`, `target_display_name_contains`, etc.
5. `python3 -m venv .venv && ./.venv/bin/pip install locationsharinglib playwright` (skip `locationsharinglib` if you only want MOCK mode).
6. (Real data only) run `./.venv/bin/python3 scripts/get_cookies.py` to save cookies to `secret/cookies.txt`.
7. `bash poller/run.sh` to start the poller (`bash poller/stop.sh` to stop).
8. Open `https://<your-worker-url>/?token=<your-shared-token>` on your phone.

## Terms of use (please read)

**This tool only works with real data if the other person has themselves turned on Google Maps' "Share your real-time location" and shared it with you.** If they haven't, no real location is ever obtained, and the app automatically falls back to dummy (MOCK) coordinates.

This project is not intended for inferring or identifying someone's whereabouts from public information such as social media posts, tags, or photo EXIF data. Don't use it for that. Obtaining or tracking someone's location without their consent may violate the terms of service of the platforms involved and/or applicable privacy laws.

## License

MIT License (see `LICENSE`)
