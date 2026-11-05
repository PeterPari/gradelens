/*
 * GradeLens: move Canvas's hard-coded brand colors to the chosen accent.
 *
 * Newer Canvas screens (dashboard, buttons, links built with InstUI) put colors
 * straight into generated <style> rules instead of the --ic-* variables that
 * accents.js overrides. This scans the page's own style sheets for brand-red
 * shades and writes matching !important rules in the accent color. Cross-origin
 * sheets can't be read, but those use the variables already.
 */
(function (root) {
  'use strict';

  const { GLAccent } = root;
  const COLOR_RE = /rgba?\(\s*(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)[\s,]+(\d+(?:\.\d+)?)(?:\s*[,/]\s*([\d.]+%?))?\s*\)|#([0-9a-f]{6}|[0-9a-f]{3})\b/gi;

  let fams = [];
  let dark = false;
  let out = null; // our <style>
  let seen = new WeakMap(); // sheet -> rules already scanned
  let rulesText = [];
  let observer = null;
  let timer = null;

  function toRgb(m) {
    if (m[5]) {
      const h = m[5].length === 3 ? m[5].replace(/./g, (x) => x + x) : m[5];
      return { rgb: [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255), alpha: null };
    }
    return { rgb: [m[1], m[2], m[3]].map((v) => Number(v) / 255), alpha: m[4] || null };
  }

  function recolorValue(value) {
    let changed = false;
    const next = value.replace(COLOR_RE, (...m) => {
      const { rgb, alpha } = toRgb(m);
      const mapped = GLAccent.remap(rgb, fams, dark);
      if (!mapped) return m[0];
      changed = true;
      const [r, g, b] = mapped.map((v) => Math.round(v * 255));
      return alpha === null ? `rgb(${r}, ${g}, ${b})` : `rgba(${r}, ${g}, ${b}, ${alpha})`;
    });
    return changed ? next : null;
  }

  function scanRules(rules, wrap) {
    for (const rule of rules) {
      if (rule.cssRules && rule.conditionText !== undefined) {
        // @media / @supports: keep the condition around our copies.
        const kind = rule.constructor.name === 'CSSSupportsRule' ? '@supports' : '@media';
        scanRules(rule.cssRules, (body) => wrap(`${kind} ${rule.conditionText} { ${body} }`));
        continue;
      }
      if (!rule.selectorText || !rule.style) continue;
      const text = rule.style.cssText;
      if (!/rgb|#/i.test(text)) continue;
      const decls = [];
      for (const prop of rule.style) {
        if (prop.startsWith('--')) continue;
        const v = recolorValue(rule.style.getPropertyValue(prop));
        if (v) decls.push(`${prop}: ${v} !important`);
      }
      if (decls.length) rulesText.push(wrap(`${rule.selectorText} { ${decls.join('; ')} }`));
    }
  }

  function scan(full) {
    if (!fams.length) return;
    let grew = false;
    for (const sheet of document.styleSheets) {
      const owner = sheet.ownerNode;
      if (owner && owner.id && owner.id.startsWith('gradelens')) continue;
      let rules;
      try {
        rules = sheet.cssRules;
      } catch (e) {
        continue; // cross-origin
      }
      const done = full ? 0 : seen.get(sheet) || 0;
      if (rules.length < done) return rebuild(); // rules were removed: start over
      if (rules.length === done) continue;
      scanRules(Array.prototype.slice.call(rules, done), (x) => x);
      seen.set(sheet, rules.length);
      grew = true;
    }
    if (grew || full) write();
  }

  function write() {
    if (!out) {
      out = document.createElement('style');
      out.id = 'gradelens-recolor';
    }
    out.textContent = rulesText.join('\n');
    // Last in the document so equal-!important rules lose to ours.
    if (out.parentNode !== document.documentElement || out.nextSibling) document.documentElement.appendChild(out);
  }

  function rebuild() {
    seen = new WeakMap();
    rulesText = [];
    scan(true);
  }

  function watch() {
    if (observer) return;
    // Canvas adds rules as components mount, which always comes with DOM changes.
    observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(() => scan(false), 250);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  // Canvas's own brand colors, read with our variable overrides switched off.
  function originals() {
    const html = document.documentElement;
    const had = html.classList.contains('gl-accent');
    html.classList.remove('gl-accent');
    const cs = getComputedStyle(html);
    const brand = cs.getPropertyValue('--ic-brand-primary').trim();
    const link = cs.getPropertyValue('--ic-link-color').trim();
    if (had) html.classList.add('gl-accent');
    return { brand, link };
  }

  function update(accentId, isDark) {
    const run = () => {
      const orig = originals();
      if (!orig.brand) return setTimeout(run, 300); // Canvas CSS not loaded yet
      fams = GLAccent.families(orig, accentId, isDark);
      dark = isDark;
      if (!fams.length) {
        rulesText = [];
        if (out) out.textContent = '';
        return;
      }
      rebuild();
      watch();
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', run, { once: true });
    else run();
  }

  root.GLRecolor = { update };
})(typeof globalThis !== 'undefined' ? globalThis : this);
