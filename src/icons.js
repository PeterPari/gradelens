/* GradeLens icons: Lucide (ISC license), 24px grid, 2px stroke. One library only. */
(function (root) {
  'use strict';

  const PATHS = {
    refresh: '<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
    minus: '<path d="M5 12h14"/>',
    chevron: '<path d="m9 18 6-6-6-6"/>',
    x: '<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
    plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
    up: '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
    down: '<path d="M12 5v14"/><path d="m19 12-7 7-7-7"/>',
    reset: '<path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>',
    scale: '<path d="m16 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="m2 16 3-8 3 8c-.87.65-1.92 1-3 1s-2.13-.35-3-1Z"/><path d="M7 21h10"/><path d="M12 3v18"/><path d="M3 7h2c2 0 5-1 7-2 2 1 5 2 7 2h2"/>',
    sigma: '<path d="M18 7V5a1 1 0 0 0-1-1H6.5a.5.5 0 0 0-.4.8l4.5 6a2 2 0 0 1 0 2.4l-4.5 6a.5.5 0 0 0 .4.8H17a1 1 0 0 0 1-1v-2"/>',
    eyeOff: '<path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49"/><path d="M14.084 14.158a3 3 0 0 1-4.242-4.242"/><path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143"/><path d="m2 2 20 20"/>',
    check: '<circle cx="12" cy="12" r="10"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
    target: '<circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/>',
    lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    pencil: '<path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/><path d="m15 5 4 4"/>',
    palette: '<path d="M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z"/><circle cx="13.5" cy="6.5" r=".5" fill="currentColor"/><circle cx="17.5" cy="10.5" r=".5" fill="currentColor"/><circle cx="6.5" cy="12.5" r=".5" fill="currentColor"/><circle cx="8.5" cy="7.5" r=".5" fill="currentColor"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/>',
    download: '<path d="M12 15V3"/><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/>',
    external: '<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h3"/>',
    canvas: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
  };

  // Brand mark (the extension's own logo, not a UI icon).
  const MARK = '<svg class="mark" viewBox="0 0 512 512" aria-hidden="true"><g fill="#D64027"><path d="M192.095 20.517A64 64 0 1 0 319.905 20.517A244 244 0 0 0 192.095 20.517ZM377.324 44.301A64 64 0 1 0 467.699 134.676A244 244 0 0 0 377.324 44.301ZM491.483 192.095A64 64 0 1 0 491.483 319.905A244 244 0 0 0 491.483 192.095ZM467.699 377.324A64 64 0 1 0 377.324 467.699A244 244 0 0 0 467.699 377.324ZM319.905 491.483A64 64 0 1 0 192.095 491.483A244 244 0 0 0 319.905 491.483ZM134.676 467.699A64 64 0 1 0 44.301 377.324A244 244 0 0 0 134.676 467.699ZM20.517 319.905A64 64 0 1 0 20.517 192.095A244 244 0 0 0 20.517 319.905ZM44.301 134.676A64 64 0 1 0 134.676 44.301A244 244 0 0 0 44.301 134.676Z"/><circle cx="256" cy="132" r="20"/><circle cx="343.681" cy="168.319" r="20"/><circle cx="380" cy="256" r="20"/><circle cx="343.681" cy="343.681" r="20"/><circle cx="256" cy="380" r="20"/><circle cx="168.319" cy="343.681" r="20"/><circle cx="132" cy="256" r="20"/><circle cx="168.319" cy="168.319" r="20"/></g><circle cx="256" cy="256" r="244" fill="none" stroke="#D64027" stroke-width="24"/><path fill="#D64027" fill-rule="evenodd" d="M176 256A80 80 0 1 0 336 256A80 80 0 1 0 176 256ZM202.415 233.804A58 58 0 0 1 233.804 202.415A6 6 0 0 1 238.397 213.502A46 46 0 0 0 213.502 238.397A6 6 0 0 1 202.415 233.804Z"/></svg>';

  function icon(name, cls) {
    return `<svg class="ic${cls ? ` ${cls}` : ''}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${PATHS[name]}</svg>`;
  }

  // Long-press shows a tooltip on touch screens (hover/focus is pure CSS).
  function enableTouchTips(scope) {
    let timer = null;
    let shown = null;
    scope.addEventListener('touchstart', (e) => {
      const el = e.target.closest && e.target.closest('[data-tip]');
      if (!el) return;
      timer = setTimeout(() => {
        if (shown) shown.classList.remove('tip-on');
        el.classList.add('tip-on');
        shown = el;
      }, 450);
    }, { passive: true });
    const end = () => {
      clearTimeout(timer);
      if (shown) {
        const el = shown;
        setTimeout(() => el.classList.remove('tip-on'), 1200);
        shown = null;
      }
    };
    scope.addEventListener('touchend', end, { passive: true });
    scope.addEventListener('touchcancel', end, { passive: true });
  }

  // Shared tooltip CSS. Uses ::before so ::after stays free for 44px hit areas.
  const TIP_CSS = `
[data-tip] { position: relative; }
[data-tip]::before {
  content: attr(data-tip);
  position: absolute; left: 50%; bottom: calc(100% + 6px); transform: translate(-50%, 2px);
  padding: 4px 8px; border-radius: 6px; background: #0e1116; color: #fff;
  font: 600 11.5px/1.3 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
  letter-spacing: 0; text-transform: none; white-space: nowrap;
  opacity: 0; pointer-events: none; transition: opacity .12s, transform .12s; z-index: 50;
}
[data-tip-pos="below"]::before { bottom: auto; top: calc(100% + 6px); transform: translate(-50%, -2px); }
[data-tip-pos="below-end"]::before { bottom: auto; top: calc(100% + 6px); left: auto; right: 0; transform: translateY(-2px); }
[data-tip-pos="start"]::before { left: 0; transform: translateY(2px); }
[data-tip-pos="end"]::before { left: auto; right: 0; transform: translateY(2px); }
[data-tip]:hover::before, [data-tip]:focus-visible::before, [data-tip].tip-on::before { opacity: 1; transform: translate(-50%, 0); }
[data-tip-pos="below-end"]:hover::before, [data-tip-pos="below-end"]:focus-visible::before, [data-tip-pos="below-end"].tip-on::before,
[data-tip-pos="start"]:hover::before, [data-tip-pos="start"]:focus-visible::before, [data-tip-pos="start"].tip-on::before,
[data-tip-pos="end"]:hover::before, [data-tip-pos="end"]:focus-visible::before, [data-tip-pos="end"].tip-on::before { transform: none; }
@media (prefers-color-scheme: dark) { [data-tip]::before { background: #eef0f4; color: #0e1116; } }
:host-context(html.gl-dark) [data-tip]::before { background: #eef0f4; color: #0e1116; }
.hit::after { content: ""; position: absolute; left: 50%; top: 50%; width: 44px; height: 44px; transform: translate(-50%, -50%); }
.ic { width: 16px; height: 16px; flex: none; }
`;

  root.GLIcons = { icon, MARK, TIP_CSS, enableTouchTips };
})(typeof globalThis !== 'undefined' ? globalThis : this);
