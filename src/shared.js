/* GradeLens shared helpers: Canvas API access + chrome.storage wrappers. */
(function (root) {
  'use strict';

  async function getJSON(url) {
    const res = await fetch(url, {
      credentials: 'include',
      headers: { Accept: 'application/json' },
    });
    if (!res.ok) {
      const err = new Error(`Canvas returned ${res.status}`);
      err.status = res.status;
      throw err;
    }
    const text = await res.text();
    try {
      return { data: JSON.parse(text.replace(/^while\(1\);/, '')), link: res.headers.get('Link') };
    } catch (e) {
      const err = new Error('Canvas did not return JSON (signed out?)');
      err.status = 401;
      throw err;
    }
  }

  // Follows Canvas's Link: <...>; rel="next" pagination.
  async function getAll(url) {
    const out = [];
    let next = url;
    let guard = 0;
    while (next && guard++ < 20) {
      const { data, link } = await getJSON(next);
      if (Array.isArray(data)) out.push(...data);
      else return data;
      const m = link && link.match(/<([^>]+)>;\s*rel="next"/);
      next = m ? m[1] : null;
    }
    return out;
  }

  // Non-academic courses: no grade shown anywhere (popup, badges, panel, CSV).
  const HIDDEN_COURSES = /green\s*team|college\s*prep/i;

  const CanvasAPI = {
    isHidden: (course) => !!(course && HIDDEN_COURSES.test(`${course.name || ''} ${course.course_code || ''}`)),

    async loadCourse(origin, courseId) {
      const [{ data: course }, groups] = await Promise.all([
        getJSON(`${origin}/api/v1/courses/${courseId}?include[]=total_scores`),
        getAll(`${origin}/api/v1/courses/${courseId}/assignment_groups?include[]=assignments&include[]=submission&per_page=100`),
      ]);
      return { course, groups };
    },

    async loadAll(origin) {
      const courses = await getAll(
        `${origin}/api/v1/courses?enrollment_state=active&enrollment_type=student&include[]=total_scores&include[]=favorites&per_page=100`
      );
      const list = courses.filter((c) => c && c.name && !c.access_restricted_by_date && !CanvasAPI.isHidden(c));
      const results = await Promise.all(
        list.map(async (course) => {
          try {
            const groups = await getAll(
              `${origin}/api/v1/courses/${course.id}/assignment_groups?include[]=assignments&include[]=submission&per_page=100`
            );
            return { course, groups };
          } catch (e) {
            return { course, groups: [], error: String(e.message || e) };
          }
        })
      );
      return results;
    },
  };

  const hasChrome = typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local;

  const GLStore = {
    async get(key, fallback) {
      if (!hasChrome) return fallback;
      try {
        const r = await chrome.storage.local.get(key);
        return r[key] === undefined ? fallback : r[key];
      } catch (e) {
        return fallback;
      }
    },
    async set(key, value) {
      if (!hasChrome) return;
      try {
        await chrome.storage.local.set({ [key]: value });
      } catch (e) {
        /* storage unavailable — keep going in memory */
      }
    },
    courseKey: (origin, id) => `gl:course:${origin}:${id}`,
    async prefs() {
      return { missingAsZero: false, goal: null, minimized: false, ...(await GLStore.get('gl:prefs', {})) };
    },
    async savePrefs(patch) {
      const cur = await GLStore.prefs();
      await GLStore.set('gl:prefs', { ...cur, ...patch });
    },
    // {custom: bool, weights: {groupId: number}, drops: {groupId: number}}
    async courseSettings(origin, id) {
      return { custom: false, weights: {}, drops: {}, ...(await GLStore.get(GLStore.courseKey(origin, id), {})) };
    },
    async saveCourseSettings(origin, id, value) {
      await GLStore.set(GLStore.courseKey(origin, id), value);
    },
    // Turn saved course settings into GradeCore.compute options.
    computeOpts(settings) {
      const o = {};
      if (!settings) return o;
      if (settings.drops && Object.keys(settings.drops).length) o.drops = settings.drops;
      if (settings.custom) {
        o.weighted = true;
        o.weights = settings.weights || {};
      }
      return o;
    },
  };

  const GLCsv = {
    // Quote every cell; prefix formula-looking text so spreadsheets don't run it.
    cell(v) {
      if (v === null || v === undefined) return '""';
      let s = typeof v === 'number' ? String(Math.round(v * 100) / 100) : String(v);
      if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    },
    build(rows) {
      return rows.map((r) => r.map(GLCsv.cell).join(',')).join('\r\n');
    },
    download(name, rows) {
      // BOM so Excel reads accented names (French course) correctly.
      const blob = new Blob(['\ufeff', GLCsv.build(rows)], { type: 'text/csv;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = name;
      a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    },
    fileName(base) {
      const day = new Date().toISOString().slice(0, 10);
      const safe = String(base).replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim().slice(0, 80);
      return `${safe} grades ${day}.csv`;
    },
  };

  root.CanvasAPI = CanvasAPI;
  root.GLCsv = GLCsv;
  root.GLStore = GLStore;
})(typeof globalThis !== 'undefined' ? globalThis : this);
