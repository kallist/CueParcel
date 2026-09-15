# CueParcel — permission justifications for Microsoft Edge Add-ons review

CueParcel requests exactly four permissions and **no host permissions**. Each
justification below states what the permission is for, where in the code it is
used, and what the extension does when the user has not granted it.

Submitted manifest permission array, verbatim:

```json
"permissions": ["activeTab", "scripting", "sidePanel", "storage"]
```

---

## activeTab

> Accesses the current webpage only after an explicit user interaction so
> CueParcel can capture the content the user has chosen to work with.

**Detail for reviewers.** CueParcel has no passive page access. The extension's
only entry point is the toolbar action (`chrome.action.onClicked`) or its declared
keyboard shortcut `Alt+Shift+Y`. Clicking the action is what grants `activeTab`,
and the tab object that Chrome hands to `onClicked` is captured directly — the
extension never enumerates tabs, never guesses a target, and never captures a tab
the user did not activate.

**Code.** `src/extension/background/service-worker.ts` (the `onClicked` listener
and `handleActionClick`), `src/extension/background/action-capture.ts`,
`src/extension/background/capture.ts`.

**Without it.** If the user has not clicked, nothing happens at all. Capture is
also unavailable on restricted pages (`chrome://`, the extension gallery, the new
tab page and similar): the extension detects the restricted URL and returns a
structured `RESTRICTED_PAGE` result instead of failing silently.

**Why `activeTab` and not `<all_urls>`.** The product is about a page the user is
looking at *right now*, on purpose. There is no feature that needs to read a page
the user has not opened and activated, so broad host access would be an
unjustified privacy cost.

---

## scripting

> Injects CueParcel's packaged content script and Context Lens into the
> user-selected active page for extraction and visual section selection.

**Detail for reviewers.** `chrome.scripting.executeScript` is used exactly once,
to inject the extension's own packaged file `assets/content-script.js` — which is
inside the submitted ZIP — into the tab the user just activated.

```js
await chrome.scripting.executeScript({
  target: { tabId },
  files: ["assets/content-script.js"],
});
```

**Code.** `src/extension/background/capture.ts:73`. The injected content script
(`src/extension/content/content-script.ts`, `content-capture.ts`) reads the
page's structure and returns a structured document; it is what makes **Context
Lens** possible, because the click-to-select regions must be drawn on the page
itself.

**What is injected.** Only code packaged in the extension. No string is evaluated
(`eval`, `new Function` and remote script tags are absent — see `AUDIT.md` §3), no
code is fetched, and no third-party script is inserted.

**Without it.** Page capture is impossible: the extraction and the visual section
picker both run in the page context.

---

## sidePanel

> Provides CueParcel's primary interface in Microsoft Edge's Side Panel so the
> user can inspect and package context while keeping the source webpage visible.

**Detail for reviewers.** The Side Panel *is* the product surface — there is no
popup and no options page. Keeping the panel next to the page is the whole point:
the user picks sections of the page with Context Lens and immediately sees them
land in the Context Cart in the panel.

**Code.** `public/manifest.json` declares
`"side_panel": { "default_path": "sidepanel.html" }`; the service worker opens the
panel inside the action's user-gesture path with
`chrome.sidePanel.open({ windowId })`
(`src/extension/background/service-worker.ts:19`).

**Behaviour note.** CueParcel explicitly calls
`chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: false })` so the
action click performs a capture and opens the panel as a single deliberate
gesture, rather than relying on Edge's default open-on-click behaviour.

**Without it.** There would be no way to show the workbench, the cart, the recipe
choice, or the Context Receipt.

---

## storage

> CueParcel stores captured content for the current browser session only, so the
> Side Panel can survive a page navigation or a service-worker restart without
> losing the user's work. It never persists captured page content to disk.

**Exact current behaviour, read from the source:**

| What is stored | API and scope | Lifetime | Evidence |
|---|---|---|---|
| Captured document (derived, already-extracted strings — not the page's raw HTML) | `chrome.storage.session`, at most **one document cache entry per browser window** | Until the browser session ends; cleared when the browser closes | `src/extension/session/document-cache.ts`, `src/extension/capture/capture-result.ts` |
| Latest capture intent and per-capture outcome (capture id, tab id, url, title, timestamp, status) | `chrome.storage.session`, keyed per window and per `captureId` | Session | `src/extension/session/session-state.ts`, `src/extension/session/session-storage.ts` |
| Context Cart items | `chrome.storage.session`, one key per browser window | Session | `src/extension/session/cart-session.ts` |
| Onboarding preference — **a single boolean** (`page2agent.onboarding.pinDismissed.v1`) recording that the "pin CueParcel" card was dismissed | `chrome.storage.local` | Persists across browser restarts until the extension is uninstalled | `src/extension/sidepanel/onboarding.ts:46`, `src/extension/sidepanel/workbench-ui/toolbar-deps.ts:21` |

**What this justification deliberately does NOT claim.** Captured page content is
**not** permanently stored, and this document does not claim that it is. The only
durable value the extension writes is one UI boolean with no page content in it.
There is no cloud storage, no sync, no export history, and no log of visited pages.

**Without it.** Every service-worker suspension or panel reload would lose the
capture, the cart and the user's selections — the MV3 service worker is not a
durable process, so session storage is the minimum mechanism that keeps the
workbench coherent.

---

## Declarations that accompany the permission answers

```text
host permissions: NONE
remote code:      NONE
remote JavaScript: NONE
```

**Host permissions — NONE.** `host_permissions` is absent from the submitted
manifest, and `optional_host_permissions` is absent too. CueParcel cannot read any
site until the user activates the extension on that site through `activeTab`.

**Remote code — NONE.** Every line of JavaScript that runs is inside
`cueparcel-v1.1.0-chromium.zip`. The manifest's content security policy is
`script-src 'self'; object-src 'self';` — a remote script would be blocked by the
browser even if the extension tried to load one, and the audit found no attempt to
do so.

**Remote JavaScript — NONE.** No `eval`, no `new Function`, no dynamically
constructed script element, no dynamic `import()` of a URL, and no remotely hosted
library. The bundled runtime is React 19, `@mozilla/readability`, and CueParcel's
own modules — all compiled into the package at build time.

## Reviewer checklist for permissions

| Question a reviewer may ask | Where the answer is verifiable |
|---|---|
| Is any permission unused? | `AUDIT.md` §2 maps each of the four to a concrete call site |
| Why no host permissions? | The product only needs the tab the user just activated |
| Does the extension read pages in the background? | No listener or timer captures anything; capture starts only from `chrome.action.onClicked` |
| Does injected code come from the network? | No — `files: ["assets/content-script.js"]`, a packaged file |
| Is page content written to disk? | No — `chrome.storage.session` only; the single `chrome.storage.local` key is a boolean preference |
| Is there any analytics or telemetry? | None — see `AUDIT.md` §3 |
