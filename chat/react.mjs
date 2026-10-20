import { useEffect, useState } from 'react';
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
