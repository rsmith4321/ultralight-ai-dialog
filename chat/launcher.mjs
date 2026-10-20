// Deliberately independent of the panel graph. No imports, storage, requests,
// timers or popup. The visitor's click is the only load trigger.
export function mountLauncher({ label, load, id = 'shared-chat-launcher', className = '', fallbackUrl = '/contact/' }) {
  if (document.getElementById(id)) return;
  const style = document.createElement('style');
  style.textContent = `[data-chat-launcher]{position:fixed;right:max(16px,env(safe-area-inset-right));bottom:max(16px,env(safe-area-inset-bottom));z-index:60;display:flex;align-items:center;gap:8px;min-height:48px;border:0;border-radius:999px;padding:0 18px;background:var(--chat-primary,var(--kit-primary,#263943));color:var(--chat-on-primary,var(--kit-on-primary,#fff));font:500 16px/1 var(--chat-font,var(--font-sans,system-ui,sans-serif));box-shadow:0 4px 16px #0003;cursor:pointer}[data-chat-launcher]:focus-visible{outline:3px solid var(--kit-focus,#06c);outline-offset:3px}[data-chat-launcher][hidden]{display:none}@media(max-width:600px){[data-chat-launcher]{width:48px;padding:0;justify-content:center;right:max(12px,env(safe-area-inset-right));bottom:max(12px,env(safe-area-inset-bottom))}[data-chat-launcher] span{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%)}}@media print{[data-chat-launcher]{display:none!important}}`;
  document.head.append(style);
  const launcher = document.createElement('button');
  launcher.id = id;
  launcher.type = 'button';
  launcher.className = className;
  launcher.dataset.chatLauncher = '';
  launcher.setAttribute('aria-label', label);
  launcher.setAttribute('aria-haspopup', 'dialog');
  launcher.setAttribute('aria-expanded', 'false');
  launcher.innerHTML = '<svg aria-hidden="true" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12Z"/></svg>';
  const text = document.createElement('span'); text.textContent = label; launcher.append(text);
  const status = document.createElement('span');
  status.setAttribute('role', 'status');
  status.hidden = true;
  status.style.cssText = 'position:fixed;z-index:61;right:max(12px,env(safe-area-inset-right));bottom:max(74px,calc(env(safe-area-inset-bottom) + 62px));max-width:min(300px,calc(100vw - 24px));padding:12px;border:1px solid #88939b;border-radius:12px;background:var(--kit-paper,#fff);color:var(--kit-ink,#25343a);font:14px/1.4 system-ui;box-shadow:0 4px 16px #0003';
  document.body.append(launcher, status);
  let opening = false;
  let instance;
  launcher.addEventListener('click', async () => {
    if (opening) return;
    opening = true; launcher.setAttribute('aria-busy', 'true');
    try {
      instance ||= await load(launcher);
      instance.open(); status.textContent = ''; status.hidden = true;
    } catch {
      status.textContent = 'Chat could not load. Try the chat button again, or ';
      const contact = document.createElement('a'); contact.href = fallbackUrl; contact.textContent = 'use the contact page'; status.append(contact, '.'); status.hidden = false;
    } finally { opening = false; launcher.removeAttribute('aria-busy'); }
  });
  return launcher;
}
