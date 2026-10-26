import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  signSession, sessionIsValid, readCookie, safeNext, isBrowserRequest, wantsLoginPage,
} from '../src/session.js';

const SECRET = 'correct horse';

test('a signed session verifies until it expires', () => {
  const now = 1_000_000;
  const token = signSession(now + 1000, SECRET);
  assert.equal(sessionIsValid(token, SECRET, now), true);
  assert.equal(sessionIsValid(token, SECRET, now + 999), true);
  assert.equal(sessionIsValid(token, SECRET, now + 1001), false);
});

test('a session signed with another password does not verify', () => {
  const token = signSession(Date.now() + 60_000, 'old password');
  assert.equal(sessionIsValid(token, SECRET), false);
});

test('a tampered session does not verify', () => {
  const token = signSession(Date.now() + 60_000, SECRET);
  const [v, exp, mac] = token.split('.');
  assert.equal(sessionIsValid(`${v}.${Number(exp) + 1e9}.${mac}`, SECRET), false);
  assert.equal(sessionIsValid(`${v}.${exp}.${mac.slice(0, -1)}A`, SECRET), false);
  assert.equal(sessionIsValid(`v2.${exp}.${mac}`, SECRET), false);
  for (const junk of [undefined, null, '', 'v1', 'v1.x.y', `${token}.extra`, 42]) {
    assert.equal(sessionIsValid(junk, SECRET), false, String(junk));
  }
});

test('no session verifies against an empty password', () => {
  const token = signSession(Date.now() + 60_000, '');
  assert.equal(sessionIsValid(token, ''), false);
});

test('cookies are read by exact name', () => {
  const req = { headers: { cookie: 'a=1; webring_admin_x=no; webring_admin=v1.2.3' } };
  assert.equal(readCookie(req, 'webring_admin'), 'v1.2.3');
  assert.equal(readCookie(req, 'missing'), null);
  assert.equal(readCookie({ headers: {} }, 'a'), null);
});

test('next only ever points back into the admin', () => {
  assert.equal(safeNext('/admin'), '/admin');
  assert.equal(safeNext('/admin?factory=bad'), '/admin?factory=bad');
  for (const bad of ['https://evil.example/admin', '//evil.example/admin', '/\\evil.example',
    '/admin.evil', '/adminx', '/', '/admin/login', '/admin/login?next=/admin', 'admin', '', undefined, ['/admin']]) {
    assert.equal(safeNext(bad), '/admin', String(bad));
  }
});

test('requests from a browser page are told apart from scripts', () => {
  assert.equal(isBrowserRequest({ headers: { 'sec-fetch-mode': 'cors' } }), true);
  assert.equal(isBrowserRequest({ headers: { 'sec-fetch-site': 'same-origin' } }), true);
  assert.equal(isBrowserRequest({ headers: { accept: '*/*' } }), false);
});

test('page loads and form posts get the sign-in page, fetches do not', () => {
  assert.equal(wantsLoginPage({ method: 'GET', headers: { accept: 'text/html,*/*' } }), true);
  assert.equal(wantsLoginPage({ method: 'POST', headers: { 'sec-fetch-mode': 'navigate' } }), true);
  assert.equal(wantsLoginPage({ method: 'GET', headers: { accept: '*/*' } }), false);
  assert.equal(wantsLoginPage({ method: 'POST', headers: { accept: 'text/html', 'sec-fetch-mode': 'cors' } }), false);
});
