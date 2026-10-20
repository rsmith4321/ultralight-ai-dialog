import { attachPanel } from '../chat/panel.mjs';

function element(tag, text, attributes = {}) {
  const node = document.createElement(tag);
  if (text !== undefined) node.textContent = text;
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  return node;
}

// Sample content stays in this demo. The shared dialog does not own messages.
export function createDemoPanel(launcher) {
  const panel = element('section', undefined, {
    id: 'demo-conversation',
    'aria-labelledby': 'demo-dialog-title',
    'aria-describedby': 'demo-dialog-note',
  });
  panel.hidden = true;
  const header = element('header');
  const heading = element('div');
  heading.append(
    element('h2', 'Try the dialog', { id: 'demo-dialog-title' }),
    element('p', 'Your UI. Your conversation.'),
  );
  const closeButton = element('button', '×', { type: 'button', 'aria-label': 'Close dialog' });
  closeButton.style.fontSize = '28px';
  header.append(heading, closeButton);

  const log = element('div', undefined, { 'aria-label': 'Sample conversation' });
  const starters = element('div', undefined, { 'data-chat-starters': '' });
  const form = element('form');
  const input = element('textarea', undefined, {
    rows: '1',
    maxlength: '2000',
    placeholder: 'Ask a sample question…',
    'aria-label': 'Your message',
  });
  const send = element('button', 'Send', { type: 'submit', 'data-chat-send': '' });
  const note = element('p', 'Demo replies are local samples. No model connected.', {
    id: 'demo-dialog-note',
    'data-chat-note': '',
  });
  form.append(input, send);
  panel.append(header, log, starters, form, note);
  document.body.append(panel);

  function addMessage(author, text) {
    // User input and server/model output must be rendered as text, not HTML.
    log.append(element('div', text, { 'data-chat-message': author }));
    log.scrollTop = log.scrollHeight;
  }

  addMessage('assistant', 'Hello! Try a question about the dialog, your server, or mobile layout. These are local sample replies.');

  function sampleReply(message) {
    const text = message.toLowerCase();
    if (/phone|mobile|keyboard|screen|landscape/.test(text)) {
      return 'On small screens, the dialog fills the available viewport. The page behind it is held in place, and the conversation can scroll. Try resizing your browser or opening this page on a phone.';
    }
    if (/server|claude|model|provider|api|openai/.test(text)) {
      return 'Keep your existing server and model integration. This UI handles presentation; your application sends requests and renders responses. Provider credentials belong on your server.';
    }
    if (/install|start|use|source|depend/.test(text)) {
      return 'Copy the shared modules into your project at a pinned commit. Mount the small launcher first, then import your conversation module when the visitor opens it. The vanilla dialog has no external runtime dependencies.';
    }
    return 'This is a local sample response, so it does not interpret your message with a model. In your application, your server supplies the answer and your message renderer adds it here. You can try asking about mobile layout, providers, or getting started.';
  }

  function submit(event) {
    event.preventDefault();
    const message = input.value.trim();
    if (!message) return;
    addMessage('user', message);
    input.value = '';
    addMessage('assistant', sampleReply(message));
  }
  function onKeydown(event) {
    if (event.key === 'Enter' && !event.shiftKey && !event.isComposing &&
        !window.matchMedia('(pointer: coarse)').matches) {
      event.preventDefault();
      form.requestSubmit();
    }
  }
  form.addEventListener('submit', submit);
  input.addEventListener('keydown', onKeydown);
  for (const prompt of ['How does mobile work?', 'Can I use my own server?']) {
    const button = element('button', prompt, { type: 'button' });
    button.addEventListener('click', () => {
      input.value = prompt;
      form.requestSubmit();
    });
    starters.append(button);
  }

  const ui = attachPanel({ panel, log, input, closeButton, launcher });
  return {
    open: ui.open,
    close: ui.close,
    destroy() {
      ui.destroy();
      form.removeEventListener('submit', submit);
      input.removeEventListener('keydown', onKeydown);
      panel.remove();
    },
  };
}
