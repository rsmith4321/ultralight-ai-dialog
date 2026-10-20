import { observeViewport } from './viewport.mjs';
import { panelCss } from './styles.mjs';

const phoneQuery = '(max-width: 599.95px), (max-width: 1023.95px) and (max-height: 499.95px)';

// Presentation-only bridge. Existing DOM/React owns messages, forms, transport,
// authentication, history and business rules. No network or storage here.
export function attachPanel({ panel, log, input, closeButton, launcher, onClose = () => {}, manageFocus = true }) {
  if (!document.querySelector('style[data-shared-chat-style]')) {
    const style = document.createElement('style'); style.dataset.sharedChatStyle = '0.1.7'; style.textContent = panelCss; document.head.append(style);
  }
  panel.dataset.chatPanel = '';
  if (log) { log.dataset.chatLog = ''; log.setAttribute('role', 'log'); log.setAttribute('aria-live', 'polite'); log.setAttribute('aria-relevant', 'additions text'); }
  if (input) input.dataset.chatInput = '';
  if (closeButton) closeButton.dataset.chatClose = '';
  panel.querySelector('form')?.setAttribute('data-chat-composer', '');
  panel.setAttribute('role', 'dialog');
  // Floating panels remain nonmodal. Phone takeover owns modal behavior
  // only while open and restores the page when that breakpoint ends.
  panel.setAttribute('aria-modal', 'false');
  if (!panel.hasAttribute('tabindex')) panel.tabIndex = -1;
  if (launcher && panel.id) launcher.setAttribute('aria-controls', panel.id);
  let stopViewport;
  let returnFocus;
  let active = false;
  let destroyed = false;
  let releaseModal;
  let stopResponsive;
  const win = panel.ownerDocument.defaultView;
  const doc = panel.ownerDocument;
  function focusTarget() { (closeButton?.isConnected && !closeButton.disabled ? closeButton : panel).focus({ preventScroll: true }); }
  function enterModal() {
    const inert = new Map();
    const styles = [];
    const scrollX = win.scrollX, scrollY = win.scrollY;
    const lock = (element, property, value) => {
      styles.push([element, property, element.style.getPropertyValue(property), element.style.getPropertyPriority(property)]);
      element.style.setProperty(property, value, 'important');
    };
    const isolate = () => {
      // A host can reparent the open panel into a previously isolated branch.
      // Release our old inert state before calculating its new surroundings.
      for (const [element, value] of inert) {
        if (!element.contains(panel) && !panel.contains(element)) continue;
        if (value === null) element.removeAttribute('inert'); else element.setAttribute('inert', value);
        inert.delete(element);
      }
      // This also supports a panel mounted inside an adapter-owned wrapper.
      for (let child = panel; child.parentElement; child = child.parentElement) {
        for (const sibling of child.parentElement.children) {
          if (sibling === child || inert.has(sibling)) continue;
          inert.set(sibling, sibling.getAttribute('inert'));
          sibling.setAttribute('inert', '');
        }
        if (child.parentElement === doc.body) break;
      }
    };
    isolate();
    lock(doc.documentElement, 'overflow', 'hidden');
    lock(doc.body, 'overflow', 'hidden');
    lock(doc.body, 'position', 'fixed');
    lock(doc.body, 'top', `${-scrollY}px`);
    lock(doc.body, 'left', `${-scrollX}px`);
    lock(doc.body, 'width', '100%');
    panel.setAttribute('aria-modal', 'true');
    const visible = element => {
      for (let node = element; node && node !== panel; node = node.parentElement) {
        const style = win.getComputedStyle(node);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
      }
      return true;
    };
    const focusables = () => [...panel.querySelectorAll('a[href],button,input,textarea,select,iframe,[tabindex],[contenteditable="true"]')].filter(element =>
      element.tabIndex >= 0 && !element.matches(':disabled') && !element.closest('[hidden],[inert]') && visible(element));
    const trap = event => {
      if (event.key !== 'Tab' || event.defaultPrevented) return;
      const items = focusables(), first = items[0] || panel, last = items.at(-1) || panel;
      if (!panel.contains(doc.activeElement) || doc.activeElement === panel || (event.shiftKey ? doc.activeElement === first : doc.activeElement === last)) {
        event.preventDefault(); (event.shiftKey ? last : first).focus({ preventScroll: true });
      }
    };
    const containFocus = event => { if (!panel.contains(event.target)) focusTarget(); };
    if (manageFocus) {
      panel.addEventListener('keydown', trap);
      doc.addEventListener('focusin', containFocus);
    }
    const observer = new win.MutationObserver(() => {
      if (!panel.isConnected) close();
      else {
        isolate();
        if (manageFocus && !panel.contains(doc.activeElement)) focusTarget();
      }
    });
    observer.observe(doc.body, { childList: true, subtree: true });
    return () => {
      observer.disconnect();
      panel.removeEventListener('keydown', trap);
      doc.removeEventListener('focusin', containFocus);
      panel.setAttribute('aria-modal', 'false');
      for (const [element, value] of inert) {
        if (value === null) element.removeAttribute('inert'); else element.setAttribute('inert', value);
      }
      for (const [element, property, value, priority] of styles) {
        if (value) element.style.setProperty(property, value, priority); else element.style.removeProperty(property);
      }
      // Avoid a site's smooth-scroll rule animating restoration after a lock.
      const behavior = doc.documentElement.style.getPropertyValue('scroll-behavior');
      const priority = doc.documentElement.style.getPropertyPriority('scroll-behavior');
      doc.documentElement.style.setProperty('scroll-behavior', 'auto', 'important');
      win.scrollTo(scrollX, scrollY);
      if (behavior) doc.documentElement.style.setProperty('scroll-behavior', behavior, priority); else doc.documentElement.style.removeProperty('scroll-behavior');
    };
  }
  function observeResponsive() {
    const media = win.matchMedia?.(phoneQuery);
    const update = () => {
      const phone = media ? media.matches : win.innerWidth < 600 || (win.innerWidth < 1024 && win.innerHeight < 500);
      if (phone && !releaseModal) {
        releaseModal = enterModal();
        if (manageFocus && !panel.contains(doc.activeElement)) focusTarget();
      } else if (!phone && releaseModal) { releaseModal(); releaseModal = null; }
    };
    update();
    media?.addEventListener('change', update);
    win.addEventListener('resize', update);
    win.addEventListener('orientationchange', update);
    return () => {
      media?.removeEventListener('change', update);
      win.removeEventListener('resize', update);
      win.removeEventListener('orientationchange', update);
      releaseModal?.(); releaseModal = null;
    };
  }
  function open() {
    if (active || destroyed) return;
    active = true;
    returnFocus = launcher || document.activeElement;
    panel.hidden = false;
    if (launcher) { launcher.hidden = true; launcher.setAttribute('aria-expanded', 'true'); }
    stopViewport = observeViewport(panel);
    stopResponsive = observeResponsive();
    if (log) log.scrollTop = log.scrollHeight;
    // Focusing the close button avoids summoning a touch keyboard merely
    // for opening the chat. A deliberate tap into the composer opens it.
    if (manageFocus) focusTarget();
  }
  function close() {
    if (!active) return;
    active = false; stopViewport?.(); stopViewport = null;
    stopResponsive?.(); stopResponsive = null;
    panel.hidden = true;
    if (launcher) { launcher.hidden = false; launcher.setAttribute('aria-expanded', 'false'); }
    onClose();
    if (manageFocus && returnFocus?.isConnected) returnFocus.focus({ preventScroll: true });
  }
  const escape = event => { if (event.key === 'Escape' && !event.defaultPrevented) { event.stopPropagation(); close(); } };
  panel.addEventListener('keydown', escape);
  closeButton?.addEventListener('click', close);
  return { open, close, destroy() { close(); destroyed = true; panel.removeEventListener('keydown', escape); closeButton?.removeEventListener('click', close); } };
}
