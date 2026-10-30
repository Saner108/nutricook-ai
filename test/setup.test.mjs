import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { EventEmitter } from 'node:events';
import config from '../vite.config.js';

test('local .env.local key reaches only the dev proxy, not client configuration', async () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'nutri-env-'));
  const cwd = process.cwd();
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.ANTHROPIC_API_KEY;
  try {
    delete process.env.ANTHROPIC_API_KEY;
    writeFileSync(path.join(directory, '.env.local'), 'ANTHROPIC_API_KEY=local-test-key\n');
    process.chdir(directory);
    const resolved = config({ mode: 'development' });
    assert.equal(resolved.define, undefined);
    const routes = new Map();
    resolved.plugins.find(plugin => plugin.name === 'dev-api-generate').configureServer({
      middlewares: { use: (route, handler) => routes.set(route, handler) },
    });
    let upstreamKey;
    globalThis.fetch = async (_url, options) => {
      upstreamKey = options.headers['x-api-key'];
      return new Response('{"content":[]}', { headers: { 'content-type': 'application/json' } });
    };
    const request = new EventEmitter();
    request.method = 'POST';
    const result = new Promise(resolve => {
      routes.get('/api/generate')(request, { setHeader() {}, end: resolve });
    });
    request.emit('data', '{"messages":[]}');
    request.emit('end');
    assert.equal(await result, '{"content":[]}');
    assert.equal(upstreamKey, 'local-test-key');
  } finally {
    process.chdir(cwd);
    globalThis.fetch = originalFetch;
    if (originalKey === undefined) delete process.env.ANTHROPIC_API_KEY;
    else process.env.ANTHROPIC_API_KEY = originalKey;
    rmSync(directory, { recursive: true, force: true });
  }
});
