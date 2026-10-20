import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { attachPanel } from '../chat/panel.mjs';

// The package has no runtime dependencies. Use an existing consumer's jsdom:
// SHARED_CHAT_TEST_DEPENDENCIES=/path/to/consumer/react node --test test/*.test.mjs
const require = createRequire(process.env.SHARED_CHAT_TEST_DEPENDENCIES
  ? path.join(path.resolve(process.env.SHARED_CHAT_TEST_DEPENDENCIES), 'package.json') : import.meta.url);
const { JSDOM } = require('jsdom');

function fixture(t, { width = 390, height = 844, nested = false, manageFocus = true } = {}) {
  const dom = new JSDOM(`<!doctype html><html><head></head><body>
    <main id="page"><a href="/">Page</a></main><aside inert="already-inert">Prior inert</aside>
    <button id="open">Open</button>${nested ? '<div id="wrapper"><button id="sibling">Wrapper sibling</button>' : ''}
    <section id="panel" hidden><header><h2>Chat</h2><button id="close">Close</button></header>
    <div id="log"></div><div hidden><button id="hidden">Hidden</button></div>
    <form><input tabindex="-1"><textarea></textarea><button disabled>Send</button></form>
    <p><a id="last" href="/privacy">Privacy</a></p></section>${nested ? '</div>' : ''}
    </body></html>`, { url: 'https://example.invalid/', pretendToBeVisual: true });
  const win = dom.window, doc = win.document;
  globalThis.window = win; globalThis.document = doc;
  let viewport = { width, height }, frames = new Map(), nextFrame = 0, closes = 0;
  const scrolls = [];
  Object.defineProperties(win, {
    innerWidth: { get: () => viewport.width }, innerHeight: { get: () => viewport.height },
    scrollX: { value: 7 }, scrollY: { value: 320 },
  });
  win.scrollTo = (...args) => scrolls.push(args);
  win.matchMedia = query => {
    assert.equal(query, '(max-width: 599.95px), (max-width: 899.95px) and (max-height: 499.95px)');
    return { get matches() { return viewport.width < 600 || (viewport.width < 900 && viewport.height < 500); }, addEventListener() {}, removeEventListener() {} };
  };
  win.requestAnimationFrame = callback => { frames.set(++nextFrame, callback); return nextFrame; };
  win.cancelAnimationFrame = id => frames.delete(id);
  const panel = doc.querySelector('#panel'), launcher = doc.querySelector('#open'), close = doc.querySelector('#close');
  const ui = attachPanel({ panel, launcher, closeButton: close, log: doc.querySelector('#log'), input: doc.querySelector('textarea'), manageFocus, onClose: () => closes++ });
  launcher.focus();
  t.after(() => { ui.destroy(); dom.window.close(); delete globalThis.window; delete globalThis.document; });
  return { doc, win, ui, panel, launcher, close, scrolls, get closes() { return closes; },
    resize(width, height, event = 'resize') {
      viewport = { width, height }; win.dispatchEvent(new win.Event(event));
      const pending = [...frames.values()]; frames.clear(); pending.forEach(callback => callback());
    },
    tab(target, shiftKey = false) {
      target.focus(); const event = new win.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true });
      target.dispatchEvent(event); return event;
    },
  };
}

test('phone takeover traps Tab/Shift+Tab, isolates the page and avoids input autofocus', t => {
  const c = fixture(t); c.ui.open();
  assert.equal(c.panel.getAttribute('aria-modal'), 'true');
  assert.equal(c.doc.activeElement, c.close);
  assert.equal(c.doc.querySelector('#page').hasAttribute('inert'), true);
  assert.equal(c.doc.body.style.position, 'fixed');
  assert.equal(c.doc.body.style.top, '-320px');
  const last = c.doc.querySelector('#last');
  assert.equal(c.tab(last).defaultPrevented, true); assert.equal(c.doc.activeElement, c.close);
  assert.equal(c.tab(c.close, true).defaultPrevented, true); assert.equal(c.doc.activeElement, last);
  assert.equal(c.tab(c.doc.querySelector('textarea')).defaultPrevented, false);
  // Synthetic focus ignores native inert, exercising containment separately.
  c.doc.querySelector('#page a').focus(); assert.equal(c.doc.activeElement, c.close);
  c.panel.dispatchEvent(new c.win.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(c.panel.hidden, true); assert.equal(c.doc.activeElement, c.launcher);
  assert.equal(c.closes, 1); assert.equal(c.doc.querySelector('#page').hasAttribute('inert'), false);
  assert.equal(c.doc.querySelector('aside').getAttribute('inert'), 'already-inert');
  assert.deepEqual(c.scrolls, [[7, 320]]);
});

test('exact phone boundaries and orientation restore floating mode without moving in-panel focus', t => {
  const c = fixture(t, { width: 600, height: 800 }); c.ui.open();
  assert.equal(c.panel.getAttribute('aria-modal'), 'false');
  assert.equal(c.tab(c.doc.querySelector('#last')).defaultPrevented, false);
  c.resize(599, 800); assert.equal(c.panel.getAttribute('aria-modal'), 'true');
  const input = c.doc.querySelector('textarea'); input.focus();
  c.resize(844, 390, 'orientationchange'); assert.equal(c.panel.getAttribute('aria-modal'), 'true');
  assert.equal(c.doc.activeElement, input);
  c.resize(900, 390); assert.equal(c.panel.getAttribute('aria-modal'), 'false');
  assert.equal(c.doc.activeElement, input); assert.equal(c.doc.body.style.position, '');
  assert.equal(c.doc.querySelector('#page').hasAttribute('inert'), false);
  c.resize(899, 499); assert.equal(c.panel.getAttribute('aria-modal'), 'true');
  c.resize(899, 500); assert.equal(c.panel.getAttribute('aria-modal'), 'false');
  c.doc.querySelector('#page a').focus(); assert.equal(c.doc.activeElement, c.doc.querySelector('#page a'));
  c.resize(1200, 900); c.ui.close();
  assert.equal(c.doc.activeElement, c.launcher); assert.equal(c.closes, 1);
});

test('manageFocus false leaves phone focus ownership to the host on open, Tab, external focus and close', t => {
  const c = fixture(t, { manageFocus: false }); c.ui.open();
  assert.equal(c.panel.getAttribute('aria-modal'), 'true');
  assert.equal(c.doc.body.style.position, 'fixed');
  assert.equal(c.doc.activeElement, c.launcher, 'open does not force focus');
  const last = c.doc.querySelector('#last');
  assert.equal(c.tab(last).defaultPrevented, false); assert.equal(c.doc.activeElement, last);
  assert.equal(c.tab(c.close, true).defaultPrevented, false); assert.equal(c.doc.activeElement, c.close);
  // Synthetic focus can bypass inert, so this detects an unwanted focusin handler.
  const outside = c.doc.querySelector('#page a'); outside.focus();
  assert.equal(c.doc.activeElement, outside);
  c.resize(1024, 768); c.resize(390, 844); assert.equal(c.doc.activeElement, outside);
  c.ui.close();
  assert.equal(c.doc.activeElement, outside, 'close does not restore focus for the host');
  assert.equal(c.doc.body.style.position, ''); assert.equal(c.doc.querySelector('#page').hasAttribute('inert'), false);
});

test('close restores exact existing inline lock properties and prior inert values; new siblings are isolated', async t => {
  const c = fixture(t, { nested: true });
  c.doc.body.style.cssText = 'position:relative!important;top:13px;left:2%;width:98%;overflow:clip!important;color:red';
  c.doc.documentElement.style.cssText = 'overflow:scroll;scroll-behavior:smooth!important';
  const beforeBody = c.doc.body.style.cssText, beforeHtml = c.doc.documentElement.style.cssText;
  c.ui.open();
  assert.equal(c.doc.querySelector('#wrapper').hasAttribute('inert'), false);
  assert.equal(c.doc.querySelector('#sibling').hasAttribute('inert'), true);
  const banner = c.doc.createElement('button'); c.doc.body.append(banner);
  await Promise.resolve(); assert.equal(banner.hasAttribute('inert'), true);
  c.close.click();
  assert.equal(c.doc.body.style.cssText, beforeBody); assert.equal(c.doc.documentElement.style.cssText, beforeHtml);
  assert.equal(c.doc.querySelector('#sibling').hasAttribute('inert'), false); assert.equal(banner.hasAttribute('inert'), false);
  assert.equal(c.doc.querySelector('aside').getAttribute('inert'), 'already-inert');
  c.ui.open(); c.ui.close(); assert.equal(c.doc.body.style.cssText, beforeBody);
});

test('closing or destroying during a delayed reply does not retain locks or reclaim focus', async t => {
  const c = fixture(t); c.ui.open();
  let finish;
  const reply = new Promise(resolve => { finish = resolve; }).then(() => c.doc.querySelector('#log').append('Delayed reply'));
  c.ui.close(); c.doc.querySelector('#page a').focus(); finish(); await reply;
  assert.equal(c.panel.hidden, true); assert.equal(c.doc.activeElement, c.doc.querySelector('#page a'));
  c.ui.open(); c.panel.remove(); c.ui.destroy();
  assert.equal(c.doc.body.style.position, ''); assert.equal(c.doc.documentElement.style.overflow, '');
  assert.equal(c.doc.activeElement, c.launcher); assert.equal(c.closes, 2);
  c.resize(400, 700); c.ui.open(); assert.equal(c.panel.hidden, true);
  assert.equal(c.doc.querySelector('#page').hasAttribute('inert'), false);
});

test('removing an open phone panel releases the modal even before explicit destroy', async t => {
  const c = fixture(t); c.ui.open(); c.panel.remove(); await Promise.resolve();
  assert.equal(c.doc.body.style.position, ''); assert.equal(c.doc.querySelector('#page').hasAttribute('inert'), false);
  assert.equal(c.doc.activeElement, c.launcher); assert.equal(c.closes, 1);
  c.ui.destroy(); assert.equal(c.closes, 1);
});

test('reparenting an open phone panel releases its new ancestor and isolates new siblings', async t => {
  const c = fixture(t); c.ui.open();
  const page = c.doc.querySelector('#page'), pageLink = page.querySelector('a');
  assert.equal(page.hasAttribute('inert'), true);
  page.append(c.panel); await Promise.resolve();
  assert.equal(c.panel.closest('[inert]'), null);
  assert.equal(page.hasAttribute('inert'), false); assert.equal(pageLink.hasAttribute('inert'), true);
  assert.equal(c.panel.hidden, false); assert.equal(c.panel.getAttribute('aria-modal'), 'true');
  assert.equal(c.doc.activeElement, c.close);
  c.ui.close();
  assert.equal(pageLink.hasAttribute('inert'), false); assert.equal(page.hasAttribute('inert'), false);
  assert.equal(c.doc.querySelector('aside').getAttribute('inert'), 'already-inert');
  assert.equal(c.doc.body.style.position, ''); assert.equal(c.doc.activeElement, c.launcher);
});

test('phone with no available controls keeps Tab on the panel; desktop destroy restores opener', t => {
  const c = fixture(t); c.panel.querySelectorAll('button,input,textarea,a').forEach(element => element.remove());
  c.ui.open(); c.panel.focus(); assert.equal(c.tab(c.panel).defaultPrevented, true); assert.equal(c.doc.activeElement, c.panel);
  c.resize(1024, 768); c.ui.destroy(); assert.equal(c.doc.activeElement, c.launcher);
});
