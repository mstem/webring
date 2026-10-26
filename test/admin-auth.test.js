import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { request } from 'http';

const PASSWORD = 'test-admin-password';
const dataDir = mkdtempSync(join(tmpdir(), 'webring-test-'));
process.env.ADMIN_PASSWORD = PASSWORD;
process.env.DATA_DIR = dataDir;
const { app } = await import('../src/server.js');

let server; let base;
before(async () => {
  server = app.listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});
after(() => { server.close(); rmSync(dataDir, { recursive: true, force: true }); });

// Each test speaks from its own address, so the lockout in one never leaks into another.
let n = 0;
const fromIp = () => ({ 'cf-connecting-ip': `203.0.113.${++n}` });
const basic = (pw) => `Basic ${Buffer.from(`admin:${pw}`).toString('base64')}`;
// node:http rather than fetch, which stamps every request with Sec-Fetch-Mode
// and would make a script look like a browser page.
function send(method, path, headers = {}, body = '') {
  return new Promise((resolve, reject) => {
    const req = request(base + path, { method, headers: { 'content-length': Buffer.byteLength(body), ...headers } }, (res) => {
      let text = '';
      res.setEncoding('utf8');
      res.on('data', (c) => { text += c; });
      res.on('end', () => resolve({
        status: res.statusCode,
        headers: { get: (k) => { const v = res.headers[k.toLowerCase()]; return v == null ? null : [].concat(v).join(', '); } },
        text: async () => text,
      }));
    });
    req.on('error', reject);
    req.end(body);
  });
}
const get = (path, headers = {}) => send('GET', path, headers);
const post = (path, headers = {}, body = '') => send('POST', path, { 'content-type': 'application/x-www-form-urlencoded', ...headers }, body);
const login = (fields, headers) => post('/admin/login', headers, new URLSearchParams(fields).toString());
const cookieOf = (res) => (res.headers.get('set-cookie') || '').split(';')[0];

test('a browser opening the admin signed out is sent to the sign-in page, and back afterwards', async () => {
  const res = await get('/admin?factory=bad', { accept: 'text/html', 'sec-fetch-mode': 'navigate', ...fromIp() });
  assert.equal(res.status, 302);
  assert.equal(res.headers.get('location'), '/admin/login?next=%2Fadmin%3Ffactory%3Dbad');
  assert.equal(res.headers.get('www-authenticate'), null);
});

test('the sign-in page is a real form a password manager can fill', async () => {
  const res = await get('/admin/login?next=%2Fadmin%3Ffactory%3Dbad', fromIp());
  assert.equal(res.status, 200);
  const html = await res.text();
  assert.match(html, /<form[^>]*method="post"[^>]*action="\/admin\/login"/);
  assert.match(html, /<input[^>]*type="password"[^>]*name="password"[^>]*autocomplete="current-password"/);
  assert.match(html, /name="next" value="\/admin\?factory=bad"/);
  assert.equal(res.headers.get('cache-control'), 'no-store');
});

test('the right password sets a scoped cookie that opens the admin', async () => {
  const ip = fromIp();
  const res = await login({ password: PASSWORD, next: '/admin?factory=bad' }, ip);
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/admin?factory=bad');
  const raw = res.headers.get('set-cookie');
  assert.match(raw, /^webring_admin=v1\./);
  assert.match(raw, /HttpOnly/);
  assert.match(raw, /SameSite=Lax/);
  assert.match(raw, /Path=\/admin/);
  assert.doesNotMatch(raw, /Max-Age/); // no Remember me: gone with the browser session
  assert.doesNotMatch(raw, /Secure/); // plain HTTP here

  const page = await get('/admin', { cookie: cookieOf(res), ...ip });
  assert.equal(page.status, 200);
  assert.match(await page.text(), /Pending submissions/);
});

test('Remember me keeps the cookie for 180 days, and HTTPS marks it Secure', async () => {
  const res = await login({ password: PASSWORD, remember: 'on' }, { 'x-forwarded-proto': 'https', ...fromIp() });
  const raw = res.headers.get('set-cookie');
  assert.match(raw, /Max-Age=15552000/);
  assert.match(raw, /Secure/);
});

test('a crafted next never leaves the admin', async () => {
  const res = await login({ password: PASSWORD, next: '//evil.example/admin' }, fromIp());
  assert.equal(res.headers.get('location'), '/admin');
});

test('a wrong password shows the form again and sets no cookie', async () => {
  const res = await login({ password: 'nope', next: '/admin?factory=bad' }, fromIp());
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('set-cookie'), null);
  assert.equal(res.headers.get('www-authenticate'), null);
  const html = await res.text();
  assert.match(html, /Wrong password/);
  assert.match(html, /name="next" value="\/admin\?factory=bad"/);
});

test('ten wrong passwords lock the address out of the form and of Basic auth', async () => {
  const ip = fromIp();
  for (let i = 0; i < 10; i++) assert.equal((await login({ password: `guess${i}` }, ip)).status, 401);
  assert.equal((await login({ password: PASSWORD }, ip)).status, 429);
  assert.equal((await get('/admin', { authorization: basic(PASSWORD), ...ip })).status, 429);
  // Wrong Basic guesses count toward the same lockout.
  const other = fromIp();
  for (let i = 0; i < 10; i++) await get('/admin', { authorization: basic(`guess${i}`), ...other });
  assert.equal((await login({ password: PASSWORD }, other)).status, 429);
});

test('a forged or expired cookie does not open the admin', async () => {
  const ip = fromIp();
  for (const cookie of ['webring_admin=v1.9999999999999.forged', 'webring_admin=v1.1.abc']) {
    const res = await get('/admin', { cookie, accept: 'text/html', ...ip });
    assert.equal(res.status, 302);
  }
});

test('a fetch from the page gets a 401 with no Basic challenge', async () => {
  const res = await get('/admin', { 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin', ...fromIp() });
  assert.equal(res.status, 401);
  assert.equal(res.headers.get('www-authenticate'), null);
});

test('scripts keep the Basic challenge, and Basic auth still opens the admin', async () => {
  const ip = fromIp();
  const challenged = await get('/admin', ip);
  assert.equal(challenged.status, 401);
  assert.equal(challenged.headers.get('www-authenticate'), 'Basic realm="Webring Admin"');
  const ok = await get('/admin', { authorization: basic(PASSWORD), ...ip });
  assert.equal(ok.status, 200);
});

test('a signed-out form post on the admin is sent to sign in', async () => {
  const res = await post('/admin/members/recheck', { 'sec-fetch-mode': 'navigate', 'sec-fetch-site': 'same-origin', ...fromIp() }, 'factory=bad');
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/admin/login?next=%2Fadmin%3Ffactory%3Dbad');
});

test('signing out clears the cookie', async () => {
  const res = await post('/admin/logout', fromIp());
  assert.equal(res.status, 303);
  assert.equal(res.headers.get('location'), '/admin/login');
  assert.match(res.headers.get('set-cookie'), /^webring_admin=;.*Path=\/admin/);
});

test('public pages and the widget stay public', async () => {
  for (const path of ['/', '/widget.js', '/api/ring', '/api/members']) {
    assert.equal((await get(path, fromIp())).status, 200, path);
  }
});
