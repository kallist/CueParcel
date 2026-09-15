# CueParcel Privacy Policy

**Applies to:** the CueParcel browser extension, version 1.1.0
**Last updated:** 15 September 2026
**Canonical public URL:** <https://kallist.github.io/CueParcel/privacy.html>
**Source of the published page:** [`site/privacy.html`](site/privacy.html) in this repository

This policy describes what the CueParcel extension actually does. Every statement
below was read out of the extension's source code, and the repository audit that
produced it is published at [`docs/store/edge/AUDIT.md`](docs/store/edge/AUDIT.md)
so anyone can check the claims rather than take them on trust.

---

## 1. The short version

CueParcel reads the webpage you explicitly ask it to read, extracts and
restructures that content **inside your browser**, and copies or downloads the
result for you. It has no server, no account, no analytics and no telemetry.
Nothing it processes is sent anywhere by CueParcel, and captured page content is
not kept after your browser session ends.

The important distinction this policy makes throughout: CueParcel **accesses**
webpage content at your request. It does **not collect** it — nothing is received
by the developer, stored off your device, or shared with anyone.

## 2. What CueParcel is, and what it is not

CueParcel lets you deliberately select relevant content from the webpage you are
viewing and package it into structured, source-grounded context for use with AI
tools.

CueParcel is **not** a chatbot, a summariser, or an agent runner. It does not call
an AI model, does not generate answers, and does not require an API key. It
prepares and copies context; you decide where that context goes.

## 3. What data is accessed, and when

**Access happens only after an explicit action by you.** There is no background
capture, no scheduled capture, no always-on page access, and no capture of any tab
you did not activate.

| Trigger | What is accessed |
|---|---|
| You click the CueParcel toolbar icon, or press the `Alt+Shift+Y` shortcut, while a page is focused | The content of **that active tab only**. This click is also what grants the `activeTab` permission for that page |
| You use **Context Lens** ("Pick Context") on an already-captured page | The visible regions of that same page, so you can click the sections to include |
| You select text on the page and add it | Only the text you selected |

Nothing is read at any other time. CueParcel cannot read a page you have not
activated, and it does not enumerate, list, or visit your tabs or history.

**What is extracted.** CueParcel converts the page into a structured document —
title, headings, paragraphs, lists, code blocks, tables, quotes, and link targets.
Specialised adapters recognise GitHub issues, GitHub pull requests, and technical
documentation pages; everything else goes through a generic article extraction.
The raw page HTML is not retained as a stored artefact: what is kept is the
derived, structured representation.

## 4. Where that data is processed

**Entirely locally, inside your browser, inside the extension.**

- There is no CueParcel backend, server, or API. No CueParcel-operated system
  receives anything, because no such system exists.
- The extension makes **no network requests of its own**. The audit found no
  `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, or dynamic import anywhere
  in the extension's source or its shipped bundle. The only `http` strings in the
  shipped package are SVG XML namespace declarations.
- Extraction, cleaning, Markdown and JSON serialisation, token estimation, and
  receipt generation all run as ordinary in-browser code.
- The extension does **not** contact an AI provider. If you paste the result into
  an AI tool later, that is your action, under that tool's own privacy policy.

## 5. Does captured content leave the browser?

**Not by CueParcel. Never.** CueParcel does not transmit, upload, sync, or report
your content — there is no channel in the code for it to do so.

Three ways content moves, all of them deliberate and all of them yours:

1. **Copy.** When you press Copy, the packaged text is written to your system
   clipboard. From that moment it is in your clipboard, under your control and your
   operating system's rules. CueParcel never reads your clipboard.
2. **Download.** When you press Download, the text is saved to a local file through
   an object URL created in the page. CueParcel does not request the `downloads`
   permission and does not track what you saved.
3. **Your subsequent paste.** If you paste the copied text into another
   application — an AI assistant, an editor, a ticket — the content goes wherever
   that application sends it. That transfer is not performed by CueParcel and is
   governed by that application's privacy policy, not this one.

## 6. Storage

Storage is the part of a policy that should be exact, so here is the complete
list of what CueParcel writes and where.

| What | Where | How long |
|---|---|---|
| Your captured document for a window — the derived, structured content and the strings shown in the panel | `chrome.storage.session` (at most **one captured document per browser window** is cached) | Until the browser session ends. Cleared when you close the browser |
| Capture bookkeeping: capture id, tab id, URL, title, capture time, and status | `chrome.storage.session` | Until the browser session ends |
| Your **Context Cart** — the sources you collected for the current task | `chrome.storage.session`, one entry per browser window | Until the browser session ends |
| **One boolean** recording that you dismissed the "pin CueParcel" onboarding card, under the key `page2agent.onboarding.pinDismissed.v1` | `chrome.storage.local` | Until you uninstall CueParcel or clear its extension data |

That is the whole list. In particular:

- **Captured page content is never written to `chrome.storage.local`.** It is not
  persisted to disk as part of normal use.
- There is **no cloud sync**, no remote backup, and no export history.
- There is **no log of pages you visited** and no record of which sites you used
  CueParcel on.
- The only durable value the extension stores is a single UI preference boolean
  containing no page content.

If you uninstall the extension, the browser removes both stores. If you want the
stored session data gone sooner, close the browser (which clears
`chrome.storage.session`), or clear the extension's data from your browser's
extension settings.

## 7. Clipboard and export behaviour

- **Copy** writes the packaged context to the system clipboard, and only when you
  press the button. CueParcel never reads the clipboard, and it is not a clipboard
  manager.
- **Download** saves the packaged context as a local file (Markdown or TaskSpec
  JSON) using a browser-generated object URL. The URL is revoked immediately after
  the download starts.
- Neither action sends anything over the network.

What happens to the copied or downloaded text **after** that point is outside
CueParcel's control and outside this policy.

## 8. Telemetry, analytics, and tracking

**None.** CueParcel contains:

- no analytics service or SDK,
- no telemetry or crash reporting,
- no advertising or tracking code,
- no usage counters, feature flags, or A/B testing,
- no unique identifier of any kind (no installation id, no device id, no
  advertising id),
- no cookies — the extension does not request the `cookies` permission, does not
  read document cookies, and does not set any.

The extension has no mechanism to measure you, so nothing about your use of it is
measured.

## 9. Backend and third parties

- **Backend: none.** There is no server component to this product, hosted or
  self-hosted.
- **Third-party sharing: none.** No data is sold, rented, traded, disclosed, or
  transferred to any third party, because no data reaches the developer or any
  service operated on the developer's behalf.
- **Third-party code.** The extension bundles open-source runtime libraries — React
  and `@mozilla/readability` — at build time. They are compiled into the submitted
  package and run locally. They make no network requests, and being bundled means
  there is no remotely loaded code of any kind.
- **Sale of data: none.** Your data is not a product here; nothing is monetised
  through it.
- **No affiliation.** CueParcel is an independent open-source project. It is not
  affiliated with, endorsed by, or acting on behalf of any AI provider, browser
  vendor, or hosting service.

## 10. Retention

| Data | Retention |
|---|---|
| Captured page content, capture bookkeeping, Context Cart | Browser session only; gone when the browser closes |
| The onboarding dismissal boolean | Until you uninstall the extension or clear its data |
| Anything on a server | Nothing, because no server exists |
| Backups, archives, analytics history | None exist |

The developer holds no copy of your content at any point, so there is nothing for
the developer to retain, delete, or disclose on request.

## 11. Permissions, and why each one is needed

CueParcel requests exactly four permissions. It requests **no host permissions**:
the submitted manifest has no `host_permissions` key, so the extension cannot read
any site until you activate it on that site.

| Permission | Why CueParcel needs it |
|---|---|
| `activeTab` | To read the current page **only after** you click the toolbar icon or press the shortcut. This is what makes capture possible without broad site access |
| `scripting` | To inject CueParcel's own packaged content script into the page you activated, which performs extraction and draws the Context Lens selection overlay |
| `sidePanel` | To show CueParcel's interface in the browser's Side Panel beside the page, so your source stays visible while you work |
| `storage` | To keep the capture and the Context Cart for the current browser session, so a page navigation or a service-worker restart does not lose your work |

CueParcel does **not** request and does not use: `<all_urls>`, `tabs`, `cookies`,
`history`, `bookmarks`, `webRequest`, `downloads`, `nativeMessaging`, `clipboardRead`,
or any other permission. It does not run code fetched from the internet: no remote
code, no remote JavaScript, no `eval`, no `new Function`, and no dynamically loaded
script.

## 12. Security posture

- **Page content is treated as untrusted input.** CueParcel separates *source
  content* from *CueParcel-generated instructions* in its data model and in every
  output, so instructions that happen to appear inside a webpage cannot be presented
  as if CueParcel wrote them.
- Un-sanitised page HTML is never injected into the extension's privileged panel.
- Data crossing between the page, the extension's service worker, and the panel is
  validated before use rather than trusted by type.
- The extension's content security policy is `script-src 'self'; object-src
  'self';`, which blocks remotely hosted scripts.

This is a description of how the product is built. It is **not** a security
certification, and CueParcel has not undergone a formal third-party security audit.

## 13. Children

CueParcel is a general-purpose productivity tool. It is not directed at children,
does not knowingly collect information from anyone, and has no account, profile, or
communication feature.

## 14. Your choices and control

- **Do not activate it.** If you never click the icon, CueParcel never reads a page.
- **Capture only what you want.** Context Lens exists so you can include the
  sections you mean and leave everything else out.
- **Inspect before you copy.** The Context Receipt lists what is in the package and
  what is not.
- **Close the browser** to clear all session-stored capture data, or clear the
  extension's data to remove the stored preference.
- **Uninstall** to remove everything CueParcel ever stored locally.

## 15. Changes to this policy

If a future version of CueParcel changes what it accesses, stores, or transmits,
this policy will be updated before that version is released, the "Last updated" date
above will change, and the change will be visible in this repository's history.
CueParcel's principle is that the policy describes the code; if the code changes,
the policy changes with it.

## 16. Contact

Questions, corrections, or a challenge to any claim on this page:

- **Issue tracker:** <https://github.com/kallist/CueParcel/issues>
- **Repository:** <https://github.com/kallist/CueParcel>

The claims in this policy are checkable. The audit behind them, including the exact
files inspected and the searches run, is published at
[`docs/store/edge/AUDIT.md`](docs/store/edge/AUDIT.md).

---

### Verifying this policy

A summary of the audit that this policy is based on:

| Claim in this policy | How it was verified |
|---|---|
| Access requires an explicit user action | The extension's only capture path begins at `chrome.action.onClicked` |
| No network requests | No `fetch`, `XMLHttpRequest`, `WebSocket`, `sendBeacon`, or dynamic import exists in the extension source or shipped bundle |
| No remote code | No `eval`, no `new Function`, no remotely loaded script; CSP is `script-src 'self'` |
| No analytics or telemetry | No analytics dependency, no reporting code path |
| Session-scoped capture storage | Captured content is written to `chrome.storage.session` only |
| Exactly one durable local value | One boolean key, `page2agent.onboarding.pinDismissed.v1`, in `chrome.storage.local` |
| Four permissions, no host permissions | The submitted `manifest.json`, verbatim |
