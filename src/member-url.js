// A member link must point at a public hostname. A raw IP address, or a
// wildcard-DNS name that embeds one (sslip.io and friends), skips whatever
// proxy normally sits in front of the site and reveals the server behind it.

const WILDCARD_DNS = ['sslip.io', 'nip.io', 'xip.io', 'traefik.me', 'localtest.me'];

// Four dot- or dash-separated octets anywhere in the hostname.
const EMBEDDED_IPV4 = /(^|[.-])(\d{1,3})[.-](\d{1,3})[.-](\d{1,3})[.-](\d{1,3})($|[.-])/;

export function isPublicMemberUrl(url) {
  let host;
  try {
    const parsed = new URL(String(url));
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    host = parsed.hostname.toLowerCase().replace(/\.$/, '');
  } catch {
    return false;
  }
  if (!host || host === 'localhost' || !host.includes('.')) return false;
  if (host.startsWith('[')) return false; // IPv6 literal
  if (EMBEDDED_IPV4.test(host)) return false;
  if (WILDCARD_DNS.some(d => host === d || host.endsWith(`.${d}`))) return false;
  return true;
}

export function publicMembers(members) {
  return (Array.isArray(members) ? members : []).filter(m => isPublicMemberUrl(m?.url));
}

export const NOT_PUBLIC_ERROR = 'Use the site\'s public hostname, not an IP address.';
