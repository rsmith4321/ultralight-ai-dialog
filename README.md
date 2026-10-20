# Ultralight AI Dialog

A small, provider-neutral conversation UI for websites. An on-demand launcher opens a floating desktop panel or a full-screen phone dialog. Bring your own messages, server, and model.

The vanilla modules have no external runtime dependencies. They handle presentation, viewport sizing, and dialog behavior; your application owns requests, authentication, history, and business rules.

Version 0.1.6 measures **4,775 bytes gzip** for the vanilla launcher and panel combined. The initial launcher is **1,196 bytes gzip**; the panel loads when opened.

| Bundle | Minified bytes | Gzip bytes | Brotli bytes |
| --- | ---: | ---: | ---: |
| Launcher | 2,518 | 1,196 | 956 |
| Panel, styles, and viewport behavior | 11,328 | 3,579 | 3,129 |
| Combined | 13,846 | 4,775 | 4,085 |

Measured with esbuild 0.28.1, ESM minification targeting Safari 15, and Node's default gzip and Brotli settings. The total sums separately compressed bundles. These figures exclude application content, the demo, React, and the optional React modal stylesheet. Reproduce them with `npm run size`.

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
