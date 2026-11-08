import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const SOURCE = readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8');

// Runs widget.js against a minimal fake DOM and returns the bar element once
// the ring has loaded.
async function renderWidget(ring, { loads = 1, oldBrowser = false } = {}) {
  const appended = [];
  let fetches = 0;
  // Each render builds a new button, as innerHTML does in a browser.
  const buttons = [];
  let builtFor = null;
  const makeButton = () => ({
    listeners: [], focused: 0, focusVisible: false,
    addEventListener(_, fn) { this.listeners.push(fn); },
    focus() { this.focused++; },
    matches(sel) {
      if (oldBrowser) throw new SyntaxError(`unknown selector ${sel}`);
      return sel === ':focus-visible' && this.focusVisible;
    },
  });
  const bar = {
    id: 'webring-widget',
    innerHTML: '',
    classList: { toggle() {} },
    style: { props: {}, sets: 0, setProperty(k, v) { this.sets++; this.props[k] = v; }, getPropertyValue(k) { return this.props[k] || ''; } },
    querySelector(sel) {
      if (sel !== '.wring-mode') return null;
      if (builtFor !== this.innerHTML) { buttons.push(makeButton()); builtFor = this.innerHTML; }
      return buttons.at(-1);
    },
  };
  const document = {
    currentScript: { src: 'https://ring.example/widget.js' },
    head: { appendChild: (n) => appended.push(n) },
    body: { appendChild() {} },
    getElementById: (id) => (id === 'webring-widget' ? bar : appended.find((n) => n.id === id) || null),
    querySelector: () => null,
    createElement: (tag) => ({ tag }),
  };
  const window = { location: { origin: 'https://member.example' } };
  const fetch = async () => { fetches++; return { json: async () => ring }; };
  for (let i = 0; i < loads; i++) runInNewContext(SOURCE, { document, window, fetch, URL, encodeURIComponent });
  await new Promise((r) => setTimeout(r, 0));
  return { bar, buttons, document, setColors: () => bar.style.sets, fetches, appended, styles: appended.filter((n) => n.tag === 'style') };
}

test('the factory name is escaped, never parsed as markup', async () => {
  const { bar } = await renderWidget({
    factory: 'good',
    factories: { good: { name: 'R&D <img src=x onerror=alert(1)>' } },
  });
  assert.ok(!bar.innerHTML.includes('<img'), bar.innerHTML);
  assert.ok(bar.innerHTML.includes('R&#38;D &#60;img'));
});

test('loading the script twice adds its styles once and still renders', async () => {
  const { styles, bar } = await renderWidget({ factory: 'bad' }, { loads: 2 });
  assert.equal(styles.length, 1);
  assert.ok(bar.innerHTML.includes('wring-mode'));
});

test('a later run, as after a client-side navigation, renders the bar again', async () => {
  const { bar, fetches } = await renderWidget({ factory: 'good' }, { loads: 2 });
  assert.equal(fetches, 2);
  assert.ok(bar.innerHTML.includes('wring-next'));
});

test('the mode button switches the arrows to the other factory', async () => {
  const { bar, buttons } = await renderWidget({ factory: 'good' });
  assert.ok(bar.innerHTML.includes('factory=good'));
  buttons.at(-1).listeners[0]();
  assert.ok(bar.innerHTML.includes('factory=bad'));
  assert.ok(bar.innerHTML.includes('Light mode'));
});

test('the bar loads its font from the ring, never from a font CDN', async () => {
  const { appended, styles } = await renderWidget({ factory: 'good' });
  assert.equal(appended.length, 1);
  assert.ok(styles[0].textContent.includes('https://ring.example/fonts/overpass-latin.woff2?v=1'));
  assert.ok(!/googleapis|gstatic/.test(styles[0].textContent));
});

test('toggling moves keyboard focus to the rebuilt button, and leaves mouse clicks alone', async () => {
  const { buttons } = await renderWidget({ factory: 'good' });
  buttons.at(-1).listeners[0]();
  assert.equal(buttons.at(-1).focused, 0);
  const kb = buttons.at(-1);
  kb.focusVisible = true;
  kb.listeners[0]();
  assert.notEqual(buttons.at(-1), kb);
  assert.equal(buttons.at(-1).focused, 1);
  assert.equal(kb.focused, 0);
});

test('the toggle still works where :focus-visible is unsupported', async () => {
  const { bar, buttons } = await renderWidget({ factory: 'good' }, { oldBrowser: true });
  buttons.at(-1).listeners[0]();
  assert.ok(bar.innerHTML.includes('factory=bad'));
});

test('a later run keeps the bar color the first run picked', async () => {
  const seen = new Set();
  for (let i = 0; i < 20; i++) {
    const { bar } = await renderWidget({ factory: 'bad' }, { loads: 1 });
    seen.add(bar.style.props['--wring-bad-random']);
  }
  assert.ok(seen.size > 1, 'first runs pick different colors');
  const { bar, setColors } = await renderWidget({ factory: 'bad' }, { loads: 3 });
  assert.match(bar.style.props['--wring-bad-random'], /^#[0-9a-f]{6}$/);
  assert.equal(setColors(), 1);
});
