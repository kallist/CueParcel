# CueParcel Edge submission — repository audit

This file records the audit the rest of `docs/store/edge/` depends on. Every row
states the evidence and how it was obtained. Nothing here is inferred from
intent, documentation, or naming.

- **Repository:** `kallist/CueParcel`
- **Branch audited:** `main` at `a854879` ("Merge pull request #5 from
  kallist/chore/github-pages")
- **Released version under submission:** 1.1.0
- **Artifact:** `cueparcel-v1.1.0-chromium.zip`
- **Audit method:** direct file reads, `grep` over `src/` and the built bundles,
  direct ZIP central-directory enumeration, and SHA-256 comparison against
  `SHA256SUMS.txt`.

## 1. Manifest

`public/manifest.json` — read in full (40 lines).

| Requirement | Required | Actual | Result |
|---|---|---|---|
| Manifest version | 3 | `"manifest_version": 3` | PASS |
| Name | `CueParcel` | `"name": "CueParcel"` | PASS |
| Version | `1.1.0` | `"version": "1.1.0"` | PASS |
| Permissions | exactly `activeTab`, `scripting`, `sidePanel`, `storage` | `["activeTab","scripting","sidePanel","storage"]` | PASS |
| `host_permissions` | absent | key not present | PASS |
| `optional_permissions` | (not requested) | key not present | PASS |
| `update_url` | absent | key not present | PASS |
| Side Panel | present | `"side_panel": { "default_path": "sidepanel.html" }` | PASS |
| Background | MV3 service worker | `assets/service-worker.js`, `"type": "module"` | PASS |
| Icons | all four sizes | `icons/icon16.png`, `32`, `48`, `128` — all exist in `dist/` and in the ZIP | PASS |
| Action icons | all four sizes | same four files under `action.default_icon` | PASS |
| CSP | restrictive extension-pages policy | `script-src 'self'; object-src 'self';` | PASS |
| Command | keyboard shortcut declared | `_execute_action` = `Alt+Shift+Y` | PASS |

`package.json` `version` is also `1.1.0`, so `scripts/package-release.mjs` cannot
package a stale `dist/` (it fails on a `package.json` ↔ `dist/manifest.json`
version mismatch).

## 2. Permissions actually used

Each permission is justified by code that would break without it.

| Permission | Evidence | Verdict |
|---|---|---|
| `activeTab` | `src/extension/background/service-worker.ts` captures the tab delivered by `chrome.action.onClicked` — the toolbar gesture is both the trigger and the grant | NEEDED |
| `scripting` | `src/extension/background/capture.ts:73` — `chrome.scripting.executeScript({ target: { tabId }, files: ["assets/content-script.js"] })` | NEEDED |
| `sidePanel` | `src/extension/background/service-worker.ts:19` — `chrome.sidePanel.open({ windowId })`; manifest `side_panel.default_path` | NEEDED |
| `storage` | `chrome.storage.session` in `src/extension/session/session-storage.ts` (capture intent, per-capture outcomes, cart, document cache); `chrome.storage.local` in `src/extension/sidepanel/workbench-ui/toolbar-deps.ts` (one onboarding boolean) | NEEDED |

No permission is requested that has no consumer. No `tabs`, `cookies`,
`history`, `bookmarks`, `webRequest`, `downloads` or `nativeMessaging` is
requested; the download feature deliberately uses a Blob + object URL + anchor
instead of the `downloads` permission (`src/extension/sidepanel/download.ts`).

## 3. Remote code, backend, telemetry, analytics, secrets

| Check | Method | Result |
|---|---|---|
| Remote code / remote JavaScript | `grep` over `src/` for `eval(`, `new Function`, dynamic `import(` → **no matches** | ABSENT |
| Network calls | `grep` over `src/` for `fetch(`, `XMLHttpRequest`, `WebSocket`, `sendBeacon` → **no matches** | ABSENT |
| Outbound URLs in the shipped bundle | `grep` over `dist/` for `https?://` → 7 hits, all non-network: three SVG `xmlns="http://www.w3.org/2000/svg"` declarations and the literal `http://www.w3.org/2000/svg` string in the bundles | NO ENDPOINTS |
| Backend | no server module, no API client, no endpoint constant anywhere in `src/` or `dist/` | ABSENT |
| Telemetry / analytics | no analytics dependency in `package.json`, no analytics package in the bundle, no event-reporting code path | ABSENT |
| API key | the extension never asks for, stores or transmits a credential; nothing in the UI requests one | NOT REQUIRED |
| Secrets | no `.env`, no token, no key material in `src/`, `dist/`, or the ZIP | ABSENT |
| `dangerouslySetInnerHTML` on page content | `grep` over `src/` → the only occurrence is React's own internal renderer code in the vendored bundle, not application code | NOT USED BY CUEPARCEL |

The one `fetch` that appears in `dist/assets/sidepanel.js` is Vite's
module-preload polyfill, which calls `fetch` on same-extension
`link[rel="modulepreload"]` hrefs. It cannot reach the network.

## 4. Storage behaviour (the exact current behaviour)

This is the source of truth for every storage claim in the privacy policy and in
the listing copy. It is deliberately narrow.

| Data | Where | Lifetime | Evidence |
|---|---|---|---|
| Captured page content (derived document strings) | `chrome.storage.session`, one document cache entry per browser window | Until the browser session ends; cleared on browser close | `src/extension/session/document-cache.ts`, `src/extension/capture/capture-result.ts` |
| Capture intent (`LatestCaptureIntent`) and per-capture outcome | `chrome.storage.session`, keyed per window / per `captureId` | Session | `src/extension/session/session-state.ts`, `session-storage.ts` |
| Context Cart contents | `chrome.storage.session`, one key per browser window | Session | `src/extension/session/cart-session.ts` |
| Onboarding preference — **one boolean** | `chrome.storage.local`, key `page2agent.onboarding.pinDismissed.v1` | Persists across restarts until uninstalled | `src/extension/sidepanel/onboarding.ts:46`, `workbench-ui/toolbar-deps.ts:21` |

**Consequence for the listing:** captured page content is session-scoped and is
**never** written to `chrome.storage.local`. The only durable item the extension
writes is a single UI boolean recording that the pin-onboarding card was
dismissed. No permanent storage of page content is claimed anywhere in this pack.

Clipboard and export behaviour:

- **Copy** writes to the system clipboard through `navigator.clipboard.writeText`
  from the user's click (`src/extension/sidepanel/clipboard.ts`). After that, the
  text is in the user's clipboard — the extension does not track or read it.
- **Download** writes a Blob to a file through an anchor element
  (`src/extension/sidepanel/download.ts`). No upload, no server.

## 5. Package audit

`cueparcel-v1.1.0-chromium.zip`, 129,082 bytes.

- **SHA-256 recomputed:**
  `63d57d5464043ed5b3f52ddde37abaa595c59eea798c1a3f91cf07da82b1b4f6`
- **`SHA256SUMS.txt` expects:**
  `63d57d5464043ed5b3f52ddde37abaa595c59eea798c1a3f91cf07da82b1b4f6`
- **Result: MATCH.**

ZIP root contents (central directory, 15 entries):

```text
manifest.json
sidepanel.html
assets/content-script.js
assets/runtime-messages-DigrEKD9.js
assets/service-worker.js
assets/sidepanel.css
assets/sidepanel.js
brand/cueparcel-mark.svg
brand/cueparcel-mark-dark.svg
brand/cueparcel-wordmark.svg
icons/icon16.png
icons/icon32.png
icons/icon48.png
icons/icon128.png
```

| Package requirement | Result |
|---|---|
| `manifest.json` at ZIP root (not nested under `dist/`) | PASS |
| Archived manifest `version` = `1.1.0` | PASS (read out of the ZIP) |
| Archived manifest `manifest_version` = 3 | PASS |
| Archived manifest has no `host_permissions` | PASS |
| Archived manifest has no `update_url` | PASS |
| All icons present | PASS (4/4) |
| Side Panel present | PASS (`side_panel.default_path` = `sidepanel.html`, and `sidepanel.html` is in the archive) |
| Every file the manifest references exists in the archive | PASS |
| No source maps | PASS — zero `.map` files; `scripts/package-release.mjs` lists `.map` in `EXCLUDED` |
| No dev files (no `node_modules`, no `src/`, no tests, no `package.json`, no lockfile) | PASS |
| No secrets | PASS |
| No QA-only permissions | PASS — the archive manifest carries exactly the four production permissions; the E2E harness manifest (`dist-e2e/`, which adds one localhost host permission) is **not** in this archive |
| No remote code | PASS |
| Deterministic build | `scripts/package-release.mjs` fixes ZIP timestamps to the DOS epoch and re-reads the archive afterwards to self-check the manifest root and entry integrity |

**The same bytes are published.** GitHub Release
[`v1.1.0`](https://github.com/kallist/CueParcel/releases/tag/v1.1.0) carries
`cueparcel-v1.1.0-chromium.zip` (129,082 bytes) and `SHA256SUMS.txt`. The released
asset was downloaded and compared with the local artifact: same length, same
SHA-256 (`63d57d54…b4f6`). A reviewer who wants a public copy to compare against the
uploaded package can take that one; it is the artifact this audit and the Edge QA
actually ran against.

## 6. Findings that are NOT blockers but are recorded honestly

**AUDIT-01 (LOW, cosmetic, user-visible in Edge).** Two user-facing strings name
Chrome explicitly:

- `src/extension/sidepanel/onboarding.ts:97` — "Open Chrome's Extensions menu
  (puzzle icon) and pin CueParcel for one-click access."
- `src/extension/sidepanel/onboarding.ts:110` — "Pin CueParcel from Chrome's
  Extensions menu for one-click access."
- `src/extension/sidepanel/workbench-ui/toolbar-deps.ts:7` and
  `src/extension/background/badge.ts:7` — source comments naming Chrome
  (internal comments, not user-visible).

Exactly two user-visible strings in the whole extension name a browser, and both
are the onboarding strings above.

In Microsoft Edge the same puzzle-icon Extensions menu exists, but the wording
names the wrong browser. This is not a certification failure and it does not
affect the manifest or the permissions. It is **not fixed in this change**: fixing
it would alter user-facing extension code and therefore the released 1.1.0
artifact, which this task explicitly forbids. Recorded as a follow-up for 1.1.1.

**AUDIT-02 (INFO).** The E2E harness build `dist-e2e/` intentionally contains one
extra host permission (`http://127.0.0.1/*`) so Playwright can exercise the
capture pipeline without a real toolbar click. It is gated at runtime by
`isE2eHarnessBuild()` in the service worker, and it is never packaged. Anyone
auditing this repository must not confuse `dist-e2e/` with the submission
artifact.

**AUDIT-03 (INFO).** The TaskSpec schema intentionally keeps
`producer.name = "Page2Agent"` as a stable serialized compatibility identifier
(see `docs/BRAND.md`). It is a machine-readable contract value, not stale
branding, and it does not appear as a user-facing product name in the store
listing. It *is* visible in the TaskSpec preview in
`screenshots/04-taskspec.png`, which is correct: that screenshot shows the real
output.

**AUDIT-04 (LOW, test hygiene, does not affect the product).** The E2E suite's
comment at `tests/e2e/extension.spec.ts:106` claims it marks the pin-onboarding
preference as dismissed by writing
`localStorage["page2agent.onboarding.pinDismissed.v1"]`. It does not: the product
stores that preference through `chrome.storage.local` (`onboarding.ts:46` and
`workbench-ui/toolbar-deps.ts:21`), and the extension has no `localStorage`
reference anywhere in `src/extension/sidepanel/`. The write is a no-op, so the
first-run pin card does render in the E2E harness — which the suite tolerates,
because its assertions are scoped to the workbench. Not fixed here: it is an
inaccuracy in an existing test's comment, it does not affect the submitted
package, and changing the E2E suite is outside this submission's scope. Recorded
so the claim is not repeated as fact. The store capture script works around it the
honest way — it dismisses the card through the product's own "Got it" button.

**AUDIT-05 (INFO, cosmetic, present in the store screenshots).** After the
onboarding card is dismissed, the product shows a small persistent pin hint whose
text names Chrome (`onboarding.ts:110`). Because the store imagery was captured
with the real product in that state, the string "Pin CueParcel from Chrome's
Extensions menu for one-click access." appears in the panel half of all five
screenshots. This is honest — it is what the extension currently displays, and the
same defect AUDIT-01 records — but a reviewer will see the wrong browser named in
the imagery. It is the strongest practical argument for fixing AUDIT-01 in 1.1.1
and regenerating the imagery with `npm run assets:store`.

## 7. Verification gates (run for this submission)

The authoritative run below was made in a **clean isolated worktree with LF line
endings** (`core.autocrlf=false`), which is how GitHub's Linux runners check the
repository out. ENV-01 below records the single difference a Windows checkout with
CRLF introduces; ENV-02 records the artifact-ordering requirement.

| Gate | Command | Result |
|---|---|---|
| Clean install | `npm ci` | PASS — 238 packages, 0 vulnerabilities |
| Lint | `npm run lint` | PASS |
| Types | `npm run typecheck` | PASS |
| Unit + integration | `npm run test` | PASS — unit and integration tests all green (run after the release artifact exists; see ENV-02) |
| Build | `npm run build` | PASS — `Build validation PASSED: dist/ is a structurally valid MV3 extension artifact` |
| Extension E2E | `npm run test:e2e` | PASS — 13 passed / 13 |
| Combined gate | `npm run verify:all` | PASS — lint, typecheck, unit tests, build and 13 E2E tests all green |
| Dependency audit | `npm audit --audit-level=low` | PASS — `found 0 vulnerabilities` |
| Whitespace / conflict check | `git diff --check origin/main...HEAD` | PASS — clean |
| Release artifact | SHA-256 of `cueparcel-v1.1.0-chromium.zip` recomputed before and after the whole run | PASS — unchanged, matches `SHA256SUMS.txt` |

**ENV-01 (pre-existing, environment-only, not caused by this submission).** On a
Windows checkout with `core.autocrlf=true`, two unit tests in
`tests/unit/packaging/launch-packaging.test.ts` fail:

- `landing page > GitHub Pages deployment > declares exactly the permissions a
  Pages deployment needs`
- `landing page > GitHub Pages deployment > only redeploys when something the site
  serves changes`

Both parse `.github/workflows/pages.yml` with patterns that require LF
(`/permissions:\n.../` and `/paths:\s*\n(?:\s+-\s.*\n)+/`). This repository has no
`.gitattributes`, and with `core.autocrlf=true` on Windows the working-tree copy of
that file is CRLF, so both patterns fail on carriage returns that the file's own
committed blob (LF) does not contain.

Evidence that this is pre-existing and environmental, not a regression:

1. A detached worktree at `HEAD` (`a854879`) was checked out with `core.autocrlf`
   set to `false` so the file materialised as LF; both tests passed there. The only
   failures in that worktree were five packaging tests that need the release ZIP,
   which is gitignored and therefore absent from a fresh worktree.
2. The two tests do not touch any file this submission changes.

Not fixed here on purpose: the honest fixes are a repository-wide `.gitattributes`
or a rewrite of those two patterns, and both are unrelated to preparing an Edge
submission. Recorded so the failure is not mistaken for a defect in the extension —
it is not: no file in `src/` or `public/` differs from `main`.

**ENV-02 (environmental, ordering).** The packaging tests validate the real release
artifact, and that artifact is gitignored. On a fresh checkout, `npm run test` alone
therefore fails five packaging tests until the artifact exists. `.github/workflows/
ci.yml` runs `npm run package:release` before `npm run test` for exactly this reason,
and the isolated run recorded above was made in that same order. Run in the wrong
order the failure looks like a release-gate failure while being nothing of the kind.

**Hosted CI confirms ENV-01 is Windows-only.** On the branch revisions
`42fd9d667a27`, `99f212fea74f` and `69fd6e5f9c0a`, both GitHub Actions runs
completed green (4 check runs per revision, all `success`):

| Job | Result |
|---|---|
| Lint / typecheck / tests / build | **pass** (35s) |
| Extension E2E (Chromium, headed under xvfb) | **pass** (55s) |

Linux checks the workflow file out as committed (LF), so the two patterns match and
all tests pass there. The Windows failures are a checkout-convention artifact, not a
code defect — which is exactly what the isolated worktree experiment predicted.

That hosted-CI evidence is attributed to the revisions listed above. Refreshing this
branch onto `main` produced a new head, so the refreshed head's own hosted-CI result
is recorded in the pull request description, not claimed here in advance.

## 8. Microsoft Edge real-browser QA

Run against **Microsoft Edge 153.0.4234.32** (`C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe`)
with the extension unpacked **from the released ZIP** — the artifact itself, not
`dist/`. 29 checks, all PASS.

| # | Check | Result |
|---|---|---|
| 1 | Edge loads the extension from the released ZIP | PASS |
| 2 | Edge reports an MV3 runtime (`manifest_version` 3) | PASS |
| 3 | Version is 1.1.0 | PASS |
| 4 | No host permissions reported by Edge | PASS (`null`) |
| 5 | Exactly four permissions | PASS (`activeTab, scripting, sidePanel, storage`) |
| 6 | `side_panel` declared with a real path | PASS |
| 7 | Toolbar action declared (`default_title` CueParcel) | PASS |
| 8 | Keyboard shortcut declared (`Alt+Shift+Y`) | PASS |
| 9 | Edge exposes `chrome.sidePanel.open` and `setPanelBehavior` | PASS |
| 10 | The Side Panel document renders in Edge | PASS |
| 11 | First-run pin card is shown and dismissible | PASS |
| 12 | GitHub Issue capture resolves the Issue adapter on the live page | PASS — `GitHub Issue / GitHub Issue` |
| 13 | Context Lens works on a live page | PASS — `2 areas selected · ~560 selected-content tokens` |
| 14 | Picked sections enter the Context Cart | PASS |
| 15 | Context Cart combines two sources | PASS — 2 sources |
| 16–20 | Learn / Compare / Verify / Build / Fix each build an agent task | PASS (5/5) |
| 21 | TaskSpec renders structured JSON | PASS — `"schemaVersion"` present |
| 22 | Context Receipt lists included/excluded facts | PASS |
| 23 | Copy reports success to the user | PASS — `Copied.` |
| 24 | Download exports a local file | PASS — `abortcontroller-web-apis-mdn-context.md` |
| 25 | After a browser restart `chrome.storage.session` is empty | PASS |
| 26 | The panel reports no capture after a restart | PASS |
| 27 | `chrome.storage.local` holds only the onboarding preference | PASS — `{"page2agent.onboarding.pinDismissed.v1":true}` |
| 28 | The onboarding card does not reappear after a restart | PASS |
| 29 | Toolbar icon visibility is observable (`chrome.action.getUserSettings`) | PASS — `isOnToolbar=false` in a fresh profile, which is the state the onboarding card exists for |

The `chrome.storage.session` / `chrome.storage.local` behaviour checked in items
25–27 is the runtime confirmation of the storage table in §4: session data does not
survive a restart, and the only durable value is the single boolean.

### What the Edge QA did NOT establish

**QA-LIMIT-01: the native Side Panel container was not observed.** A focused spike
drove both Edge's own "toggle side panel" shortcut and CueParcel's `Alt+Shift+Y`
command and polled for a new page target, a `sidepanel.html` target, and a change
in the page viewport width. None occurred: no target appeared and the page stayed
1180 px wide. Playwright cannot drive or observe Edge's browser chrome, so the
harness cannot make the native panel appear. What *is* established is everything
around it — the manifest declaration, Edge exposing the `sidePanel` API, the
service worker calling `chrome.sidePanel.open({ windowId })` inside the action's
user-gesture path, and the panel document rendering correctly as an extension page
at side-panel width. **A human must confirm the native Side Panel visually once
before publishing**, and `certification-notes.md` says so.

**QA-LIMIT-02: the toolbar icon click was not driven.** Playwright cannot click
browser toolbar chrome. Every capture in the QA was triggered through the
extension's declared `_execute_action` command (`Alt+Shift+Y`) via a real CDP key
event, which is the same code path as the toolbar icon and the same `activeTab`
grant. The icon's presence is established through the manifest and
`chrome.action.getUserSettings`, not by clicking it.

**QA-LIMIT-03: a GitHub Pull Request was not captured on a live page.** The PR
adapter is covered by its fixture unit tests, but no live `github.com/.../pull/N`
page was captured in Edge during this QA. Claimed as NOT TESTED rather than
implied.

**QA-LIMIT-04: no outbound-request inspection was performed.** The "no outbound
requests to external services" claim rests on the static audit in §3 (no
application-authored network calls; the bundle's only `fetch` is Vite's
same-extension module-preload helper), not on watching the service worker's Network
panel. A reviewer following `certification-notes.md` can watch that panel; this pack did not.

**QA-LIMIT-05: Edge's own UI surfaces were not painted.** Chromium's extension
management page (`edge://extensions`) and the Extensions menu were not screenshotted
or automated. The full flow ran with the panel loaded as an extension page at the
browser's real side-panel width (512 px), which is the same document Edge displays
in its Side Panel.

## 9. What this audit does NOT establish

- It does not establish that Microsoft Edge accepts the package. Loading the ZIP
  into a clean Microsoft Edge profile is real-browser QA and is reported
  separately in the readiness report, not assumed here.
- It does not establish that the public privacy URL is already live. The URL
  becomes live after `site/privacy.html` is merged to `main` and the Pages
  workflow deploys.
