import assert from 'node:assert/strict';
import test from 'node:test';

import worker from '../src/worker/index.js';

test('artifact worker health endpoint returns ok', async () => {
  const res = await worker.fetch(new Request('https://assets.example.test/health'), {});
  assert.equal(res.status, 200);
  assert.deepEqual(await res.json(), { ok: true });
});

test('artifact worker serves R2 objects with video cache headers', async () => {
  const env = {
    REEL_ARTIFACTS: {
      get: async (key) => {
        assert.equal(key, 'draft.mp4');
        return {
          body: 'mp4-body',
          httpEtag: '"etag"',
          writeHttpMetadata: (headers) => headers.set('content-type', 'video/mp4'),
        };
      },
    },
  };

  const res = await worker.fetch(new Request('https://assets.example.test/reels/draft.mp4'), env);
  assert.equal(res.status, 200);
  assert.equal(res.headers.get('content-type'), 'video/mp4');
  assert.equal(res.headers.get('cache-control'), 'public, max-age=31536000, immutable');
  assert.equal(await res.text(), 'mp4-body');
});

test('artifact worker supports byte ranges for video playback', async () => {
  const env = {
    REEL_ARTIFACTS: {
      get: async (key, options) => {
        assert.equal(key, 'draft.mp4');
        assert.deepEqual(options, { range: { offset: 0, length: 4 } });
        return {
          body: 'mp4-',
          size: 100,
          httpEtag: '"etag"',
          writeHttpMetadata: (headers) => headers.set('content-type', 'video/mp4'),
        };
      },
    },
  };

  const res = await worker.fetch(new Request('https://assets.example.test/reels/draft.mp4', {
    headers: { range: 'bytes=0-3' },
  }), env);
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('accept-ranges'), 'bytes');
  assert.equal(res.headers.get('content-range'), 'bytes 0-3/100');
  assert.equal(await res.text(), 'mp4-');
});

test('artifact worker supports open-ended byte ranges', async () => {
  const env = {
    REEL_ARTIFACTS: {
      get: async (key, options) => {
        assert.equal(key, 'draft.mp4');
        assert.deepEqual(options, { range: { offset: 10 } });
        return {
          body: 'tail',
          size: 100,
          httpEtag: '"etag"',
          writeHttpMetadata: (headers) => headers.set('content-type', 'video/mp4'),
        };
      },
    },
  };

  const res = await worker.fetch(new Request('https://assets.example.test/reels/draft.mp4', {
    headers: { range: 'bytes=10-' },
  }), env);
  assert.equal(res.status, 206);
  assert.equal(res.headers.get('content-range'), 'bytes 10-99/100');
});

test('artifact worker rejects unsafe artifact keys', async () => {
  const res = await worker.fetch(new Request('https://assets.example.test/reels/bad/key'), {
    REEL_ARTIFACTS: { get: async () => null },
  });
  assert.equal(res.status, 400);
});
