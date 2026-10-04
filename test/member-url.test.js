import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { isPublicMemberUrl, publicMembers } from '../src/member-url.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

test('accepts ordinary public hostnames', () => {
  for (const url of [
    'https://cardinal.mindshine.io',
    'https://mstem.github.io/pet-rent',
    'https://wholesome-dedication-production-4b87.up.railway.app',
    'https://emojicompass.com/',
    'https://v2.example.com',
  ]) assert.equal(isPublicMemberUrl(url), true, url);
});

test('rejects raw IPs and wildcard-DNS names that embed one', () => {
  for (const url of [
    'http://91.98.23.69',
    'https://91.98.23.69:8443/app',
    'http://k517kxh9fwmk2djcuiu1f9cp.91.98.23.69.sslip.io/',
    'http://app.91-98-23-69.sslip.io',
    'http://sslip.io',
    'http://app.10.0.0.1.nip.io',
    'http://myapp.traefik.me',
    'http://[2001:db8::1]/',
    'http://localhost:3000',
    'http://intranet',
    'ftp://files.example.com',
    'not a url',
    '',
    undefined,
  ]) assert.equal(isPublicMemberUrl(url), false, String(url));
});

test('publicMembers drops non-public entries and keeps the rest in order', () => {
  const members = [
    { name: 'a', url: 'https://a.example.com' },
    { name: 'b', url: 'http://x.1.2.3.4.sslip.io' },
    { name: 'c', url: 'https://c.example.com' },
  ];
  assert.deepEqual(publicMembers(members).map(m => m.name), ['a', 'c']);
  assert.deepEqual(publicMembers(null), []);
});

test('the seed members.json has only public URLs', () => {
  const members = JSON.parse(readFileSync(join(ROOT, 'members.json'), 'utf8'));
  for (const m of members) assert.equal(isPublicMemberUrl(m.url), true, `${m.name}: ${m.url}`);
});

test('login-gated sites stay off the ring until they have a public landing page', () => {
  const members = JSON.parse(readFileSync(join(ROOT, 'members.json'), 'utf8'));
  const hosts = members.map(m => new URL(m.url).hostname);
  for (const gated of ['fridge.mindshine.io', 'command.mindshine.io', 'briefing.mindshine.io']) {
    assert.ok(!hosts.includes(gated), gated);
  }
});
