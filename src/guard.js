// Small defences for the admin surface: constant-time secret checks, a per-IP
// rate limiter, and an address filter so the health check can only ever reach
// the public internet.

import { createHash, timingSafeEqual } from 'crypto';
import { lookup } from 'dns/promises';
import { isIP } from 'net';

// Hash both sides first so the comparison takes the same time whatever the
// length of the guess.
export function secretMatches(given, expected) {
  if (!expected) return false;
  const a = createHash('sha256').update(String(given ?? '')).digest();
  const b = createHash('sha256').update(String(expected)).digest();
  return timingSafeEqual(a, b);
}

// Counts hits per key inside a sliding window. In memory, so a restart resets
// it, which is fine for a ring this size.
export function rateLimiter({ max, windowMs, now = () => Date.now() }) {
  const hits = new Map();
  return {
    // True once the key has used up its allowance; records the hit either way.
    hit(key) {
      const t = now();
      const recent = (hits.get(key) || []).filter(at => t - at < windowMs);
      recent.push(t);
      hits.set(key, recent);
      if (hits.size > 10000) for (const [k, v] of hits) if (t - v[v.length - 1] >= windowMs) hits.delete(k);
      return recent.length > max;
    },
    blocked(key) {
      const t = now();
      return (hits.get(key) || []).filter(at => t - at < windowMs).length >= max;
    },
    clear(key) { hits.delete(key); },
  };
}

// The visitor's address. Behind Cloudflare the socket address is a proxy's.
export function clientIp(req) {
  return String(req.headers['cf-connecting-ip'] || req.ip || req.socket?.remoteAddress || '');
}

// Loopback, private, link-local, carrier-grade NAT, multicast and reserved
// ranges, in v4, v6 and v4-mapped v6.
export function isPrivateAddress(ip) {
  let addr = String(ip).toLowerCase();
  const mapped = addr.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) addr = mapped[1];
  if (isIP(addr) === 4) {
    const [a, b] = addr.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || a >= 224
      || (a === 100 && b >= 64 && b <= 127)
      || (a === 169 && b === 254)
      || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168)
      || (a === 198 && (b === 18 || b === 19));
  }
  if (isIP(addr) === 6) {
    return addr === '::' || addr === '::1'
      || /^f[cd]/.test(addr) || /^fe[89ab]/.test(addr) || addr.startsWith('ff');
  }
  return true; // not an address at all: refuse
}

// True when every address the hostname resolves to is public.
export async function resolvesPublic(hostname, resolve = lookup) {
  try {
    const addrs = await resolve(hostname, { all: true });
    return addrs.length > 0 && addrs.every(a => !isPrivateAddress(a.address));
  } catch {
    return false;
  }
}
