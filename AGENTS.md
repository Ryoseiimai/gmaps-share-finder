# AGENTS.md

Guidance for AI coding agents (Claude Code, Codex, GitHub Copilot, Cursor, etc.)
working in this repository. Humans, feel free to read this too — it doubles as
a technical overview.

## What this project is

`gmaps-share-finder` ("おじさん探しゲーム") is a small real-life hide-and-seek
game built on Google Maps' "Share your real-time location" feature. See
[README.md](README.md) for the full picture and diagram.

## Layout

- `worker/` — Cloudflare Worker (plain Fetch API, ES modules, no framework).
  - `src/index.js` — HTTP routing, KV reads/writes, and the phone-facing HTML page.
  - `src/geo.js` — pure functions: `distanceMeters`, `bearingDegrees`. Keep these
    framework-free and side-effect-free so they stay unit-testable.
  - `test/geo.test.js` — Node's built-in test runner (`node:test`), tests for
    `geo.js` only.
  - `wrangler.toml` — Worker config. **Do not add an `account_id` or change the
    bound KV `id` in a PR** — that binding is the maintainer's production KV.
- `poller/` — Mac-side Python daemon that feeds real (or mock) target
  coordinates into the Worker via HTTP.
- `scripts/` — helper scripts (cookie extraction from a **copied** Chrome
  profile, phone-screen screenshot for real deploys, and the dev-mode mock
  feeder).
- `docs/index.html` — a fully client-side, mocked demo for GitHub Pages. It
  never calls the real Worker; it simulates a moving target entirely in the
  browser. If you touch the real distance/bearing math in `worker/src/geo.js`,
  the JS copy in `docs/index.html` is intentionally duplicated (a static page
  can't `import` from `worker/`) — keep them in sync if you change the formulas.
- `config.example.json` — template for the user's local `config.json` (which is
  git-ignored and never committed).

## How to run it

Dev mode needs **no Google account and no Cloudflare account**:

```bash
npm run dev     # or: make dev
```

This starts `wrangler dev --local` (Miniflare, fully local, no Cloudflare
network access) plus a mock coordinate feeder
(`scripts/dev_mock_feed.py`), and opens the phone screen in a browser at
`http://127.0.0.1:8787/?token=devtoken`. Stop with Ctrl+C.

## How to test

```bash
cd worker && npm test          # node:test — geo.js unit tests
node --check worker/src/index.js worker/src/geo.js   # syntax check
python3 -m py_compile poller/poll.py scripts/*.py     # Python syntax check
ruff check poller scripts       # Python lint (same as CI)
```

CI (`.github/workflows/ci.yml`) runs all of the above on every PR. A PR must be
green before it can be merged (branch protection on `main`).

## Lines an agent must not cross

Read [SECURITY.md](SECURITY.md) in full before implementing anything related to
locating a person. In short:

1. **Never** implement a feature that infers/locates someone from anything
   other than a location they actively shared (no SNS scraping, no EXIF, no
   "last seen" tricks). PRs that do this will be rejected, not merged.
2. **Never** put raw coordinates in an API response or a log line. `GET /state`
   may only return distance, bearing, timestamps, and the judgment result.
3. **Never** commit `secret/`, `config.json`, cookies, tokens, or anything
   under `worker/.wrangler/` or `worker/.dev.vars` — all are git-ignored on
   purpose.
4. **Never** add a GitHub Actions workflow that deploys to the production
   Worker (`wrangler deploy`) or that requires the maintainer's Cloudflare
   credentials. This repo intentionally has no deploy-on-merge automation.
5. **Never** touch `scripts/get_cookies.py`'s "copied Chrome profile only"
   design — it must never open the user's real Chrome profile.
6. Keep the KV binding `id` in `worker/wrangler.toml` untouched in PRs; it
   points at the maintainer's own KV namespace.

## Style

- Follow the existing code: plain Fetch API in the Worker (no new frameworks),
  stdlib-only Python where the existing scripts are stdlib-only.
  Comments in `worker/` and `poller/` are bilingual/Japanese-first; match that
  style when editing those files. New docs aimed at contributors (like this
  file) are fine in English.
- Small, focused PRs. See [CONTRIBUTING.md](CONTRIBUTING.md) for the branch/PR
  flow, and the PR template for the required checklist.
