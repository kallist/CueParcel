# CueParcel — Partner Center privacy answers

Exact answers for the Partner Center submission, with the evidence each answer
rests on and an explicit confidence level. Where the live form's wording cannot be
confirmed from the repository, this file says so rather than guessing a checkbox.

Reference documentation: [Publish a Microsoft Edge extension](https://learn.microsoft.com/en-us/microsoft-edge/extensions/chromium/publish/publish-extension)
(Microsoft Edge Developer documentation).

---

## 1. Single purpose

**Answer — paste verbatim:**

```text
CueParcel lets users deliberately select relevant content from the webpage they
are viewing and package it into structured, source-grounded context for use with
AI tools.
```

**Evidence.** Every feature maps onto this one purpose; see the feature-to-purpose
table in `EDGEADDONS.md`. CueParcel does not summarise, does not call a model, does
not run an agent, does not block ads, does not manage tabs or downloads, and has
no cloud component, so there is no second purpose to declare.

---

## 2. Permission justification

**Answer.** Use `permission-justifications.md`, one block per permission
(`activeTab`, `scripting`, `sidePanel`, `storage`), plus the three declarations:

```text
host permissions: NONE
remote code:      NONE
remote JavaScript: NONE
```

The `storage` justification is the one reviewers scrutinise most, because
"we store your data" is where extensions usually over-claim. CueParcel's answer is
the narrow, source-of-truth version: captured content lives in
`chrome.storage.session` and is gone when the browser closes; the only
`chrome.storage.local` value is a single boolean recording that the pin-onboarding
card was dismissed, and it contains no page content. **Confidence: CONFIRMED**
against `src/extension/session/*` and `src/extension/sidepanel/onboarding.ts`.

---

## 3. Are you using remote code?

**Answer — select "No". Paste verbatim:**

```text
No, I am not using remote code.
```

**Confirmed by repository audit, not by assumption.** All of the following were
checked directly (details and grep results in `AUDIT.md` §3):

| Check | Result |
|---|---|
| `eval(` in `src/` | no matches |
| `new Function` in `src/` | no matches |
| dynamic `import(` in `src/` | no matches |
| `fetch(` / `XMLHttpRequest` / `WebSocket` / `sendBeacon` in `src/` | no matches |
| outbound URLs in `dist/` | only SVG XML namespaces; no endpoints |
| manifest CSP | `script-src 'self'; object-src 'self';` |
| third-party runtime libraries | React 19 and `@mozilla/readability`, both bundled at build time from `node_modules` |

**Confidence: CONFIRMED.**

---

## 4. Data usage

This is the section where guessing would be dishonest, so it is split into what is
confirmed and what must be read off the live form.

### 4a. The confirmed facts about CueParcel's behaviour

These are read from the source and do not depend on any form's wording:

| Behaviour | Confirmed value | Evidence |
|---|---|---|
| Webpage content is accessed | **Yes — only after an explicit user action** (toolbar click or `Alt+Shift+Y`), only for the active tab | `service-worker.ts` `onClicked` path; `AUDIT.md` §2 |
| Where that content is processed | **Entirely locally, inside the extension, in the browser** | no application-authored outbound network calls; the packaged Vite module-preload helper may `fetch` same-extension module assets, and `AUDIT.md` §3 found no external endpoint |
| Is any data transmitted off the device by CueParcel? | **No** | `AUDIT.md` §3 |
| Is any data collected by CueParcel (received and retained off-device)? | **No** | same |
| Is data sold or shared with third parties? | **No.** There is no third party to share with: no server, no SDK, no analytics vendor | `package.json` dependencies; bundle contents |
| Telemetry / analytics | **None** | `AUDIT.md` §3 |
| Retention of captured content | Until the browser session ends (`chrome.storage.session`) | `AUDIT.md` §4 |
| Retention of the one local preference | Until the extension is uninstalled or the user clears extension data | `onboarding.ts:46` |
| User account / identifiers | **None.** No sign-in, no device id, no installation id, no advertising id | no such code path exists |
| Cookies | **Not requested, not read, not written** | no `cookies` permission; no document cookie access in `src/` |
| Clipboard | **Written only on the user's explicit Copy action**; never read | `src/extension/sidepanel/clipboard.ts` |

### 4b. Mapping to Partner Center's checkbox vocabulary

Partner Center presents a list of data categories (the published documentation
describes the step as "Which user data do you plan to collect from users now or in
the future?" — see the [publish-extension documentation](https://learn.microsoft.com/en-us/microsoft-edge/extensions/chromium/publish/publish-extension)).
The form's category names and its exact yes/no framing change over time, so the
mapping below is written so it stays correct either way:

| Data category (as commonly presented) | Selected? | Reason |
|---|---|---|
| Personally identifiable information | **No** | CueParcel has no account, no name, no email, no identifier, and never transmits anything |
| Health information | **No** | No such feature, no such access |
| Financial and payment information | **No** | No payments, no billing, no financial page targeting |
| Authentication information | **No** | No credentials are requested, read, or stored; no API key is used |
| Personal communications | **No** | No mail, chat or messaging integration |
| Location | **No** | Not requested, not derived, not transmitted |
| Web history | **No** | No history permission; CueParcel records no list of visited pages |
| User activity | **No** | No interaction logging, no analytics, no telemetry |
| Website content | **No** | See the important distinction below |

**The one category that needs care — "website content".** A reviewer looking only
at the permissions could reasonably ask whether CueParcel "collects website
content", because it plainly *accesses* it. The honest answer is that access and
collection are different things, and the declaration must not blur them:

- CueParcel **accesses** the content of the page the user explicitly chose, because
  that is the entire feature. This access is disclosed in the permission
  justification and in the privacy policy.
- CueParcel does **not collect** that content in the sense the declaration means:
  it is not received by the developer, not stored off the user's device, not
  retained after the browser session, not aggregated, and not shared with anyone.
  Nothing about it ever reaches a CueParcel-operated system, because no such system
  exists.

If, on the live form, the category's help text defines "collect" as *any* access to
page content including purely local on-device processing, then **Website content
must be marked as collected, and the disclosure should say it is processed locally
and never transmitted.** Do not mark it "No" if the form's own definition says
otherwise — the box that matters is the one the user is actually being asked.

**Confidence: CONFIRMED for every "No" above based on CueParcel's behaviour;
the concrete checkbox set and the form's definition of "collect" must be read on
the live form at submission time. This file states both branches rather than
guessing which one applies.**

### 4c. Related certifications

If the form asks for a certification such as "I certify that the disclosures above
are true", it can be affirmed truthfully: the statements in 4a are read directly
from the submitted package, and the audit that produced them is reproducible with
the commands recorded in `AUDIT.md`.

---

## 5. Privacy policy URL

**Answer — paste verbatim:**

```text
https://kallist.github.io/CueParcel/privacy.html
```

**Source of the page.** `site/privacy.html` in this repository, published by the
GitHub Pages workflow `.github/workflows/pages.yml`, which uploads `site/` as the
deploy root on every push to `main` that touches `site/**`. The same path already
serves the landing page at `https://kallist.github.io/CueParcel/`.

**Timing note, stated honestly.** The URL is not live until this change is merged
to `main` and the Pages workflow completes. Verify the URL resolves **before**
submitting the form; if the Pages deployment has not run yet, the URL will 404 and
the submission will be rejected for a missing policy.

The policy content and the answers above are written from the same audit, so a
reviewer comparing the two finds one consistent story: content is accessed on
request, processed locally, never collected off-device, session-scoped in storage,
written to the clipboard only when the user copies.

---

## 6. Answers that are deliberately not given

- No answer claims a review outcome, an approval, or a publication.
- No answer claims compliance with a regulation (GDPR, CCPA, COPPA) as a legal
  conclusion. The policy describes behaviour; it does not assert a legal status.
- No answer claims a data-processing agreement, a data protection officer, or a
  company entity, because CueParcel is published by an individual maintainer with
  no backend to operate.
