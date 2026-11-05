/* GradeLens popup: every active course with its calculated grade. */
(function () {
  'use strict';

  const GC = globalThis.GradeCore;
  const { CanvasAPI, GLStore, GLIcons, GLCsv, GLAccent } = globalThis;
  const { icon } = GLIcons;
  const $ = (id) => document.getElementById(id);
  const CANVAS_RE = /^https:\/\/[^/]+\.instructure\.com$/;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmtPct = (n) => (Math.round(n * 100) / 100).toFixed(2);
  const meta = (name, value, tip) => `<span class="m" data-tip="${esc(tip)}" data-tip-pos="start" aria-label="${esc(tip)}${value === '' ? '' : `: ${esc(value)}`}">${icon(name)}${esc(value)}</span>`;

  document.head.insertAdjacentHTML('beforeend', `<style>${GLIcons.TIP_CSS}</style>`);
  $('refresh').innerHTML = icon('refresh');
  $('export').innerHTML = icon('download');

  // Canvas dark mode: dark.js in every Canvas tab watches this pref and flips live.
  function paintDark(on) {
    const b = $('dark');
    b.innerHTML = icon(on ? 'sun' : 'moon');
    b.setAttribute('aria-pressed', String(on));
    b.dataset.tip = on ? 'Light Canvas' : 'Dark Canvas';
    b.setAttribute('aria-label', b.dataset.tip);
  }
  GLStore.prefs().then((p) => paintDark(!!p.dark));
  // Accent: swatch row under the header; dark.js in Canvas tabs applies it live.
  $('accent').innerHTML = icon('palette');
  function paintAccent(id) {
    $('swatches').innerHTML = GLAccent.ACCENTS.map((a) => `
      <button class="sw" role="radio" aria-checked="${a.id === id}" aria-label="${esc(a.name)}" data-tip="${esc(a.name)}"
        data-tip-pos="below" data-accent="${esc(a.id)}" style="background:${a.hex}"></button>`).join('');
  }
  GLStore.prefs().then((p) => paintAccent(GLAccent.find(p.accent).id));
  $('accent').addEventListener('click', () => {
    const open = $('swatches').hidden;
    $('swatches').hidden = !open;
    $('accent').setAttribute('aria-expanded', String(open));
  });
  $('swatches').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-accent]');
    if (!b) return;
    paintAccent(b.dataset.accent);
    await GLStore.savePrefs({ accent: b.dataset.accent });
  });

  $('dark').addEventListener('click', async () => {
    const on = !(await GLStore.prefs()).dark;
    paintDark(on);
    await GLStore.savePrefs({ dark: on });
  });
  GLIcons.enableTouchTips(document.body);

  let origin = null;
  let shown = [];

  async function findOrigin() {
    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (tab && tab.url) {
        const o = new URL(tab.url).origin;
        if (CANVAS_RE.test(o)) return o;
      }
    } catch (e) { /* no tab access */ }
    return GLStore.get('gl:lastOrigin', null);
  }

  // Direct fetch first; if the browser withholds cookies, ask an open Canvas tab.
  async function fetchAll() {
    try {
      return await CanvasAPI.loadAll(origin);
    } catch (direct) {
      const tabs = await chrome.tabs.query({ url: `${origin}/*` });
      for (const tab of tabs) {
        try {
          const res = await chrome.tabs.sendMessage(tab.id, { type: 'gl:loadAll' });
          if (res && res.ok) return res.data;
        } catch (e) { /* tab has no content script yet */ }
      }
      throw direct;
    }
  }

  function showState(html) {
    shown = [];
    $('export').disabled = true;
    $('summary').hidden = true;
    $('list').innerHTML = `<div class="state">${html}</div>`;
  }

  async function load() {
    $('refresh').classList.add('spin');
    origin = await findOrigin();
    if (!origin) {
      $('origin').textContent = '';
      showState(`${icon('canvas')}<b>Open Canvas</b>`);
      $('refresh').classList.remove('spin');
      return;
    }
    $('origin').textContent = new URL(origin).host;

    try {
      const [raw, prefs] = await Promise.all([fetchAll(), GLStore.prefs()]);
      const rows = await Promise.all(
        raw.map(async ({ course, groups }) => {
          const model = GC.buildModel(course, groups);
          const settings = await GLStore.courseSettings(origin, course.id);
          const r = GC.compute(model, { missingAsZero: prefs.missingAsZero, ...GLStore.computeOpts(settings) });
          return { model, r, fav: !!course.is_favorite };
        })
      );
      render(rows);
    } catch (e) {
      showState(
        e.status === 401 || e.status === 403
          ? `${icon('alert')}<b>Signed out</b><a class="cta" href="${esc(origin)}" target="_blank">${icon('external')}Canvas</a>`
          : `${icon('alert')}<b>Can't reach Canvas</b>`
      );
    } finally {
      $('refresh').classList.remove('spin');
    }
  }

  function render(rows) {
    rows = rows.filter((x) => x.model.isStudent || x.r.pct !== null);
    rows.sort((a, b) => (a.r.pct === null) - (b.r.pct === null) || a.model.name.localeCompare(b.model.name));

    if (!rows.length) return showState(`<b>No courses</b>`);
    shown = rows;
    $('export').disabled = false;

    const graded = rows.filter((x) => x.r.pct !== null);
    const gpas = graded.map((x) => GC.gpaFor(x.r.letter)).filter((g) => g !== null);
    $('summary').hidden = false;
    $('avg').textContent = graded.length ? `${fmtPct(graded.reduce((t, x) => t + x.r.pct, 0) / graded.length)}%` : '—';
    $('gpa').textContent = gpas.length ? (gpas.reduce((t, g) => t + g, 0) / gpas.length).toFixed(2) : '—';

    $('list').innerHTML = rows
      .map(({ model, r }) => {
        const band = GC.band(r.letter);
        const has = r.pct !== null;
        const sub = [
          model.hideFinal ? meta('eyeOff', '', 'Hidden in Canvas') : '',
          r.weighted ? meta('scale', '', 'Weighted') : meta('sigma', '', 'Total points'),
          meta('check', r.gradedCount, 'Graded'),
        ].join('');
        return `
        <button class="row" data-id="${esc(model.id)}" aria-label="${esc(model.name)} grades">
          <div style="min-width:0">
            <div class="name">${esc(model.name)}</div>
            <div class="sub">${sub}</div>
            <div class="bar"><i style="width:${has ? Math.max(0, Math.min(100, r.pct)) : 0}%;background:var(--${band})"></i></div>
          </div>
          <div class="grade">
            ${has
              ? `<span class="pct">${fmtPct(r.pct)}%</span><span class="letter" style="color:var(--${band});background:var(--${band}-soft)">${esc(r.letter)}</span>`
              : `<span class="muted">—</span>`}
          </div>
        </button>`;
      })
      .join('');
  }

  $('list').addEventListener('click', (e) => {
    const row = e.target.closest('.row[data-id]');
    if (!row || !origin) return;
    chrome.tabs.create({ url: `${origin}/courses/${row.dataset.id}/grades` });
    window.close();
  });
  $('refresh').addEventListener('click', load);
  $('export').addEventListener('click', () => {
    if (!shown.length) return;
    const out = [['Course', 'Percent', 'Letter', 'GPA', 'Grading', 'Graded', 'Ungraded', 'Hidden in Canvas']];
    for (const { model, r } of shown) {
      out.push([model.name, r.pct === null ? '' : r.pct, r.letter || '', GC.gpaFor(r.letter) ?? '',
        r.weighted ? 'Weighted' : 'Points', r.gradedCount, r.remainingCount, model.hideFinal ? 'Yes' : 'No']);
    }
    const graded = shown.filter((x) => x.r.pct !== null);
    const gpas = graded.map((x) => GC.gpaFor(x.r.letter)).filter((g) => g !== null);
    out.push(['Average', graded.length ? graded.reduce((t, x) => t + x.r.pct, 0) / graded.length : '', '',
      gpas.length ? gpas.reduce((t, g) => t + g, 0) / gpas.length : '', '', '', '', '']);
    GLCsv.download(GLCsv.fileName(origin ? new URL(origin).host.split('.')[0] : 'Canvas'), out);
  });

  load();
})();
