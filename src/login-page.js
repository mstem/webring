// The admin sign-in page. A plain form post, so it works without scripts and a
// password manager sees an ordinary password field.

function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}

export function loginPage({ next = '/admin', error = '' } = {}) {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in · Webring Admin</title>
<style>
  *, *::before, *::after { box-sizing: border-box; }
  body { font-family: system-ui, -apple-system, sans-serif; margin: 0; padding: 2rem 1rem; color: #1a1a1a; background: #fff; font-size: 15px; line-height: 1.5; }
  form { max-width: 340px; margin: 12vh auto 0; border: 1px solid #ddd; border-radius: 8px; padding: 1.5rem; }
  h1 { font-size: 1.2rem; font-weight: 600; margin: 0 0 1.25rem; }
  label { display: block; }
  .field span { display: block; font-size: 0.9rem; margin-bottom: 0.35rem; }
  input[type=password] { width: 100%; font: inherit; color: inherit; background: #fff; border: 1px solid #ccc; border-radius: 6px; padding: 0.5rem 0.65rem; }
  input[type=password]:focus { outline: 2px solid #4f46e5; outline-offset: 1px; border-color: #4f46e5; }
  .remember { display: flex; align-items: center; gap: 0.5rem; margin: 1rem 0 1.25rem; font-size: 0.9rem; cursor: pointer; }
  .remember input { margin: 0; accent-color: #4f46e5; }
  button { width: 100%; font: inherit; font-weight: 600; color: #fff; background: #4f46e5; border: 0; border-radius: 6px; padding: 0.55rem 0.9rem; cursor: pointer; }
  button:hover { background: #4338ca; }
  .error { margin: 1rem 0 0; color: #b91c1c; font-size: 0.9rem; }
</style></head>
<body>
  <form method="post" action="/admin/login">
    <h1>Webring admin</h1>
    <input type="hidden" name="next" value="${escapeHtml(next)}">
    <label class="field" for="password"><span>Password</span>
      <input type="password" id="password" name="password" autocomplete="current-password" required autofocus>
    </label>
    <label class="remember" for="remember">
      <input type="checkbox" id="remember" name="remember" value="on" checked>
      Remember me for 180 days
    </label>
    <button type="submit">Sign in</button>
    ${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
  </form>
</body></html>`;
}
