# Contributing

Keep the core focused on conversation presentation. Provider calls, credentials, application history, and business logic belong in consumers.

Use Node.js 22, then run:

```sh
npm ci
npm test
npm run size
npm run demo
```

The demo is at [localhost:4173/demo/](http://localhost:4173/demo/). Keep it usable offline after its own static files load. Replies should remain clearly labeled local samples.

For a behavior change, check desktop and phone layouts, short landscape viewports, long messages, keyboard-only operation, close and reopen, and reduced motion. Check background scrolling, focus restoration, and the input with an on-screen keyboard when a physical device is available. Report which checks used emulation and which used a device.

Add or update focused tests for behavior changes. Include actual output from the size command when discussing bundle size. Avoid introducing external runtime dependencies in the vanilla modules.

Pull requests should explain the problem, the resulting behavior, and how it was checked. Do not include credentials, private customer content, production configuration, or application-specific prompts in fixtures or reports.

Consumers vendor pinned source. A change here does not deploy an application; consumer upgrades should be reviewed and tested in those applications.
