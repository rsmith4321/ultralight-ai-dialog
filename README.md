# Ultralight AI Dialog

A small, provider-neutral conversation UI for websites. An on-demand launcher opens a floating desktop panel or a full-screen phone dialog. Bring your own messages, server, and model.

The vanilla modules have no external runtime dependencies. They handle presentation, viewport sizing, and dialog behavior; your application owns requests, authentication, history, and business rules.

Version 0.1.8 measures **4,775 bytes gzip** for the vanilla launcher and panel combined. The initial launcher is **1,196 bytes gzip**; the panel loads when opened.

| Bundle | Minified bytes | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| Launcher | 2,518 | 1,196 | 956 |
| Panel, styles, and viewport behavior | 11,328 | 3,579 | 3,128 |
| Combined | 13,846 | 4,775 | 4,084 |

Measured with esbuild 0.28.1, ESM minification targeting Safari 15, and Node's default gzip and Brotli settings. The total sums separately compressed bundles. These figures exclude application content, the demo, React, the optional contact form, and the optional React modal stylesheet. Reproduce them with `npm run size`.

## Try it locally

```sh
git clone https://github.com/rsmith4321/ultralight-ai-dialog.git
cd ultralight-ai-dialog
npm ci
npm run demo
```

Open [localhost:4173/demo/](http://localhost:4173/demo/). The demo works without a model, credentials, external fonts, or an API. **Demo replies are local samples. No model connected.** Only the site's own static files are loaded.

## Add it to your site

Vendor the source at a pinned commit, or use the included copy command:

```sh
node sync-chat.mjs /path/to/your/site
```

This copies the shared modules into `shared/chat` within the destination application root. For consumers that keep the modules at `chat`:

```sh
node sync-chat.mjs /path/to/your/site --destination=chat
```

The copy command records the source commit and file hashes in `SOURCE.json` and refuses to replace an edited destination. Commit the copied source in your application and review upgrades explicitly. This is source reuse: it does not load a runtime CDN, update consumers automatically, or deploy your application. No npm package has been published.

Load the launcher in your page's existing module script:

```js
import { mountLauncher } from './shared/chat/launcher.mjs';

mountLauncher({
  id: 'help-launcher',
  label: 'Ask a question',
  load: async launcher => {
    const { createConversation } = await import('./conversation.mjs');
    return createConversation(launcher);
  },
});
```

`load` runs on a deliberate launcher click. It must return an object with `open()`, `close()`, and `destroy()` methods; the launcher calls `open()` after loading. The returned instance is reused on later clicks. Your `conversation.mjs` creates the content and attaches the shared behavior:

```js
import { attachPanel } from './shared/chat/panel.mjs';

export function createConversation(launcher) {
  // Create these elements in your app, then append panel to document.body.
  const { panel, log, input, closeButton } = buildYourConversationDOM();
  return attachPanel({ panel, log, input, closeButton, launcher });
}
```

`buildYourConversationDOM()` above is your application code. See [demo/panel.mjs](demo/panel.mjs) for a complete working example. Give the panel an `id` and an accessible name with `aria-labelledby` or `aria-label`. Include a visible close control.

## Behavior and markup

`attachPanel({ panel, log, input, closeButton, launcher, onClose, manageFocus })` returns `open`, `close`, and `destroy`. `onClose` is optional; `manageFocus` defaults to `true`. Styles are injected when the panel module is attached. The adapter marks the panel, log, input, close button, and first form automatically. Mark message bubbles and other optional content in your own markup:

| Attribute | Purpose |
| --- | --- |
| `data-chat-message="assistant"` / `"user"` | Message bubbles |
| `data-chat-send` | Submit button |
| `data-chat-note` | Persistent explanatory note |
| `data-chat-starters` | Optional suggested prompts |
| `data-chat-header` | Header when not using a direct `<header>` child |

On desktop, the panel floats at up to 420 CSS pixels wide and the page remains usable. At widths below 600 CSS pixels, it takes over the available viewport. Compact landscape layouts below 1024 pixels wide and 500 pixels high also use the takeover layout. The phone modal behavior handles focus containment, background inertness, scroll locking, and focus restoration. Opening focuses the close control so a touch keyboard is not requested immediately.

The viewport helper follows the visual viewport when available, accounting for on-screen keyboard space and safe-area insets. Browser emulation and automated checks do not establish physical iOS keyboard behavior; test your final application on the devices you support.

When a host already owns focus, set `manageFocus: false`. That disables this adapter's initial focus, focus containment, and focus restoration; the host must provide them, including during phone takeover.

For a page-wide theme, set `--kit-primary`, `--kit-on-primary`, and `--font-sans` on your root element. Set `--kit-paper`, `--kit-ink`, `--kit-line`, and `--kit-soft` for panel colors. These defaults reach both the launcher and panel. For element-specific changes, set `--chat-*` properties inline on the relevant element; the panel declares its own defaults, so root-level `--chat-*` values alone do not override them. Keep input text at 16px or larger.

## Optional contact form

Import `createContactForm` from `./shared/chat/contact.mjs` (package export `ultralight-ai-dialog/contact`) only where needed. Its scoped styles are included in that optional module, measured at **2,426 bytes gzip** (6,213 minified bytes; 2,065 bytes Brotli). The launcher and dialog core do not import it. Try the [local contact example](demo/contact.html); it makes no request and reports that no message was sent.

```js
import { createContactForm } from './shared/chat/contact.mjs';

const contact = createContactForm({
  document,
  values: { name: '', email: '', message: '' },
  limits: { name: 120, email: 200, message: 4000 },
  onDraftChange(values) { /* Optional: persist this explicit draft in your app. */ },
  onBack() { contact.element.hidden = true; showConversation(); },
  async onSubmit(values) {
    // Your adapter sends only this explicit visitor-authored message.
    // Keep verification, transport, and server authorization in your adapter.
    return await sendWithYourExistingTransport(values);
  },
});
contentArea.append(contact.element);
// contact.focus(); // Optional deliberate focus; mounting never takes focus.
// contact.getValues(); // { name, email, message, website }
// contact.destroy(); // Remove listeners and suppress detached late results.
```

`createContactForm({ document, onSubmit, onBack, onDraftChange, onStatusChange, values, limits, extraFields, initialStatus, requireName })` returns `{ element, getValues, getStatus, setStatus, focus, destroy }`. `element` is a native form with labeled, required name, email, and message fields plus a hidden-from-navigation `website` honeypot. Field limits default to 120, 200, and 4000 characters. `requireName` defaults to `true`; set it to `false` when your adapter accepts an optional name. `extraFields` accepts an optional DOM node or array of nodes for adapter-owned verification. Those nodes are never included in `getValues()` or the submit callback. Draft and submit callbacks receive exactly `{ name, email, message, website }`; no transcript is added.

Only deliberate activation of **Send message** submits. Enter in a single-line field does not send. The callback may return a result or a promise. Only `{ ok: true, message: 'Your receipt' }` confirms success; the UI shows the receipt as plain text and disables fields and Send to prevent duplicate sends. Other results may provide `{ ok: false, message: 'Your explanation' }`; missing/ambiguous results and thrown exceptions show a generic uncertainty message and lock the fields and Send to avoid an accidental repeat. `{ ok: false, uncertain: true }` or `{ ok: false, locked: true }` also locks the attempt; a definite `{ ok: false }` remains editable. Draft values remain intact, and no retry happens automatically.

`getStatus()` returns a copy of `{ kind, message, locked }`, where `kind` is `idle`, `pending`, `success`, `error`, or `uncertain`. `setStatus(status)` updates presentation and notifies `onStatusChange(status)`; it never submits or changes focus. `initialStatus` restores this state without emitting a new status callback. Pending, successful, and uncertain states always lock fields and Send. Terminal success/uncertainty and explicit locked outcomes remain locked for that UI instance, including after setStatus; Back stays enabled. `onStatusChange` is also called for pending and completed attempts, so your adapter can persist status with its own attempt identifiers and values. This module stores no identifiers or data. After an uncertain delivery, use the contact page to resolve it before starting another attempt.

Back stays available during a pending send. Keep the form mounted and use `contact.element.hidden` when switching to the conversation so a pending result can update its own receipt without reopening anything, moving focus, or navigating. `destroy()` is idempotent; it does not cancel your adapter's transport. Your adapter remains responsible for server-side limits, validation, rate limiting, bot verification, and the meaning of its receipt.

The optional `contact-react.mjs` entry exports `ChatContactForm` separately from the existing viewport hook (package export `ultralight-ai-dialog/contact-react`):

```jsx
import { ChatContactForm } from './shared/chat/contact-react.mjs';

<ChatContactForm
  ref={contactRef} // exposes getValues(), getStatus(), setStatus(), focus()
  values={{ name: '', email: '', message: '' }}
  onSubmit={sendWithYourExistingTransport}
  onBack={showConversation}
  onDraftChange={saveDraft}
/>
```

The React wrapper mounts the same vanilla UI. Callback changes stay current without clearing the draft. `values`, `limits`, `extraFields`, `initialStatus`, and `requireName` are initial mount options; change the React key when intentionally creating a new form. Keep the wrapper mounted inside a hidden parent when switching views. Unmounting destroys the UI and suppresses late result updates. React remains optional; the vanilla contact module has no external runtime dependency.

## Keep your server and model

This library does not call an AI provider. An existing Claude, OpenAI, or other server integration can keep its transport, prompts, tools, and authorization. Connect its result to your existing message renderer. Render plain text with `textContent`; sanitize any deliberately supported rich content before inserting it.

Provider keys stay on your server. Never place them in browser modules, HTML, or a public build. See [the Claude integration example](docs/claude.md) for one server-side pattern.

An optional React viewport hook and `chat/modal.css` support an application's existing React dialog:

```jsx
import useChatViewport from './shared/chat/react.mjs';
import './shared/chat/modal.css';

function Conversation({ open }) {
  const contentRef = useChatViewport(open);
  // ExistingDialog is your application's existing modal component.
  // Its popup must expose role="dialog" or be a native <dialog>.
  return (
    <ExistingDialog open={open}>
      <div ref={contentRef}>{/* Existing conversation content */}</div>
    </ExistingDialog>
  );
}
```

Keep your established modal primitive responsible for focus and dismissal; a viewport hook does not replace it. Do not attach a second focus manager to the same dialog. React remains an optional peer dependency of that adapter, not a dependency of the vanilla modules.

## Development

Requires Node.js 22 for the development tools.

```sh
npm ci
npm test
npm run size
```

The size command measures the current source; consult its output for reproducible numbers. Development dependencies are not needed by a deployed vanilla consumer. See [CONTRIBUTING.md](CONTRIBUTING.md) for contribution guidance.

Released under the [MIT license](LICENSE).

## 0.1.6

Wide phone windows below 1024px wide and below 500px high now retain full takeover when rotated to landscape. Tablet-sized windows at 1024px and above keep the floating public panel. The optional setup modal follows the same compact-landscape boundary. No transport or provider behavior changed.

## 0.1.7

Adds an optional contact form for explicit visitor-authored messages, safe receipts, pending-send protection, and Back navigation. Includes a React wrapper around the same UI. Applications retain their existing transport and verification. The contact module is measured separately and adds no code to the launcher or dialog core.

## 0.1.8

The optional React contact wrapper now lives in `contact-react.mjs`; import `ChatContactForm` from that entry instead of `react.mjs`. The existing `react.mjs` viewport hook has no contact-module imports or re-exports, keeping contact code out of viewport-only chunks. `createContactForm` and all contact behavior are unchanged. The size command reports both optional React adapters separately, excluding the external React runtime. The viewport adapter measures 527 bytes gzip (1,236 minified bytes); the contact React adapter including the vanilla form measures 2,756 bytes gzip (7,265 minified bytes).
