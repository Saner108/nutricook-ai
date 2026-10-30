import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { build } from 'esbuild';
import React from 'react';
import { renderToString } from 'react-dom/server';

test('shipped application imports and renders the demo entry screen', async () => {
  const root = fileURLToPath(new URL('../', import.meta.url));
  const directory = mkdtempSync(path.join(root, 'node_modules', '.nutri-smoke-'));
  try {
    const bundle = await build({
      entryPoints: [path.join(root, 'artifacts/NutriCookAI_v2.tsx')],
      bundle: true,
      write: false,
      platform: 'node',
      format: 'esm',
      external: ['react', 'react-dom', '@supabase/supabase-js'],
      define: { 'import.meta.env': '{}' },
    });
    const filename = path.join(directory, 'app.mjs');
    writeFileSync(filename, bundle.outputFiles[0].text);
    const { default: App } = await import(pathToFileURL(filename));
    const html = renderToString(React.createElement(App));
    assert.match(html, /NUTRICOOK AI/);
    assert.match(html, /Today/);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
