/* Web Ring Widget — embed with: <script src="https://your-ring.example.com/widget.js"></script> */
(function () {
  const script = document.currentScript;
  if (!script) return; // must not be deferred/async

  const RING_URL = new URL(script.src).origin;
  const FROM = encodeURIComponent(window.location.origin);

  // Allow embedding into a specific container: <div id="webring-widget"></div>
  // Otherwise the bar goes at the very end of the page, in the flow like a
  // footer, never floating over the site.
  const TARGET_ID = 'webring-widget';

  // Dressed like biffud.com, the Bad Idea Factory's own site: Overpass in heavy
  // tracked capitals, square outlined buttons and, in dark mode, a saturated
  // background drawn at random from biffud.com's
  // palette. The list keeps only its colors that hold white text above 4.5:1, with margin.
  const BIF_COLORS = [
    '#940700', '#941400', '#942a00', '#944900', '#003994',
    '#110094', '#520094', '#8a0094', '#94006e', '#940049',
  ];

  // biffud.com's own arrow icon (its IcoMoon icon font), inlined so member
  // sites need nothing extra. The left arrow is the same icon flipped in CSS.
  const ARROW = `<svg viewBox="0 0 1024 1024" width="1em" height="1em" aria-hidden="true" focusable="false"><path fill="currentColor" d="M621.254 877.254l320-320c24.994-24.992 24.994-65.516 0-90.51l-320-320c-24.994-24.992-65.516-24.992-90.51 0-24.994 24.994-24.994 65.516 0 90.51l210.746 210.746h-613.49c-35.346 0-64 28.654-64 64s28.654 64 64 64h613.49l-210.746 210.746c-12.496 12.496-18.744 28.876-18.744 45.254s6.248 32.758 18.744 45.254c24.994 24.994 65.516 24.994 90.51 0z"/></svg>`;

  // The ring serves Overpass itself (SIL OFL, see fonts/OFL.txt) under its own
  // family name, so the bar never touches the member site's fonts and sends no
  // visitor data to a font CDN. Bump ?v= whenever the font file changes.
  const CSS = `
    @font-face {
      font-family: 'webring-overpass';
      src: url('${RING_URL}/fonts/overpass-latin.woff2?v=1') format('woff2');
      font-weight: 400 800;
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
      font-display: fallback;
    }
    #webring-widget {
      --wring-ink: #1d1c1a;
      --wring-fg: var(--wring-ink);
      font-family: 'webring-overpass', 'Helvetica Neue', Helvetica, Arial, sans-serif;
      font-weight: 400;
      font-size: 0.75rem;
      line-height: 1.3;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 0.7rem;
      padding: 0.9rem 1rem;
      background: #fff;
      border-top: 2px solid var(--wring-ink);
      color: var(--wring-ink);
    }
    #webring-widget .wring-nav {
      grid-column: 2;
      display: flex;
      align-items: center;
      gap: 0.9rem;
    }
    /* Padding gives each arrow a tap target twice the size of its icon. */
    #webring-widget a {
      display: inline-block;
      padding: 0.5em;
      margin: -0.5em;
      color: inherit;
      text-decoration: none;
    }
    /* Hover nudges the arrow outward. Fading it would drop white below 4.5:1
       on the bad palette. */
    @media (prefers-reduced-motion: no-preference) {
      #webring-widget a { transition: transform 0.15s; }
      #webring-widget .wring-prev:hover { transform: translateX(-3px); }
      #webring-widget .wring-next:hover { transform: translateX(3px); }
      #webring-widget .wring-prev:focus-visible { transform: translateX(-3px); }
      #webring-widget .wring-next:focus-visible { transform: translateX(3px); }
    }
    #webring-widget a:focus-visible {
      outline: 2px solid var(--wring-fg);
      outline-offset: 2px;
    }
    #webring-widget .wring-mode:focus-visible {
      outline: 2px solid var(--wring-fg);
      outline-offset: 2px;
    }
    #webring-widget a svg { display: block; width: 1em; height: 1em; }
    #webring-widget a svg path { fill: currentColor; }
    #webring-widget .wring-prev svg { transform: scaleX(-1); }
    #webring-widget .wring-name {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
    }
    #webring-widget .wring-title {
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    /* Emoji glyphs draw wider than their box at small sizes, and member sites
       set their own fonts. A fixed slot per emoji, in the emoji font, keeps the
       halo and horns clear of the factory whatever the site's type. */
    #webring-widget .wring-faces { display: inline-flex; margin-left: 0.2em; }
    #webring-widget .wring-faces > span {
      display: inline-block;
      width: 1.5em;
      text-align: center;
      font-family: "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif;
    }
    #webring-widget .wring-mode {
      grid-column: 3;
      justify-self: end;
      font: inherit;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: inherit;
      background: none;
      border: 2px solid currentColor;
      border-radius: 0;
      margin: 0;
      padding: 0.35rem 0.7rem 0.25rem;
      cursor: pointer;
    }
    @media (hover: hover) {
      #webring-widget .wring-mode:hover { background: var(--wring-ink); color: #fff; }
      #webring-widget:where(.wring-bad) .wring-mode:hover { background: #fff; color: var(--wring-bad, var(--wring-bad-random)); }
    }
    @media (max-width: 480px) {
      #webring-widget { grid-template-columns: 1fr; justify-items: center; }
      #webring-widget .wring-nav, #webring-widget .wring-mode { grid-column: 1; justify-self: center; }
    }
    /* :where() keeps the dark rules at the same weight as the defaults above,
       so a member site that restyles the bar still wins. */
    #webring-widget:where(.wring-bad) {
      --wring-fg: #fff;
      background: var(--wring-bad, var(--wring-bad-random));
      border-top-color: #fff;
      color: #fff;
    }
  `;

  const esc = (t) => String(t).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

  function inject(ring) {
    // One stylesheet per page, however many times the script runs.
    if (!document.getElementById('webring-style')) {
      const style = document.createElement('style');
      style.id = 'webring-style';
      style.textContent = CSS;
      document.head.appendChild(style);
    }

    // Determine mount point
    let el = document.getElementById(TARGET_ID);
    if (!el) {
      el = document.createElement('div');
      el.id = TARGET_ID;
      document.body.appendChild(el);
    }

    // Light mode is the Good Idea Factory, dark mode the Bad Idea Factory. The
    // bar opens in this site's own factory; its one button offers the other
    // mode and switches which ring the arrows walk.
    // One biffud.com color per page load, kept across mode toggles. A member
    // site that sets --wring-bad on the bar picks its own color instead.
    if (!el.style.getPropertyValue('--wring-bad-random')) {
      el.style.setProperty('--wring-bad-random', BIF_COLORS[Math.floor(Math.random() * BIF_COLORS.length)]);
    }

    function render(factory) {
      el.classList.toggle('wring-bad', factory === 'bad');
      const name = ring.factories?.[factory]?.name || ring.name || '';
      const face = factory === 'bad' ? '😈' : '😇';
      const q = `from=${FROM}&factory=${factory}`;
      el.innerHTML =
        `<span class="wring-nav">` +
          `<a href="${RING_URL}/prev?${q}" class="wring-prev" title="Previous site" aria-label="Previous site">${ARROW}</a>` +
          `<span class="wring-name"><span class="wring-title">${esc(name)}</span><span>webring<span class="wring-faces" aria-hidden="true"><span>${face}</span><span>🏭</span></span></span></span>` +
          `<a href="${RING_URL}/next?${q}" class="wring-next" title="Next site" aria-label="Next site">${ARROW}</a>` +
        `</span>` +
        `<button type="button" class="wring-mode">${factory === 'bad' ? 'Light' : 'Dark'} mode</button>`;
      const mode = el.querySelector('.wring-mode');
      mode.addEventListener('click', () => {
        // Only a keyboard user's focus ring shows, so only they need it back.
        // Browsers without :focus-visible throw here; there, any focused
        // button gets focus back, which at worst refocuses after a click.
        let keyboard = document.activeElement === mode;
        try { keyboard = mode.matches(':focus-visible'); } catch (e) {}
        render(factory === 'bad' ? 'good' : 'bad');
        if (keyboard) el.querySelector('.wring-mode').focus();
      });
    }

    render(ring.factory === 'bad' ? 'bad' : 'good');
  }

  fetch(`${RING_URL}/api/ring?from=${FROM}`)
    .then(r => r.json())
    .then(inject)
    .catch(() => {
      // Fail silently — don't break member sites
    });
})();
