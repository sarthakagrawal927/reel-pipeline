# Reel Pipeline Architecture

`reel-pipeline` is the video generation layer for SaaS Maker Marketing Queue.
It does not replace SaaS Maker; it turns accepted/generated marketing ideas into
reviewable video drafts.

## Control Plane

SaaS Maker remains the source of truth:

1. Agent creates a Marketing Queue item.
2. User accepts or rejects the item.
3. `reel-pipeline` converts an accepted item into a `VideoBrief`.
4. A render adapter creates a draft video.
5. The MP4, thumbnail, captions, logs, and provider metadata are attached back to the queue item.
6. Autopost only runs after explicit acceptance/scheduling.

## Engines

### MoneyPrinterTurbo

Default cheap path. Good for stock-footage videos with Edge TTS, subtitles,
background music, and FFmpeg/MoviePy composition.

Use it first because it is MIT licensed, heavily starred, actively maintained,
and runs with Docker or local Python. The first canary uses local generated
video/audio material only, so the renderer can be verified without API quota.

### OpenShorts

Premium UGC path and workflow reference. It is closer to ReelFarm: UGC actors,
website/product analysis, gallery, scheduling, and Upload-Post publishing.

Do not make it the first default engine because it assumes more paid services:
Gemini, fal.ai, ElevenLabs, Upload-Post, and optional S3.

The current adapter writes a guarded OpenShorts job spec only. It intentionally
does not invoke paid UGC dependencies or autopost.

### reel-maker

Legacy/internal Remotion + Modal prototype. Keep it as a possible custom engine
for Modal-native renders after the `VideoBrief` contract stabilizes.

## Update Policy

Upstream engines should be pinned by commit. Do not auto-update. Upgrade on a
branch only after canary renders pass.

## Current Real-Renderer Probe

The local machine has the baseline prerequisites for a MoneyPrinterTurbo canary:

- Docker daemon responds.
- `uv sync --frozen --dry-run` works in `engines/MoneyPrinterTurbo`.
- FFmpeg is installed.

Use:

```bash
npm run probe:engines
```

This does not install dependencies or start a render. It only verifies that the
real-render path is plausible before spending time or API quota.

After MoneyPrinterTurbo is running, use:

```bash
npm run canary:moneyprinter
```

The canary writes generated local fixtures under the MoneyPrinterTurbo storage
folder, submits `POST /api/v1/videos`, polls `GET /api/v1/tasks/:id`, verifies
the output MP4 exists, and saves a machine-readable result in
`tmp/moneyprinter-canary-result.json`.
