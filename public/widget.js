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

  const CSS = `
    #webring-widget {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 0.72rem;
      letter-spacing: 0.01em;
      display: grid;
      grid-template-columns: 1fr auto 1fr;
      align-items: center;
      gap: 0.55rem;
      padding: 0.45rem 1rem;
      background: rgba(255, 255, 255, 0.9);
      border-top: 1px solid rgba(15, 23, 42, 0.08);
      color: rgba(15, 23, 42, 0.6);
    }
    #webring-widget .wring-nav {
      grid-column: 2;
      display: flex;
      align-items: center;
      gap: 0.55rem;
    }
    #webring-widget a {
      color: #6366f1;
      text-decoration: none;
      transition: color 0.15s;
    }
    #webring-widget a:hover { color: #0f172a; }
    #webring-widget .wring-name {
      color: rgba(15, 23, 42, 0.8);
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      line-height: 1.25;
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
    #webring-widget .wring-sep { opacity: 0.3; user-select: none; }
    #webring-widget .wring-mode {
      grid-column: 3;
      justify-self: end;
      font: inherit;
      color: inherit;
      background: none;
      border: 1px solid currentColor;
      border-radius: 4px;
      margin: 0;
      padding: 0.2rem 0.55rem;
      cursor: pointer;
      line-height: 1.3;
    }
    #webring-widget .wring-mode:hover { color: #0f172a; }
    @media (max-width: 480px) {
      #webring-widget { grid-template-columns: 1fr; justify-items: center; }
      #webring-widget .wring-nav, #webring-widget .wring-mode { grid-column: 1; justify-self: center; }
      #webring-widget .wring-mode-word { display: none; }
    }
    /* :where() keeps the dark rules at the same weight as the defaults above,
       so a member site that restyles the bar still wins. */
    #webring-widget:where(.wring-bad) {
      background: rgba(20, 20, 19, 0.9);
      border-top-color: rgba(236, 235, 230, 0.12);
      color: rgba(236, 235, 230, 0.6);
    }
    #webring-widget:where(.wring-bad) a { color: #8f92f7; }
    #webring-widget:where(.wring-bad) a:hover { color: #ecebe6; }
    #webring-widget:where(.wring-bad) .wring-name { color: rgba(236, 235, 230, 0.85); }
    #webring-widget:where(.wring-bad) .wring-mode:hover { color: #ecebe6; }
  `;

  function inject(ring) {
    // Add stylesheet
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

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
          `<span class="wring-sep">|</span>` +
          `<span class="wring-name"><span>${name}</span><span>Webring<span class="wring-faces" aria-hidden="true"><span>${face}</span><span>🏭</span></span></span></span>` +
          `<span class="wring-sep">|</span>` +
          `<a href="${RING_URL}/next?${q}" title="Next site">→</a>` +
        `</span>` +
        `<button type="button" class="wring-mode">${factory === 'bad' ? 'Light' : 'Dark'}<span class="wring-mode-word"> mode</span></button>`;
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
