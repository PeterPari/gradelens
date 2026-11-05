/* GradeLens in-page styles (injected into a shadow root so Canvas CSS can't touch them). */
(function (root) {
  'use strict';
  root.GL_STYLES = `
:host { all: initial; }
* { box-sizing: border-box; }
.gl {
  --ink: #0e1116;
  --ink-2: #3b4250;
  --ink-3: #6b7383;
  --line: #e7e9ee;
  --line-2: #f1f2f5;
  --surface: #ffffff;
  --surface-2: #f7f8fa;
  --accent: #4b47e6;
  --accent-soft: #eeedfd;
  --A: #0f9b6c; --A-soft: #e5f6ef;
  --B: #2563eb; --B-soft: #e8effe;
  --C: #c27c0e; --C-soft: #fcf3e3;
  --D: #e0601a; --D-soft: #fdeee5;
  --F: #d93a3a; --F-soft: #fdeaea;
  --none: #8a92a3; --none-soft: #f0f1f4;
  --shadow: 0 1px 2px rgba(14,17,22,.06), 0 8px 24px -6px rgba(14,17,22,.14), 0 24px 56px -12px rgba(14,17,22,.18);
  font: 13px/1.45 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", "Segoe UI", Roboto, sans-serif;
  color: var(--ink);
  -webkit-font-smoothing: antialiased;
  position: fixed;
  right: 20px;
  bottom: 20px;
  z-index: 2147483000;
  font-variant-numeric: tabular-nums;
}
@media (prefers-color-scheme: dark) {
  .gl {
    --ink: #eef0f4; --ink-2: #c3c8d2; --ink-3: #8b93a3;
    --line: #2a2f3a; --line-2: #222631;
    --surface: #16191f; --surface-2: #1d2129;
    --accent: #8b88ff; --accent-soft: #26254a;
    --A: #3ccf98; --A-soft: #143328;
    --B: #6c9cff; --B-soft: #182644;
    --C: #f0b23f; --C-soft: #3a2e14;
    --D: #ff8c4d; --D-soft: #3c2416;
    --F: #ff6b6b; --F-soft: #3d1c1c;
    --none: #7b8394; --none-soft: #242833;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 16px 48px -8px rgba(0,0,0,.6);
  }
}
:host-context(html.gl-dark) .gl {
    --ink: #eef0f4; --ink-2: #c3c8d2; --ink-3: #8b93a3;
    --line: #2a2f3a; --line-2: #222631;
    --surface: #16191f; --surface-2: #1d2129;
    --accent: #8b88ff; --accent-soft: #26254a;
    --A: #3ccf98; --A-soft: #143328;
    --B: #6c9cff; --B-soft: #182644;
    --C: #f0b23f; --C-soft: #3a2e14;
    --D: #ff8c4d; --D-soft: #3c2416;
    --F: #ff6b6b; --F-soft: #3d1c1c;
    --none: #7b8394; --none-soft: #242833;
    --shadow: 0 1px 2px rgba(0,0,0,.4), 0 16px 48px -8px rgba(0,0,0,.6);
  }
button { font: inherit; color: inherit; cursor: pointer; border: 0; background: none; padding: 0; }
input, select { font: inherit; color: inherit; }

/* ---------- pill (minimized) ---------- */
.pill {
  display: none;
  align-items: center;
  gap: 10px;
  padding: 7px 14px 7px 7px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 999px;
  box-shadow: var(--shadow);
  transition: transform .18s ease;
}
.pill:hover { transform: translateY(-2px); }
.pill .mini-ring { width: 34px; height: 34px; }
.pill-pct { font-size: 15px; font-weight: 700; letter-spacing: -.01em; }
.pill-letter { font-size: 12px; font-weight: 700; padding: 2px 7px; border-radius: 6px; }
.gl[data-min="1"] .pill { display: inline-flex; }
.gl[data-min="1"] .panel { display: none; }

/* ---------- panel ---------- */
.panel {
  width: 380px;
  max-height: calc(100vh - 40px);
  display: flex;
  flex-direction: column;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 18px;
  box-shadow: var(--shadow);
  overflow: hidden;
  animation: rise .28s cubic-bezier(.2,.8,.2,1);
}
@keyframes rise { from { opacity: 0; transform: translateY(10px) scale(.985); } to { opacity: 1; transform: none; } }

.head {
  display: flex; align-items: center; gap: 10px;
  padding: 12px 12px 12px 16px;
  border-bottom: 1px solid var(--line-2);
}
.mark { width: 22px; height: 22px; flex: none; }
.brand { font-weight: 700; font-size: 13px; letter-spacing: -.01em; }
.course { color: var(--ink-3); font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.head .titles { min-width: 0; flex: 1; display: flex; flex-direction: column; line-height: 1.25; }
.icon-btn {
  width: 28px; height: 28px; border-radius: 8px; display: grid; place-items: center; color: var(--ink-3);
  transition: background .15s, color .15s;
}
.icon-btn:hover { background: var(--surface-2); color: var(--ink); }
.icon-btn svg { width: 16px; height: 16px; }
.spin svg { animation: spin .8s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }

.body { overflow-y: auto; overflow-x: hidden; overscroll-behavior: contain; }
.body::-webkit-scrollbar { width: 10px; }
.body::-webkit-scrollbar-thumb { background: var(--line); border-radius: 10px; border: 3px solid var(--surface); }

/* hero */
.hero { display: flex; align-items: center; gap: 18px; padding: 18px 18px 14px; }
.ring { width: 92px; height: 92px; flex: none; position: relative; }
.ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.ring .track { stroke: var(--line-2); }
.ring .bar { transition: stroke-dashoffset .7s cubic-bezier(.2,.8,.2,1), stroke .3s; }
.ring .letter {
  position: absolute; inset: 0; display: grid; place-items: center;
  font-size: 26px; font-weight: 800; letter-spacing: -.03em;
}
.hero-text { min-width: 0; }
.pct { font-size: 38px; font-weight: 750; letter-spacing: -.035em; line-height: 1; }
.pct small { font-size: 18px; font-weight: 600; color: var(--ink-3); margin-left: 1px; letter-spacing: 0; }
.meta { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 12px; color: var(--ink-3); font-size: 12px; margin-top: 8px; }
.meta .meta { margin-top: 0; }
.stat { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: var(--ink-3); outline: none; }
.stat .ic { width: 14px; height: 14px; }
.stat:focus-visible { color: var(--accent); }
.delta { display: inline-flex; align-items: center; gap: 3px; font-size: 11.5px; font-weight: 700; padding: 2px 8px 2px 6px; border-radius: 999px; background: var(--A-soft); color: var(--A); outline: none; }
.delta.neg { background: var(--F-soft); color: var(--F); }
.delta .ic { width: 12px; height: 12px; }
.delta[hidden] { display: none; }

/* controls */
.controls { display: flex; flex-wrap: wrap; gap: 6px; padding: 0 18px 14px; }
.chip {
  display: inline-flex; align-items: center; gap: 6px;
  height: 28px; padding: 0 10px; border-radius: 8px;
  background: var(--surface-2); border: 1px solid var(--line);
  font-size: 12px; font-weight: 550; color: var(--ink-2);
  transition: border-color .15s, background .15s, color .15s;
}
.chip:hover { border-color: color-mix(in srgb, var(--accent) 40%, var(--line)); }
.chip[aria-pressed="true"] { background: var(--accent-soft); border-color: transparent; color: var(--accent); }
.chip .ic { width: 15px; height: 15px; }
.chip.icon-only { width: 28px; padding: 0; justify-content: center; }
.controls { align-items: center; }
.flex { flex: 1; }
.switch { width: 24px; height: 14px; border-radius: 999px; background: var(--line); position: relative; transition: background .2s; flex: none; }
.switch::after { content: ""; position: absolute; top: 2px; left: 2px; width: 10px; height: 10px; border-radius: 50%; background: #fff; transition: transform .2s; box-shadow: 0 1px 2px rgba(0,0,0,.2); }
.chip[aria-pressed="true"] .switch { background: var(--accent); }
.chip[aria-pressed="true"] .switch::after { transform: translateX(10px); }

.whatif { display: inline-flex; align-items: center; gap: 5px; height: 28px; padding: 0 2px 0 9px; border-radius: 8px; background: var(--accent-soft); color: var(--accent); font-size: 12px; font-weight: 700; }
.whatif .ic { width: 14px; height: 14px; }
.whatif[hidden] { display: none; }
.whatif .icon-btn { width: 24px; height: 24px; color: var(--accent); }
.whatif .icon-btn:hover { background: color-mix(in srgb, var(--accent) 14%, transparent); color: var(--accent); }

.warn { display: flex; align-items: center; gap: 6px; margin: 0 18px 12px; padding: 8px 12px; border-radius: 10px; font-size: 12px; background: var(--C-soft); color: var(--C); font-weight: 650; }
.warn .ic { width: 14px; height: 14px; }
.warn[hidden] { display: none; }

/* groups */
.groups { padding: 0 10px 6px; }
.group { border-radius: 12px; transition: background .15s; }
.group + .group { margin-top: 2px; }
.group.open { background: var(--surface-2); }
.g-head { width: 100%; display: grid; grid-template-columns: 14px 1fr auto; align-items: center; column-gap: 8px; row-gap: 7px; padding: 10px 8px; text-align: left; border-radius: 12px; }
.g-head:hover { background: var(--surface-2); }
.chev { width: 14px; height: 14px; color: var(--ink-3); transition: transform .2s; }
.group.open .chev { transform: rotate(90deg); }
.g-name { font-weight: 600; font-size: 13px; min-width: 0; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.g-name .w { color: var(--ink-3); font-weight: 550; margin-left: 6px; font-size: 12px; }
.g-pct { font-weight: 700; font-size: 13px; }
.g-pct.muted { color: var(--ink-3); font-weight: 550; }
.g-track { grid-column: 2 / 4; height: 5px; border-radius: 99px; background: var(--line-2); overflow: hidden; }
.group.open .g-track { background: var(--line); }
.g-fill { height: 100%; border-radius: 99px; width: 0; transition: width .6s cubic-bezier(.2,.8,.2,1), background .3s; }
.g-sub { grid-column: 2 / 4; display: flex; justify-content: space-between; color: var(--ink-3); font-size: 11.5px; margin-top: -2px; }

.zero-groups { margin-top: 6px; padding-top: 4px; border-top: 1px solid var(--line); }
.zero-head { width: 100%; display: flex; align-items: center; gap: 8px; padding: 8px; text-align: left; border-radius: 12px; color: var(--ink-3); font-size: 12px; font-weight: 600; }
.zero-head:hover { background: var(--surface-2); }
.zero-count { margin-left: auto; min-width: 18px; padding: 1px 6px; border-radius: 99px; background: var(--line-2); text-align: center; font-size: 11px; }
.zero-groups.open > .zero-head .chev { transform: rotate(90deg); }
.zero-list { display: none; }
.zero-groups.open .zero-list { display: block; }

.w-input {
  width: 52px; height: 24px; padding: 0 6px; text-align: right;
  border-radius: 6px; border: 1px solid var(--line); background: var(--surface);
  font-size: 12px; font-weight: 600;
}
.w-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }

.items { display: none; padding: 0 8px 8px 30px; }
.group.open .items { display: block; }
.item { display: grid; grid-template-columns: 1fr auto; align-items: center; gap: 10px; padding: 7px 0; border-top: 1px solid var(--line); }
.item:first-child { border-top: 0; }
.i-name { min-width: 0; font-size: 12.5px; color: var(--ink-2); overflow: hidden; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; line-height: 1.35; }
.i-name a { color: inherit; text-decoration: none; }
.i-name a:hover { color: var(--accent); text-decoration: underline; }
.tags { display: flex; gap: 4px; flex-wrap: wrap; margin-top: 3px; }
.tag { font-size: 10px; font-weight: 700; letter-spacing: .02em; padding: 1px 6px; border-radius: 5px; background: var(--none-soft); color: var(--ink-3); }
.tag.missing { background: var(--F-soft); color: var(--F); }
.tag.late { background: var(--C-soft); color: var(--C); }
.tag.whatif { background: var(--accent-soft); color: var(--accent); }
.tag.dropped { background: var(--none-soft); color: var(--ink-3); }
.item.is-dropped .i-name { text-decoration: line-through; text-decoration-color: var(--ink-3); opacity: .7; }
.item.is-omit { opacity: .55; }

.score { display: flex; align-items: center; gap: 4px; font-size: 12.5px; color: var(--ink-3); white-space: nowrap; }
.s-input {
  width: 54px; height: 28px; padding: 0 8px; text-align: right;
  border-radius: 7px; border: 1px solid transparent; background: transparent;
  font-weight: 650; color: var(--ink); transition: border-color .15s, background .15s, box-shadow .15s;
}
.s-input::placeholder { color: var(--ink-3); font-weight: 500; }
.item:hover .s-input, .s-input:focus { border-color: var(--line); background: var(--surface); }
.s-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.s-input.edited { border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: var(--accent-soft); color: var(--accent); }
.p-input { width: 44px; height: 28px; padding: 0 6px; text-align: right; border-radius: 7px; border: 1px solid var(--line); background: var(--surface); font-weight: 600; }
.p-input:focus { outline: none; border-color: var(--accent); }
.n-input { width: 100%; height: 26px; padding: 0 6px; border-radius: 6px; border: 1px solid var(--line); background: var(--surface); font-size: 12.5px; }
.n-input:focus { outline: none; border-color: var(--accent); }
.x-btn { width: 22px; height: 22px; border-radius: 6px; color: var(--ink-3); display: grid; place-items: center; }
.x-btn:hover { background: var(--F-soft); color: var(--F); }
.add-btn { margin-top: 4px; width: 28px; height: 28px; display: grid; place-items: center; color: var(--accent); border-radius: 8px; margin-left: -6px; }
.add-btn:hover { background: var(--accent-soft); }
.drop-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; padding: 4px 0 8px; font-size: 12.5px; color: var(--ink-2); }
.drop-label { font-weight: 600; }
.stepper { display: inline-flex; align-items: center; gap: 2px; padding: 2px; border-radius: 9px; border: 1px solid var(--line); background: var(--surface); }
.drop-row.edited .stepper { border-color: color-mix(in srgb, var(--accent) 55%, transparent); background: var(--accent-soft); }
.drop-row.edited .step-n { color: var(--accent); }
.step { width: 24px; height: 24px; border-radius: 7px; display: grid; place-items: center; color: var(--ink-2); }
.step .ic { width: 14px; height: 14px; }
.step:hover:not(:disabled) { background: var(--surface-2); color: var(--ink); }
.step:disabled { opacity: .35; cursor: default; }
.step-n { min-width: 20px; text-align: center; font-weight: 700; font-size: 13px; }
.empty-g { font-size: 12px; color: var(--ink-3); padding: 4px 0 6px; }

/* goal */
.goal { margin: 8px 12px 14px; padding: 14px; border-radius: 14px; border: 1px solid var(--line); }
.goal-row { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.goal-icon { width: 28px; height: 28px; display: grid; place-items: center; border-radius: 8px; background: var(--accent-soft); color: var(--accent); flex: none; }
.goal-row select { flex: 1; }
.goal select {
  appearance: none; -webkit-appearance: none; height: 28px; padding: 0 26px 0 10px; border-radius: 8px;
  border: 1px solid var(--line); background: var(--surface-2) url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' fill='none' stroke='%236b7383' stroke-width='1.6' stroke-linecap='round'/%3E%3C/svg%3E") no-repeat right 9px center;
  font-weight: 650; font-size: 12.5px; cursor: pointer;
}
.goal select:focus { outline: none; border-color: var(--accent); }
.goal-big { font-size: 22px; font-weight: 750; letter-spacing: -.02em; margin-top: 12px; }
.goal-big.ok { color: var(--A); }
.goal-big.bad { color: var(--F); }
.goal-big { display: flex; align-items: center; gap: 6px; }
.ic-big { width: 20px; height: 20px; }
.goal-scope { display: flex; flex-wrap: wrap; gap: 4px 12px; margin-top: 6px; font-size: 12px; }
.warn-c { color: var(--C); }
.range { position: relative; height: 8px; border-radius: 99px; background: var(--line-2); margin: 16px 0 6px; }
.range-fill { position: absolute; top: 0; bottom: 0; border-radius: 99px; background: linear-gradient(90deg, color-mix(in srgb, var(--accent) 35%, transparent), var(--accent)); }
.range-mark { position: absolute; top: -4px; width: 2px; height: 16px; border-radius: 2px; background: var(--ink); }
.range-legend { display: flex; justify-content: space-between; font-size: 11px; font-weight: 600; color: var(--ink-3); }
.range-legend span { outline: none; }
.avg-row { margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--line); justify-content: flex-start; }
.avg-row[hidden] { display: none; }
.avg-in { display: flex; align-items: center; gap: 4px; font-size: 12.5px; font-weight: 600; color: var(--ink-3); }
.avg-input {
  width: 58px; height: 28px; padding: 0 8px; text-align: right;
  border-radius: 8px; border: 1px solid var(--line); background: var(--surface-2);
  font-weight: 650; font-size: 12.5px; color: var(--ink);
}
.avg-input::placeholder { color: var(--ink-3); font-weight: 500; }
.avg-input:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px var(--accent-soft); }
.avg-out { margin-left: auto; display: flex; align-items: center; gap: 6px; font-size: 15px; font-weight: 750; letter-spacing: -.01em; }
.avg-letter { padding: 1px 7px; border-radius: 99px; font-size: 12px; font-weight: 700; }


.state { padding: 36px 24px; text-align: center; color: var(--ink-3); }
.state b { display: block; color: var(--ink); font-size: 14px; margin-top: 6px; }
.ic-lg { width: 24px; height: 24px; color: var(--C); }
.skeleton { height: 12px; border-radius: 6px; background: linear-gradient(90deg, var(--line-2), var(--line), var(--line-2)); background-size: 200% 100%; animation: shimmer 1.2s infinite; }
@keyframes shimmer { to { background-position: -200% 0; } }

/* dashboard badge */
.badge { all: initial; }
`;

  root.GL_BADGE_STYLES = `
.gl-badge {
  position: absolute; top: 10px; right: 10px; z-index: 5;
  display: inline-flex; align-items: center; gap: 6px;
  padding: 4px 9px 4px 5px; border-radius: 999px;
  background: rgba(255,255,255,.96); color: #0e1116;
  font: 700 12.5px/1 -apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif;
  font-variant-numeric: tabular-nums;
  box-shadow: 0 1px 2px rgba(0,0,0,.12), 0 6px 16px -4px rgba(0,0,0,.25);
  text-decoration: none !important; pointer-events: auto;
}
.gl-badge i { font-style: normal; font-size: 11px; padding: 3px 6px; border-radius: 999px; color: #fff; }
.gl-badge[data-band="A"] i { background: #0f9b6c; }
.gl-badge[data-band="B"] i { background: #2563eb; }
.gl-badge[data-band="C"] i { background: #c27c0e; }
.gl-badge[data-band="D"] i { background: #e0601a; }
.gl-badge[data-band="F"] i { background: #d93a3a; }
.gl-badge[data-band="none"] i { background: #8a92a3; }
`;
})(typeof globalThis !== 'undefined' ? globalThis : this);
