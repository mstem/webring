import express from 'express';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { timingSafeEqual } from 'crypto';

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

function loadMembers() {
  return JSON.parse(readFileSync(join(ROOT, 'members.json'), 'utf8'));
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

// --- Navigation routes ---

app.get('/next', (req, res) => {
  const members = loadMembers();
  if (members.length === 0) return res.redirect('/');
  const idx = findMemberIndex(members, req.query.from || '');
  const next = (idx === -1 ? 0 : (idx + 1) % members.length);
  res.redirect(members[next].url);
});

app.get('/prev', (req, res) => {
  const members = loadMembers();
  if (members.length === 0) return res.redirect('/');
  const idx = findMemberIndex(members, req.query.from || '');
  const prev = (idx === -1 ? 0 : (idx - 1 + members.length) % members.length);
  res.redirect(members[prev].url);
});

app.get('/random', (req, res) => {
  const members = loadMembers();
  if (members.length === 0) return res.redirect('/');
  const idx = findMemberIndex(members, req.query.from || '');
  const pool = members.length > 1 ? members.filter((_, i) => i !== idx) : members;
  res.redirect(pool[Math.floor(Math.random() * pool.length)].url);
});

// --- API ---

app.get('/api/ring', (req, res) => res.json(loadRing()));
app.get('/api/members', (req, res) => res.json(loadMembers()));

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

// --- Admin: view pending submissions ---

app.get('/admin', requireAdminAuth, (req, res) => {
  const submissions = loadSubmissions();
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
          <button type="submit">Delete</button>
        </form>
      </td>
    </tr>`).join('');

  res.send(`<!doctype html>
<html><head><meta charset="utf-8"><title>Webring Admin — Pending Submissions</title>
<style>
  body { font-family: system-ui, sans-serif; margin: 2rem; color: #1a1a1a; background: #fff; }
  h1 { font-size: 1.4rem; }
  table { border-collapse: collapse; width: 100%; margin-top: 1rem; }
  th, td { border: 1px solid #ddd; padding: 0.5rem 0.75rem; text-align: left; vertical-align: top; }
  th { background: #f5f5f5; }
  button { cursor: pointer; }
</style></head>
<body>
  <h1>Pending submissions (${submissions.length})</h1>
  <p>Approve by adding an entry to <code>members.json</code>, then delete it from here.</p>
  <table>
    <thead><tr><th>Name</th><th>URL</th><th>Description</th><th>Contact</th><th>Submitted</th><th></th></tr></thead>
    <tbody>${rows || '<tr><td colspan="6">No pending submissions.</td></tr>'}</tbody>
  </table>
</body></html>`);
});

app.post('/admin/submissions/delete', requireAdminAuth, (req, res) => {
  const submissions = loadSubmissions();
  const index = parseInt(req.body.index, 10);
  if (Number.isNaN(index) || index < 0 || index >= submissions.length) {
    return res.status(400).send('Invalid index.');
  }
  submissions.splice(index, 1);
  saveSubmissions(submissions);
  res.redirect('/admin');
});

// --- Serve index for all other routes (SPA-style) ---
app.get('*', (req, res) => {
  res.sendFile(join(ROOT, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Web ring running on http://localhost:${PORT}`));
