# Keep Claude on your server

Ultralight AI Dialog is a presentation layer. If your application already calls Claude through its server, keep that flow. Add the dialog to your existing markup, and append the returned text through your application's message renderer.

The demo does not call Claude. Its replies are local samples.

## A server-side request

The following is the shape of an optional server integration using `@anthropic-ai/sdk`. That package is installed in your server application, separately from this library. `ANTHROPIC_API_KEY` and `CLAUDE_MODEL` are server environment variables. Set `CLAUDE_MODEL` to a model available to your account; this library does not select one.

```js
// Server only: never import this module in a browser bundle.
import Anthropic from '@anthropic-ai/sdk';

const apiKey = process.env.ANTHROPIC_API_KEY;
const model = process.env.CLAUDE_MODEL;
if (!apiKey || !model) throw new Error('Configure the server Claude credentials and model.');
const client = new Anthropic({ apiKey });

export async function replyToValidatedMessage(message) {
  // Call from your existing authenticated, rate-limited server route,
  // after validating input and checking the user's authorization.
  const response = await client.messages.create({
    model,
    max_tokens: 400,
    messages: [{ role: 'user', content: message }],
  });
  return response.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('\n');
}
```

This example sends one message. Your application can retain its existing conversation history, streaming, tools, and model settings. Authentication, rate limits, request validation, cancellation, and any calendar or other business access belong to the application server.

For the provider API contract, see the official [Messages API guide](https://platform.claude.com/docs/en/build-with-claude/working-with-messages).

## Render the result

In your application's browser code, use the result from your existing server route:

```js
function appendAssistantMessage(log, text) {
  const bubble = document.createElement('div');
  bubble.dataset.chatMessage = 'assistant';
  bubble.textContent = text;
  log.append(bubble);
  log.scrollTop = log.scrollHeight;
}
```

Treat user input and model output as untrusted text. Do not insert them with `innerHTML`. If your application deliberately supports Markdown or other rich content, use a renderer and sanitizer appropriate to that format.

Keep provider credentials on the server. The dialog needs no provider key, account access, or direct connection to an AI service.
