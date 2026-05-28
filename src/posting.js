import { SaaSMakerClient } from './saas-maker-client.js';

const REEL_CHANNELS = new Set(['tiktok', 'instagram_reels', 'youtube_shorts']);

export class ManualPostingProvider {
  constructor(options = {}) {
    this.now = options.now ?? (() => new Date());
  }

  async post(marketingPost) {
    return {
      provider: 'manual',
      status: 'prepared',
      channel: marketingPost.channel,
      assetUrl: marketingPost.result_url ?? marketingPost.asset_url,
      externalUrl: null,
      preparedAt: this.now().toISOString(),
      instructions: `Review and manually upload ${marketingPost.title} to ${marketingPost.channel}.`,
    };
  }
}

export class UploadPostProvider {
  constructor(options = {}) {
    this.apiKey = options.apiKey ?? process.env.UPLOAD_POST_API_KEY;
    this.baseUrl = (options.baseUrl ?? process.env.UPLOAD_POST_API_URL ?? 'https://api.upload-post.com').replace(/\/$/, '');
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async post(marketingPost) {
    if (!this.apiKey) throw new Error('missing UPLOAD_POST_API_KEY');
    const res = await this.fetchImpl(`${this.baseUrl}/posts`, {
      method: 'POST',
      headers: {
        'authorization': `Bearer ${this.apiKey}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        platform: platformForChannel(marketingPost.channel),
        video_url: marketingPost.result_url ?? marketingPost.asset_url,
        caption: buildCaption(marketingPost),
      }),
    });
    if (!res.ok) throw new Error(`Upload-Post failed ${res.status}: ${await res.text()}`);
    const payload = await res.json();
    return {
      provider: 'upload-post',
      status: 'posted',
      channel: marketingPost.channel,
      assetUrl: marketingPost.result_url ?? marketingPost.asset_url,
      externalUrl: payload.url ?? payload.post_url ?? null,
      postedAt: new Date().toISOString(),
      raw: payload,
    };
  }
}

export function createPostingProvider(mode = 'manual', options = {}) {
  if (mode === 'manual') return new ManualPostingProvider(options.manual);
  if (mode === 'upload-post') return new UploadPostProvider(options.uploadPost);
  throw new Error(`unsupported posting provider: ${mode}`);
}

export async function postReadyMarketingVideos(options = {}) {
  if (!options.confirmPost) {
    throw new Error('posting requires confirmPost=true');
  }

  const client = options.saasMakerClient ?? new SaaSMakerClient(options.saasMaker);
  const provider = options.provider ?? createPostingProvider(options.providerMode ?? 'manual', options);
  const posts = await client.listMarketingPosts({
    status: 'accepted',
    limit: options.limit ?? 20,
    ...(options.projectSlug ? { project_slug: options.projectSlug } : {}),
    ...(options.channel ? { channel: options.channel } : {}),
  });
  const now = options.now ?? new Date();
  const results = [];

  for (const post of posts) {
    const gate = postingGate(post, { now, includeUnscheduled: options.includeUnscheduled });
    if (!gate.ready) {
      results.push({ postId: post.id, skipped: true, reason: gate.reason });
      continue;
    }

    const posted = await provider.post(post);
    const patch = patchForPostingResult(post, posted);
    const sync = await client.updateMarketingPost(post.id, patch);
    results.push({ postId: post.id, posted, sync });
  }

  return { scanned: posts.length, results };
}

export function patchForPostingResult(post, posted) {
  const patch = {
      status: posted.status === 'posted' ? 'sent' : 'accepted',
      result_url: posted.externalUrl ?? post.result_url ?? post.asset_url,
      notes: appendPostingNotes(post.notes, posted),
    };

  if (posted.status === 'posted') {
    patch.posted_at = posted.postedAt;
  }

  return patch;
}

export function postingGate(post, options = {}) {
  if (!REEL_CHANNELS.has(post.channel)) return { ready: false, reason: 'not a reel channel' };
  if (post.status !== 'accepted') return { ready: false, reason: 'not accepted' };
  if (!post.result_url && !post.asset_url) return { ready: false, reason: 'missing rendered asset' };
  if (post.posted_at) return { ready: false, reason: 'already posted' };
  if (!options.includeUnscheduled && !post.scheduled_for) return { ready: false, reason: 'not scheduled' };
  if (post.scheduled_for && new Date(post.scheduled_for) > options.now) return { ready: false, reason: 'scheduled for later' };
  return { ready: true };
}

function appendPostingNotes(existingNotes, posted) {
  const lines = [
    existingNotes,
    'Posting gate handled by reel-pipeline.',
    `posting_provider: ${posted.provider}`,
    `posting_status: ${posted.status}`,
    posted.preparedAt ? `prepared_at: ${posted.preparedAt}` : null,
    posted.externalUrl ? `external_url: ${posted.externalUrl}` : null,
  ].filter(Boolean);
  return lines.join('\n');
}

function platformForChannel(channel) {
  if (channel === 'youtube_shorts') return 'youtube';
  if (channel === 'instagram_reels') return 'instagram';
  return channel;
}

function buildCaption(post) {
  return [post.hook, post.cta].filter(Boolean).join('\n\n') || post.title;
}
