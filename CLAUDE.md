# CLAUDE.md

This file is read automatically by Claude Code sessions opened in this repo.
The full agent guide (layout, run/test commands, and hard limits) lives in
[AGENTS.md](AGENTS.md) — read it before making changes. This file only adds
Claude-Code-specific notes.

## Quick start for a Claude Code session here

```bash
npm run dev     # or: make dev — Googleアカウント/Cloudflareアカウント不要、Ctrl+Cで停止
cd worker && npm test   # geo.js のユニットテスト
```

## Non-negotiable limits (same as AGENTS.md, repeated because they matter)

- Do not build any feature that locates a person from something other than a
  location they actively shared via Google Maps (no SNS/photo/EXIF-based
  inference). See [SECURITY.md](SECURITY.md).
- Do not put raw coordinates in an HTTP response or a log line.
- Do not read, edit, or commit `secret/`, `config.json`, `worker/.dev.vars`, or
  `worker/.wrangler/` — all are intentionally git-ignored.
- Do not add a workflow that runs `wrangler deploy` against the maintainer's
  production Worker, and do not change the KV `id` in `worker/wrangler.toml`.
- Do not touch the user's real Chrome profile; `scripts/get_cookies.py` only
  operates on a copied profile — keep it that way.

## Working style expected in this repo

- Small, single-purpose commits/PRs.
- Run the tests in [AGENTS.md](AGENTS.md) before proposing a change is done.
- Match existing code style (plain Fetch API in `worker/`, stdlib-only Python
  in `poller/`/`scripts/`, bilingual JA/EN comments where the surrounding code
  already does that).
