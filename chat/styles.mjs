export const panelCss = `
[data-chat-panel]{--chat-font:var(--font-sans,system-ui,sans-serif);--chat-paper:var(--kit-paper,#fff);--chat-ink:var(--kit-ink,#25343a);--chat-line:var(--kit-line,#d9e0e4);--chat-primary:var(--kit-primary,#263943);--chat-soft:var(--kit-soft,#f1f5f7);--chat-gap:12px;--chat-left-gap:max(var(--chat-gap),env(safe-area-inset-left));--chat-right-gap:max(var(--chat-gap),env(safe-area-inset-right));--chat-width:min(420px,calc(var(--chat-vw,100vw) - var(--chat-left-gap) - var(--chat-right-gap)));box-sizing:border-box;position:fixed;z-index:61;inset:auto!important;left:calc(var(--chat-vleft,0px) + var(--chat-vw,100vw) - var(--chat-width) - var(--chat-right-gap))!important;bottom:auto!important;top:calc(var(--chat-vtop,0px) + var(--chat-vh,100dvh) - max(var(--chat-gap),env(safe-area-inset-bottom)))!important;transform:translateY(-100%);width:var(--chat-width);height:auto!important;min-height:0!important;max-height:calc(var(--chat-vh,100dvh) - max(var(--chat-gap),env(safe-area-inset-top)) - max(var(--chat-gap),env(safe-area-inset-bottom)));display:flex;flex-direction:column;overflow:hidden;padding:0!important;border:1px solid var(--chat-line);border-radius:18px;background:var(--chat-paper);color:var(--chat-ink);box-shadow:0 12px 40px #0003;font:400 16px/1.45 var(--chat-font);isolation:isolate}
[data-chat-panel][hidden]{display:none!important}
[data-chat-panel] *,[data-chat-panel] *::before,[data-chat-panel] *::after{box-sizing:border-box}
[data-chat-panel]>header,[data-chat-panel]>[data-chat-header]{display:flex;flex:none;align-items:center;justify-content:space-between;gap:12px;padding:12px 14px;border-bottom:1px solid var(--chat-line);background:var(--chat-paper)}
[data-chat-panel] h2{font:600 18px/1.3 var(--chat-font);margin:0}
[data-chat-panel]>header p{font-size:13px;margin:2px 0 0;color:var(--kit-faint,#53616b)}
[data-chat-panel] [data-chat-close]{display:grid;place-items:center;flex:none;min-width:44px;min-height:44px;border:0;border-radius:50%;background:transparent;color:inherit;cursor:pointer}
[data-chat-panel] [data-chat-close] svg{width:20px;height:20px}
[data-chat-panel] [data-chat-log]{flex:0 1 auto;min-height:0;overflow:auto;overscroll-behavior:contain;overflow-wrap:anywhere;padding:14px;display:flex;flex-direction:column;gap:10px}
[data-chat-panel] [data-chat-message]{flex:none;max-width:92%;padding:10px 13px;border:1px solid var(--chat-line);border-radius:16px;background:var(--chat-soft);align-self:flex-start;overflow-wrap:anywhere;white-space:pre-wrap}
[data-chat-panel] [data-chat-message=user]{background:var(--chat-primary);color:var(--kit-on-primary,#fff);border-color:transparent;align-self:flex-end;white-space:pre-wrap}
[data-chat-panel] [data-chat-message] p{margin:0}
[data-chat-panel] [data-chat-message] p+p,[data-chat-panel] [data-chat-message] ul+p{margin-top:8px}
[data-chat-panel] [data-chat-message] ul{margin:8px 0;padding-left:20px}
[data-chat-panel] a{color:inherit;text-decoration:underline;text-underline-offset:2px}
[data-chat-panel] [data-chat-composer]{display:flex;flex:none;gap:8px;align-items:flex-end;margin:0;padding:10px 12px;border-top:1px solid var(--chat-line);background:var(--chat-paper)}
[data-chat-panel] [data-chat-input]{display:block;flex:1;min-width:0;min-height:44px;max-height:min(100px,calc(var(--chat-vh,100dvh) * .2));resize:none;padding:10px 12px;border:1px solid var(--rsp-field-line,#84939d);border-radius:16px;color:inherit;background:var(--kit-page,#fff);font:inherit;font-size:16px;line-height:1.4}
[data-chat-panel] [data-chat-send]{flex:none;min-height:44px;min-width:44px;border:0;border-radius:22px;padding:0 12px;background:var(--chat-primary);color:var(--kit-on-primary,#fff);font:inherit;font-weight:600;cursor:pointer}
[data-chat-panel] [data-chat-send] svg{width:20px;height:20px;vertical-align:middle}
[data-chat-panel] button:disabled{opacity:.5;cursor:default}
[data-chat-panel] [data-chat-note]{flex:none;margin:0;padding:8px 14px 12px;font-size:13px;line-height:1.4;color:var(--kit-faint,#53616b)}
[data-chat-panel] [data-chat-check]:empty{display:none}
[data-chat-panel] [data-chat-check]{flex:none;padding:0 12px;max-height:80px;overflow:auto}
[data-chat-panel] [data-chat-starters]{display:flex;flex:none;flex-wrap:wrap;gap:6px;padding:0 14px 12px;max-height:min(110px,20dvh);overflow:auto}
[data-chat-panel] [data-chat-starters]:empty{display:none}
[data-chat-panel] [data-chat-starters] button{font:inherit;font-size:13px;min-height:44px;padding:5px 10px;border:1px solid var(--chat-line);border-radius:22px;background:transparent;color:inherit;cursor:pointer}
[data-chat-panel] :is(button,textarea,a):focus-visible{outline:3px solid var(--kit-focus,#06c);outline-offset:2px}
[data-chat-panel] [data-chat-sr]{position:absolute;width:1px;height:1px;overflow:hidden;clip-path:inset(50%);white-space:nowrap}
[data-chat-panel][data-chat-short] [data-chat-note]{max-height:32px;overflow:auto;padding:4px 12px}[data-chat-panel][data-chat-short] [data-chat-starters]{max-height:50px}[data-chat-panel][data-chat-short]>header,[data-chat-panel][data-chat-short]>[data-chat-header]{padding:4px 12px}
[data-chat-panel][data-chat-short] [data-chat-check]{max-height:60px}
[data-chat-panel][data-chat-tiny] [data-chat-starters]{display:none}
[data-chat-panel][data-chat-tiny] [data-chat-note]{max-height:24px}
[data-chat-panel][data-chat-tiny] [data-chat-check]{max-height:40px}
@media (max-width:599.95px), (max-width:1023.95px) and (max-height:499.95px){
[data-chat-panel]{left:var(--chat-vleft,0px)!important;top:var(--chat-vtop,0px)!important;transform:none;width:var(--chat-vw,100vw);max-width:none;height:var(--chat-vh,100dvh)!important;max-height:none;border:0;border-radius:0;box-shadow:none;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)!important}
[data-chat-panel] [data-chat-log]{flex:1 1 auto}
}
@media print{[data-chat-panel]{display:none!important}}
@media(prefers-reduced-motion:reduce){[data-chat-panel] *,[data-chat-launcher]{animation:none!important;transition:none!important;scroll-behavior:auto!important}}
`;
