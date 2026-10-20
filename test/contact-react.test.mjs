import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

import * as React from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { ChatContactForm } from '../chat/contact-react.mjs';

test('React wrapper retains the same draft DOM and pending send while callbacks change; cleanup rejects late updates', async t => {
  const dom = new JSDOM('<div id="host"></div>');
  const saved = new Map();
  for (const [key, value] of Object.entries({ window: dom.window, document: dom.window.document, IS_REACT_ACT_ENVIRONMENT: true })) {
    saved.set(key, Object.getOwnPropertyDescriptor(globalThis, key));
    Object.defineProperty(globalThis, key, { configurable: true, writable: true, value });
  }
  const root = createRoot(document.querySelector('#host'));
  let unmounted = false;
  t.after(async () => {
    if (!unmounted) await act(() => root.unmount());
    dom.window.close();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor); else delete globalThis[key];
    }
  });
  let firstCalls = 0, latestCalls = 0, drafts = 0, statuses = [], resolve;
  const ref = React.createRef();
  await act(() => root.render(React.createElement(ChatContactForm, { ref, onSubmit() { firstCalls++; }, values: { name: 'Initial' } })));
  const form = document.querySelector('form');
  form.elements.name.value = 'Typed draft'; form.elements.email.value = 'visitor@example.invalid'; form.elements.message.value = 'Message';
  await act(() => root.render(React.createElement(ChatContactForm, { ref,
    onSubmit() { latestCalls++; return new Promise(done => { resolve = done; }); },
    onDraftChange() { drafts++; }, onStatusChange(status) { statuses.push(status); }, values: { name: 'New prop should not overwrite draft' },
  })));
  assert.equal(document.querySelector('form'), form);
  assert.equal(ref.current.getValues().name, 'Typed draft');
  form.elements.name.dispatchEvent(new dom.window.Event('input', { bubbles: true }));
  assert.equal(drafts, 1);
  ref.current.setStatus({ kind:'error', message:'Adapter state', locked:false });
  assert.equal(ref.current.getStatus().message, 'Adapter state');
  assert.equal(statuses.length, 1);
  form.querySelector('[data-contact-send]').click();
  assert.equal(firstCalls, 0); assert.equal(latestCalls, 1);
  const status = form.querySelector('[role=status]'); const before = status.textContent;
  await act(() => root.unmount()); unmounted = true;
  resolve({ ok: true, message: 'Late result' }); await new Promise(done => setImmediate(done));
  assert.equal(status.textContent, before); assert.equal(form.isConnected, false);
});
