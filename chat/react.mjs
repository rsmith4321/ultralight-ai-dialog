import { createElement, forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { createContactForm } from './contact.mjs';
import { observeViewport } from './viewport.mjs';

// Content remains owned by its existing modal. This adapter only supplies
// viewport bounds; Base UI/native dialog still owns focus, Escape and scroll lock.
export default function useChatViewport(open) {
  const [content, setContent] = useState(null);
  useEffect(() => {
    const popup = content?.closest('[role="dialog"], dialog');
    if (!open || !popup) return undefined;
    popup.setAttribute('data-shared-chat', '');
    const stop = observeViewport(popup);
    // Keep geometry through the host modal's exit animation. The host removes
    // its popup on exit, or hides its keepMounted popup.
    return stop;
  }, [open, content]);
  return setContent;
}

// Initial fields/options are read once per mount; callback changes stay current
// without rebuilding the native form or erasing a visitor's draft.
export const ChatContactForm = /* @__PURE__ */ forwardRef(function ChatContactForm({ onSubmit, onBack, onDraftChange, onStatusChange, values, limits, extraFields, initialStatus, requireName, className }, ref) {
  const host = useRef(null);
  const instance = useRef(null);
  const callbacks = useRef({ onSubmit, onBack, onDraftChange, onStatusChange });
  callbacks.current = { onSubmit, onBack, onDraftChange, onStatusChange };
  const initial = useRef({ values, limits, extraFields, initialStatus, requireName });
  useImperativeHandle(ref, () => ({
    getValues: () => instance.current?.getValues(),
    getStatus: () => instance.current?.getStatus(),
    setStatus: next => instance.current?.setStatus(next),
    focus: () => instance.current?.focus(),
  }), []);
  useEffect(() => {
    const ui = createContactForm({
      document: host.current.ownerDocument, ...initial.current,
      onSubmit: data => callbacks.current.onSubmit(data),
      onBack: () => callbacks.current.onBack?.(),
      onDraftChange: data => callbacks.current.onDraftChange?.(data),
      onStatusChange: status => callbacks.current.onStatusChange?.(status),
    });
    instance.current = ui;
    host.current.append(ui.element);
    return () => { ui.destroy(); instance.current = null; };
  }, []);
  return createElement('div', { ref: host, className, style: { display: 'flex', flexDirection: 'column', flex: '1 1 auto', minHeight: 0 } });
});
