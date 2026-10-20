import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';
import { createDemoPanel } from '../demo/panel.mjs';

const root = path.resolve(import.meta.dirname, '..');
const html = fs.readFileSync(path.join(root, 'demo/index.html'), 'utf8');

function fixture(t) {
  const dom = new JSDOM(html, { url: 'http://localhost:4173/demo/', pretendToBeVisual: true });
  const { window } = dom;
  const saved = new Map();
  for (const key of ['window', 'document', 'HTMLElement', 'Element', 'MutationObserver', 'getComputedStyle']) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, {
      configurable: true, writable: true,
      value: key === 'window' ? window : key === 'getComputedStyle' ? window.getComputedStyle.bind(window) : window[key],
    });
  }
  let networkCalls = 0;
  const rejectNetwork = () => { networkCalls++; throw new Error('The local demo must not make a network request.'); };
  saved.set('fetch', Object.getOwnPropertyDescriptor(globalThis, 'fetch'));
  globalThis.fetch = rejectNetwork;
  window.fetch = rejectNetwork;
  window.XMLHttpRequest = class { constructor() { rejectNetwork(); } };
  window.navigator.sendBeacon = rejectNetwork;
  let coarse = false;
  window.matchMedia = query => ({
    matches: query.includes('pointer: coarse') && coarse,
    media: query, addEventListener() {}, removeEventListener() {},
  });
  const launcher = window.document.createElement('button');
  launcher.textContent = 'Open';
  window.document.body.append(launcher);
  const ui = createDemoPanel(launcher);
  t.after(() => {
    ui.destroy();
    window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  return {
    window, ui, launcher,
    panel: window.document.getElementById('demo-conversation'),
    input: window.document.querySelector('textarea'),
    form: window.document.querySelector('form'),
    networkCalls: () => networkCalls,
    setCoarse(value) { coarse = value; },
  };
}

test('actual demo renders user input as text and uses only local sample replies', t => {
  const f = fixture(t);
  assert.equal(f.panel.hidden, true);
  f.ui.open();
  assert.equal(f.panel.hidden, false);
  assert.match(f.panel.textContent, /Demo replies are local samples\. No model connected\./);
  const userText = '<img src="https://example.invalid/pixel" onerror="alert(1)"> & <script>bad()</script>';
  f.input.value = userText;
  f.form.requestSubmit();
  assert.equal(f.panel.querySelector('[data-chat-message="user"]').textContent, userText);
  assert.equal(f.panel.querySelectorAll('img, script').length, 0);
  assert.match(f.panel.querySelector('[data-chat-message="assistant"]:last-child').textContent, /local sample response/);
  assert.equal(f.input.value, '');
  assert.equal(f.networkCalls(), 0);
  f.ui.close();
  assert.equal(f.panel.hidden, true);
  assert.equal(f.launcher.hidden, false);
  assert.equal(f.window.document.activeElement, f.launcher);
});

test('demo keyboard submission preserves touch, Shift+Enter, and IME composition', t => {
  const f = fixture(t);
  f.ui.open();
  const messages = () => f.panel.querySelectorAll('[data-chat-message]').length;
  function enter(options = {}) {
    const event = new f.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true, ...options });
    f.input.dispatchEvent(event);
    return event;
  }
  f.input.value = 'How does mobile work?';
  assert.equal(enter({ shiftKey: true }).defaultPrevented, false);
  assert.equal(enter({ isComposing: true }).defaultPrevented, false);
  f.setCoarse(true);
  assert.equal(enter().defaultPrevented, false);
  assert.equal(messages(), 1);
  f.setCoarse(false);
  assert.equal(enter().defaultPrevented, true);
  assert.equal(messages(), 3);
  f.input.value = '   ';
  f.form.requestSubmit();
  assert.equal(messages(), 3);
  assert.equal(f.networkCalls(), 0);
});

test('real demo entry keeps panel code in a dynamic module and has no external imports', async () => {
  const dom = new JSDOM(html);
  const entries = [...dom.window.document.querySelectorAll('script[type="module"]')];
  assert.equal(entries.length, 1);
  assert.equal(dom.window.document.querySelectorAll('script[src], link[rel="stylesheet"], img').length, 0);
  const result = await build({
    absWorkingDir: root,
    stdin: { contents: entries[0].textContent, resolveDir: path.join(root, 'demo'), sourcefile: 'demo-entry.mjs' },
    bundle: true, splitting: true, format: 'esm', platform: 'browser',
    outdir: path.join(os.tmpdir(), 'ultralight-demo-graph'), write: false, metafile: true,
  });
  dom.window.close();
  const outputs = Object.values(result.metafile.outputs);
  const entry = outputs.find(output => output.entryPoint?.endsWith('demo-entry.mjs'));
  assert.ok(entry);
  assert.ok(Object.keys(entry.inputs).some(input => input.endsWith('chat/launcher.mjs')));
  assert.equal(Object.keys(entry.inputs).some(input => input.endsWith('demo/panel.mjs') || input.endsWith('chat/panel.mjs')), false);
  assert.ok(entry.imports.some(imported => imported.kind === 'dynamic-import'));
  assert.equal(outputs.some(output => output.imports.some(imported => imported.external)), false);
});
