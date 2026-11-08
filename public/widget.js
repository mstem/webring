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
  // palette. Only its colors that keep white text at 4.5:1 or better are here.
  const BIF_COLORS = [
    '#940700', '#941400', '#942a00', '#944900', '#947200', '#003994',
    '#110094', '#520094', '#8a0094', '#94006e', '#940049',
  ];
  const BIF_COLOR = BIF_COLORS[Math.floor(Math.random() * BIF_COLORS.length)];
  const FONT_URL = 'https://fonts.googleapis.com/css2?family=Overpass:wght@400;800&display=swap';

  const CSS = `
    #webring-widget {
      --wring-ink: #1d1c1a;
      font-family: 'Overpass', 'Helvetica Neue', Helvetica, Arial, sans-serif;
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
    #webring-widget a {
      color: inherit;
      font-weight: 800;
      text-decoration: none;
      transition: opacity 0.15s;
    }
    #webring-widget a:hover { opacity: 0.6; }
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
    #webring-widget .wring-mode:hover { background: var(--wring-ink); color: #fff; }
    @media (max-width: 480px) {
      #webring-widget { grid-template-columns: 1fr; justify-items: center; }
      #webring-widget .wring-nav, #webring-widget .wring-mode { grid-column: 1; justify-self: center; }
    }
    /* :where() keeps the dark rules at the same weight as the defaults above,
       so a member site that restyles the bar still wins. */
    #webring-widget:where(.wring-bad) {
      background: ${BIF_COLOR};
      border-top-color: #fff;
      color: #fff;
    }
    #webring-widget:where(.wring-bad) .wring-mode:hover { background: #fff; color: ${BIF_COLOR}; }
  `;

  function inject(ring) {
    // Add stylesheet
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);
    if (!document.querySelector(`link[href="${FONT_URL}"]`)) {
      const font = document.createElement('link');
      font.rel = 'stylesheet';
      font.href = FONT_URL;
      document.head.appendChild(font);
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
    function render(factory) {
      el.classList.toggle('wring-bad', factory === 'bad');
      const name = ring.factories?.[factory]?.name || ring.name;
      const face = factory === 'bad' ? '😈' : '😇';
      const q = `from=${FROM}&factory=${factory}`;
      el.innerHTML =
        `<span class="wring-nav">` +
          `<a href="${RING_URL}/prev?${q}" title="Previous site">←</a>` +
                    `<span class="wring-name"><span class="wring-title">${name}</span><span>webring<span class="wring-faces" aria-hidden="true"><span>${face}</span><span>🏭</span></span></span></span>` +
                    `<a href="${RING_URL}/next?${q}" title="Next site">→</a>` +
        `</span>` +
        `<button type="button" class="wring-mode">${factory === 'bad' ? 'Light' : 'Dark'} mode</button>`;
      el.querySelector('.wring-mode').addEventListener('click', () => render(factory === 'bad' ? 'good' : 'bad'));
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
