import test from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';
import { build } from 'esbuild';
import { createContactForm } from '../chat/contact.mjs';
const settled = () => new Promise(resolve => setImmediate(resolve));
const values = { name: 'Visitor', email: 'visitor@example.invalid', message: 'Please reply to this message.' };
function fixture(t, options = {}) {
  const dom = new JSDOM('<button id="outside">Outside</button>');
  const doc = dom.window.document;
  const outside = doc.querySelector('button'); outside.focus();
  const ui = createContactForm({ document: doc, values, onSubmit: () => ({ ok: false }), ...options });
  doc.body.append(ui.element);
  t.after(() => { ui.destroy(); dom.window.close(); });
  return { dom, doc, ui, outside, send: ui.element.querySelector('[data-contact-send]'), back: ui.element.querySelector('button[type=button]'), status: ui.element.querySelector('[role=status]') };
}

test('mount is inert and accessible; only Send activation submits exact explicit fields', async t => {
  const sent = [], drafts = [];
  const f = fixture(t, { onSubmit: data => { sent.push(data); return { ok: false, message: 'Not sent' }; }, onDraftChange: data => drafts.push(data) });
  assert.equal(f.doc.activeElement, f.outside, 'mount does not take focus');
  const fields = f.ui.element.elements;
  for (const name of ['name','email','message']) {
    assert.equal(fields[name].required, true);
    assert.ok(fields[name].closest('label').textContent.includes(name === 'name' ? 'Name' : name === 'email' ? 'Email' : 'Message'));
  }
  assert.equal(fields.email.type, 'email');
  assert.deepEqual(['name','email','message'].map(name => fields[name].maxLength), [120,200,4000]);
  assert.equal(fields.website.tabIndex, -1); assert.equal(fields.website.getAttribute('aria-hidden'), 'true');
  fields.name.value = 'Edited visitor';
  fields.name.dispatchEvent(new f.dom.window.Event('input', { bubbles: true }));
  assert.equal(drafts.length, 1); assert.equal(sent.length, 0);
  const enter = new f.dom.window.KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  fields.name.dispatchEvent(enter); assert.equal(enter.defaultPrevented, true);
  f.ui.element.requestSubmit(); await settled(); assert.equal(sent.length, 0, 'implicit or unqualified submit is ignored');
  f.send.click(); await settled();
  assert.deepEqual(sent, [{ ...values, name: 'Edited visitor', website: '' }]);
  assert.equal(f.status.textContent, 'Not sent');
  assert.equal(fields.name.value, 'Edited visitor');
});

test('validation blocks incomplete fields; limits and adapter verification stay outside submitted values', async t => {
  const dom = new JSDOM();
  const verification = dom.window.document.createElement('input'); verification.name = 'verification'; verification.value = 'adapter-token';
  let received;
  const f = fixture(t, { extraFields: verification, limits: { message: 1800 }, onSubmit: data => { received = data; return { ok: false }; } });
  assert.equal(f.ui.element.elements.message.maxLength, 1800);
  f.ui.element.elements.email.value = 'invalid'; f.send.click(); await settled(); assert.equal(received, undefined);
  f.ui.element.elements.email.value = values.email;
  f.ui.element.elements.website.value = 'spam-filled-honeypot';
  f.send.click(); await settled();
  assert.deepEqual(received, { ...values, website: 'spam-filled-honeypot' });
  assert.equal(Object.keys(received).includes('verification'), false);
  dom.window.close();
});

test('Back stays available during pending send and hidden late success updates without focus or duplicate send', async t => {
  let resolve, requests = 0, backs = 0;
  const f = fixture(t, { onSubmit: () => { requests++; return new Promise(done => { resolve = done; }); }, onBack: () => { backs++; f.ui.element.hidden = true; } });
  f.send.click(); f.send.click();
  f.ui.element.dispatchEvent(new f.dom.window.SubmitEvent('submit', { submitter: f.send, cancelable: true }));
  assert.equal(requests, 1); assert.equal(f.send.disabled, true); assert.equal(f.back.disabled, false);
  assert.equal(f.ui.element.getAttribute('aria-busy'), 'true');
  f.back.click(); assert.equal(backs, 1); assert.equal(f.ui.element.hidden, true);
  f.outside.focus();
  resolve({ ok: true, message: '<img src=x onerror=bad()> Message received.' }); await settled();
  assert.equal(f.doc.activeElement, f.outside); assert.equal(f.ui.element.hidden, true);
  assert.equal(f.status.textContent, '<img src=x onerror=bad()> Message received.');
  assert.equal(f.status.querySelector('img'), null); assert.equal(f.send.disabled, true);
  for (const name of ['name','email','message','website']) assert.equal(f.ui.element.elements[name].disabled, true);
  assert.deepEqual(f.ui.getValues(), { ...values, website: '' });
  f.ui.element.hidden = false; f.send.click(); assert.equal(requests, 1);
});

test('definite rejection is editable; ambiguous results and exceptions lock without automatic retries', async t => {
  for (const outcome of [{ ok: 'true', message: '<b>Unconfirmed</b>' }, undefined, { ok: false }, new Error('private transport details')]) {
    let requests = 0;
    const f = fixture(t, { onSubmit: () => { requests++; if (outcome instanceof Error) throw outcome; return outcome; } });
    f.send.click(); await settled();
    const locked = outcome?.ok !== false;
    assert.equal(f.send.disabled, locked);
    assert.equal(f.ui.getStatus().locked, locked);
    assert.deepEqual(f.ui.getValues(), { ...values, website: '' });
    assert.equal(f.status.querySelector('b'), null);
    assert.doesNotMatch(f.status.textContent, /private transport/);
    assert.equal(f.doc.activeElement, f.outside);
    assert.equal(requests, 1); await settled(); assert.equal(requests, 1);
    if (locked) {
      f.send.click();
      f.ui.element.dispatchEvent(new f.dom.window.SubmitEvent('submit', { submitter: f.send, cancelable: true }));
      assert.equal(requests, 1);
    }
  }
});

test('restored terminal status cannot unlock; status callbacks and optional name stay adapter-owned', async t => {
  const changes = [];
  let requests = 0;
  const f = fixture(t, { initialStatus: { kind:'uncertain', message:'Check your contact page.', locked:true },
    onStatusChange: status => changes.push(status), onSubmit: () => { requests++; } });
  assert.deepEqual(f.ui.getStatus(), { kind:'uncertain', message:'Check your contact page.', locked:true });
  assert.equal(changes.length, 0, 'restoring status does not emit a new attempt');
  f.send.click(); assert.equal(requests, 0);
  const copy = f.ui.getStatus(); copy.locked = false;
  f.ui.setStatus({ kind:'error', message:'Attempt remains locked.', locked:false });
  assert.equal(f.ui.getStatus().locked, true, 'terminal uncertainty cannot become sendable');
  f.ui.destroy(); const before = changes.length;
  f.ui.setStatus({ kind:'error' }); assert.equal(changes.length, before);

  const statuses = [];
  const fresh = fixture(t, { requireName:false, limits:{ name:120, email:254, message:3000 },
    onStatusChange: status => statuses.push(status), onSubmit: () => { requests++; return { ok:false, message:'Definite rejection' }; } });
  assert.equal(fresh.ui.element.elements.name.required, false);
  assert.equal(fresh.ui.element.elements.email.maxLength, 254);
  assert.equal(fresh.ui.element.elements.message.maxLength, 3000);
  fresh.ui.setStatus({ kind:'error', message:'Ready to correct your details.', locked:false });
  fresh.ui.element.elements.name.value = '';
  fresh.send.click(); await settled();
  assert.equal(requests, 1); assert.equal(fresh.send.disabled, false);
  assert.deepEqual(statuses.map(status => status.kind), ['error','pending','error']);
  assert.equal(statuses[1].locked, true);
  fresh.ui.setStatus({ kind:'success', message:'Confirmed', locked:false });
  assert.equal(fresh.ui.getStatus().locked, true, 'success cannot be restored as sendable');
});

test('explicit uncertainty and locked failure leave Back available without another send', async t => {
  for (const outcome of [{ ok:false, uncertain:true, message:'May have arrived' }, { ok:false, locked:true, message:'Do not retry' }]) {
    let requests = 0, backs = 0;
    const f = fixture(t, { onSubmit: () => { requests++; return outcome; }, onBack: () => { backs++; } });
    f.send.click(); await settled();
    assert.equal(f.ui.getStatus().locked, true);
    assert.equal(f.status.textContent, outcome.message);
    assert.equal(f.ui.element.elements.message.disabled, true);
    f.back.click(); assert.equal(backs, 1); f.send.click(); assert.equal(requests, 1);
  }
});

test('explicit focus works; destroyed pending forms never update or call callbacks again', async t => {
  let resolve, requests = 0;
  const f = fixture(t, { onSubmit: () => { requests++; return new Promise(done => { resolve = done; }); } });
  f.ui.focus(); assert.equal(f.doc.activeElement, f.ui.element.elements.name);
  f.send.click(); const before = f.status.textContent;
  f.ui.destroy(); f.ui.destroy(); f.outside.focus();
  resolve({ ok: true, message: 'Late receipt' }); await settled();
  assert.equal(f.status.textContent, before); assert.equal(f.ui.element.isConnected, false); assert.equal(f.doc.activeElement, f.outside);
  f.ui.element.dispatchEvent(new f.dom.window.SubmitEvent('submit', { submitter: f.send, cancelable: true }));
  f.ui.focus(); assert.equal(requests, 1); assert.equal(f.doc.activeElement, f.outside);
});

test('optional contact styles install once, preserve 16px inputs and 44px targets, and stay outside core graphs', async t => {
  const f = fixture(t);
  const other = createContactForm({ document: f.doc, onSubmit() {} });
  f.doc.body.append(other.element); t.after(() => other.destroy());
  assert.equal(f.doc.querySelectorAll('[data-shared-chat-contact-style]').length, 1);
  assert.equal(f.dom.window.getComputedStyle(f.ui.element.elements.name).fontSize, '16px');
  assert.equal(f.dom.window.getComputedStyle(f.send).minHeight, '44px');
  const hook = await build({ stdin: { contents: "export { default } from './chat/react.mjs';", resolveDir: process.cwd() }, bundle: true, format: 'esm', minify: true, write: false, metafile: true, external: ['react'] });
  assert.doesNotMatch(hook.outputFiles[0].text, /data-chat-contact/, 'viewport-only hook excludes contact UI');
  assert.equal(Object.keys(hook.metafile.inputs).some(name => name.endsWith('contact.mjs') || name.endsWith('contact-react.mjs')), false, 'viewport hook module graph has no contact edges');
  const contactReact = await build({ entryPoints: ['chat/contact-react.mjs'], bundle: true, format: 'esm', write: false, metafile: true, external: ['react'] });
  assert.equal(Object.keys(contactReact.metafile.inputs).some(name => name.endsWith('viewport.mjs') || name.endsWith('panel.mjs')), false, 'contact wrapper has no viewport or dialog edges');
  assert.ok(Object.keys(contactReact.metafile.inputs).some(name => name.endsWith('contact.mjs')));
  for (const entry of ['launcher','panel','contact']) {
    const result = await build({ entryPoints: [`chat/${entry}.mjs`], bundle: true, format: 'esm', write: false, metafile: true });
    assert.equal(Object.keys(result.metafile.inputs).some(name => name.includes('node_modules')), false, 'vanilla graph has no external runtime');
    assert.equal(Object.keys(result.metafile.inputs).some(name => name.endsWith('contact.mjs')), entry === 'contact');
  }
});
