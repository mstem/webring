import { test } from 'node:test';
import assert from 'node:assert/strict';
import { factoryOf, parseFactory, otherFactory, factoriesOf } from '../src/factory.js';

test('a member with no factory is good', () => {
  assert.equal(factoryOf({ url: 'https://a.example' }), 'good');
  assert.equal(factoryOf({ url: 'https://a.example', factory: 'bad' }), 'bad');
  assert.equal(factoryOf({ url: 'https://a.example', factory: 'weird' }), 'good');
});

test('only good and bad parse as factories', () => {
  assert.equal(parseFactory('bad'), 'bad');
  assert.equal(parseFactory('good'), 'good');
  assert.equal(parseFactory('BAD'), null);
  assert.equal(parseFactory(undefined), null);
});

test('the toggle always points at the other factory', () => {
  assert.equal(otherFactory('good'), 'bad');
  assert.equal(otherFactory('bad'), 'good');
});

test('factory names fall back to defaults when ring.json leaves them out', () => {
  const f = factoriesOf({ factories: { bad: { name: 'Night Shift' } } });
  assert.equal(f.good.name, 'Good Idea Factory');
  assert.equal(f.bad.name, 'Night Shift');
});
