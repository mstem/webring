import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const SOURCE = readFileSync(new URL('../public/widget.js', import.meta.url), 'utf8');

// Runs widget.js against a minimal fake DOM and returns the bar element once
// the ring has loaded.
async function renderWidget(ring, { loads = 1 } = {}) {
  const appended = [];
  let fetches = 0;
  const button = { listeners: [], focused: 0, addEventListener(_, fn) { this.listeners.push(fn); }, focus() { this.focused++; } };
  const bar = {
    id: 'webring-widget',
    innerHTML: '',
    classList: { toggle() {} },
    style: { setProperty() {} },
    querySelector: () => button,
  };
  const document = {
    currentScript: { src: 'https://ring.example/widget.js' },
    head: { appendChild: (n) => appended.push(n) },
    body: { appendChild() {} },
    getElementById: (id) => (id === 'webring-widget' ? bar : appended.find((n) => n.id === id) || null),
    querySelector: () => null,
    createElement: (tag) => ({ tag }),
  };
  document.activeElement = null;
  const window = { location: { origin: 'https://member.example' } };
  const fetch = async () => { fetches++; return { json: async () => ring }; };
  for (let i = 0; i < loads; i++) runInNewContext(SOURCE, { document, window, fetch, URL, encodeURIComponent });
  await new Promise((r) => setTimeout(r, 0));
  return { bar, button, document, fetches, appended, styles: appended.filter((n) => n.tag === 'style') };
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
  const { bar, button } = await renderWidget({ factory: 'good' });
  assert.ok(bar.innerHTML.includes('factory=good'));
  button.listeners.at(-1)();
  assert.ok(bar.innerHTML.includes('factory=bad'));
  assert.ok(bar.innerHTML.includes('Light mode'));
});

test('the bar loads its font from the ring, never from a font CDN', async () => {
  const { appended, styles } = await renderWidget({ factory: 'good' });
  assert.equal(appended.length, 1);
  assert.ok(styles[0].textContent.includes('https://ring.example/fonts/overpass-latin.woff2?v=1'));
  assert.ok(!/googleapis|gstatic/.test(styles[0].textContent));
});

test('toggling moves focus to the rebuilt button', async () => {
  const { button } = await renderWidget({ factory: 'good' });
  button.listeners.at(-1)();
  assert.equal(button.focused, 1);
});
