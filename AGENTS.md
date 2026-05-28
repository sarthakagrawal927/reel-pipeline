# reel-pipeline

AI reel generation and autopost orchestration for fleet products.

## Operating Rules

- Keep SaaS Maker as the source of truth for marketing ideas, approval state, and task linkage.
- Keep render engines behind adapters; do not edit vendored upstream engines unless there is no adapter-only path.
- Do not touch platform credentials, API tokens, social accounts, `.env` files, or cloud deployment config without explicit approval.
- Default to draft/export flows; autopost must require an accepted queue item.
- Prefer cheap/local render paths first, then premium UGC actors when quality requires it.
- Every engine integration must have a smoke test that proves request -> status -> artifact metadata.

## Engine Strategy

- `MoneyPrinterTurbo`: default cheap renderer for stock-footage + voice + subtitles.
- `OpenShorts`: UGC actor workflow reference and optional premium adapter.
- `reel-maker`: legacy Remotion/Modal engine; reuse pieces after the pipeline contract is stable.
