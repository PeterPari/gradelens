// Run: node gradelens/test/core.test.js
// Fixtures are real (anonymized) courses where Canvas shows its own score,
// so the calculator must land on the same number.
const assert = require('node:assert/strict');
const GC = require('../src/grade-core.js');

// a: [points, score, excused, omit, missing, pending]
function course(id, weighted, groups) {
  let n = 0;
  return GC.buildModel(
    { id, name: `C${id}`, apply_assignment_group_weights: weighted },
    groups.map((g, gi) => ({
      id: `${id}-${gi}`,
      name: `G${gi}`,
      position: gi,
      group_weight: g.w,
      rules: g.r || {},
      assignments: g.a.map(([p, s, ex, om, mi, pe]) => ({
        id: `${id}-a${n++}`,
        name: 'x',
        points_possible: p,
        grading_type: 'points',
        omit_from_final_grade: !!om,
        submission: { score: s, excused: !!ex, missing: !!mi, workflow_state: pe ? 'pending_review' : 'graded' },
      })),
    }))
  );
}

const french = course(5196, true, [
  { w: 40, a: [] },
  { w: 30, a: [[20, 19.5], [32, 28.75]] },
  { w: 15, a: [[5, 5], [5, 5], [5, 5], [5, 5], [0, null], [5, 5], [10, 10]] },
  { w: 15, a: [[25, 24]] },
]);

const pointsCourse = course(5256, false, [
  {
    w: 0,
    a: [
      [null, null], [4, 4], [null, null], [6, 6], [4, 4], [4, 4], [0, null, 1, 1], [null, null],
      [4, 4], [1, 1], [4, null, 1], [4, null], [4, null], [4, null], [10, null], [4, null],
      [0, null], [4, null], [4, null], [0, null], [15, null], [15, null], [50, null], [15, null],
      [15, null], [25, 23], [25, 0, 0, 0, 0, 1], [40, null], [40, null], [40, null],
    ],
  },
]);

const dropCourse = course(5314, true, [
  { w: 0, a: [] },
  { w: 55, a: [[100, 75], [100, 82]] },
  { w: 30, a: [[100, null], [100, 91]] },
  { w: 15, r: { drop_lowest: 1 }, a: [[100, 97], [100, 73], [100, 83], [100, 80], [100, 56], [100, null], [100, 100]] },
]);

let passed = 0;
function test(name, fn) {
  fn();
  passed++;
  console.log(`  ✓ ${name}`);
}

test('weighted course matches Canvas (95.39)', () => {
  assert.equal(GC.round2(GC.compute(french).pct), 95.39);
});

test('points course matches Canvas (95.83), pending_review excluded', () => {
  assert.equal(GC.round2(GC.compute(pointsCourse).pct), 95.83);
});

test('weighted + drop_lowest matches Canvas (83.47)', () => {
  const r = GC.compute(dropCourse);
  assert.equal(GC.round2(r.pct), 83.47);
  assert.equal(r.groups[3].dropped.size, 1);
});

test('letters use Peter\'s scale, rounding up', () => {
  assert.equal(GC.letterFor(95.39), 'A');
  assert.equal(GC.letterFor(92.01), 'A'); // rounds up to 93
  assert.equal(GC.letterFor(92.004), 'A-'); // shows as 92.00
  assert.equal(GC.letterFor(92), 'A-');
  assert.equal(GC.letterFor(82.26), 'B'); // example from the Grade Scale app
  assert.equal(GC.letterFor(83.47), 'B');
  assert.equal(GC.letterFor(99.01), 'A+');
  assert.equal(GC.letterFor(59.5), 'D-');
  assert.equal(GC.letterFor(59), 'F');
  assert.equal(GC.letterFor(null), null);
  assert.equal(GC.gpaFor('A+'), 4.33);
  assert.equal(GC.gpaFor('B-'), 2.67);
});

test('cutoffFor gives lowest percent for a letter', () => {
  assert.equal(GC.letterFor(GC.cutoffFor('A')), 'A');
  assert.equal(GC.letterFor(GC.cutoffFor('A') - 0.006), 'A-');
  assert.equal(GC.cutoffFor('F'), 0);
});

test('what-if override changes grade', () => {
  const id = dropCourse.groups[2].assignments[0].id; // ungraded 100-pt item
  const r = GC.compute(dropCourse, { overrides: { [id]: 100 } });
  // group 2 becomes 191/200
  const expected = (55 * 0.785 + 30 * 0.955 + 15 * 0.866) / 100 * 100;
  assert.ok(Math.abs(r.pct - expected) < 1e-6);
});

test('missing-as-zero only touches missing work', () => {
  const m = course(1, false, [{ w: 0, a: [[10, 10], [10, null, 0, 0, 1], [10, null]] }]);
  assert.equal(GC.compute(m).pct, 100);
  assert.equal(GC.compute(m, { missingAsZero: true }).pct, 50);
});

test('custom weights override unweighted course', () => {
  const c = course(2, false, [{ w: 0, a: [[100, 100]] }, { w: 0, a: [[10, 5]] }]);
  assert.equal(GC.round2(GC.compute(c).pct), 95.45); // 105/110
  const r = GC.compute(c, { weighted: true, weights: { '2-0': 70, '2-1': 30 } });
  assert.equal(GC.round2(r.pct), 85);
});

test('drop_highest and never_drop', () => {
  const kept = GC.dropItems(
    [{ id: 'a', s: 10, p: 10 }, { id: 'b', s: 2, p: 10 }, { id: 'c', s: 7, p: 10 }, { id: 'd', s: 1, p: 10 }],
    { drop_lowest: 1, drop_highest: 1, never_drop: ['d'] }
  ).map((i) => i.id).sort();
  // d is protected; drop lowest of the rest (b) and highest (a)
  assert.deepEqual(kept, ['c', 'd']);
});

test('drop picks best ratio, not just lowest percent', () => {
  // Dropping the 0/1 item is worse than dropping the 50/100 item for keeping the average high?
  // Keep 2 of 3: {10/10, 0/1, 50/100}. Keep 10/10 + 0/1 => 10/11 = 90.9%; keep 10/10 + 50/100 => 60/110 = 54.5%
  const kept = GC.dropItems(
    [{ id: 'a', s: 10, p: 10 }, { id: 'b', s: 0, p: 1 }, { id: 'c', s: 50, p: 100 }],
    { drop_lowest: 1 }
  ).map((i) => i.id).sort();
  assert.deepEqual(kept, ['a', 'b']);
});

test('target solver: needed average on remaining work', () => {
  const c = course(3, false, [{ w: 0, a: [[100, 80], [100, null]] }]);
  const t = GC.solveTarget(c, {}, 90);
  assert.equal(t.status, 'reachable');
  assert.ok(Math.abs(t.needed - 1.0) < 1e-6);
  const t2 = GC.solveTarget(c, {}, 85);
  assert.ok(Math.abs(t2.needed - 0.9) < 1e-6);
  assert.equal(GC.solveTarget(c, {}, 40).status, 'locked');
  assert.equal(GC.solveTarget(c, {}, 99).status, 'stretch');
});

test('target solver counts empty weighted groups (final exam)', () => {
  // French: 40% group has no work yet.
  const t = GC.solveTarget(french, {}, 90);
  assert.equal(t.emptyGroups.length, 1);
  // current graded part = 95.39 over 60% weight; need x on the other 40%: 0.6*95.39 + 0.4*x*100 = 90
  const x = (90 - 0.6 * 95.3904) / 40;
  assert.ok(Math.abs(t.needed - x) < 1e-3, `${t.needed} vs ${x}`);
});

test('extras (hypothetical assignments) count', () => {
  const c = course(4, false, [{ w: 0, a: [[100, 90]] }]);
  const gid = c.groups[0].id;
  const r = GC.compute(c, { extras: [{ id: 'x1', groupId: gid, points: 100, score: 70 }] });
  assert.equal(r.pct, 80);
});

test('drop overrides: add, change, remove', () => {
  const c = course(5, false, [{ w: 0, a: [[10, 10], [10, 4], [10, 8], [10, 6]] }]);
  const gid = c.groups[0].id;
  assert.equal(GC.compute(c).pct, 70); // 28/40, no rule
  assert.equal(GC.round2(GC.compute(c, { drops: { [gid]: 1 } }).pct), 80); // drop the 4
  assert.equal(GC.compute(c, { drops: { [gid]: 2 } }).pct, 90); // drop 4 and 6
  // Override a Canvas rule back to 0
  assert.equal(GC.round2(GC.compute(dropCourse, { drops: { [dropCourse.groups[3].id]: 0 } }).pct), 82.7); // LSA 489/600
  // Drops flow through the goal solver
  const t = GC.solveTarget(c, { drops: { [gid]: 1 } }, 75);
  assert.equal(t.status, 'none');
});

test('CSV cells are quoted and formula-safe', () => {
  require('../src/shared.js');
  const { GLCsv } = globalThis;
  assert.equal(GLCsv.build([['a', 'b"c', 'x,y'], [93.456, null, '=SUM(A1)']]),
    '"a","b""c","x,y"\r\n"93.46","","\'=SUM(A1)"');
  assert.equal(GLCsv.cell(-5), '"-5"'); // negative numbers stay numbers
  assert.match(GLCsv.fileName('English 11: Am/Lit'), /^English 11- Am-Lit grades \d{4}-\d{2}-\d{2}\.csv$/);
});

test('accents: six colors, readable, exact in dark mode', () => {
  const A = require('../src/accents.js');
  assert.deepEqual(A.ACCENTS.map((a) => a.name), ['Red', 'Blue', 'Green', 'Yellow', 'Purple', 'Orange']);
  assert.equal(A.ACCENTS[0].hex, '#E4002B'); // Canvas's own red
  const contrast = (x, y) => { const [a, b] = [A.lum(x), A.lum(y)].sort((p, q) => q - p); return (a + 0.05) / (b + 0.05); };
  for (const a of A.ACCENTS) {
    const shown = A.forwardDark(A.hexToRgb(A.preDark(a.hex)));
    A.hexToRgb(a.hex).forEach((v, i) => assert.ok(Math.abs(shown[i] - v) < 0.05, `${a.name} channel ${i}`));
    assert.ok(contrast(A.readable(a.hex, false), '#FFFFFF') >= 4.5, `${a.name} link on white`);
    assert.ok(contrast(A.readable(a.hex, true), '#0A0A0A') >= 4.5, `${a.name} link on dark`);
    assert.ok(contrast(A.textOn(a.hex), a.hex) >= 2.5, `${a.name} button text`);
  }
  assert.equal(A.textOn('#EAB308'), '#000000'); // dark text on yellow
  assert.equal(A.css('canvas', false), ''); // light mode + Canvas red = untouched
  assert.match(A.css('blue', false), /--ic-brand-primary:#2563EB/);
});

test('recolor: brand shades follow accent, error red does not', () => {
  const A = require('../src/accents.js');
  const orig = { brand: '#E4002B', link: '#B52828' };
  const f = A.families(orig, 'green', false);
  const map = (hex) => { const r = A.remap(A.hexToRgb(hex), f, false); return r && A.rgbToHex(r); };
  assert.equal(map('#E4002B'), '#16A34A'); // brand -> accent
  assert.ok(map('#B10021')); // darker button shade follows
  assert.ok(map('#B52828')); // link red follows
  assert.equal(map('#E0061F'), null); // InstUI error red stays
  assert.equal(map('#0B874B'), null); // success green untouched
  assert.equal(A.families(orig, 'canvas', false).length, 0); // nothing to do
  assert.ok(A.families(orig, 'canvas', true).length > 0); // dark mode still maps
});

console.log(`\n${passed} tests passed`);
