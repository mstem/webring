import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const SOURCE = readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8');

// A stand-in for one element the bar looks up: it records what the widget
// sets on it. Setting the bar's innerHTML builds a fresh set, as a browser does.
function makeNode() {
  return {
    href: '',
    textContent: '',
    listeners: [],
    addEventListener(_, fn) { this.listeners.push(fn); },
    click() { this.listeners.forEach((fn) => fn()); },
  };
}

// Runs widget.js against a minimal fake DOM and returns the bar once the ring
// has loaded.
async function renderWidget(ring, { loads = 1 } = {}) {
  const appended = [];
  let fetches = 0;
  let nodes = {};
  let html = '';
  const classes = new Set();
  const bar = {
    id: 'webring-widget',
    get innerHTML() { return html; },
    set innerHTML(v) {
      html = v;
      nodes = {};
      for (const cls of ['wring-prev', 'wring-next', 'wring-title', 'wring-face', 'wring-mode']) {
        if (v.includes(`class="${cls}"`)) nodes[`.${cls}`] = makeNode();
      }
    },
    classList: { toggle(c, on) { if (on) classes.add(c); else classes.delete(c); } },
    style: {
      props: {},
      sets: 0,
      setProperty(k, v) { this.sets++; this.props[k] = v; },
      getPropertyValue(k) { return this.props[k] || ''; },
    },
    querySelector: (sel) => nodes[sel] || null,
  };
  const document = {
    currentScript: { src: 'https://ring.example/widget.js' },
    head: { appendChild: (n) => appended.push(n) },
    body: { appendChild() {} },
    getElementById: (id) => (id === 'webring-widget' ? bar : appended.find((n) => n.id === id) || null),
    createElement: (tag) => ({ tag }),
  };
  const window = { location: { origin: 'https://member.example' } };
  const fetch = async () => { fetches++; return { json: async () => ring }; };
  for (let i = 0; i < loads; i++) runInNewContext(SOURCE, { document, window, fetch, URL, encodeURIComponent });
  await new Promise((r) => setTimeout(r, 0));
  return {
    bar,
    node: (sel) => nodes[sel],
    isBad: () => classes.has('wring-bad'),
    fetches,
    appended,
    styles: appended.filter((n) => n.tag === 'style'),
  };
}

test('the factory name goes in as text, never as markup', async () => {
  const name = 'R&D <img src=x onerror=alert(1)>';
  const { bar, node } = await renderWidget({ factory: 'good', factories: { good: { name } } });
  assert.equal(node('.wring-title').textContent, name);
  assert.ok(!bar.innerHTML.includes('<img'));
});

test('loading the script twice adds its styles once and still renders', async () => {
  const { styles, node } = await renderWidget({ factory: 'bad' }, { loads: 2 });
  assert.equal(styles.length, 1);
  assert.equal(node('.wring-mode').textContent, 'Light mode');
});

test('a later run, as after a client-side navigation, renders the bar again', async () => {
  const { node, fetches } = await renderWidget({ factory: 'good' }, { loads: 2 });
  assert.equal(fetches, 2);
  assert.match(node('.wring-next').href, /factory=good/);
});

test('the mode button switches the arrows and the look to the other factory', async () => {
  const { node, isBad } = await renderWidget({ factory: 'good' });
  const mode = node('.wring-mode');
  assert.equal(isBad(), false);
  assert.match(node('.wring-prev').href, /factory=good/);
  mode.click();
  assert.equal(isBad(), true);
  assert.match(node('.wring-prev').href, /factory=bad/);
  assert.match(node('.wring-next').href, /factory=bad/);
  assert.equal(mode.textContent, 'Light mode');
  assert.equal(node('.wring-face').textContent, '😈');
  mode.click();
  assert.equal(isBad(), false);
  assert.equal(mode.textContent, 'Dark mode');
});

test('a toggle updates the bar in place, so the focused button survives', async () => {
  const { node } = await renderWidget({ factory: 'good' });
  const mode = node('.wring-mode');
  mode.click();
  assert.equal(node('.wring-mode'), mode);
});

test('the bar loads its font from the ring, never from a font CDN', async () => {
  const { appended, styles } = await renderWidget({ factory: 'good' });
  assert.equal(appended.length, 1);
  assert.ok(styles[0].textContent.includes('https://ring.example/fonts/overpass-latin.woff2?v=1'));
  assert.ok(!/googleapis|gstatic/.test(styles[0].textContent));
});

test('a good bar sets no color; a bad bar keeps one color across toggles and runs', async () => {
  const good = await renderWidget({ factory: 'good' });
  assert.equal(good.bar.style.sets, 0);

  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const { bar } = await renderWidget({ factory: 'bad' });
    seen.add(bar.style.props['--wring-bad-random']);
  }
  assert.ok(seen.size > 1, 'first runs pick different colors');

  const bad = await renderWidget({ factory: 'bad' }, { loads: 3 });
  bad.node('.wring-mode').click();
  bad.node('.wring-mode').click();
  assert.match(bad.bar.style.props['--wring-bad-random'], /^#[0-9a-f]{6}$/);
  assert.equal(bad.bar.style.sets, 1);
});
