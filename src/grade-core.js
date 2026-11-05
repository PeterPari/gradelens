/*
 * GradeLens core — pure grade math, no DOM or chrome APIs.
 * Mirrors how Canvas computes a student's current grade:
 *   - only scored, non-excused, non-omitted work counts
 *   - pending_review submissions don't count yet
 *   - group drop rules (drop_lowest / drop_highest / never_drop)
 *   - weighted groups rescale when some groups have no graded work
 */
(function (root) {
  'use strict';

  // Peter's grading scale (from the Grade Scale app): [letter, minimum %, GPA].
  // A percent is rounded UP to a whole number before lookup, so gaps between
  // ranges go to the higher letter: 82.26 -> 83 -> B.
  const SCALE = [
    ['A+', 100, 4.33], ['A', 93, 4.0], ['A-', 90, 3.67],
    ['B+', 87, 3.33], ['B', 83, 3.0], ['B-', 80, 2.67],
    ['C+', 77, 2.33], ['C', 73, 2.0], ['C-', 70, 1.67],
    ['D+', 67, 1.33], ['D', 63, 1.0], ['D-', 60, 0.67],
    ['F', 0, 0],
  ];
  // [letter, fraction] pairs, highest first, for goal pickers.
  const SCHEME = SCALE.map(([n, min]) => [n, min / 100]);

  const EPS = 1e-9;

  function num(v) {
    if (v === null || v === undefined || v === '') return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  const sum = (arr, f) => arr.reduce((t, x) => t + (f ? f(x) : x), 0);
  const round2 = (n) => Math.round(n * 100) / 100;

  // ---------- model ----------

  function buildModel(course, groups) {
    const enrollment = (course.enrollments || []).find((e) => e.type === 'student') || null;

    return {
      id: String(course.id),
      name: course.name || course.course_code || 'Course',
      code: course.course_code || '',
      weighted: !!course.apply_assignment_group_weights,
      hideFinal: !!course.hide_final_grades,
      canvasScore: enrollment ? num(enrollment.computed_current_score) : null,
      isStudent: !!enrollment,
      scheme: SCHEME,
      groups: (groups || [])
        .slice()
        .sort((a, b) => (a.position || 0) - (b.position || 0))
        .map((g) => ({
          id: String(g.id),
          name: (g.name || 'Untitled').trim(),
          weight: num(g.group_weight) || 0,
          rules: g.rules || {},
          assignments: (g.assignments || [])
            .filter((a) => a.grading_type !== 'not_graded')
            .map((a) => {
              const s = a.submission || {};
              return {
                id: String(a.id),
                name: a.name || 'Untitled assignment',
                url: a.html_url || null,
                points: num(a.points_possible),
                dueAt: a.due_at || null,
                omit: !!a.omit_from_final_grade,
                gradingType: a.grading_type,
                score: num(s.score),
                excused: !!s.excused,
                missing: !!s.missing,
                late: !!s.late,
                pending: s.workflow_state === 'pending_review',
                submitted: !!s.submitted_at,
              };
            }),
        })),
    };
  }

  // ---------- scoring ----------

  function scoreOf(a, ctx) {
    if (ctx.overrides && Object.prototype.hasOwnProperty.call(ctx.overrides, a.id)) {
      const v = num(ctx.overrides[a.id]);
      if (v !== null) return { score: v, whatIf: true };
    }
    if (a.excused) return null;
    if (a.score !== null && a.score !== undefined && !a.pending) return { score: a.score };
    if (ctx.missingAsZero && a.missing && (a.points || 0) > 0) return { score: 0, assumed: true };
    return null;
  }

  // Pick k items from pool maximizing (or minimizing) the group's ratio, with
  // `fixed` items always included. Binary search on the ratio q: the best
  // k-subset satisfies sum(s - q*p) >= 0 exactly when its ratio >= q.
  function pickBest(pool, k, fixed, maximize) {
    k = Math.max(1, k);
    if (pool.length <= k) return pool.slice();
    const order = (a, b) => (maximize ? b.v - a.v : a.v - b.v);

    if (!pool.some((i) => i.p > 0)) {
      return pool
        .map((i) => ({ i, v: i.s }))
        .sort(order)
        .slice(0, k)
        .map((x) => x.i);
    }

    const fs = sum(fixed, (i) => i.s);
    const fp = sum(fixed, (i) => i.p);
    const choose = (q) => pool.map((i) => ({ i, v: i.s - q * i.p })).sort(order).slice(0, k);
    const F = (q) => sum(choose(q), (x) => x.v) + fs - q * fp;

    const minP = Math.min(...pool.filter((i) => i.p > 0).map((i) => i.p));
    let lo = 0;
    let hi = 1 + (sum(pool, (i) => Math.max(0, i.s)) + Math.max(0, fs)) / minP;
    for (let n = 0; n < 80; n++) {
      const mid = (lo + hi) / 2;
      if (F(mid) >= 0) lo = mid; else hi = mid;
    }
    return choose(lo).map((x) => x.i);
  }

  function dropItems(items, rules) {
    const lowN = Number(rules && rules.drop_lowest) || 0;
    const highN = Number(rules && rules.drop_highest) || 0;
    if ((!lowN && !highN) || items.length < 2) return items;

    const never = new Set(((rules && rules.never_drop) || []).map(String));
    const fixed = items.filter((i) => never.has(i.id));
    const pool = items.filter((i) => !never.has(i.id));
    if (!pool.length) return items;

    const dl = Math.max(0, Math.min(lowN, pool.length - 1));
    const dh = dl + highN >= pool.length ? 0 : highN;
    const keepHigh = pool.length - dl;
    const keepLow = keepHigh - dh;

    let kept = pickBest(pool, keepHigh, fixed, true);
    kept = pickBest(kept, keepLow, fixed, false);
    return kept.concat(fixed);
  }

  function computeGroup(g, ctx) {
    const items = [];
    const remaining = [];
    const extras = (ctx.extras || []).filter((x) => x.groupId === g.id);
    const all = g.assignments.concat(extras.map((x) => ({ ...x, extra: true })));

    for (const a of all) {
      if (a.omit) continue;
      const eff = scoreOf(a, ctx);
      const p = a.points || 0;
      if (eff) items.push({ id: a.id, s: eff.score, p, whatIf: !!eff.whatIf, assumed: !!eff.assumed });
      else if (!a.excused && !a.pending && p > 0) remaining.push({ id: a.id, p, extra: !!a.extra });
      else if (a.pending && p > 0) remaining.push({ id: a.id, p, pending: true });
    }

    const rules = ctx.drops && ctx.drops[g.id] !== undefined && ctx.drops[g.id] !== null
      ? { ...g.rules, drop_lowest: Number(ctx.drops[g.id]) || 0 }
      : g.rules;
    const kept = dropItems(items, rules);
    const keptIds = new Set(kept.map((i) => i.id));
    const score = sum(kept, (i) => i.s);
    const possible = sum(kept, (i) => i.p);

    return {
      id: g.id,
      name: g.name,
      weight: g.weight,
      score,
      possible,
      pct: possible > 0 ? (score / possible) * 100 : null,
      graded: items.length,
      dropped: new Set(items.filter((i) => !keptIds.has(i.id)).map((i) => i.id)),
      remaining,
      hasWork: all.some((a) => !a.omit && (a.points || 0) > 0),
    };
  }

  // Round the shown (2-decimal) percent up to a whole number, then look it up.
  function letterFor(pct) {
    if (pct === null || pct === undefined || !Number.isFinite(pct)) return null;
    const n = Math.ceil(round2(pct) - EPS);
    for (const [name, min] of SCALE) if (n >= min) return name;
    return 'F';
  }

  // Lowest percent that still earns `letter` (e.g. A -> 92.005, since 92.01 rounds up to 93).
  function cutoffFor(letter) {
    const row = SCALE.find(([n]) => n === letter);
    if (!row) return null;
    return row[1] === 0 ? 0 : row[1] - 1 + 0.005;
  }

  /**
   * opts: {
   *   overrides: {assignmentId: score}  what-if scores
   *   extras: [{id, groupId, name, points, score|null}]  hypothetical work
   *   missingAsZero: bool
   *   weighted: bool          override course's weighting
   *   weights: {groupId: %}   override group weights
   *   drops: {groupId: n}     override how many lowest scores each group drops
   * }
   */
  function compute(model, opts) {
    opts = opts || {};
    const ctx = {
      overrides: opts.overrides || {},
      extras: opts.extras || [],
      missingAsZero: !!opts.missingAsZero,
      drops: opts.drops || null,
    };
    const weighted = typeof opts.weighted === 'boolean' ? opts.weighted : model.weighted;
    const weights = opts.weights || null;

    const groups = model.groups.map((g) => {
      const r = computeGroup(g, ctx);
      if (weights && weights[g.id] !== undefined && weights[g.id] !== null) r.weight = Number(weights[g.id]) || 0;
      return r;
    });

    let pct = null;
    const totalScore = sum(groups, (g) => g.score);
    const totalPossible = sum(groups, (g) => g.possible);

    if (weighted) {
      const rel = groups.filter((g) => g.possible > 0 && g.weight > 0);
      const W = sum(rel, (g) => g.weight);
      if (W > 0) {
        const t = sum(rel, (g) => g.weight * (g.score / g.possible));
        pct = W < 100 ? (t * 100) / W : t;
      }
    } else if (totalPossible > 0) {
      pct = (totalScore / totalPossible) * 100;
    }

    return {
      pct,
      letter: letterFor(pct),
      weighted,
      groups,
      totalScore,
      totalPossible,
      gradedCount: sum(groups, (g) => g.graded),
      remainingCount: sum(groups, (g) => g.remaining.length),
    };
  }

  // ---------- projections ----------

  // Grade if every remaining item scores fraction x of its points. In weighted
  // mode, weighted groups with no work yet (e.g. "Final Exam") get a phantom
  // item so they pull the projection like they will at the end of the term.
  function project(model, opts, x) {
    const base = compute(model, opts);
    const fill = {};
    const extras = (opts.extras || []).slice();
    let phantoms = 0;
    for (const g of base.groups) {
      for (const r of g.remaining) fill[r.id] = x * r.p;
      if (base.weighted && g.weight > 0 && g.graded === 0 && g.remaining.length === 0) {
        extras.push({ id: `__phantom_${g.id}`, groupId: g.id, points: 100, score: null });
        fill[`__phantom_${g.id}`] = x * 100;
        phantoms++;
      }
    }
    const res = compute(model, { ...opts, overrides: { ...fill, ...(opts.overrides || {}) }, extras });
    return { pct: res.pct, phantoms };
  }

  function remainingSummary(model, opts) {
    const base = compute(model, opts);
    const items = [];
    const emptyGroups = [];
    for (const g of base.groups) {
      for (const r of g.remaining) items.push(r);
      if (base.weighted && g.weight > 0 && g.graded === 0 && g.remaining.length === 0) {
        emptyGroups.push({ id: g.id, name: g.name, weight: g.weight });
      }
    }
    return { items, points: sum(items, (r) => r.p), emptyGroups, base };
  }

  /**
   * What average (fraction of points) is needed on everything left to finish
   * at `targetPct`? Returns { status, needed, worst, best, ... }.
   * status: 'none' | 'locked' | 'reachable' | 'stretch' | 'impossible'
   */
  function solveTarget(model, opts, targetPct) {
    const rem = remainingSummary(model, opts);
    const info = {
      remainingCount: rem.items.length,
      remainingPoints: rem.points,
      emptyGroups: rem.emptyGroups,
      current: rem.base.pct,
    };
    if (!rem.items.length && !rem.emptyGroups.length) return { status: 'none', ...info };

    const worst = project(model, opts, 0).pct;
    const best = project(model, opts, 1).pct;
    Object.assign(info, { worst, best });
    if (worst === null || best === null) return { status: 'none', ...info };
    if (worst >= targetPct - EPS) return { status: 'locked', needed: 0, ...info };

    let lo = 0;
    let hi = 1;
    if (best < targetPct - EPS) {
      hi = 3;
      const top = project(model, opts, hi).pct;
      if (top === null || top < targetPct - EPS) return { status: 'impossible', ...info };
    }
    for (let n = 0; n < 50; n++) {
      const mid = (lo + hi) / 2;
      if (project(model, opts, mid).pct >= targetPct - EPS) hi = mid; else lo = mid;
    }
    return { status: hi <= 1 + EPS ? 'reachable' : 'stretch', needed: hi, ...info };
  }

  function band(letter) {
    if (!letter) return 'none';
    const c = letter.trim().charAt(0).toUpperCase();
    return 'ABCDF'.includes(c) ? c : 'none';
  }

  function gpaFor(letter) {
    const row = letter && SCALE.find(([n]) => n === letter);
    return row ? row[2] : null;
  }

  const api = {
    SCALE,
    SCHEME,
    cutoffFor,
    buildModel,
    compute,
    dropItems,
    letterFor,
    solveTarget,
    project,
    remainingSummary,
    band,
    gpaFor,
    round2,
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  root.GradeCore = api;
})(typeof globalThis !== 'undefined' ? globalThis : this);
