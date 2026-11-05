/* GradeLens content script: grade panel on course Grades pages, badges on the Dashboard. */
(function () {
  'use strict';

  const GC = globalThis.GradeCore;
  const { CanvasAPI, GLStore, GLIcons, GLCsv } = globalThis;
  const { icon, MARK } = GLIcons;
  const origin = location.origin;

  GLStore.set('gl:lastOrigin', origin);

  // Popup can ask this tab to fetch data (uses the page's own Canvas session).
  if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.onMessage) chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg && msg.type === 'gl:loadAll') {
      CanvasAPI.loadAll(origin).then(
        (data) => reply({ ok: true, data }),
        (e) => reply({ ok: false, error: String(e.message || e), status: e.status })
      );
      return true;
    }
    return false;
  });

  const gradesMatch = location.pathname.match(/^\/courses\/(\d+)\/grades(?:\/\d+)?\/?$/);
  if (gradesMatch) mountPanel(gradesMatch[1]);
  else if (/^\/?$|^\/dashboard\/?$/.test(location.pathname)) mountDashboardBadges();

  // ---------------------------------------------------------------- helpers

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  const fmtPct = (n) => (n === null || n === undefined ? '—' : (Math.round(n * 100) / 100).toFixed(2));
  const fmtPts = (n) => (n === null || n === undefined ? '—' : String(Math.round(n * 100) / 100));

  function parseScore(raw, points) {
    const t = String(raw).trim();
    if (!t) return null;
    let m = t.match(/^(-?\d*\.?\d+)\s*%$/);
    if (m) return points ? (parseFloat(m[1]) / 100) * points : null;
    m = t.match(/^(-?\d*\.?\d+)\s*\/\s*(\d*\.?\d+)$/);
    if (m) return points && parseFloat(m[2]) ? (parseFloat(m[1]) / parseFloat(m[2])) * points : parseFloat(m[1]);
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }

  // Icon + value with a tooltip naming the value.
  const stat = (name, value, tip, pos) => `<span class="stat" data-tip="${esc(tip)}"${pos ? ` data-tip-pos="${pos}"` : ''} tabindex="0" aria-label="${esc(tip)}: ${esc(value)}">${icon(name)}${esc(value)}</span>`;

  const RING_C = 2 * Math.PI * 40;
  const bandColor = (letter) => `var(--${GC.band(letter)})`;
  const bandSoft = (letter) => `var(--${GC.band(letter)}-soft)`;

  // ---------------------------------------------------------------- panel

  async function mountPanel(courseId) {
    const host = document.createElement('div');
    host.id = 'gradelens-root';
    document.documentElement.appendChild(host);
    const shadow = host.attachShadow({ mode: 'open' });
    shadow.innerHTML = `<style>${GLIcons.TIP_CSS}${globalThis.GL_STYLES}</style><div class="gl" data-min="0"></div>`;
    const root = shadow.querySelector('.gl');
    GLIcons.enableTouchTips(root);

    // Keep Canvas keyboard shortcuts from firing while typing in the panel.
    for (const t of ['keydown', 'keyup', 'keypress']) root.addEventListener(t, (e) => e.stopPropagation());

    const S = {
      courseId,
      model: null,
      settings: { custom: false, weights: {}, drops: {} },
      prefs: await GLStore.prefs(),
      overrides: {},
      extras: [],
      open: new Set(),
      zeroOpen: false,
      goal: null,
      avg: '',
      xSeq: 1,
    };
    root.dataset.min = S.prefs.minimized ? '1' : '0';

    const opts = () => ({
      overrides: S.overrides,
      extras: S.extras,
      missingAsZero: S.prefs.missingAsZero,
      ...GLStore.computeOpts(S.settings),
    });

    root.innerHTML = shell(`<div class="state"><div class="skeleton" style="width:60%;margin:0 auto 10px"></div><div class="skeleton" style="width:40%;margin:0 auto"></div></div>`, '');

    async function load() {
      const btn = root.querySelector('[data-act="refresh"]');
      if (btn) btn.classList.add('spin');
      try {
        const [{ course, groups }, settings] = await Promise.all([
          CanvasAPI.loadCourse(origin, courseId),
          GLStore.courseSettings(origin, courseId),
        ]);
        if (CanvasAPI.isHidden(course)) return host.remove();
        S.model = GC.buildModel(course, groups);
        S.settings = settings;
        build();
      } catch (e) {
        const signedOut = e.status === 401;
        root.innerHTML = shell(
          `<div class="state">${icon('alert', 'ic-lg')}<b>${signedOut ? 'Signed out' : 'Load failed'}</b></div>`,
          ''
        );
      }
    }

    function shell(body, courseName) {
      return `
        <button class="pill" data-act="expand" data-tip="Open GradeLens" aria-label="Open GradeLens">
          <svg class="mini-ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="40" fill="none" stroke="var(--line-2)" stroke-width="12"/><circle class="mini-bar" cx="50" cy="50" r="40" fill="none" stroke-width="12" stroke-linecap="round" transform="rotate(-90 50 50)" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/></svg>
          <span class="pill-pct">—</span><span class="pill-letter"></span>
        </button>
        <section class="panel" role="dialog" aria-label="GradeLens">
          <header class="head">
            ${MARK}
            <div class="titles"><span class="brand">GradeLens</span><span class="course">${esc(courseName)}</span></div>
            <button class="icon-btn hit" data-act="export" data-tip="Export CSV" data-tip-pos="below" aria-label="Export grades as CSV">${icon('download')}</button>
            <button class="icon-btn hit" data-act="refresh" data-tip="Reload" data-tip-pos="below" aria-label="Reload">${icon('refresh')}</button>
            <button class="icon-btn hit" data-act="minimize" data-tip="Minimize" data-tip-pos="below-end" aria-label="Minimize">${icon('minus')}</button>
          </header>
          <div class="body">${body}</div>
        </section>`;
    }

    function build() {
      const m = S.model;
      const custom = S.settings.custom;
      const weighted = custom || m.weighted;
      const goalOptions = m.scheme.filter(([, v]) => v > 0);

      // 0% categories (weighted courses, Canvas weights) go in a collapsed dropdown at the end.
      const hideZero = m.weighted && !custom;
      const mainGroups = hideZero ? m.groups.filter((g) => g.weight > 0) : m.groups;
      const zeroGroups = hideZero ? m.groups.filter((g) => !(g.weight > 0)) : [];

      const groupHtml = (g) => {
        const items = g.assignments.map((a) => itemHtml(a)).join('');
        const extras = S.extras.filter((x) => x.groupId === g.id).map(extraHtml).join('');
        const empty = !g.assignments.length && !extras ? `<div class="empty-g">No assignments</div>` : '';
        const wVal = custom ? (S.settings.weights[g.id] ?? '') : g.weight;
        return `
        <div class="group ${S.open.has(g.id) ? 'open' : ''}" data-gid="${esc(g.id)}">
          <div class="g-head" role="button" tabindex="0" data-act="toggle" aria-expanded="${S.open.has(g.id)}">
            ${icon('chevron', 'chev')}
            <span class="g-name">${esc(g.name)}${weighted && !custom ? `<span class="w">${fmtPts(g.weight)}%</span>` : ''}</span>
            ${custom ? `<span><input class="w-input" data-weight="${esc(g.id)}" value="${esc(wVal)}" placeholder="0" inputmode="decimal" aria-label="Weight for ${esc(g.name)}">%</span>` : `<span class="g-pct" data-gpct></span>`}
            <div class="g-track"><div class="g-fill" data-gfill></div></div>
            <div class="g-sub"><span data-gsub></span>${custom ? `<span class="g-pct" data-gpct></span>` : `<span data-gsub2></span>`}</div>
          </div>
          <div class="items">${dropMax(g) > 0 ? dropRowHtml(g) : ''}${items}${extras}${empty}<button class="add-btn hit" data-act="add-extra" data-tip="Add what-if" data-tip-pos="start" aria-label="Add what-if assignment">${icon('plus')}</button></div>
        </div>`;
      };

      const zeroHtml = zeroGroups.length
        ? `
          <div class="zero-groups ${S.zeroOpen ? 'open' : ''}">
            <button class="zero-head" data-act="toggle-zero" aria-expanded="${S.zeroOpen}">${icon('chevron', 'chev')}<span>0% categories</span><span class="zero-count">${zeroGroups.length}</span></button>
            <div class="zero-list">${zeroGroups.map(groupHtml).join('')}</div>
          </div>`
        : '';
      const groupsHtml = mainGroups.map(groupHtml).join('') + zeroHtml;

      const canvasStat = m.canvasScore !== null && !m.hideFinal
        ? stat('canvas', `${fmtPct(m.canvasScore)}%`, 'Canvas total')
        : `<span class="stat" data-tip="Hidden in Canvas" tabindex="0" aria-label="Total hidden in Canvas">${icon('eyeOff')}</span>`;

      const body = `
        <div class="hero">
          <div class="ring">
            <svg viewBox="0 0 100 100" aria-hidden="true"><circle class="track" cx="50" cy="50" r="40" fill="none" stroke-width="9"/><circle class="bar" data-ring cx="50" cy="50" r="40" fill="none" stroke-width="9" stroke-linecap="round" stroke-dasharray="${RING_C}" stroke-dashoffset="${RING_C}"/></svg>
            <div class="letter" data-letter>—</div>
          </div>
          <div class="hero-text">
            <div class="pct"><span data-pct>—</span><small>%</small></div>
            <div class="meta"><span class="meta" data-meta></span>${canvasStat}<span class="delta" data-delta hidden></span></div>
          </div>
        </div>
        <div class="controls">
          <button class="chip" data-act="missing" aria-pressed="${!!S.prefs.missingAsZero}" data-tip="Count missing as zero" data-tip-pos="start"><span class="switch"></span>Missing = 0</button>
          <button class="chip icon-only hit" data-act="weights" aria-pressed="${custom}" data-tip="Custom weights" aria-label="Custom weights">${icon('scale')}</button>
          <span class="flex"></span>
          <span class="whatif" data-banner hidden>${icon('pencil')}<span data-banner-text></span><button class="icon-btn hit" data-act="reset" data-tip="Reset what-ifs" aria-label="Reset what-ifs">${icon('reset')}</button></span>
        </div>
        <div class="warn" data-warn hidden>${icon('alert')}<span data-warn-text></span></div>
        <div class="groups">${groupsHtml || `<div class="state">No categories</div>`}</div>
        <div class="goal">
          <label class="goal-row">
            <span class="goal-icon" data-tip="Goal grade" data-tip-pos="start" aria-hidden="true">${icon('target')}</span>
            <select data-goal aria-label="Goal grade">
              ${goalOptions.map(([n, v]) => `<option value="${esc(n)}">${esc(n)} · ${fmtPts(v * 100)}%</option>`).join('')}
            </select>
          </label>
          <div data-goal-out></div>
          <div class="goal-row avg-row" data-avg-row>
            <span class="goal-icon" data-tip="Average on what's left" data-tip-pos="start" aria-hidden="true">${icon('pencil')}</span>
            <span class="avg-in"><input class="avg-input" data-avg value="${esc(S.avg)}" placeholder="90" inputmode="decimal" aria-label="Average on remaining work, percent">%</span>
            <span class="avg-out" data-avg-out></span>
          </div>
        </div>`;

      const scrollTop = root.querySelector('.body') ? root.querySelector('.body').scrollTop : 0;
      root.innerHTML = shell(body, m.name);
      root.querySelector('.body').scrollTop = scrollTop;

      const sel = root.querySelector('[data-goal]');
      const goal = pickGoal();
      if (goal) sel.value = goal;
      S.goal = sel.value;

      refresh();
    }

    function itemHtml(a) {
      const tags = [];
      if (a.omit) tags.push('<span class="tag">Not counted</span>');
      if (a.excused) tags.push('<span class="tag">Excused</span>');
      if (a.missing) tags.push('<span class="tag missing">Missing</span>');
      if (a.late && !a.missing) tags.push('<span class="tag late">Late</span>');
      if (a.pending) tags.push('<span class="tag">Pending</span>');
      const has = Object.prototype.hasOwnProperty.call(S.overrides, a.id);
      const actual = a.score !== null && !a.pending ? a.score : null;
      const val = has ? S.overrides[a.id] : actual;
      const ph = a.excused ? 'EX' : '–';
      const pts = a.points !== null ? fmtPts(a.points) : '—';
      const name = a.url ? `<a href="${esc(a.url)}">${esc(a.name)}</a>` : esc(a.name);
      return `
        <div class="item ${a.omit ? 'is-omit' : ''}" data-aid="${esc(a.id)}">
          <div><div class="i-name">${name}</div><div class="tags">${tags.join('')}<span data-dyn-tags></span></div></div>
          <div class="score"><input class="s-input ${has ? 'edited' : ''}" data-score="${esc(a.id)}" value="${val === null || val === undefined ? '' : esc(fmtPts(val))}" placeholder="${ph}" inputmode="decimal" aria-label="Score for ${esc(a.name)}" ${a.omit ? 'disabled' : ''}>/ ${pts}</div>
        </div>`;
    }

    // How many scores a category can drop: all but one of its countable assignments.
    function dropMax(g) {
      const n = g.assignments.filter((a) => !a.omit && (a.points || 0) > 0).length
        + S.extras.filter((x) => x.groupId === g.id).length;
      return Math.max(0, n - 1);
    }

    const canvasDrops = (g) => Number(g.rules && g.rules.drop_lowest) || 0;
    const dropsFor = (g) => (S.settings.drops[g.id] !== undefined ? S.settings.drops[g.id] : canvasDrops(g));

    function dropRowHtml(g) {
      return `
        <div class="drop-row" data-drop-row>
          <span class="drop-label">Drop lowest</span>
          <div class="stepper" role="group" aria-label="Lowest scores dropped in ${esc(g.name)}">
            <button class="step hit" data-act="drop-dec" data-tip="Drop fewer" aria-label="Drop one fewer">${icon('minus')}</button>
            <span class="step-n" data-drop-n aria-live="polite">${dropsFor(g)}</span>
            <button class="step hit" data-act="drop-inc" data-tip="Drop more" data-tip-pos="end" aria-label="Drop one more">${icon('plus')}</button>
          </div>
        </div>`;
    }

    function extraHtml(x) {
      return `
        <div class="item" data-xid="${esc(x.id)}">
          <div><input class="n-input" data-xfield="name" value="${esc(x.name)}" placeholder="Name" aria-label="What-if assignment name"><div class="tags"><span class="tag whatif">What-if</span></div></div>
          <div class="score">
            <input class="s-input edited" data-xfield="score" value="${x.score === null ? '' : esc(fmtPts(x.score))}" placeholder="Score" inputmode="decimal" aria-label="Score">/
            <input class="p-input" data-xfield="points" value="${esc(fmtPts(x.points))}" placeholder="Pts" inputmode="decimal" aria-label="Points possible">
            <button class="x-btn hit" data-act="remove-extra" data-tip="Remove" data-tip-pos="below-end" aria-label="Remove">${icon('x')}</button>
          </div>
        </div>`;
    }

    function pickGoal() {
      const m = S.model;
      const letters = m.scheme.filter(([, v]) => v > 0).map(([n]) => n);
      if (S.prefs.goal && letters.includes(S.prefs.goal)) return S.prefs.goal;
      const cur = GC.compute(m, opts());
      if (cur.pct === null) return letters[0];
      // Default: the next letter up (or the top one).
      const idx = m.scheme.findIndex(([n]) => n === cur.letter);
      return idx > 0 ? m.scheme[idx - 1][0] : letters[0];
    }

    function refresh() {
      const m = S.model;
      if (!m) return;
      const o = opts();
      const r = GC.compute(m, o);
      const base = GC.compute(m, {});
      const color = bandColor(r.letter);

      // hero
      const q = (sel) => root.querySelector(sel);
      q('[data-pct]').textContent = fmtPct(r.pct);
      q('[data-letter]').textContent = r.letter || '—';
      q('[data-letter]').style.color = color;
      const ring = q('[data-ring]');
      ring.style.stroke = color;
      requestAnimationFrame(() => {
        ring.style.strokeDashoffset = RING_C * (1 - Math.max(0, Math.min(100, r.pct || 0)) / 100);
      });
      q('[data-meta]').innerHTML = [
        r.weighted
          ? `<span class="stat" data-tip="Weighted" tabindex="0" aria-label="Weighted by category">${icon('scale')}</span>`
          : `<span class="stat" data-tip="Total points" tabindex="0" aria-label="Total points">${icon('sigma')}</span>`,
        stat('check', r.gradedCount, 'Graded'),
        r.remainingCount ? stat('clock', r.remainingCount, 'Ungraded') : '',
      ].join('');

      // pill
      q('.pill-pct').textContent = r.pct === null ? '—' : `${fmtPct(r.pct)}%`;
      const pl = q('.pill-letter');
      pl.textContent = r.letter || '';
      pl.style.color = color;
      pl.style.background = bandSoft(r.letter);
      const mini = q('.mini-bar');
      mini.style.stroke = color;
      mini.style.strokeDashoffset = RING_C * (1 - Math.max(0, Math.min(100, r.pct || 0)) / 100);

      // delta vs actual
      const edits = Object.keys(S.overrides).length + S.extras.length;
      const changed = edits || S.prefs.missingAsZero || S.settings.custom;
      const delta = q('[data-delta]');
      if (changed && base.pct !== null && r.pct !== null && Math.abs(r.pct - base.pct) >= 0.005) {
        const d = r.pct - base.pct;
        delta.hidden = false;
        delta.dataset.tip = `Actual ${fmtPct(base.pct)}%`;
        delta.tabIndex = 0;
        delta.innerHTML = `${icon(d > 0 ? 'up' : 'down')}${fmtPct(Math.abs(d))}`;
        delta.classList.toggle('neg', d < 0);
      } else delta.hidden = true;

      // what-if count + reset
      const banner = q('[data-banner]');
      banner.hidden = !edits;
      q('[data-banner-text]').textContent = String(edits);
      banner.setAttribute('aria-label', `${edits} what-if change${edits === 1 ? '' : 's'}`);

      // weight warning
      const warn = q('[data-warn]');
      if (S.settings.custom) {
        const W = m.groups.reduce((t, g) => t + (Number(S.settings.weights[g.id]) || 0), 0);
        warn.hidden = Math.abs(W - 100) < 0.01;
        q('[data-warn-text]').textContent = `Weights total ${fmtPts(W)}%`;
      } else warn.hidden = true;

      // groups
      for (const g of r.groups) {
        const el = root.querySelector(`.group[data-gid="${CSS.escape(g.id)}"]`);
        if (!el) continue;
        const letter = GC.letterFor(g.pct);
        const pctEl = el.querySelector('[data-gpct]');
        pctEl.textContent = g.pct === null ? '—' : `${fmtPct(g.pct)}%`;
        pctEl.classList.toggle('muted', g.pct === null);
        const fill = el.querySelector('[data-gfill]');
        fill.style.width = `${Math.max(0, Math.min(100, g.pct || 0))}%`;
        fill.style.background = bandColor(letter);
        el.querySelector('[data-gsub]').textContent = g.possible > 0 ? `${fmtPts(g.score)} / ${fmtPts(g.possible)}` : '';
        const sub2 = el.querySelector('[data-gsub2]');
        if (sub2) {
          sub2.innerHTML = [
            g.dropped.size ? stat('x', g.dropped.size, 'Dropped', 'end') : '',
            g.remaining.length ? stat('clock', g.remaining.length, 'Ungraded', 'end') : '',
          ].join('');
        }

        // drop stepper
        const mg = m.groups.find((x) => x.id === g.id);
        const dropRow = el.querySelector('[data-drop-row]');
        if (dropRow) {
          const n = dropsFor(mg);
          dropRow.querySelector('[data-drop-n]').textContent = n;
          dropRow.classList.toggle('edited', S.settings.drops[g.id] !== undefined);
          dropRow.querySelector('[data-act="drop-dec"]').disabled = n <= 0;
          dropRow.querySelector('[data-act="drop-inc"]').disabled = n >= dropMax(mg);
        }

        // per-item dynamic state
        for (const row of el.querySelectorAll('.item[data-aid]')) {
          const id = row.dataset.aid;
          const dropped = g.dropped.has(id);
          const has = Object.prototype.hasOwnProperty.call(S.overrides, id);
          row.classList.toggle('is-dropped', dropped);
          const a = m.groups.find((x) => x.id === g.id).assignments.find((x) => x.id === id);
          const assumedZero = S.prefs.missingAsZero && a && a.missing && !has && (a.score === null || a.score === undefined);
          const input = row.querySelector('.s-input');
          if (a) input.placeholder = assumedZero ? '0' : a.excused ? 'EX' : '–';
          row.querySelector('[data-dyn-tags]').innerHTML =
            (has ? '<span class="tag whatif">What-if</span>' : '') + (dropped ? '<span class="tag dropped">Dropped</span>' : '');
        }
      }

      renderGoal();
    }

    function renderGoal() {
      const m = S.model;
      const out = root.querySelector('[data-goal-out]');
      const entry = m.scheme.find(([n]) => n === S.goal);
      if (!entry) return (out.innerHTML = '');
      const target = GC.cutoffFor(S.goal);
      const t = GC.solveTarget(m, opts(), target);

      // What the "needed" average applies to: remaining items + empty weighted categories.
      const scope = [
        t.remainingCount ? stat('clock', `${t.remainingCount} · ${fmtPts(t.remainingPoints)} pts`, 'Ungraded work') : '',
        ...t.emptyGroups.map((g) => `<span class="stat" data-tip="Empty category" tabindex="0">${icon('target')}${esc(g.name)} · ${fmtPts(g.weight)}%</span>`),
      ].join('');

      let big = '';
      let cls = '';
      let note = '';
      switch (t.status) {
        case 'none':
          big = 'Nothing left';
          note = `<span class="stat">${icon('plus')}Add what-if</span>`;
          break;
        case 'locked':
          big = `${icon('lock', 'ic-big')}Locked in`;
          cls = 'ok';
          break;
        case 'reachable':
          big = `Need ${fmtPct(t.needed * 100)}%`;
          break;
        case 'stretch':
        case 'impossible':
          // Needs over 100%: show the best grade possible with perfect scores instead.
          big = `Max ${fmtPct(t.best)}% · ${esc(GC.letterFor(t.best) || '—')}`;
          cls = 'bad';
          note = `<span class="stat warn-c">${icon('alert')}${esc(S.goal)} out of reach</span>`;
          break;
      }

      let range = '';
      if (t.worst !== undefined && t.best !== undefined && t.worst !== null && t.best !== null) {
        const lo = Math.max(0, Math.floor(Math.min(t.worst, target) / 10) * 10 - 5);
        const hi = Math.max(100, Math.ceil(t.best));
        const pos = (v) => `${((Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo)) * 100}%`;
        range = `
          <div class="range" role="img" aria-label="Possible final: ${fmtPct(t.worst)}% to ${fmtPct(t.best)}%">
            <div class="range-fill" style="left:${pos(t.worst)};right:calc(100% - ${pos(t.best)})"></div>
            <div class="range-mark" style="left:${pos(target)}"></div>
          </div>
          <div class="range-legend"><span data-tip="All zeros" data-tip-pos="start" tabindex="0">${fmtPct(t.worst)}%</span><span data-tip="All perfect" data-tip-pos="below-end" tabindex="0">${fmtPct(t.best)}%</span></div>`;
      }
      out.innerHTML = `<div class="goal-big ${cls}">${big}</div><div class="goal-scope">${scope}${note}</div>${range}`;
      renderAvg(t.status !== 'none');
    }

    // Final grade if every remaining item averages the entered percent (over 100 allowed).
    function renderAvg(show) {
      const row = root.querySelector('[data-avg-row]');
      if (!row) return;
      row.hidden = !show;
      const out = row.querySelector('[data-avg-out]');
      const v = parseFloat(S.avg);
      const p = show && Number.isFinite(v) && v >= 0 ? GC.project(S.model, opts(), v / 100).pct : null;
      if (p === null) return (out.innerHTML = '');
      const letter = GC.letterFor(p);
      out.innerHTML = `${fmtPct(p)}%<span class="avg-letter" style="color:${bandColor(letter)};background:${bandSoft(letter)}">${esc(letter || '—')}</span>`;
    }

    // ---------- events ----------

    root.addEventListener('click', (e) => {
      const el = e.target.closest('[data-act]');
      if (!el || !root.contains(el)) return;
      const act = el.dataset.act;
      if (act === 'toggle') {
        if (e.target.closest('input')) return;
        const g = el.closest('.group');
        const id = g.dataset.gid;
        if (S.open.has(id)) S.open.delete(id); else S.open.add(id);
        g.classList.toggle('open', S.open.has(id));
        el.setAttribute('aria-expanded', S.open.has(id));
      } else if (act === 'toggle-zero') {
        S.zeroOpen = !S.zeroOpen;
        el.closest('.zero-groups').classList.toggle('open', S.zeroOpen);
        el.setAttribute('aria-expanded', S.zeroOpen);
      } else if (act === 'minimize' || act === 'expand') {
        const min = act === 'minimize';
        root.dataset.min = min ? '1' : '0';
        S.prefs.minimized = min;
        GLStore.savePrefs({ minimized: min });
      } else if (act === 'export') {
        if (S.model) exportCsv();
      } else if (act === 'refresh') {
        load();
      } else if (act === 'missing') {
        S.prefs.missingAsZero = !S.prefs.missingAsZero;
        el.setAttribute('aria-pressed', S.prefs.missingAsZero);
        GLStore.savePrefs({ missingAsZero: S.prefs.missingAsZero });
        refresh();
      } else if (act === 'weights') {
        const on = !S.settings.custom;
        const weights = { ...S.settings.weights };
        if (on) {
          const gs = S.model.groups;
          const anyCanvas = gs.some((g) => g.weight > 0);
          for (const g of gs) {
            if (weights[g.id] === undefined) {
              weights[g.id] = anyCanvas ? g.weight : Math.round((100 / gs.length) * 100) / 100;
            }
          }
        }
        S.settings = { ...S.settings, custom: on, weights };
        GLStore.saveCourseSettings(origin, courseId, S.settings);
        build();
      } else if (act === 'drop-inc' || act === 'drop-dec') {
        const gid = el.closest('.group').dataset.gid;
        const g = S.model.groups.find((x) => x.id === gid);
        const n = Math.max(0, Math.min(dropMax(g), dropsFor(g) + (act === 'drop-inc' ? 1 : -1)));
        const drops = { ...S.settings.drops };
        if (n === canvasDrops(g)) delete drops[gid]; else drops[gid] = n;
        S.settings = { ...S.settings, drops };
        GLStore.saveCourseSettings(origin, courseId, S.settings);
        refresh();
      } else if (act === 'reset') {
        S.overrides = {};
        S.extras = [];
        build();
      } else if (act === 'add-extra') {
        const gid = el.closest('.group').dataset.gid;
        const id = `x${S.xSeq++}`;
        S.extras.push({ id, groupId: gid, name: `What-if ${S.extras.length + 1}`, points: 100, score: null });
        S.open.add(gid);
        if (el.closest('.zero-groups')) S.zeroOpen = true;
        build();
        const input = root.querySelector(`.item[data-xid="${id}"] [data-xfield="score"]`);
        if (input) input.focus();
      } else if (act === 'remove-extra') {
        const id = el.closest('.item').dataset.xid;
        S.extras = S.extras.filter((x) => x.id !== id);
        build();
      }
    });

    root.addEventListener('keydown', (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('.g-head')) {
        e.preventDefault();
        e.target.click();
      }
      if (e.key === 'Enter' && e.target.matches('input')) e.target.blur();
    });

    root.addEventListener('input', (e) => {
      const t = e.target;
      if (t.matches('[data-avg]')) {
        S.avg = t.value.trim();
        renderAvg(true);
      } else if (t.dataset.score) {
        const id = t.dataset.score;
        const a = findAssignment(id);
        const v = parseScore(t.value, a && a.points);
        const actual = a && a.score !== null && !a.pending ? a.score : null;
        if (v === null || (actual !== null && Math.abs(v - actual) < 1e-9)) delete S.overrides[id];
        else S.overrides[id] = v;
        t.classList.toggle('edited', Object.prototype.hasOwnProperty.call(S.overrides, id));
        refresh();
      } else if (t.dataset.xfield) {
        const x = S.extras.find((y) => y.id === t.closest('.item').dataset.xid);
        if (!x) return;
        if (t.dataset.xfield === 'name') x.name = t.value;
        if (t.dataset.xfield === 'points') x.points = Math.max(0, parseFloat(t.value) || 0);
        if (t.dataset.xfield === 'score') x.score = parseScore(t.value, x.points);
        refresh();
      } else if (t.dataset.weight) {
        const v = parseFloat(t.value);
        S.settings.weights[t.dataset.weight] = Number.isFinite(v) ? v : 0;
        GLStore.saveCourseSettings(origin, courseId, S.settings);
        refresh();
      }
    });

    root.addEventListener('change', (e) => {
      if (e.target.matches('[data-goal]')) {
        S.goal = e.target.value;
        GLStore.savePrefs({ goal: S.goal });
        renderGoal();
      }
    });

    // Put the real score back if a what-if input is left empty.
    root.addEventListener('focusout', (e) => {
      const t = e.target;
      if (!t.dataset || !t.dataset.score) return;
      if (t.value.trim() === '') {
        const a = findAssignment(t.dataset.score);
        if (a && a.score !== null && !a.pending) t.value = fmtPts(a.score);
      } else {
        const v = Object.prototype.hasOwnProperty.call(S.overrides, t.dataset.score) ? S.overrides[t.dataset.score] : null;
        if (v !== null) t.value = fmtPts(v);
      }
    });

    // Exports exactly what the panel shows, including what-ifs, drops and custom weights.
    function exportCsv() {
      const m = S.model;
      const r = GC.compute(m, opts());
      const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
      const pct = (s, p) => (s !== null && s !== undefined && p > 0 ? (s / p) * 100 : '');
      const rows = [['Type', 'Category', 'Assignment', 'Score', 'Points', 'Percent', 'Letter', 'Weight %', 'Status', 'Due']];

      for (const g of r.groups) {
        const mg = m.groups.find((x) => x.id === g.id);
        const all = mg.assignments.concat(S.extras.filter((x) => x.groupId === g.id).map((x) => ({ ...x, extra: true })));
        for (const a of all) {
          const whatIf = own(S.overrides, a.id) || (a.extra && a.score !== null);
          let score = own(S.overrides, a.id) ? S.overrides[a.id] : a.extra ? a.score : a.score !== null && !a.pending ? a.score : null;
          const assumed = score === null && S.prefs.missingAsZero && a.missing && !a.excused;
          if (assumed) score = 0;
          const status = [
            a.omit && 'Not counted', a.excused && 'Excused', a.missing && 'Missing', a.late && 'Late',
            a.pending && 'Pending', g.dropped.has(a.id) && 'Dropped', whatIf && 'What-if', assumed && 'Counted as 0',
          ].filter(Boolean).join('; ');
          rows.push(['Assignment', g.name, a.name, score === null ? '' : score, a.points === null ? '' : a.points,
            pct(score, a.points), '', '', status, a.dueAt ? a.dueAt.slice(0, 10) : '']);
        }
        rows.push(['Category', g.name, '', g.possible > 0 ? g.score : '', g.possible > 0 ? g.possible : '',
          g.pct === null ? '' : g.pct, GC.letterFor(g.pct) || '', r.weighted ? g.weight : '',
          g.dropped.size ? `${g.dropped.size} dropped` : '', '']);
      }

      const notes = [
        Object.keys(S.overrides).length + S.extras.length ? 'What-if' : '',
        S.settings.custom ? 'Custom weights' : '',
        Object.keys(S.settings.drops || {}).length ? 'Custom drops' : '',
        S.prefs.missingAsZero ? 'Missing = 0' : '',
      ].filter(Boolean).join('; ');
      rows.push(['Total', '', m.name, r.weighted ? '' : r.totalScore, r.weighted ? '' : r.totalPossible,
        r.pct === null ? '' : r.pct, r.letter || '', r.weighted ? 'Weighted' : 'Points', notes, '']);

      GLCsv.download(GLCsv.fileName(m.name), rows);
    }

    function findAssignment(id) {
      for (const g of S.model.groups) for (const a of g.assignments) if (a.id === id) return a;
      return null;
    }

    load();
  }

  // ---------------------------------------------------------------- dashboard badges

  async function mountDashboardBadges() {
    let data = null;

    const style = document.createElement('style');
    style.textContent = globalThis.GL_BADGE_STYLES;
    document.head.appendChild(style);

    async function ensureData() {
      if (data) return data;
      const raw = await CanvasAPI.loadAll(origin);
      const prefs = await GLStore.prefs();
      data = {};
      await Promise.all(raw.map(async ({ course, groups }) => {
        const settings = await GLStore.courseSettings(origin, course.id);
        const model = GC.buildModel(course, groups);
        data[String(course.id)] = GC.compute(model, { missingAsZero: prefs.missingAsZero, ...GLStore.computeOpts(settings) });
      }));
      return data;
    }

    async function paint() {
      const cards = document.querySelectorAll('.ic-DashboardCard');
      if (!cards.length) return;
      const d = await ensureData().catch(() => null);
      if (!d) return;
      for (const card of cards) {
        if (card.querySelector('.gl-badge')) continue;
        const link = card.querySelector('a[href*="/courses/"]');
        const m = link && link.getAttribute('href').match(/\/courses\/(\d+)/);
        if (!m || !d[m[1]] || d[m[1]].pct === null) continue;
        const r = d[m[1]];
        const header = card.querySelector('.ic-DashboardCard__header') || card;
        if (getComputedStyle(header).position === 'static') header.style.position = 'relative';
        const a = document.createElement('a');
        a.className = 'gl-badge';
        a.href = `/courses/${m[1]}/grades`;
        a.title = 'Grades';
        a.setAttribute('aria-label', `Grade ${r.letter || ''} ${fmtPct(r.pct)}%`);
        a.dataset.band = GC.band(r.letter);
        a.innerHTML = `<i>${esc(r.letter || '—')}</i>${fmtPct(r.pct)}%`;
        a.addEventListener('click', (e) => e.stopPropagation());
        header.appendChild(a);
      }
    }

    let t = null;
    const obs = new MutationObserver(() => {
      clearTimeout(t);
      t = setTimeout(paint, 250);
    });
    obs.observe(document.body, { childList: true, subtree: true });
    paint();
    setTimeout(() => obs.disconnect(), 30000);
  }
})();
