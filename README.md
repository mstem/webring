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

The ring is two sibling rings. Each member has an optional `"factory": "good"` or `"factory": "bad"` in `members.json`; leaving it out means good. Prev, next and random in a member's widget only walk members of the same factory, and the widget bar wears that factory's name and colours (dark for bad).

The homepage and `/admin` open on the Good Idea Factory in light mode, with a button that switches to the Bad Idea Factory in dark mode. A visitor who arrives from a member's widget lands in that member's factory. `?factory=bad` links straight to it. Names and descriptions come from the optional `factories` block in `ring.json`:

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

This injects a fixed footer bar. To place the widget inline instead, add this anywhere in your HTML and the script will target it:

```html
<div id="webring-widget"></div>
<script src="https://your-ring.example.com/widget.js"></script>
```

## Joining the ring

Two paths:

- **Non-technical:** fill out the form on the ring homepage → submission lands in `submissions.json` → ring admin reviews and moves the entry to `members.json`
- **Technical:** open a pull request adding your site to `members.json`

## Local development

```bash
npm install
npm run dev   # starts server with --watch on port 3000
```
