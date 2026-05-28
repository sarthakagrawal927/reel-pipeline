# Reel Pipeline

Internal AI reel pipeline for SaaS Maker Marketing Queue.

The goal is to turn accepted/generated marketing ideas into reviewable video
drafts, then later schedule/autopost approved videos. SaaS Maker remains the
control plane; this repo owns rendering orchestration.

## Current Status

- `VideoBrief` contract for reel-platform ideas.
- Mock renderer that proves request -> artifact -> `video_ready`.
- MoneyPrinterTurbo adapter for cheap stock-footage rendering.
- Local MoneyPrinterTurbo canary for no-secrets MP4 generation.
- HTTP API with `POST /renders`, `GET /renders/:id`, and `GET /health`.
- Tests for queue mapping, validation, adapter request shape, and mock render.

## Commands

```bash
npm test
npm run bootstrap:cloudflare
npm run smoke:mock
npm run probe:engines
npm run check:cloudflare
npm run canary:moneyprinter
npm run render:accepted -- --mode mock --limit 5
npm run render:accepted -- --mode mock --limit 5 \
  --artifact-public-dir ./tmp/public-reels \
  --artifact-base-url https://assets.example.com/reels
npm run render:accepted -- --mode moneyprinterturbo --limit 1 \
  --artifact-r2-bucket reel-artifacts \
  --artifact-base-url https://assets.example.com/reels
npm run render:accepted -- --fixture test/fixtures/accepted-marketing-posts.json --mode mock --limit 1
npm run post:ready -- --fixture test/fixtures/post-ready-marketing-posts.json --confirm-post --limit 1
npm run smoke:full
npm run smoke:artifact -- https://assets.example.com sample.mp4
npm run worker:dry-run
npm run dev
```

`canary:moneyprinter` expects MoneyPrinterTurbo to be running at
`MONEYPRINTER_API_URL` or `http://127.0.0.1:8080`. It uses local generated
video/audio fixtures only, so it does not spend LLM, TTS, stock-footage, or
posting API quota.

## Local API

```bash
curl -sS http://127.0.0.1:4317/health

curl -sS http://127.0.0.1:4317/renders \
  -H 'content-type: application/json' \
  -d '{
    "id": "brief-1",
    "projectSlug": "linkchat",
    "channel": "tiktok",
    "title": "AI profile answers repeated DMs",
    "hook": "POV: your link-in-bio answers the same DM before you see it.",
    "body": "Script: show repeated DMs then Linkchat answering them.\nShot list: phone DM pile, product chat screen, result screen.\nCaptions: same question again, let the profile answer first.\nAsset prompts: vertical phone UI, creator desk, product demo.",
    "cta": "Open the profile and ask one question.",
    "renderMode": "mock"
  }'

curl -sS http://127.0.0.1:4317/marketing/render-accepted \
  -H 'content-type: application/json' \
  -d '{"mode":"mock","limit":5}'
```

`render:accepted` and `/marketing/render-accepted` pull accepted SaaS Maker
Marketing Queue items, render only reel channels, skip items that already have
`asset_url` or `result_url`, and patch the generated artifact back onto the
queue item.

Use `--fixture` for local end-to-end testing without SaaS Maker auth.
Use `--artifact-public-dir` plus `--artifact-base-url` when the synced queue
item needs an HTTP asset URL instead of a local file URL.
Use `--artifact-r2-bucket` plus `--artifact-base-url` to upload with
`npx wrangler r2 object put`; this relies on the local Wrangler login and does
not store credentials in this repo.

`worker:dry-run` validates the R2-backed artifact Worker. The Worker exposes
`GET /health` and `GET /reels/:key`; production upload URLs should use the same
base URL passed as `--artifact-base-url`.

`check:cloudflare` verifies Wrangler auth, confirms the configured R2 bucket is
visible, and runs a Worker dry-run. `smoke:artifact` verifies the deployed
artifact Worker can serve an uploaded object.

`bootstrap:cloudflare` is guarded. Without flags it only authenticates,
checks the bucket, and dry-runs deploy. Use `--confirm-create-bucket` to create
the configured R2 bucket and `--confirm-deploy` to deploy the Worker.

`post:ready` is deliberately gated: it only processes accepted reel-channel
items with a rendered asset, a due `scheduled_for` timestamp, and
`--confirm-post`. The default `manual` provider prepares a posting handoff and
does not call external social APIs.

## Next Milestones

1. Create/bind the real `reel-artifacts` R2 bucket and route/domain.
2. Wire a real posting provider after manual gate proves useful.
3. Replace OpenShorts job-spec scaffold with an enabled UGC render once paid providers are chosen.

## Upstream Engines

Pinned submodules live under `engines/`. See `docs/submodules.md` and
`docs/engine-pins.md`.

```bash
git submodule update --init --recursive
```
