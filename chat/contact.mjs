// Optional presentation only. The adapter owns transport and verification.
const contactCss = `
[data-chat-contact],form[data-chat-contact][data-chat-composer]{box-sizing:border-box;display:flex;flex:1 1 auto;flex-direction:column;gap:12px;min-height:0;overflow:auto;overscroll-behavior:contain;margin:0;padding:14px;color:var(--chat-ink,var(--kit-ink,var(--ui-text,#25343a)));background:var(--chat-paper,var(--kit-paper,var(--ui-paper,#fff)));font:400 16px/1.45 var(--chat-font,var(--font-sans,system-ui,sans-serif))}
[data-chat-contact][hidden]{display:none!important}
[data-chat-contact] [data-contact-field]{display:flex;flex:none;flex-direction:column;gap:4px;margin:0;font:inherit;font-weight:600}
[data-chat-contact] :is(input,textarea){box-sizing:border-box;display:block;width:100%;min-width:0;min-height:44px;margin:0;padding:10px 12px;border:1px solid var(--chat-line,var(--kit-line,var(--ui-hairline,#84939d)));border-radius:10px;color:inherit;background:var(--chat-paper,var(--kit-paper,var(--ui-paper,#fff)));font:400 16px/1.4 var(--chat-font,var(--font-sans,system-ui,sans-serif));font-size:16px}
[data-chat-contact] textarea{resize:vertical;min-height:100px}
[data-chat-contact] [data-contact-trap]{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
[data-chat-contact] [data-contact-actions]{display:flex;flex:none;flex-wrap:wrap;gap:8px}
[data-chat-contact] button{min-height:44px;margin:0;padding:10px 14px;border:1px solid var(--chat-line,var(--kit-line,var(--ui-hairline,#d9e0e4)));border-radius:22px;background:transparent;color:inherit;font:inherit;cursor:pointer}
[data-chat-contact] [data-contact-send]{background:var(--chat-primary,var(--kit-primary,var(--ui-primary,#263943)));color:var(--kit-on-primary,#fff);border-color:transparent;font-weight:600}
[data-chat-contact] :is(input,textarea,button):focus-visible{outline:3px solid var(--kit-focus,#06c);outline-offset:2px}
[data-chat-contact] :disabled{opacity:.65;cursor:default}
[data-chat-contact] [data-contact-status]{flex:none;margin:0;overflow-wrap:anywhere;font:inherit}
[data-chat-contact] [data-contact-status]:empty{display:none}
@media(prefers-reduced-motion:reduce){[data-chat-contact],[data-chat-contact] *{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;

export function createContactForm({ document: doc = globalThis.document, onSubmit, onBack = () => {}, onDraftChange = () => {}, onStatusChange = () => {}, values = {}, limits = {}, extraFields, initialStatus, requireName = true } = {}) {
  if (typeof onSubmit !== 'function') throw new TypeError('Contact form requires an onSubmit callback.');
  if (!doc.querySelector('style[data-shared-chat-contact-style]')) {
    const style = doc.createElement('style');
    style.dataset.sharedChatContactStyle = '0.1.8';
    style.textContent = contactCss;
    doc.head.append(style);
  }
  const element = doc.createElement('form');
  element.dataset.chatContact = '';
  element.setAttribute('aria-label', 'Send a message');
  const fields = {};
  for (const [name, label, maximum] of [['name', 'Name', 120], ['email', 'Email', 200], ['message', 'Message', 4000]]) {
    const wrapper = doc.createElement('label');
    wrapper.dataset.contactField = '';
    wrapper.append(doc.createTextNode(label));
    const input = doc.createElement(name === 'message' ? 'textarea' : 'input');
    input.name = name;
    input.required = name !== 'name' || requireName;
    const limit = Number(limits[name]);
    input.maxLength = Number.isInteger(limit) && limit > 0 ? limit : maximum;
    input.value = typeof values[name] === 'string' ? values[name] : '';
    if (name !== 'message') {
      input.type = name === 'email' ? 'email' : 'text';
      input.autocomplete = name;
    } else input.rows = 4;
    fields[name] = input;
    wrapper.append(input);
    element.append(wrapper);
  }
  const trap = doc.createElement('label');
  trap.dataset.contactTrap = '';
  trap.setAttribute('aria-hidden', 'true');
  trap.textContent = 'Website';
  const website = doc.createElement('input');
  website.name = 'website';
  website.type = 'text';
  website.tabIndex = -1;
  website.autocomplete = 'off';
  website.setAttribute('aria-hidden', 'true');
  trap.append(website);
  element.append(trap);
  if (extraFields) {
    const slot = doc.createElement('div');
    slot.dataset.contactExtra = '';
    for (const node of Array.isArray(extraFields) ? extraFields : [extraFields]) slot.append(node);
    element.append(slot);
  }
  const status = doc.createElement('p');
  status.dataset.contactStatus = '';
  status.setAttribute('role', 'status');
  status.setAttribute('aria-live', 'polite');
  status.setAttribute('aria-atomic', 'true');
  const actions = doc.createElement('div');
  actions.dataset.contactActions = '';
  const back = doc.createElement('button');
  back.type = 'button'; back.textContent = 'Back';
  const send = doc.createElement('button');
  send.type = 'submit'; send.textContent = 'Send message'; send.dataset.contactSend = '';
  actions.append(back, send);
  element.append(status, actions);
  let pending = false, destroyed = false;
  let currentStatus, terminalLocked = false;
  const getValues = () => ({ name: fields.name.value, email: fields.email.value, message: fields.message.value, website: website.value });
  const getStatus = () => ({ ...currentStatus });
  const active = () => !destroyed && element.isConnected;
  const updateStatus = (next = {}, notify = true) => {
    if (destroyed) return;
    const kind = ['idle', 'pending', 'success', 'error', 'uncertain'].includes(next.kind) ? next.kind : 'idle';
    if (kind !== 'pending' && (next.locked === true || kind === 'success' || kind === 'uncertain')) terminalLocked = true;
    currentStatus = {
      kind,
      message: typeof next.message === 'string' ? next.message : '',
      locked: terminalLocked || next.locked === true || ['pending', 'success', 'uncertain'].includes(kind),
    };
    status.textContent = currentStatus.message;
    send.disabled = pending || currentStatus.locked;
    Object.values(fields).forEach(field => { field.disabled = pending || currentStatus.locked; });
    website.disabled = pending || currentStatus.locked;
    if (pending || kind === 'pending') element.setAttribute('aria-busy', 'true');
    else element.removeAttribute('aria-busy');
    if (notify) onStatusChange(getStatus());
  };
  updateStatus(initialStatus, false);
  const goBack = () => { if (!destroyed) onBack(); };
  const keydown = event => {
    // Only deliberate activation of Send submits; Enter in a field is not send.
    if (event.key === 'Enter' && event.target.tagName === 'INPUT') event.preventDefault();
  };
  const submit = async event => {
    event.preventDefault();
    if (event.submitter !== send || !active() || pending || currentStatus.locked || !element.reportValidity()) return;
    const submittedValues = getValues();
    pending = true;
    updateStatus({ kind: 'pending', message: 'Sending your message…', locked: true });
    try {
      const result = await onSubmit(submittedValues);
      if (!active()) return;
      pending = false;
      if (result?.ok === true) {
        updateStatus({ kind: 'success', locked: true,
          message: typeof result.message === 'string' && result.message.trim() ? result.message : 'Your message was sent.' });
      } else {
        const uncertain = result?.uncertain === true || result?.ok !== false;
        updateStatus({ kind: uncertain ? 'uncertain' : 'error', locked: uncertain || result?.locked === true,
          message: typeof result?.message === 'string' && result.message.trim() ? result.message : 'We could not confirm whether your message was received. Please use the contact page before trying again.' });
      }
    } catch {
      if (!active()) return;
      pending = false;
      updateStatus({ kind: 'uncertain', locked: true,
        message: 'We could not confirm whether your message was received. Please use the contact page before trying again.' });
    } finally {
      pending = false;
    }
  };
  const draftChanged = () => { if (!destroyed) onDraftChange(getValues()); };
  element.addEventListener('input', draftChanged);
  back.addEventListener('click', goBack);
  element.addEventListener('keydown', keydown);
  element.addEventListener('submit', submit);
  return {
    element, getValues, getStatus,
    setStatus(next) { updateStatus(next); },
    focus() {
      if (!active() || pending || currentStatus.locked || element.closest('[hidden],[inert]')) return;
      (Object.values(fields).find(field => !field.validity.valid) || fields.name).focus({ preventScroll: true });
    },
    destroy() {
      if (destroyed) return;
      destroyed = true;
      element.removeEventListener('input', draftChanged);
      back.removeEventListener('click', goBack);
      element.removeEventListener('keydown', keydown);
      element.removeEventListener('submit', submit);
      element.remove();
    },
  };
}
