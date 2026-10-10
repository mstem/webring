import { test } from 'node:test';
import assert from 'node:assert/strict';
import { secretMatches, rateLimiter, isPrivateAddress, resolvesPublic } from '../src/guard.js';

test('secrets match only exactly, and never against an empty secret', () => {
  assert.equal(secretMatches('hunter2', 'hunter2'), true);
  assert.equal(secretMatches('hunter', 'hunter2'), false);
  assert.equal(secretMatches(undefined, 'hunter2'), false);
  assert.equal(secretMatches('', ''), false);
});

test('the limiter blocks past its allowance and forgets after the window', () => {
  let t = 0;
  const lim = rateLimiter({ max: 2, windowMs: 1000, now: () => t });
  assert.equal(lim.hit('a'), false);
  assert.equal(lim.hit('a'), false);
  assert.equal(lim.blocked('a'), true);
  assert.equal(lim.hit('a'), true);
  assert.equal(lim.blocked('b'), false);
  t = 5000;
  assert.equal(lim.blocked('a'), false);
});

test('private, loopback and link-local addresses are refused', () => {
  for (const ip of ['127.0.0.1', '10.1.2.3', '172.16.0.1', '192.168.1.1', '169.254.169.254',
    '100.64.0.1', '0.0.0.0', '::1', 'fd00::1', 'fe80::1', '::ffff:127.0.0.1', 'not-an-ip']) {
    assert.equal(isPrivateAddress(ip), true, ip);
  }
  for (const ip of ['91.98.23.69', '104.21.73.131', '2606:4700::6810:1', '172.32.0.1']) {
    assert.equal(isPrivateAddress(ip), false, ip);
  }
});

test('a hostname passes only when every address it resolves to is public', async () => {
  const fake = (map) => async (h) => map[h] || Promise.reject(new Error('ENOTFOUND'));
  const resolve = fake({
    'ok.example': [{ address: '104.21.73.131' }],
    'lvh.me': [{ address: '127.0.0.1' }],
    'mixed.example': [{ address: '104.21.73.131' }, { address: '10.0.0.1' }],
  });
  assert.equal(await resolvesPublic('ok.example', resolve), true);
  assert.equal(await resolvesPublic('lvh.me', resolve), false);
  assert.equal(await resolvesPublic('mixed.example', resolve), false);
  assert.equal(await resolvesPublic('missing.example', resolve), false);
});
