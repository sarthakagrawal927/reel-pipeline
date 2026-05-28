import http from 'node:http';
import { createDraftVideo, createRenderResponse, getDraftVideoStatus, renderAcceptedMarketingPosts } from '../pipeline.js';
import { postReadyMarketingVideos } from '../posting.js';

const port = Number(process.env.PORT ?? 4317);

export function createServer(options = {}) {
  return http.createServer(async (req, res) => {
    try {
      if (req.method === 'GET' && req.url === '/health') {
        return json(res, 200, { ok: true });
      }
      if (req.method === 'POST' && req.url === '/renders') {
        const body = await readJson(req);
        const data = await createDraftVideo(body, options);
        return json(res, 201, { data: createRenderResponse(data) });
      }
      if (req.method === 'POST' && req.url === '/marketing/render-accepted') {
        const body = await readJson(req);
        const data = await renderAcceptedMarketingPosts({ ...options, ...body });
        return json(res, 200, { data });
      }
      if (req.method === 'POST' && req.url === '/marketing/post-ready') {
        const body = await readJson(req);
        const data = await postReadyMarketingVideos({ ...options, ...body });
        return json(res, 200, { data });
      }
      const statusMatch = req.method === 'GET' && req.url?.match(/^\/renders\/([^/?#]+)$/);
      if (statusMatch) {
        const data = await getDraftVideoStatus(decodeURIComponent(statusMatch[1]), options);
        if (!data) return json(res, 404, { error: 'render not found' });
        return json(res, 200, { data: createRenderResponse(data) });
      }
      return json(res, 404, { error: 'not found' });
    } catch (error) {
      return json(res, 400, { error: error instanceof Error ? error.message : String(error) });
    }
  });
}

function json(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json' });
  res.end(JSON.stringify(body));
}

async function readJson(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  createServer().listen(port, () => {
    console.log(`reel-pipeline listening on http://127.0.0.1:${port}`);
  });
}
