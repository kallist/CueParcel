# CueParcel — Microsoft Edge Add-ons cover sheet

Field-by-field entry reference for Partner Center. Companion documents:
`permission-justifications.md`, `privacy-answers.md`, `certification-notes.md`,
`AUDIT.md`.

## Submission identity

| Partner Center field | Value |
|---|---|
| Extension name | CueParcel |
| Version submitted | 1.1.0 |
| Package | `cueparcel-v1.1.0-chromium.zip` |
| Package SHA-256 | `63d57d5464043ed5b3f52ddde37abaa595c59eea798c1a3f91cf07da82b1b4f6` |
| Manifest version | 3 |

## Single purpose

Partner Center asks for the extension's single purpose. CueParcel's answer:

> CueParcel lets users deliberately select relevant content from the webpage they
> are viewing and package it into structured, source-grounded context for use with
> AI tools.

This is deliberately narrow, and every feature is a supporting part of that one
purpose rather than a second purpose:

| Feature | How it serves the single purpose |
|---|---|
| **Context Lens** | Selecting which parts of the current page are the relevant content — the "deliberately select" half of the purpose |
| **Context Cart** | Combining several selected sources into one package — still packaging, not a new capability |
| **Recipes** (Learn / Compare / Verify / Build / Fix) | Choosing what the packaged context is *for* — it disciplines the package rather than adding a service |
| **TaskSpec** | The machine-readable form of the same package |
| **Context Receipt** | Inspecting the package before it is used — the "source-grounded" guarantee made visible |

CueParcel does **not** summarise, does not call a model, does not run an agent,
does not translate, does not block ads, does not manage tabs, does not synchronise
to a cloud, and does not require an account. There is no second purpose to
declare.

## Declaration summary

| Partner Center question | Answer |
|---|---|
| Are you using remote code? | **No, I am not using remote code.** |
| Host permissions | **None.** The submitted manifest has no `host_permissions` key. |
| Permissions requested | `activeTab`, `scripting`, `sidePanel`, `storage` |
| Does the extension require an account, sign-in, or API key? | **No.** |
| Does the extension work offline? | **Yes.** Capture, extraction, packaging, copy and download are entirely local. |
| Privacy policy URL | `https://kallist.github.io/CueParcel/privacy.html` |

## Store listing properties

| Property | Value | Why |
|---|---|---|
| Category | **Productivity** | The product packages working context for the user's own tools; it is not a developer-tool console |
| Language 1 | English (`en`) | `description-en.md` |
| Language 2 | Simplified Chinese (`zh-CN`) | `description-zh-CN.md` |
| Website | `https://kallist.github.io/CueParcel/` | The project landing page published from `site/` |
| Support contact | `https://github.com/kallist/CueParcel/issues` | Preferred form: the repository issue tracker, where bugs and questions actually get answered in public |
| Mature content | **No** | CueParcel reads whatever page the user is on, but it ships no adult, violent or gambling content of its own, and it has no user-generated content surface, no chat, and no feed |
| Search terms | `context`, `AI context`, `webpage capture`, `Markdown`, `prompt`, `research`, `source-grounded` | Descriptive terms that match what the product does; not a keyword list |

## Assets

All eight files exist and were produced by `scripts/capture-store-assets.mjs` from
the real product. Run `npm run build && node scripts/capture-store-assets.mjs` to
regenerate them.

| Asset | Specification | File | What it shows |
|---|---|---|---|
| Logo | 300 × 300, transparent | `promo/logo-300.png` | The approved mark, rasterised from `public/brand/cueparcel-mark.svg` |
| Screenshot 1 | 1280 × 800 | `screenshots/01-context-lens.png` | Context Lens live on a real MDN page: three regions picked on the page, the pick summary in the panel |
| Screenshot 2 | 1280 × 800 | `screenshots/02-context-cart.png` | The Context Cart holding three sources — a lens-picked section, the MDN page, and a real GitHub Issue — with the Issue marked primary |
| Screenshot 3 | 1280 × 800 | `screenshots/03-github-issue-fix.png` | The real GitHub Issue page beside the panel with the **Fix** recipe selected and the generated `fix_issue` task |
| Screenshot 4 | 1280 × 800 | `screenshots/04-taskspec.png` | The **TaskSpec** tab: structured JSON for the same package |
| Screenshot 5 | 1280 × 800 | `screenshots/05-context-receipt.png` | The **Context Receipt** with details expanded: included and excluded rows per source |
| Promotional tile (small) | 440 × 280 | `promo/promo-440x280.png` | Mark + tagline + a capture of the real Side Panel |
| Promotional tile (large) | 1400 × 560 | `promo/promo-1400x560.png` | The same lockup at large size |

The logo is the approved CueParcel mark — an open **C** with a single Cue Blue cue
dot in its opening. It is **not** redesigned for this submission: it is rasterised
from the approved geometry in `scripts/generate-brand-assets.mjs`. No generated or
illustrated UI appears anywhere in this pack.

### How to check the screenshots instead of trusting them

`screenshots/EVIDENCE.json` is written by the same script that takes the pictures.
For each screenshot it records the on-screen text of both halves at the moment of
capture, plus the pages used. Read it to confirm that, for example,
`03-github-issue-fix.png` really shows the task `Target repository:
HKUDS/RAG-Anything` and a source card badged `GitHub Issue`.

The capture run also refuses to produce a screenshot that would misrepresent the
product. It aborts if:

- the loaded build declares any host permission (store imagery must come from the
  production build, which has none);
- a page capture does not resolve the adapter the screenshot claims (a "GitHub
  Issue" shot whose source card said "Web Page" is a false claim);
- the Context Cart holds fewer than two sources for the cart screenshot;
- the generated task does not target the GitHub Issue repository;
- the Fix recipe does not become the selected recipe;
- the TaskSpec preview contains no TaskSpec document;
- the Context Receipt has no included/excluded detail to show;
- the lens selection does not register on the page.

Pages used: `https://developer.mozilla.org/en-US/docs/Web/API/AbortController`
(technical documentation / generic article path) and
`https://github.com/HKUDS/RAG-Anything/issues/348` (GitHub Issue path). Both are
real pages loaded over the network; if either cannot be reached the run stops
rather than substituting a fixture and captioning it as the real site.

### Honest limitations of these captures

- The two halves are composed side by side into the 1280 × 800 canvas. The panel
  half is the extension's real `sidepanel.html` at the browser's real side-panel
  width (512 px); in normal use Microsoft Edge draws it in its native Side Panel
  container rather than as a tab. The capture is of the same document at the same
  width.
- Page capture in the pipeline is triggered with the extension's declared
  `Alt+Shift+Y` command through a real key event, because Playwright cannot click
  browser toolbar chrome. That is the same code path as the toolbar icon
  (`_execute_action`), including the `activeTab` grant.
- The screenshots are English-only. The zh-CN listing is a localised text listing,
  not a separately captured UI.
- The capture timestamps visible in the panel (`2026年9月15日 23:20`) are real
  values from the run that produced these files. They are not hand-edited, and
  regenerating the imagery changes them.

## Entering the submission (order of operations)

1. Partner Center → **Microsoft Edge** programme → **Extensions** → **New
   extension**.
2. Upload `cueparcel-v1.1.0-chromium.zip`.
3. **Properties**: name, category *Productivity*, website, support URL, mature
   content *No*, privacy policy URL as above.
4. **Store listing** → English: short description and body from
   `description-en.md`; upload the logo, the five screenshots and both promotional
   tiles.
5. **Store listing** → add the Simplified Chinese language and paste
   `description-zh-CN.md`.
6. **Privacy / data usage**: follow `privacy-answers.md` exactly, including its
   "verify against the live form" notes.
7. **Notes for certification**: paste `certification-notes.md` verbatim.
8. Do **not** publish. This pack stops at the point where a human reviewer at
   Microsoft — and the account owner — are the only remaining actors.

## Explicitly out of scope

- Chrome Web Store listing, assets and checklist. Not prepared here.
- Any change to the 1.1.0 release artifact, version number, or extension source.
- Any claim of a completed Partner Center submission, review outcome, or
  publication.
