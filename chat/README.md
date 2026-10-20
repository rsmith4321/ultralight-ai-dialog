# Ultralight AI Dialog runtime

Version 0.1.5. MIT licensed. Canonical source and integration documentation:
https://github.com/rsmith4321/ultralight-ai-dialog

Presentation and viewport behavior only. No provider, network, authentication,
analytics, or history dependency. The vanilla entry points do not require React.
The optional React viewport hook leaves modal focus ownership with the host.

Use launcher.mjs for a deliberately opened lazy panel, panel.mjs for vanilla
lifecycle, viewport.mjs for visual viewport tracking, and modal.css for an
existing React modal. Phones below600 CSS pixels or compact landscape below
900 pixels wide/500 pixels high take over the visible viewport; larger public
chat panels float. Phone opening focuses Close and does not summon the keyboard.

Generated consumer copies include SOURCE.json with an exact source commit and
file hashes. Never edit them directly: change the canonical source, review,
commit, and run sync-chat.mjs. Each consumer retains its own content and backend.
Physical iOS Safari keyboard and assistive-technology testing remains a separate
step from desktop viewport emulation.
