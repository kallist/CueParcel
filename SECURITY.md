# Security Policy

## Reporting a vulnerability

Please **do not open a public issue** for a security problem.

Use GitHub's private reporting instead:
[**Report a vulnerability**](https://github.com/kallist/CueParcel/security/advisories/new)
(Security → Advisories → Report a vulnerability).

If you cannot use that form, open a minimal issue that says only that you need a
private channel — do not include the details.

Please include:

- what the problem is and why it is a security issue, not a bug,
- the affected version (the extension shows `1.1.0`; check `chrome://extensions`),
- browser and version,
- the smallest reproduction you can manage,
- the impact you believe it has.

**Do not paste private page content, cookies, tokens or session data into a
report.** A description of the shape of the data is enough.

## What to expect

This is a small project maintained in the open. Reports are read and answered as
time allows; there is no paid support and no service-level agreement. If a report
is valid, the fix and the advisory are published together, and you are credited
unless you ask not to be.

## Supported versions

| Version | Supported |
|---|---|
| 1.1.x | ✅ |
| earlier | ❌ |

Only the latest release line is supported. There is no back-porting.

## The security model, stated plainly

Understanding what CueParcel is designed to do makes reports easier to judge.

**What it processes.** CueParcel reads the DOM of the page you are looking at,
when you ask it to. That page is treated as **untrusted input**. Page content is
data, never instructions.

**What runs.** Only CueParcel's own code, shipped inside the extension. There is
no remote code, no `eval`, no `new Function`, no remotely hosted script, and no
dynamically evaluated string. The extension's content security policy is
`script-src 'self'; object-src 'self'`.

**Permissions.** Exactly four:

```text
activeTab   scripting   sidePanel   storage
```

No host permissions, no `<all_urls>`, no `tabs`, no `cookies`, no `history`, no
`bookmarks`, no `webRequest`, no `nativeMessaging`. An extra permission would be
a security regression, and the test suite asserts the exact set.

**Where data goes.** Nowhere. Everything is processed locally. There is no
backend, no analytics, no telemetry, no provider API key, no cloud sync. The
extension makes no network requests of its own.

**Where data is stored.** Captured page content lives in
`chrome.storage.session`, which is cleared when the browser closes, and is never
written to `chrome.storage.local`. The only persistent local preference is a
single boolean recording that the pin onboarding was dismissed.

**Trust boundaries that exist on purpose.**

- Source content and CueParcel-generated instructions are strictly separated in
  the data model and in the output, so a page cannot smuggle text into the part
  of the output that looks like instructions.
- Messages crossing extension contexts are treated as `unknown` and validated;
  nothing is trusted because of its declared type.
- The toolbar badge can only be painted by an extension page, never by page
  content.
- The Side Panel never messages a content script directly and never guesses
  which tab to talk to; it goes through the Service Worker, which forwards to the
  tab recorded in the capture session.

**What is explicitly out of scope.**

- Extraction quality: pages that do not extract (app-like pages, iframes, PDFs,
  shadow-rooted articles) are documented limitations, not vulnerabilities.
- A malicious page attacking *itself*, or a browser extension the user installed
  deliberately.
- Anything that requires the attacker to already control the user's browser
  profile or the unpacked extension files on disk.
- The security of third-party agents you paste CueParcel output into. CueParcel
  prepares text; what you do with it is outside its boundary.

## Verifying the permission set yourself

```bash
npm ci
npm run build
node -e "console.log(require('./dist/manifest.json').permissions)"
# [ 'activeTab', 'scripting', 'sidePanel', 'storage' ]
```

The build validates `dist/` as a structurally valid MV3 artifact, and the test
suite pins the permission list, the CSP, and the absence of host permissions.
