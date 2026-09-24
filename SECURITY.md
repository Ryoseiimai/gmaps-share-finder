# Security & Acceptable Use / セキュリティと利用条件

## 日本語

### 報告のしかた

脆弱性(トークンの漏えい・座標がレスポンスに混ざる・KVの読み取り制御の不備など)を見つけた場合は、
公開Issueではなく、[GitHub Security Advisory](https://github.com/Ryoseiimai/gmaps-share-finder/security/advisories/new)
から非公開で報告してください。

### 受け付けない変更(必ず守ってください)

このプロジェクトの前提は「相手が自分の意思でGoogleマップの位置共有をONにした場合にのみ動く」ことです。
以下のようなPR・Issueは**受け付けません**。

- SNSの投稿・タグ付け・写真のExifなど、**本人が能動的に共有した位置情報以外**から居場所を推測・特定する機能
- 相手の同意・共有なしに位置を取得・追跡する機能
- 共有を解除された後もキャッシュや別経路で位置を保持し続ける機能

### 実装上のルール

- 座標(lat/lng)そのものを **APIレスポンス(`GET /state`)に含めない**。返してよいのは距離(m)・方角(度)・更新時刻・判定結果だけです。
- 座標そのものを **ログに出力しない**(`poller/poll.py` は取得の成否と時刻だけを表示する設計を踏襲してください)。
- `secret/`・`config.json`・Cookie・トークンなどの機微情報はコミットしない(`.gitignore`済み)。
- 本物のChromeプロファイルを直接操作しない(`scripts/get_cookies.py` はコピーしたプロファイルのみ操作する設計を踏襲してください)。

## English

### Reporting a vulnerability

If you find a security issue (token leakage, coordinates leaking into a response, missing access control on KV, etc.), please report it privately via
[GitHub Security Advisories](https://github.com/Ryoseiimai/gmaps-share-finder/security/advisories/new) instead of opening a public issue.

### Changes we will not accept

This project only works when the target person has actively turned on Google Maps location sharing themselves. The following will **not** be accepted:

- Any feature that infers or identifies someone's location from something other than **a location they actively shared** — e.g. social media posts, tags, or photo EXIF data
- Any feature that obtains or tracks a person's location without their consent / active sharing
- Any feature that keeps serving a person's location (via cache or another path) after they stop sharing

### Implementation rules

- Never include raw coordinates (lat/lng) in an **API response** (`GET /state`). Only distance (m), bearing (degrees), update timestamps, and the judgment result may be returned.
- Never print raw coordinates to **logs** (follow `poller/poll.py`'s pattern of only logging success/failure and timestamps).
- Never commit secrets: `secret/`, `config.json`, cookies, or tokens (already covered by `.gitignore`).
- Never operate on the user's real Chrome profile directly (follow `scripts/get_cookies.py`'s pattern of only operating on a **copied** profile).
