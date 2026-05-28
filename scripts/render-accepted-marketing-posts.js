import { renderAcceptedMarketingPosts } from '../src/pipeline.js';
import { readFile } from 'node:fs/promises';

const args = parseArgs(process.argv.slice(2));

const result = await renderAcceptedMarketingPosts({
  mode: args.mode ?? process.env.REEL_RENDER_MODE ?? 'mock',
  limit: Number(args.limit ?? process.env.REEL_RENDER_LIMIT ?? 5),
  projectSlug: args.project,
  channel: args.channel,
  pollIntervalMs: Number(args.pollIntervalMs ?? 2000),
  pollLimit: Number(args.pollLimit ?? 60),
  artifacts: {
    baseUrl: args.artifactBaseUrl ?? args['artifact-base-url'],
    publicDir: args.artifactPublicDir ?? args['artifact-public-dir'],
    r2Bucket: args.artifactR2Bucket ?? args['artifact-r2-bucket'],
  },
  ...(args.fixture ? { saasMakerClient: await fixtureClient(args.fixture) } : {}),
});

console.log(JSON.stringify(result, null, 2));

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (!arg.startsWith('--')) continue;
    const key = arg.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith('--')) {
      parsed[key] = true;
    } else {
      parsed[key] = next;
      index += 1;
    }
  }
  return parsed;
}

async function fixtureClient(file) {
  const posts = JSON.parse(await readFile(file, 'utf8'));
  const updates = [];
  return {
    listMarketingPosts: async () => Array.isArray(posts) ? posts : posts.data,
    updateMarketingPost: async (id, patch) => {
      updates.push({ id, patch });
      return { skipped: false, data: { id, ...patch } };
    },
  };
}
