/* Web Ring Widget — embed with: <script src="https://your-ring.example.com/widget.js"></script> */
(function () {
  const script = document.currentScript;
  if (!script) return; // must not be deferred/async

  const RING_URL = new URL(script.src).origin;
  const FROM = encodeURIComponent(window.location.origin);

  // Allow embedding into a specific container: <div id="webring-widget"></div>
  // Falls back to a fixed footer bar.
  const TARGET_ID = 'webring-widget';

  const CSS = `
    #webring-widget {
      font-family: system-ui, -apple-system, sans-serif;
      font-size: 0.72rem;
      letter-spacing: 0.01em;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 0.55rem;
      padding: 0.45rem 1rem;
      background: rgba(255, 255, 255, 0.9);
      backdrop-filter: blur(6px);
      -webkit-backdrop-filter: blur(6px);
      border-top: 1px solid rgba(15, 23, 42, 0.08);
      color: rgba(15, 23, 42, 0.6);
    }
    #webring-widget.wring-fixed {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      z-index: 9999;
    }
    #webring-widget a {
      color: #6366f1;
      text-decoration: none;
      transition: color 0.15s;
    }
    #webring-widget a:hover { color: #0f172a; }
    #webring-widget .wring-name { color: rgba(15, 23, 42, 0.8); }
    #webring-widget .wring-sep { opacity: 0.3; user-select: none; }
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
  `;

  function inject(ring) {
    // Add stylesheet
    const style = document.createElement('style');
    style.textContent = CSS;
    document.head.appendChild(style);

    // Determine mount point
    let el = document.getElementById(TARGET_ID);
    const fixed = !el;
    if (!el) {
      el = document.createElement('div');
      el.id = TARGET_ID;
      document.body.appendChild(el);
    }
    if (fixed) el.classList.add('wring-fixed');

    // The server says which factory this site belongs to; the bar wears its colours.
    const factory = ring.factory === 'bad' ? 'bad' : 'good';
    if (factory === 'bad') el.classList.add('wring-bad');
    const label = ring.factories?.[factory]?.name || ring.name;

    el.innerHTML =
      `<a href="${RING_URL}/prev?from=${FROM}" title="Previous site">←</a>` +
      `<span class="wring-sep">|</span>` +
      `<a class="wring-name" href="${RING_URL}/?factory=${factory}" title="Browse the ring">${label}</a>` +
      `<span class="wring-sep">|</span>` +
      `<a href="${RING_URL}/next?from=${FROM}" title="Next site">→</a>` +
      `<span class="wring-sep">·</span>` +
      `<a href="${RING_URL}/random?from=${FROM}" title="Random site">?</a>`;
  }

  fetch(`${RING_URL}/api/ring?from=${FROM}`)
    .then(r => r.json())
    .then(inject)
    .catch(() => {
      // Fail silently — don't break member sites
    });
})();
