const JSON_HEADERS = {
  'content-type': 'application/json; charset=utf-8',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === 'GET' && url.pathname === '/health') {
      return json({ ok: true });
    }

    if (request.method === 'GET' && url.pathname.startsWith('/reels/')) {
      return serveArtifact(url.pathname.slice('/reels/'.length), env, request);
    }

    return json({ error: 'not found' }, 404);
  },
};

async function serveArtifact(key, env, request) {
  if (!env.REEL_ARTIFACTS) return json({ error: 'missing REEL_ARTIFACTS binding' }, 500);
  if (!isSafeKey(key)) return json({ error: 'invalid artifact key' }, 400);

  const range = parseRange(request.headers.get('range'));
  const object = await env.REEL_ARTIFACTS.get(key, range ? { range } : undefined);
  if (!object) return json({ error: 'artifact not found' }, 404);

  const headers = new Headers();
  object.writeHttpMetadata(headers);
  headers.set('etag', object.httpEtag);
  headers.set('cache-control', 'public, max-age=31536000, immutable');
  headers.set('access-control-allow-origin', '*');
  headers.set('accept-ranges', 'bytes');
  if (!headers.has('content-type')) headers.set('content-type', contentTypeFor(key));
  if (range && typeof object.size === 'number') {
    const offset = range.offset ?? 0;
    const length = range.length ?? object.size - offset;
    headers.set('content-range', `bytes ${offset}-${offset + length - 1}/${object.size}`);
    headers.set('content-length', String(length));
    return new Response(object.body, { status: 206, headers });
  }
  return new Response(object.body, { headers });
}

function isSafeKey(key) {
  return Boolean(key) && !key.includes('..') && !key.includes('/') && /^[A-Za-z0-9._-]+$/.test(key);
}

function contentTypeFor(key) {
  if (key.endsWith('.mp4')) return 'video/mp4';
  if (key.endsWith('.json')) return 'application/json; charset=utf-8';
  if (key.endsWith('.webm')) return 'video/webm';
  if (key.endsWith('.png')) return 'image/png';
  if (key.endsWith('.jpg') || key.endsWith('.jpeg')) return 'image/jpeg';
  return 'application/octet-stream';
}

function parseRange(value) {
  if (!value) return null;
  const match = value.match(/^bytes=(\d+)-(\d*)$/);
  if (!match) return null;
  const offset = Number(match[1]);
  const end = match[2] ? Number(match[2]) : undefined;
  if (!Number.isFinite(offset) || offset < 0) return null;
  if (end !== undefined && (!Number.isFinite(end) || end < offset)) return null;
  return end === undefined ? { offset } : { offset, length: end - offset + 1 };
}

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}
