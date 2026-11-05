/*
 * GradeLens accent colors for Canvas. Canvas reads its brand colors from --ic-* CSS variables, so overriding those
 * recolors links, primary buttons and the global nav.
 */
(function (root) {
  'use strict';

  const ACCENTS = [
    { id: 'canvas', name: 'Red', hex: '#E4002B' }, // Canvas's own brand red
    { id: 'blue', name: 'Blue', hex: '#2563EB' },
    { id: 'green', name: 'Green', hex: '#16A34A' },
    { id: 'yellow', name: 'Yellow', hex: '#EAB308' },
    { id: 'purple', name: 'Purple', hex: '#9333EA' },
    { id: 'orange', name: 'Orange', hex: '#F97316' },
  ];
  const DEFAULT = 'canvas';

  const clamp = (v) => Math.min(1, Math.max(0, v));
  const hexToRgb = (hex) => {
    const h = hex.replace('#', '');
    return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
  };
  const rgbToHex = (rgb) => `#${rgb.map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0')).join('')}`.toUpperCase();
  const mix = (hex, toward, t) => {
    const a = hexToRgb(hex);
    const b = hexToRgb(toward);
    return rgbToHex(a.map((v, i) => v + (b[i] - v) * t));
  };

  // Dark mode shows each page pixel through a lightness flip that keeps hue and
  // saturation (c + 1 - max - min, see dark.js), then a slight contrast drop.
  const CONTRAST = 0.92;
  const flipL = (c) => {
    const k = 1 - Math.max(...c) - Math.min(...c);
    return c.map((v) => clamp(v + k));
  };

  function forwardDark(rgb) {
    return flipL(rgb).map((v) => clamp((v - 0.5) * CONTRAST + 0.5));
  }

  // The color to paint so that dark mode displays `hex`. The flip is its own
  // inverse, so: undo the contrast, then flip.
  function preDark(hex) {
    return rgbToHex(flipL(hexToRgb(hex).map((v) => clamp((v - 0.5) / CONTRAST + 0.5))));
  }

  // WCAG relative luminance.
  const lum = (hex) => {
    const [r, g, b] = hexToRgb(hex).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };

  // Nudge `hex` toward black (on light pages) or white (on dark pages) until
  // link text reaches 4.5:1 contrast. Yellow on white or purple on black need it.
  function readable(hex, onDark) {
    for (let t = 0; t <= 1; t += 0.05) {
      const c = mix(hex, onDark ? '#FFFFFF' : '#000000', t);
      if (onDark ? lum(c) >= 0.19 : lum(c) <= 0.18) return c;
    }
    return onDark ? '#FFFFFF' : '#000000';
  }

  // Black or white button text, whichever reads better on `hex`.
  const textOn = (hex) => ((lum(hex) + 0.05) / 0.05 > 1.05 / (lum(hex) + 0.05) ? '#000000' : '#FFFFFF');

  function find(id) {
    return ACCENTS.find((a) => a.id === id) || ACCENTS.find((a) => a.id === DEFAULT);
  }

  // Canvas variable overrides for brand color `c`, link color `link` and
  // primary-button text color `text`.
  function brandVars(c, link, text) {
    const d = (t) => mix(c, '#000000', t);
    const l = (t) => mix(c, '#FFFFFF', t);
    return [
      `--ic-brand-primary:${c}`,
      `--ic-brand-primary-darkened-5:${d(0.05)}`,
      `--ic-brand-primary-darkened-10:${d(0.1)}`,
      `--ic-brand-primary-darkened-15:${d(0.15)}`,
      `--ic-brand-primary-lightened-5:${l(0.05)}`,
      `--ic-brand-primary-lightened-10:${l(0.1)}`,
      `--ic-brand-primary-lightened-15:${l(0.15)}`,
      `--ic-brand-button--primary-bgd:${c}`,
      `--ic-brand-button--primary-bgd-darkened-5:${d(0.05)}`,
      `--ic-brand-button--primary-bgd-darkened-15:${d(0.15)}`,
      `--ic-brand-button--primary-text:${text}`,
      `--ic-link-color:${link}`,
      `--ic-link-color-darkened-10:${mix(link, '#000000', 0.1)}`,
    ].map((v) => `${v} !important;`).join(' ');
  }

  function navVars(c) {
    return [
      `--ic-brand-global-nav-ic-icon-svg-fill:${c}`,
      `--ic-brand-global-nav-ic-icon-svg-fill--active:${c}`,
      `--ic-brand-global-nav-menu-item__text-color--active:${c}`,
    ].map((v) => `${v} !important;`).join(' ');
  }

  /**
   * CSS for accent `id`. In light mode Canvas red needs no override. In dark
   * mode the page is inverted, so page colors are pre-inverted while the global
   * nav (flipped back to its real colors) gets the plain accent.
   */
  function css(id, dark) {
    const a = find(id);
    if (!dark) {
      if (a.id === DEFAULT) return '';
      return `html.gl-accent { ${brandVars(a.hex, readable(a.hex, false), textOn(a.hex))} ${navVars(a.hex)} }`;
    }
    // Page colors are painted so the dark overlay shows the real ones.
    const page = brandVars(preDark(a.hex), preDark(readable(a.hex, true)), preDark(textOn(a.hex)));
    return `html.gl-accent.gl-dark { ${page} }
html.gl-accent.gl-dark .ic-app-header { ${brandVars(a.hex, a.hex, textOn(a.hex))} ${navVars(a.hex)} }`;
  }

  // ---- recoloring Canvas's hard-coded brand colors ----
  // Newer Canvas UI (InstUI) bakes brand colors and darker/lighter shades of
  // them into generated CSS rules instead of reading the --ic-* variables. A
  // "family" is every color with the brand's hue and saturation; its shades are
  // moved to the accent keeping their lightness offset. Error red has a
  // different hue, so "Missing" badges stay red.

  function rgbToHsl([r, g, b]) {
    const mx = Math.max(r, g, b);
    const mn = Math.min(r, g, b);
    const l = (mx + mn) / 2;
    const d = mx - mn;
    if (!d) return [0, 0, l];
    const s = d / (1 - Math.abs(2 * l - 1));
    let h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h = (h * 60 + 360) % 360;
    return [h, s, l];
  }

  function hslToRgb([h, s, l]) {
    const c = (1 - Math.abs(2 * l - 1)) * s;
    const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
    const m = l - c / 2;
    const [r, g, b] = h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
    return [r + m, g + m, b + m].map(clamp);
  }

  /**
   * orig: Canvas's own colors {brand, link} (hex). Returns [{ref, target}] or
   * [] when nothing needs to change (Canvas's own red in light mode).
   */
  function families(orig, id, dark) {
    const a = find(id);
    const own = a.id === DEFAULT;
    if (own && !dark) return [];
    const out = [];
    const add = (ref, target) => {
      if (!ref || !/^#[0-9a-f]{6}$/i.test(ref)) return;
      const [h, s] = rgbToHsl(hexToRgb(ref));
      if (s < 0.3 || out.some((f) => Math.abs(f.h - h) < 1 && Math.abs(f.s - s) < 0.02)) return;
      out.push({ h, s, l: rgbToHsl(hexToRgb(ref))[2], target: rgbToHsl(hexToRgb(target)), ref });
    };
    add(orig.brand, own ? orig.brand : a.hex);
    add(orig.link, readable(own ? orig.link : a.hex, dark));
    return out;
  }

  // New color for rgb `c` (0..1) or null if it isn't a brand shade.
  function remap(c, fams, dark) {
    const [h, s, l] = rgbToHsl(c);
    if (s < 0.3) return null;
    for (const f of fams) {
      const dh = Math.min(Math.abs(h - f.h), 360 - Math.abs(h - f.h));
      if (dh <= 2.5 && Math.abs(s - f.s) <= 0.06) {
        const out = hslToRgb([f.target[0], f.target[1], clamp(f.target[2] + (l - f.l))]);
        return dark ? hexToRgb(preDark(rgbToHex(out))) : out;
      }
    }
    return null;
  }

  root.GLAccent = { ACCENTS, DEFAULT, CONTRAST, find, css, preDark, forwardDark, readable, textOn, lum, hexToRgb, rgbToHex, rgbToHsl, hslToRgb, families, remap };
  if (typeof module !== 'undefined' && module.exports) module.exports = root.GLAccent;
})(typeof globalThis !== 'undefined' ? globalThis : this);
