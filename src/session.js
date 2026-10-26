// The admin sign-in cookie. Basic auth has no form of its own, so a password
// manager had nothing to fill; the form at /admin/login posts the password and
// gets this cookie back instead. Basic auth keeps working alongside it for
// scripts that send a header.
//
// The cookie carries its own expiry and an HMAC over it, keyed by the admin
// password, so there is no session store and changing the password signs every
// browser out.

import { createHmac, timingSafeEqual } from 'crypto';

export const SESSION_COOKIE = 'webring_admin';
export const REMEMBER_MAX_AGE_MS = 180 * 24 * 60 * 60 * 1000; // 180 days
export const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours without Remember me

export function signSession(expiresAt, secret) {
  const payload = `v1.${expiresAt}`;
  const mac = createHmac('sha256', String(secret)).update(payload).digest('base64url');
  return `${payload}.${mac}`;
}

export function sessionIsValid(token, secret, now = Date.now()) {
  if (!secret || typeof token !== 'string') return false;
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== 'v1' || !/^\d+$/.test(parts[1])) return false;
  const expiresAt = Number(parts[1]);
  if (expiresAt < now) return false;
  const expected = Buffer.from(signSession(expiresAt, secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function readCookie(req, name) {
  const header = req.headers?.cookie;
  if (!header) return null;
  for (const pair of header.split(';')) {
    const eq = pair.indexOf('=');
    if (eq < 0 || pair.slice(0, eq).trim() !== name) continue;
    try { return decodeURIComponent(pair.slice(eq + 1).trim()); } catch { return null; }
  }
  return null;
}

// Where to go after signing in. Only admin pages, so a crafted link can never
// bounce anyone off-site or into a loop through the sign-in page.
export function safeNext(raw) {
  if (typeof raw !== 'string' || /[^\x21-\x7e]/.test(raw)) return '/admin';
  if (!/^\/admin(?:[/?#]|$)/.test(raw)) return '/admin';
  if (/^\/admin\/log(?:in|out)(?:[/?#]|$)/.test(raw)) return '/admin';
  return raw;
}

export function loginUrl(next) {
  const back = safeNext(next);
  return back === '/admin' ? '/admin/login' : `/admin/login?next=${encodeURIComponent(back)}`;
}

// Browsers stamp every request with Sec-Fetch-* headers; curl and scripts don't.
// A Basic challenge sent to a browser makes it pop up its own login box.
export function isBrowserRequest(req) {
  return Boolean(req.headers['sec-fetch-mode'] || req.headers['sec-fetch-site']);
}

// A page load or a form post: something a person is looking at, which should
// land on the sign-in page rather than on a bare 401.
export function wantsLoginPage(req) {
  const mode = req.headers['sec-fetch-mode'];
  if (mode) return mode === 'navigate';
  return req.method === 'GET' && String(req.headers.accept || '').includes('text/html');
}

export function isHttps(req) {
  if (req.secure) return true;
  return String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
}
