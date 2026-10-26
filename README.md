# webring

An embeddable web ring for vibe-coded projects. Deploy your own in minutes — members paste one `<script>` tag and get a minimal footer widget with ← prev / ring name / next → navigation.

## How it works

- `ring.json` — ring identity, theme, and join settings
- `members.json` — the list of member sites (edit to add/approve)
- `submissions.json` — auto-created when someone submits via the form (gitignored)
- `public/widget.js` — the embeddable snippet served to member sites
- `public/index.html` — the ring homepage: member directory, embed code, join form

When a visitor clicks ← or →, they hit `/prev?from=<origin>` or `/next?from=<origin>` on the ring server, which resolves the next site in the list and redirects them.

## Deploy your own

### Fly.io (recommended)

```bash
git clone https://github.com/mstem/webring
cd webring
npm install

# Edit ring.json and members.json, then:
fly launch --no-deploy
fly deploy
```

### Any Node host (Railway, Render, etc.)

Set the `PORT` environment variable if needed. Start command: `npm start`.

## Configure your ring

**`ring.json`**

```json
{
  "name": "My Ring",
  "description": "A collection of vibe-coded projects",
  "url": "https://your-ring.example.com",
  "join": {
    "enabled": true,
    "label": "Add your project"
  },
  "theme": {
    "accent": "#818cf8"
  }
}
```

Set `join.enabled` to `false` to disable the submission form and hide the join section on the ring homepage. The widget never carries a join link.

**`members.json`**

```json
[
  {
    "name": "My Project",
    "url": "https://my-project.example.com",
    "description": "What it does"
  }
]
```

### Good and Bad Idea Factories

The ring is two sibling rings. Each member has an optional `"factory": "good"` or `"factory": "bad"` in `members.json`; leaving it out means good. The bar opens in the site's own factory, showing the factory's name, with "Webring" and then an angel or devil and a factory centred on the line below, in dark colours for bad. A button on its right offers the other mode (Dark mode on a good site, Light mode on a bad one, shortened to Dark or Light on phones), and switches which ring the arrows walk. The name is not a link: the bar only ever leads to other members.

The homepage and `/admin` open on the Good Idea Factory in light mode, with a button that switches to the Bad Idea Factory in dark mode. `?factory=bad` links straight to it. Names and descriptions come from the optional `factories` block in `ring.json`:

```json
"factories": {
  "good": { "name": "Good Idea Factory", "description": "" },
  "bad":  { "name": "Bad Idea Factory",  "description": "" }
}
```

The sync endpoint takes an optional `factory` too. A re-sync without one leaves the member where it was.

## Add the widget to a member site

Paste before `</body>`:

```html
<script src="https://your-ring.example.com/widget.js"></script>
```

This adds the bar at the very end of the page, after the site's own footer. It never floats over the page. To place it somewhere else, add this anywhere in your HTML and the script will target it:

```html
<div id="webring-widget"></div>
<script src="https://your-ring.example.com/widget.js"></script>
```

## Joining the ring

Two paths:

- **Non-technical:** fill out the form on the ring homepage → submission lands in `submissions.json` → ring admin reviews and moves the entry to `members.json`
- **Technical:** open a pull request adding your site to `members.json`

## Admin

`/admin` lists pending submissions and member health. Set `ADMIN_PASSWORD` to turn it on; without it the page answers 503.

Opening `/admin` in a browser while signed out goes to `/admin/login`, a password form, and back to the page you asked for once you sign in. Signing in sets a cookie scoped to `/admin`: it lasts 180 days with Remember me ticked, and otherwise ends with the browser session, 12 hours at most. Changing `ADMIN_PASSWORD` signs every browser out. Sign out is at the top of the admin page.

Scripts can keep using HTTP Basic auth with any username and the admin password, e.g. `curl -u admin:$ADMIN_PASSWORD https://your-ring.example.com/admin`. The sync endpoint takes the same password in an `x-admin-secret` header. Ten wrong passwords from one address in 15 minutes, across the form, Basic auth and the sync secret together, lock that address out until the window passes.

## Local development

```bash
npm install
npm run dev   # starts server with --watch on port 3000
```
