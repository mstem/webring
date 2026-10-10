import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { timingSafeEqual } from 'crypto';
import { isPublicMemberUrl, publicMembers, NOT_PUBLIC_ERROR } from './member-url.js';
import { factoryOf, parseFactory, otherFactory, factoriesOf } from './factory.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const DATA_DIR = process.env.DATA_DIR || ROOT;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '';

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// CORS — widget and API are called cross-origin by member sites
app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  next();
});

app.use(express.static(join(ROOT, 'public')));

// --- Data helpers ---

// Members live on the persistent data dir once anything has written them, so
// edits survive a redeploy. The copy in the repo root is the initial seed.
// Entries without a public hostname are dropped on every read, so an old copy
// on the data dir can never put one back in front of visitors.
function loadMembers() {
  const livePath = join(DATA_DIR, 'members.json');
  const path = existsSync(livePath) ? livePath : join(ROOT, 'members.json');
  return publicMembers(JSON.parse(readFileSync(path, 'utf8')));
}

function saveMembers(members) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, 'members.json'), JSON.stringify(members, null, 2));
}

function loadRing() {
  return JSON.parse(readFileSync(join(ROOT, 'ring.json'), 'utf8'));
}

function loadSubmissions() {
  const path = join(DATA_DIR, 'submissions.json');
  if (!existsSync(path)) return [];
  return JSON.parse(readFileSync(path, 'utf8'));
}

function saveSubmissions(submissions) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, 'submissions.json'), JSON.stringify(submissions, null, 2));
}

// --- Member health ---
//
// A ring exists to send visitors somewhere, so a member whose site no longer
// answers is worse than no member at all. Every member URL is re-checked on a
// timer and the result cached here; unreachable members drop out of the public
// ring but stay in members.json, so the dashboard still shows them as joined.
//
// Unknown means reachable: a member added seconds ago, or a ring booted before
// its first sweep, must not vanish just because nothing has checked it yet.

const HEALTH_INTERVAL_MS = 15 * 60 * 1000;

// Keyed by the full URL, not the origin: two members can share an origin and
// differ only by path, and each needs its own verdict.
function healthKey(url) {
  return String(url || '').replace(/\/$/, '').toLowerCase();
}

function loadHealth() {
  const path = join(DATA_DIR, 'health.json');
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return {}; }
}

function saveHealth(health) {
  if (!existsSync(DATA_DIR)) mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(join(DATA_DIR, 'health.json'), JSON.stringify(health, null, 2));
}

async function checkUrl(url) {
  const at = new Date().toISOString();
  const opts = {
    redirect: 'follow',
    signal: AbortSignal.timeout(10000),
    headers: { 'User-Agent': 'webring-healthcheck' },
  };
  try {
    let r = await fetch(url, { ...opts, method: 'HEAD' });
    // Plenty of hosts mishandle HEAD; confirm a failure with a real GET before
    // dropping a member from the ring.
    if (r.status >= 400) r = await fetch(url, { ...opts, method: 'GET' });
    return { ok: r.status >= 200 && r.status < 400, status: r.status, checkedAt: at };
  } catch (e) {
    return { ok: false, status: 0, error: String(e?.message || e).slice(0, 120), checkedAt: at };
  }
}

async function refreshHealth() {
  const members = loadMembers();
  const health = loadHealth();
  const results = await Promise.all(members.map(m => checkUrl(m.url)));
  members.forEach((m, i) => { health[healthKey(m.url)] = results[i]; });

  // Forget members that have since left the ring.
  const live = new Set(members.map(m => healthKey(m.url)));
  for (const key of Object.keys(health)) if (!live.has(key)) delete health[key];

  saveHealth(health);
  return health;
}

function isReachable(member, health) {
  const h = health[healthKey(member.url)];
  return h ? h.ok : true;
}

// What visitors get: joined members that actually answer, from one factory
// when one is given.
function reachableMembers(factory) {
  const health = loadHealth();
  return loadMembers().filter(m => isReachable(m, health) && (!factory || factoryOf(m) === factory));
}

// Sun for the good (light) factory, moon for the bad (dark) one.
const FACTORY_ICONS = {
  good: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>',
  bad: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/></svg>',
};

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

function requireAdminAuth(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).send('Admin page is not configured (ADMIN_PASSWORD not set).');
  }
  const header = req.headers.authorization || '';
  const [scheme, encoded] = header.split(' ');
  const decoded = encoded ? Buffer.from(encoded, 'base64').toString('utf8') : '';
  const password = decoded.includes(':') ? decoded.slice(decoded.indexOf(':') + 1) : decoded;
  const a = Buffer.from(password);
  const b = Buffer.from(ADMIN_PASSWORD);
  const match = scheme === 'Basic' && a.length === b.length && timingSafeEqual(a, b);
  if (!match) {
    res.setHeader('WWW-Authenticate', 'Basic realm="Webring Admin"');
    return res.status(401).send('Authentication required.');
  }
  next();
}

// Same secret as the admin page, presented as a header instead of Basic auth so
// that machine callers (the dashboard) don't have to build an auth header.
function requireAdminSecret(req, res, next) {
  if (!ADMIN_PASSWORD) {
    return res.status(503).json({ error: 'Sync is not configured (ADMIN_PASSWORD not set).' });
  }
  const a = Buffer.from(String(req.headers['x-admin-secret'] || ''));
  const b = Buffer.from(ADMIN_PASSWORD);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return res.status(401).json({ error: 'Invalid admin secret.' });
  }
  next();
}

function normalizeUrl(url) {
  try {
    return new URL(url).origin.toLowerCase();
  } catch {
    return url.replace(/\/$/, '').toLowerCase();
  }
}

function findMemberIndex(members, from) {
  const needle = normalizeUrl(from);
  return members.findIndex(m => normalizeUrl(m.url) === needle);
}

// The factory a visitor is walking: the one their current site belongs to,
// else one named outright, else good.
function factoryForRequest(req) {
  const members = loadMembers();
  const idx = req.query.from ? findMemberIndex(members, req.query.from) : -1;
  if (idx !== -1) return factoryOf(members[idx]);
  return parseFactory(req.query.factory) || 'good';
}

// --- Navigation routes ---

app.get('/next', (req, res) => {
  const members = reachableMembers(factoryForRequest(req));
  if (members.length === 0) return res.redirect('/');
  const idx = findMemberIndex(members, req.query.from || '');
  const next = (idx === -1 ? 0 : (idx + 1) % members.length);
  res.redirect(members[next].url);
});

app.get('/prev', (req, res) => {
  const members = reachableMembers(factoryForRequest(req));
  if (members.length === 0) return res.redirect('/');
  const idx = findMemberIndex(members, req.query.from || '');
  const prev = (idx === -1 ? 0 : (idx - 1 + members.length) % members.length);
  res.redirect(members[prev].url);
});

app.get('/random', (req, res) => {
  const members = reachableMembers(factoryForRequest(req));
  if (members.length === 0) return res.redirect('/');
  const idx = findMemberIndex(members, req.query.from || '');
  const pool = members.length > 1 ? members.filter((_, i) => i !== idx) : members;
  res.redirect(pool[Math.floor(Math.random() * pool.length)].url);
});

// --- API ---

app.get('/api/ring', (req, res) => {
  const ring = loadRing();
  res.json({ ...ring, factories: factoriesOf(ring), factory: factoryForRequest(req) });
});

// Public view of one factory: joined members whose sites currently answer.
app.get('/api/members', (req, res) => {
  res.json(reachableMembers(parseFactory(req.query.factory) || 'good'));
});

// Everything joined, health included. The dashboard reads this so a member that
// is merely unreachable still shows as checked rather than silently leaving.
app.get('/api/members/all', (req, res) => {
  const health = loadHealth();
  res.json(loadMembers().map(m => {
    const h = health[healthKey(m.url)] || null;
    return { ...m, factory: factoryOf(m), reachable: isReachable(m, health), health: h };
  }));
});

// --- Join / submission ---

app.post('/api/submit', (req, res) => {
  const ring = loadRing();
  if (!ring.join?.enabled) {
    return res.status(403).json({ error: 'Submissions are not enabled for this ring.' });
  }

  const { name, url, description, contact } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'Name and URL are required.' });
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return res.status(400).json({ error: 'Invalid URL.' });
  }
  if (!isPublicMemberUrl(parsedUrl.href)) {
    return res.status(400).json({ error: NOT_PUBLIC_ERROR });
  }

  const submissions = loadSubmissions();
  const members = loadMembers();
  const allUrls = [...members, ...submissions].map(s => normalizeUrl(s.url));

  if (allUrls.includes(normalizeUrl(parsedUrl.href))) {
    return res.status(409).json({ error: 'This site is already in the ring or pending review.' });
  }

  submissions.push({
    name: name.trim().slice(0, 100),
    url: parsedUrl.origin,
    description: (description || '').trim().slice(0, 300),
    contact: (contact || '').trim().slice(0, 200),
    submittedAt: new Date().toISOString(),
  });

  saveSubmissions(submissions);
  res.json({ ok: true, message: 'Submission received! It will be reviewed before being added.' });
});

// --- Admin: add or remove a member directly (used by the dashboard) ---

app.post('/api/members/sync', requireAdminSecret, (req, res) => {
  const { name, url, description, remove, factory } = req.body || {};
  if (!url) return res.status(400).json({ error: 'url is required.' });

  let parsedUrl;
  try {
    parsedUrl = new URL(url.startsWith('http') ? url : `https://${url}`);
  } catch {
    return res.status(400).json({ error: 'Invalid URL.' });
  }
  if (!remove && !isPublicMemberUrl(parsedUrl.href)) {
    return res.status(400).json({ error: NOT_PUBLIC_ERROR });
  }

  const members = loadMembers();
  const key = normalizeUrl(parsedUrl.href);
  const idx = members.findIndex(m => normalizeUrl(m.url) === key);

  if (remove) {
    if (idx === -1) return res.json({ ok: true, removed: false, count: members.length });
    members.splice(idx, 1);
    saveMembers(members);
    return res.json({ ok: true, removed: true, count: members.length });
  }

  // Keep the path — project sites hosted under one origin (GitHub Pages and
  // friends) are a different member than the origin's root. Matching stays
  // origin-based, in line with the rest of the ring.
  const entry = {
    name: String(name || parsedUrl.hostname).trim().slice(0, 100),
    url: parsedUrl.href.replace(/\/$/, ''),
    description: String(description || '').trim().slice(0, 300),
  };
  // A re-sync that names no factory leaves the member where it was.
  const chosen = parseFactory(factory) || (idx === -1 ? null : members[idx].factory);
  if (chosen) entry.factory = chosen;
  if (idx === -1) members.push(entry); else members[idx] = entry;
  saveMembers(members);
  res.json({ ok: true, added: idx === -1, updated: idx !== -1, count: members.length });

  // Classify the new member without making the caller wait; until this lands it
  // counts as reachable, so a working site is never briefly missing from the ring.
  checkUrl(entry.url)
    .then((result) => {
      const health = loadHealth();
      health[healthKey(entry.url)] = result;
      saveHealth(health);
    })
    .catch(() => {});
});

// --- Admin: view pending submissions ---

app.get('/admin', requireAdminAuth, (req, res) => {
  const submissions = loadSubmissions();
  const health = loadHealth();
  const factory = parseFactory(req.query.factory) || 'good';
  const other = otherFactory(factory);
  const names = factoriesOf(loadRing());
  const members = loadMembers().filter(m => factoryOf(m) === factory);
  const hidden = members.filter(m => !isReachable(m, health));
  const keep = `<input type="hidden" name="factory" value="${factory}">`;
  const memberRows = members.map((m) => {
    const h = health[healthKey(m.url)];
    const state = !h ? 'not checked yet'
      : h.ok ? `in the ring (${h.status})`
      : `hidden — ${h.status ? `HTTP ${h.status}` : h.error || 'unreachable'}`;
    return `
    <tr>
      <td>${escapeHtml(m.name)}</td>
      <td><a href="${escapeHtml(m.url)}" target="_blank" rel="noopener">${escapeHtml(m.url)}</a></td>
      <td>${escapeHtml(state)}</td>
      <td>${escapeHtml(h?.checkedAt || '—')}</td>
    </tr>`;
  }).join('') || '<tr><td colspan="4">No members yet.</td></tr>';
  const rows = submissions.map((s, i) => `
    <tr>
      <td>${escapeHtml(s.name)}</td>
      <td><a href="${escapeHtml(s.url)}" target="_blank" rel="noopener">${escapeHtml(s.url)}</a></td>
      <td>${escapeHtml(s.description)}</td>
      <td>${escapeHtml(s.contact)}</td>
      <td>${escapeHtml(s.submittedAt)}</td>
      <td>
        <form method="POST" action="/admin/submissions/delete" onsubmit="return confirm('Delete this submission?')">
          <input type="hidden" name="index" value="${i}">
          ${keep}
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  res.send(`<!doctype html>
<html lang="en" data-factory="${factory}"><head><meta charset="utf-8"><title>Webring Admin — ${escapeHtml(names[factory].name)}</title>
<style>
  :root { --paper: #fff; --ink: #1a1a1a; --rule: #ddd; --head: #f5f5f5; --link: #4f46e5; }
  :root[data-factory="bad"] { --paper: #141413; --ink: #ecebe6; --rule: #3a3a37; --head: #1f1f1d; --link: #a5a8f8; }
  body { font-family: system-ui, sans-serif; margin: 2rem; color: var(--ink); background: var(--paper); }
  a { color: var(--link); }
  h1 { font-size: 1.4rem; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
  th, td { border: 1px solid var(--rule); padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
  th { background: var(--head); }
  button { cursor: pointer; }
  .switch { display: inline-flex; align-items: center; gap: 0.4rem; font-size: 0.9rem; text-decoration: none; border: 1px solid var(--rule); border-radius: 6px; padding: 0.35rem 0.7rem; }
  .switch svg { width: 15px; height: 15px; }
</style></head>
<body>
  <a class="switch" href="/admin?factory=${other}">${FACTORY_ICONS[other]}${escapeHtml(names[other].name)}</a>
  <h1>Pending submissions (${submissions.length})</h1>
  <p>Approve by adding an entry to <code>members.json</code>, then delete it from here.</p>
  <table>
    <thead><tr><th>Name</th><th>URL</th><th>Description</th><th>Contact</th><th>Submitted</th><th></th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6">No pending submissions.</td></tr>'}</tbody>
  </table>

  <h1>${escapeHtml(names[factory].name)}: members (${members.length}), ${hidden.length} hidden</h1>
  <p>A member whose site stops answering is held back from the ring until it responds again. Nothing is removed.</p>
  <table>
    <thead><tr><th>Name</th><th>URL</th><th>State</th><th>Last checked</th></tr></thead>
    <tbody>${memberRows}</tbody>
  </table>
  <form method="POST" action="/admin/members/recheck">${keep}<button type="submit">Re-check now</button></form>
</body></html>`);
});

app.post('/admin/members/recheck', requireAdminAuth, async (req, res) => {
  await refreshHealth();
  res.redirect(`/admin?factory=${parseFactory(req.body.factory) || 'good'}`);
});

app.post('/admin/submissions/delete', requireAdminAuth, (req, res) => {
  const submissions = loadSubmissions();
  const index = parseInt(req.body.index, 10);
  if (Number.isNaN(index) || index < 0 || index >= submissions.length) {
    return res.status(400).send('Invalid index.');
  }
  submissions.splice(index, 1);
  saveSubmissions(submissions);
  res.redirect(`/admin?factory=${parseFactory(req.body.factory) || 'good'}`);
});

// --- Serve index for all other routes (SPA-style) ---
app.get('/{*splat}', (req, res) => {
  res.sendFile(join(ROOT, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Web ring running on http://localhost:${PORT}`);
  // First sweep runs shortly after boot rather than during it, so a slow or
  // unreachable member can never hold up serving the ring.
  setTimeout(() => { refreshHealth().catch(() => {}); }, 5000);
  setInterval(() => { refreshHealth().catch(() => {}); }, HEALTH_INTERVAL_MS);
});
