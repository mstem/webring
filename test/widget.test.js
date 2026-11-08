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
  const bar = {
    id: 'webring-widget',
    innerHTML: '',
    classList: { toggle() {} },
    querySelector: () => ({ addEventListener() {} }),
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
  return { bar, fetches, styles: appended.filter((n) => n.tag === 'style') };
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
