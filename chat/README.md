# Ultralight AI Dialog runtime

Version 0.1.10. MIT licensed. Canonical source and integration documentation:
https://github.com/rsmith4321/ultralight-ai-dialog

Presentation and viewport behavior only. No provider, network, authentication,
analytics, or history dependency. The vanilla entry points do not require React.
The optional React viewport hook leaves modal focus ownership with the host.

Use launcher.mjs for a deliberately opened lazy panel, panel.mjs for vanilla
lifecycle, viewport.mjs for visual viewport tracking, and modal.css for an
existing React modal. Phones up to 640 CSS pixels or compact landscape up to
1024 pixels wide and below 500 pixels high take over the visible viewport; larger public
chat panels float. Phone opening focuses Close and does not summon the keyboard.

attachPanel accepts optional responsive: { phoneMaxWidth, landscapeMaxWidth }
with inclusive positive safe integer CSS pixel widths. For example 640/1024
aligns with a host's phone/tablet tiers. Omitted limits preserve defaults.
getPanelPhoneQuery(responsive) returns the exact query for host navigation
checks. Per-panel takeover styling and modal/focus behavior use that query
together. The optional React modal and launcher defaults are unchanged.

Generated consumer copies include SOURCE.json with an exact source commit and
file hashes. Never edit them directly: change the canonical source, review,
commit, and run sync-chat.mjs. Each consumer retains its own content and backend.
Physical iOS Safari keyboard and assistive-technology testing remains a separate
step from desktop viewport emulation.

Optional contact.mjs exports createContactForm({document,onSubmit,onBack,
onDraftChange,onStatusChange,values,limits,extraFields,initialStatus,requireName})
and returns element/getValues/getStatus/setStatus/focus/
destroy. It submits only name/email/message/website through your callback;
only ok===true confirms success. Uncertain/thrown results lock sending;
definite ok:false stays editable unless locked:true/uncertain:true. Pending,
success and uncertain statuses always lock, while Back remains available. Keep mounted while hidden to retain drafts
and pending receipts. No auto focus, transport, retry or transcript sharing.
Extra verification DOM stays adapter-owned and is never serialized.
contact-react.mjs exports ChatContactForm with live callback refs.
react.mjs exports only the viewport hook and never imports the contact UI.
Version0.1.7 named ChatContactForm imports must migrate to contact-react.mjs.
