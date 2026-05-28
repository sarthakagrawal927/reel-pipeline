import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

export class OpenShortsAdapter {
  constructor(options = {}) {
    this.jobDir = options.jobDir ?? process.env.OPENSHORTS_JOB_DIR ?? './artifacts/openshorts-jobs';
  }

  async createVideo(brief) {
    const taskId = `openshorts_${brief.id}_${Date.now()}`;
    const dir = path.resolve(this.jobDir, taskId);
    await mkdir(dir, { recursive: true });
    const specPath = path.join(dir, 'job.json');
    const spec = toOpenShortsJob(brief);
    await writeFile(specPath, `${JSON.stringify(spec, null, 2)}\n`);
    return {
      provider: 'openshorts',
      externalTaskId: taskId,
      status: 'queued',
      videos: [],
      raw: {
        specPath,
        spec,
        next: 'Run this job through OpenShorts once paid UGC dependencies are configured.',
      },
    };
  }
}

export function toOpenShortsJob(brief) {
  return {
    title: brief.title,
    platform: platformForChannel(brief.channel),
    hook: brief.hook,
    script: brief.body,
    cta: brief.cta ?? '',
    product_url: brief.productUrl ?? '',
    duration_seconds: brief.durationSeconds,
    output_format: 'vertical_reel',
    guardrails: [
      'Do not autopost from this adapter.',
      'Generate draft assets only.',
      'Use UGC actor workflow only when actor/provider credentials are explicitly configured.',
    ],
  };
}

function platformForChannel(channel) {
  if (channel === 'youtube_shorts') return 'youtube';
  if (channel === 'instagram_reels') return 'instagram';
  return channel;
}
