// No UA guessing: visualViewport includes a docked keyboard's occlusion and
// offset after Safari pans. Host supplies open/close lifecycle and focus.
export function observeViewport(panel, win = window) {
  let frame = 0;
  const update = () => {
    frame = 0;
    const view = win.visualViewport;
    // Zoom is intentionally left to the browser; a magnified visual viewport
    // must not repeatedly resize the reader's content under their finger.
    if (view && view.scale !== 1) return;
    const height = Math.max(1, view?.height ?? win.innerHeight);
    panel.toggleAttribute('data-chat-short', height <= 480);
    panel.toggleAttribute('data-chat-tiny', height <= 300);
    panel.style.setProperty('--chat-vh', `${height}px`);
    panel.style.setProperty('--chat-vw', `${Math.max(1, view?.width ?? win.innerWidth)}px`);
    panel.style.setProperty('--chat-vbottom', `${Math.max(0, win.innerHeight - height - (view?.offsetTop ?? 0))}px`);
    panel.style.setProperty('--chat-vtop', `${Math.max(0, view?.offsetTop ?? 0)}px`);
    panel.style.setProperty('--chat-vleft', `${Math.max(0, view?.offsetLeft ?? 0)}px`);
  };
  const schedule = () => { if (!frame) frame = win.requestAnimationFrame(update); };
  update();
  win.addEventListener('resize', schedule);
  win.addEventListener('orientationchange', schedule);
  win.visualViewport?.addEventListener('resize', schedule);
  win.visualViewport?.addEventListener('scroll', schedule);
  return () => {
    win.cancelAnimationFrame(frame);
    win.removeEventListener('resize', schedule);
    win.removeEventListener('orientationchange', schedule);
    win.visualViewport?.removeEventListener('resize', schedule);
    win.visualViewport?.removeEventListener('scroll', schedule);
  };
}
