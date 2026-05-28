const baseUrl = process.env.REEL_ARTIFACT_BASE_URL ?? process.argv[2];
const key = process.env.REEL_ARTIFACT_SMOKE_KEY ?? process.argv[3];

if (!baseUrl || !key) {
  throw new Error('usage: REEL_ARTIFACT_BASE_URL=https://... REEL_ARTIFACT_SMOKE_KEY=file.mp4 npm run smoke:artifact');
}

const health = await fetch(`${baseUrl.replace(/\/$/, '')}/health`);
if (!health.ok) throw new Error(`artifact worker health failed: ${health.status} ${await health.text()}`);

const artifact = await fetch(`${baseUrl.replace(/\/$/, '')}/reels/${encodeURIComponent(key)}`);
if (!artifact.ok) throw new Error(`artifact fetch failed: ${artifact.status} ${await artifact.text()}`);

const contentType = artifact.headers.get('content-type') ?? '';
if (!contentType.includes('video/') && !contentType.includes('application/octet-stream')) {
  throw new Error(`unexpected artifact content-type: ${contentType}`);
}

console.log(JSON.stringify({
  ok: true,
  baseUrl,
  key,
  contentType,
  cacheControl: artifact.headers.get('cache-control'),
  etag: artifact.headers.get('etag'),
}, null, 2));
