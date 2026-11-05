/*
 * GradeLens dark mode and accent color for Canvas. Runs at document_start in
 * every Canvas frame so pages open dark without a white flash.
 *
 * Canvas mixes its own CSS, InstUI and inline styles, so a hand-written theme
 * would leave white patches. Instead a click-through overlay re-colors
 * everything under it with an SVG filter (backdrop-filter) that flips each
 * color's lightness while keeping its hue and saturation:
 *
 *     c' = c + 1 - max(r,g,b) - min(r,g,b)
 *
 * Unlike invert + hue-rotate, this never leaves the color gamut and applying it
 * twice gives back the exact original. So media, the already-dark global nav and
 * GradeLens badges get the same flip first and come out in their real colors.
 *
 * A filter on <html> itself is avoided: it would pin every position: fixed
 * element (Canvas trays, modals, the GradeLens panel) to the page instead of
 * the screen.
 */
(function () {
  'use strict';

  const KEY = 'gl:prefs';
  const { GLAccent } = globalThis;
  const CLASS = 'gl-dark';
  const D = `html.${CLASS}`;

  // Filter primitives for the lightness flip. Channel max/min come from blending
  // grayscale copies of R, G and B with lighten/darken.
  const flip = (extra) => `
    <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 0 1 0" result="r"/>
    <feColorMatrix in="SourceGraphic" type="matrix" values="0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 0 1 0" result="g"/>
    <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 0 1 0" result="b"/>
    <feBlend in="r" in2="g" mode="lighten" result="mx1"/>
    <feBlend in="mx1" in2="b" mode="lighten" result="mx"/>
    <feBlend in="r" in2="g" mode="darken" result="mn1"/>
    <feBlend in="mn1" in2="b" mode="darken" result="mn"/>
    <feComposite in="mx" in2="mn" operator="arithmetic" k2="0.5" k3="0.5" result="l"/>
    <feComponentTransfer in="l" result="il">
      <feFuncR type="table" tableValues="1 0"/><feFuncG type="table" tableValues="1 0"/><feFuncB type="table" tableValues="1 0"/>
    </feComponentTransfer>
    <feComposite in="SourceGraphic" in2="il" operator="arithmetic" k2="1" k3="2" k4="-1" result="f"/>${extra}`;

  // The overlay also lowers contrast a little so black is #0A0A0A, not pure black.
  const lin = `type="linear" slope="${GLAccent.CONTRAST}" intercept="${(1 - GLAccent.CONTRAST) / 2}"`;
  const dim = `
    <feComponentTransfer in="f"><feFuncR ${lin}/><feFuncG ${lin}/><feFuncB ${lin}/></feComponentTransfer>`;

  const FILTERS = `
    <filter id="gl-flip" color-interpolation-filters="sRGB">${flip('')}</filter>
    <filter id="gl-flip-dim" color-interpolation-filters="sRGB" x="0" y="0" width="1" height="1">${flip(dim)}</filter>`;

  // Things that keep their own colors. Anything flipped inside another flipped
  // thing must not flip again, hence the "none" list. InstUI avatars paint the
  // picture as a class-based background-image; only those with a src have one.
  const keep = [
    'img', 'video', 'picture', 'canvas', 'iframe', 'embed', 'object',
    '[style*="background-image"]', '.ic-DashboardCard__header_image', '.ic-avatar',
    '[class*="-avatar"][src]:not(img)', '.ic-app-header', '.gl-badge',
  ];
  const nested = [
    'picture img', '.ic-avatar img', '[class*="-avatar"][src] img', '[style*="background-image"] img',
    '.ic-DashboardCard__header_image img', '.ic-app-header img', '.ic-app-header .ic-avatar',
    '.ic-app-header [style*="background-image"]', '.ic-app-header svg image',
  ];

  const css = `
${D} { background: #fff !important; }
${D}::after {
  content: ""; position: fixed; inset: 0; pointer-events: none;
  z-index: 2147482000;
  -webkit-backdrop-filter: url(#gl-flip-dim);
  backdrop-filter: url(#gl-flip-dim);
}
${keep.map((k) => `${D} ${k}`).join(',\n')} { filter: url(#gl-flip) !important; }
${nested.map((k) => `${D} ${k}`).join(',\n')} { filter: none !important; }
${D} ::selection { background: #b3d4fc; }
`;

  function ensureFilters() {
    if (document.getElementById('gradelens-filters')) return;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.id = 'gradelens-filters';
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('width', '0');
    svg.setAttribute('height', '0');
    svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
    svg.innerHTML = FILTERS;
    document.documentElement.appendChild(svg);
  }

  function styleEl(id) {
    let el = document.getElementById(id);
    if (!el) {
      el = document.createElement('style');
      el.id = id;
      (document.head || document.documentElement).appendChild(el);
    }
    return el;
  }

  // prefs.dark: Canvas dark mode. prefs.accent: accent id from GLAccent.
  function apply(prefs) {
    const dark = !!(prefs && prefs.dark);
    const accent = (prefs && prefs.accent) || GLAccent.DEFAULT;
    if (dark) {
      ensureFilters();
      const el = styleEl('gradelens-dark');
      if (el.textContent !== css) el.textContent = css;
    }
    const accentCss = GLAccent.css(accent, dark);
    if (accentCss || document.getElementById('gradelens-accent')) styleEl('gradelens-accent').textContent = accentCss;
    document.documentElement.classList.toggle(CLASS, dark);
    document.documentElement.classList.toggle('gl-accent', !!accentCss);
    globalThis.GLRecolor.update(accent, dark);
  }

  try {
    chrome.storage.local.get(KEY).then((r) => apply(r[KEY]));
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area === 'local' && changes[KEY]) apply(changes[KEY].newValue);
    });
  } catch (e) {
    /* storage unavailable: leave Canvas as is */
  }
})();
