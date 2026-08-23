# Generic web adapter

The default adapter, for any app reachable over HTTP in a browser. It gets a run
off the ground without project-specific tooling. It is deliberately weaker than a
purpose-built adapter: it drives the app the way a user does, so anything the UI
cannot reach (a specific error state, a corrupted record, an expired token) needs
either a route interception recipe below or a project-specific extension.

Read [`adapter-guide.md`](adapter-guide.md) and fill the gaps this file leaves
open — then save the result into the project.

## 1. Boot

Find the dev-server command from the project itself: `package.json` scripts
(`dev`, `start`, `serve`, `preview`), `Procfile`, `Makefile`, `docker-compose.yml`,
or the project's README. Prefer a command that serves a production-like build if
one exists; hot-reload dev servers inject overlays and re-render mid-capture.

Start it in the background, then poll until ready — never sleep:

```bash
# adjust the command and URL
npm run dev &
until curl -sf http://127.0.0.1:3000/ >/dev/null; do sleep 1; done
```

Record in `run.md`: the command, the port, the URL, and **whether booting resets
shared state**. Check for a test database, a seed script that truncates tables,
or a fixture directory that gets cleared. If it does reset, the orchestrator owns
the server for the whole run and nobody restarts it.

If the app needs a backend as well as a frontend, boot both and give each its own
readiness check.

## 2. Browser and driver

Walkers use `assets/walker-template.cjs`, which needs `@playwright/test`
resolvable from the directory the driver runs in:

```bash
# if the project already has Playwright, run from wherever its node_modules live
cd <dir containing node_modules/@playwright/test>
node <run-dir>/scenarios/NN-slug/driver.cjs > console.log 2>&1

# otherwise, once per machine
npm i -D @playwright/test && npx playwright install chromium
```

Set `APP_URL` and `APP_READY_SELECTOR` at the top of the driver. The ready
selector must be an element that exists only after the app has mounted — a root
container with a stable class or `data-testid`, a nav landmark, or a heading.
`body` is not good enough; it exists before the app does.

If the product supports more than one browser engine, walk the primary engine and
spot-check the other. A disagreement between two supported engines is a product
signal, not flake.

## 3. Seeding state

**Page-scoped, before navigation.** Everything here is per-browser-context and
never collides between parallel walkers:

```js
// storage + cookies, applied before any app code runs
await page.addInitScript(() => {
  localStorage.setItem('onboarded', 'true');
  localStorage.setItem('theme', 'dark');
});
await context.addCookies([{ name: 'locale', value: 'en', url: APP_URL }]);
```

Discover the keys that matter by grepping for `localStorage.setItem`,
`sessionStorage`, `document.cookie`, and feature-flag reads in the app source.
List them in the adapter with their legal values — a walker guessing at flag
names burns its sitting.

**Authenticated start.** Three options, in order of preference:

1. A project seed/factory command that creates a fresh user and prints
   credentials. Best: cheap, isolated, and the walk starts at the product.
2. A saved Playwright storage state, created once per run by logging in through
   the UI and saved with `context.storageState({ path })`, then reused with
   `browser.newContext({ storageState })`. Note that reused storage state means a
   **shared** account — only safe when scenarios do not mutate account-level
   state.
3. Logging in through the UI at the start of every walk. Correct but slow, and it
   spends part of every scenario on the same three screens.

Whichever you use: if the account is shared server state, **one fresh account per
scenario and per reviewer re-drive**. Two walkers mutating one account produce
findings neither can reproduce.

**Determinism.** Freeze what would otherwise jitter the pixels:

```js
await page.clock.install({ time: new Date('2025-01-01T09:00:00Z') }); // Playwright ≥1.45
await page.addInitScript(() => { Math.random = () => 0.42; });
```

Also block third-party requests (analytics, fonts, avatars, maps) so a slow CDN
cannot make a capture unstable or a screenshot non-reproducible:

```js
await page.route('**/*', (route) =>
  new URL(route.request().url()).host.endsWith('127.0.0.1')
    ? route.continue()
    : route.abort());
```

## 4. Reaching non-happy states

All of these use `page.route`, which is page-local and safe under parallel
walkers. Use `{ times: 1 }` when only the first call should be affected.

**Empty state** — boot with a fresh account and no fixture data, or fulfil the
list endpoint with an empty collection:

```js
await page.route('**/api/items*', (r) =>
  r.fulfill({ json: { items: [], nextCursor: null } }));
```

**Loading state** — hold the response open, capture, then release. Keep the
release reachable from cleanup so a failure cannot strand the run:

```js
let release;
const gate = new Promise((r) => { release = r; });
await page.route('**/api/items*', async (route) => { await gate; await route.continue(); });
// navigate, capture the skeleton/spinner state
release();
```

While a write is gated, the UI holds *provisional* state. Do not assert
persistence at that checkpoint — capture the requested state, release, wait for
the persisted value, and only then assert it.

**Error state** — force the status and the payload shape the app actually
handles:

```js
await page.route('**/api/items*', (r) => r.fulfill({ status: 500, json: { error: 'boom' } }));
await page.route('**/api/items*', (r) => r.fulfill({ status: 403, json: { error: 'forbidden' } }));
await page.route('**/api/items*', (r) => r.fulfill({ status: 200, body: 'not json' }));
```

**Offline / degraded** — cut the network *and prove nothing leaked*:

```js
let offline = false;
const leaks = [];
page.on('request', (r) => { if (offline) leaks.push(r.url()); });

offline = true;
await context.setOffline(true);
// drive the offline scenario, capture the degraded UI
await context.setOffline(false);
offline = false;
// `leaks` must be empty for backend origins — that assertion IS the finding
```

**Permission denied** — seed a user without the capability if the project can;
otherwise intercept the capability/session endpoint and strip the permission.
Note in the adapter which one you did: an intercepted permission proves the UI
handles the response, not that the server enforces it.

**Oversized / truncating** — long strings and large collections, injected at the
API boundary:

```js
const long = 'Wolverine'.repeat(20);
await page.route('**/api/items*', (r) =>
  r.fulfill({ json: { items: Array.from({ length: 200 }, (_, i) => ({ id: i, name: long })) } }));
```

**Pagination** — fulfil page 1 with a `nextCursor` and page 2 with the tail, so
the "load more" path and its end state both get walked.

**Slow transitions** — when a scenario must act *during* a pending operation, gate
the specific request as above rather than sleeping. If the app exposes a test
hook for delaying an internal operation, document it here; it is strictly better
than a route gate.

## 5. Inspecting truth

Rendered text is not evidence of persistence — layout inserts line breaks, and a
"Saved" label often precedes the write. Read the persisted value back:

- **API read-back** (works everywhere): a fresh authenticated `fetch` from inside
  the page, or `request.newContext()` outside it, polled until it matches.

  ```js
  await expect.poll(async () => {
    const res = await page.request.get('/api/items/42');
    return (await res.json()).name;
  }).toBe('expected value');
  ```
- **Reload from scratch** for any scenario whose goal includes durability: hard
  reload, or open a new context with the same auth, and confirm the value
  survived.
- **Database or file inspection** if the project exposes a query or test API —
  strongest evidence, and worth adding to the adapter when it exists.

**Waiting without sleeping.** In order of preference: await a locator or an
assertion on visible state; await a specific response
(`page.waitForResponse(...)`); await an app-provided idle hook if one exists;
`page.waitForLoadState('networkidle')` as a last resort — it is a heuristic and
lies under polling or open sockets.

**Known evidence-tool limitations** — record these so no reviewer files them as
product defects:

- `ariaSnapshot()` serializes password input values in plain text even though the
  control is visually masked. **Redact credentials before writing snapshots.**
- It omits some DOM states (`aria-current` among them) and native validation
  bubbles. Verify those DOM attributes directly.
- Chromium can intermittently return a partially painted screenshot while the DOM
  and accessibility tree are unchanged. The walker template's capture guard
  handles this; if a pixel defect contradicts the accessibility evidence,
  re-drive with plain and stability-styled A/B captures before filing.

## 6. Viewports, themes, locales

- Set the viewport per context: `browser.newContext({ viewport: { width, height } })`.
  Walk the product's primary size plus the smallest and largest it claims to
  support — `375x667`, `1280x720`, `1920x1080` are reasonable defaults until the
  project states its own.
- Themes are usually a `localStorage` key plus a `documentElement` attribute, or
  `colorScheme` emulation:
  `page.emulateMedia({ colorScheme: 'dark' })`. Capture the same screen in every
  supported theme — parity breaks are among the most common visual findings.
- Locale: whatever the app reads (a storage key, a cookie, a `?lang=` query, an
  `Accept-Language` header via `newContext({ locale })`). **List only the locales
  the product actually ships.** Catalogs present in the repo but not loaded must
  be named as such, or a reviewer will file missing translations against a
  language that was never released.

## 7. Out-of-band surfaces

Not testable from a browser context; flag, do not attempt: OS credential stores,
native file dialogs and OS-level drag-and-drop from the desktop, real filesystem
event semantics, OS notifications, installers and auto-updaters, code signing,
push delivery, third-party payment/OAuth provider UIs, exact native webview
rendering, hardware sensors and cameras, email and SMS delivery.

Extend this list with whatever this project cannot reach, and copy it into the
run's coverage-gap section.

## 8. Etiquette under parallel walkers

**Page-local, never collides:** init scripts, route interception, cookies and
storage, offline toggles, viewport, theme/locale emulation, clock installation.

**Shared, collides:** the app server, the database, queues, object storage,
outbound email, and anything else behind the port.

So: fresh shared state per walker, and **nobody restarts the server**.
