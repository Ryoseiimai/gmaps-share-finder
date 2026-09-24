## What / 変更内容

<!-- What does this PR do, and why? / 何を、なぜ変更しましたか？ -->

## How tested / 動作確認

<!-- e.g. `npm test`, `npm run dev` and manually checked the phone screen, etc. -->

- [ ] `cd worker && npm test` passes
- [ ] `python3 -m py_compile poller/*.py scripts/*.py` passes (if you touched Python)
- [ ] Tried `npm run dev` / `make dev` and confirmed the screen behaves as expected (if you touched `worker/` or the phone UI)

## Lines not to cross / 守るべき線 (see [SECURITY.md](../SECURITY.md))

- [ ] This PR does **not** add any feature that infers/locates a person from something other than a location they actively shared (no SNS/photo/EXIF-based location inference, no tracking without consent).
      このPRは、本人が能動的に共有した位置情報以外から居場所を推測・特定する機能を追加していません。
- [ ] This PR does **not** add raw coordinates (lat/lng) to any API response or log line.
      このPRは、座標そのものをAPIレスポンスやログに出力していません。
- [ ] This PR does **not** touch/commit `secret/`, `config.json`, `worker/.dev.vars`, or `worker/.wrangler/`.
      このPRは `secret/`・`config.json`・`worker/.dev.vars`・`worker/.wrangler/` に触れていません。
- [ ] This PR does **not** add a deploy-to-production workflow or change the KV `id` in `worker/wrangler.toml`.
      このPRは本番デプロイ用のワークフロー追加や `worker/wrangler.toml` のKV IDの変更を行っていません。

## Related issue / 関連Issue

<!-- Closes #... -->
