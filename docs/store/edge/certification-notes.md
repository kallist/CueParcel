# CueParcel 1.1.0 — notes for certification

Paste the "Notes for certification" section below into the Partner Center
submission box. It is written to be read by a reviewer who has never seen the
extension and has limited time.

---

## Notes for certification (paste this text)

```text
CueParcel — notes for the reviewer

WHAT IT IS
CueParcel lets a user pick the relevant parts of the page they are reading and
package them into structured, source-grounded context for an AI tool. The user
copies or downloads the result themselves. CueParcel does not call a model, does
not summarise, does not run an agent, and has no server.

WHAT YOU NEED TO TEST IT
Nothing. No account, no sign-in, no API key, no backend, no configuration, no
network connection beyond loading the test page itself. Install and use.

The submitted package is also published at
https://github.com/kallist/CueParcel/releases/tag/v1.1.0 — the asset
cueparcel-v1.1.0-chromium.zip there is byte-identical to the uploaded one
(SHA-256 63d57d5464043ed5b3f52ddde37abaa595c59eea798c1a3f91cf07da82b1b4f6), so you
can compare the uploaded package against a public copy if that helps.

PERMISSIONS AND WHY THEY BEHAVE THE WAY THEY DO
- activeTab: CueParcel reads a page ONLY after the user activates the extension on
  that page. There is no background access, no scheduled access, and no access to
  any other tab. This is why the extension appears to do nothing until you click
  its toolbar icon — that click is what grants access to the page. Please do not
  expect content to be captured without it.
- scripting: injects CueParcel's own packaged content script (assets/
  content-script.js, inside the submitted ZIP) into the page you activated. This
  powers both the extraction and the on-page section picker. No remote code, no
  eval, no third-party script.
- sidePanel: the Side Panel is CueParcel's only interface. There is no popup.
- storage: captured content is kept for the current browser session only
  (chrome.storage.session) and is gone when the browser closes. The only value
  written to permanent local storage is a single boolean recording that the
  "pin CueParcel" onboarding card was dismissed. Captured page content is never
  written to chrome.storage.local.

TEST FLOW (about 4 minutes)

1. Install CueParcel. If the toolbar icon is hidden behind Edge's Extensions menu
   (puzzle icon), pin it: CueParcel's entry point is the toolbar action, so the
   icon must be reachable. The extension shows a one-time in-panel card explaining
   this, because an extension cannot pin itself; newer builds of the card say
   "Extensions menu" rather than naming a specific browser.
2. Open a normal HTTPS page. Recommended stable page for a GitHub Issue test:
   https://github.com/HKUDS/RAG-Anything/issues/348
   Any ordinary article page also works for the generic path.
3. Click the CueParcel toolbar icon (or press Alt+Shift+Y).
4. The Side Panel opens beside the page and shows the captured source: title, URL,
   capture time, adapter type, and an estimated packaged size in tokens.
5. Two ways to choose content:
   a. "+ Add to Context" adds the whole captured document to the Context Cart.
   b. "Pick Context" turns on Context Lens on the page: meaningful regions
      (headings, paragraphs, lists, code blocks, tables, quotes) get outlines.
      Click the regions you want — they highlight as selected, and a live estimate
      in the panel updates. Press "Done" in the on-page dock to finish.
      You can also select text with the mouse and add that selection as a region.
6. The picked regions appear in the panel with an "Add to Context" button. Add
   them. The Context Cart now lists each source with its own URL and title.
7. Choose what to do with the context: Learn / Compare / Verify / Build / Fix.
   Compare needs at least two sources, so add a second page to the cart first if
   you want to test it; the panel disables it and says so otherwise.
8. Inspect the output in the three preview tabs: "Agent" (an agent-ready prompt),
   "Markdown" (a readable document), "TaskSpec" (structured JSON describing the
   task, the sources, verified source facts, and the recipe).
9. Read the Context Receipt at the bottom: it lists the sources in the package,
   what each contributes, the source-versus-generated split, the estimated size,
   and what is NOT included. This is the "source-grounded" guarantee made visible.
10. Use Copy (or Download) to take the result. Copy writes to the system clipboard
    through the user's own click; Download writes a local file. Nothing is sent
    anywhere by the extension.

WHAT YOU WILL SEE HONESTLY
- On restricted pages (edge:// pages, the Edge Add-ons gallery, the new tab page)
  CueParcel returns a clear "this page cannot be captured" message instead of
  failing silently. That is intended behaviour.
- If a page has no extractable content, CueParcel says no content was found rather
  than producing an empty package.
- If a capture is superseded by a newer capture, only the newest result is shown.
- Every size number shown is an estimate from a local heuristic, and each surface
  labels which stage it measures. No model tokenizer equivalence is claimed.

WHAT THE EXTENSION DELIBERATELY DOES NOT DO
- No remote code. Everything that runs is inside the submitted package.
- No host permissions. The submitted manifest has no host_permissions key.
- No analytics, no telemetry, no crash reporting, no advertising.
- No account, no cloud sync, no data transmission of any kind.
- No summarisation or model calls: CueParcel prepares and copies context; it does
  not generate AI answers.

PRIVACY POLICY
https://kallist.github.io/CueParcel/privacy.html

SUPPORT
https://github.com/kallist/CueParcel/issues
```

---

## Why each part of this note exists

| Note section | Reviewer question it pre-empts |
|---|---|
| "No account, API key or backend" | "Where do I get credentials to test this?" |
| The `activeTab` explanation | "The extension did nothing when I loaded a page." The extension cannot act without a user gesture; a reviewer who does not click will see an idle extension |
| The pinning note | "I cannot find the extension's UI." Edge hides new extensions behind the Extensions menu, and an extension cannot pin itself |
| The restricted-page and no-content notes | "It showed an error / an empty result — is that a bug?" |
| The "does not do" list | "Does this thing send my test page somewhere?" |
| The stable GitHub Issue URL | A reproducible page whose structure exercises the GitHub Issue adapter |

## Link between the notes and the reviewable evidence

| Claim in the notes | Where the reviewer can verify it |
|---|---|
| No host permissions | The manifest inside the uploaded ZIP: `permissions` has four entries and there is no `host_permissions` key |
| No remote code | Same manifest: CSP is `script-src 'self'; object-src 'self';` |
| Session-only storage of page content | Behaviour: capture a page, restart Edge, and the capture is gone and the panel says the structured document is unavailable |
| Only one permanent local value | Behaviour: capture a page, restart Edge, and no page content returns |
| No network transmission | Watch the extension's service worker in `edge://extensions` (Developer mode → service worker → Network) while performing any flow: there are no outbound requests |
| The five recipes exist as described | The recipe grid in the Side Panel's "What do you want to do?" section |

## What is NOT claimed in these notes

- No claim that the extension has been reviewed, approved or published.
- No claim about test counts, coverage percentages, or CI status.
- No claim that every page on the web extracts perfectly. Extraction quality
  varies with page structure, and the extension reports honestly when it finds
  nothing.
- No invitation to test the Chrome-specific onboarding wording: as recorded in
  `AUDIT.md` (AUDIT-01), two onboarding strings in 1.1.0 name Chrome while running
  in Edge. The feature they describe — pinning from the Extensions menu — is
  identical in Edge, but the wording mismatch is a known cosmetic defect in this
  release, scheduled for the next patch. It affects no permission, no manifest
  field, and no behaviour. The same string is visible in the panel in all five
  store screenshots, because those were captured from the real product.

## What was verified before submitting, and what a reviewer should still confirm

The full matrix is in `AUDIT.md` §7 (gates) and §8 (Microsoft Edge 153 real-browser
QA, 29 checks). Everything the reviewer is asked to do above was also done on this
machine against the extension unpacked from the submitted ZIP, except the three
items below. They are called out so the reviewer knows exactly where the gaps are:

1. **The native Side Panel container.** The panel document was verified at the
   browser's real side-panel width as an extension page; automation could not make
   Edge draw its own panel container, so that one visual must be confirmed by a
   person once. If the panel does not appear when you click the toolbar icon, that
   is a real defect and not a harness artifact — the extension calls
   `chrome.sidePanel.open({ windowId })` directly inside the action click.
2. **Clicking the toolbar icon itself.** Capture was driven through the declared
   `Alt+Shift+Y` command, which shares the `_execute_action` path and the
   `activeTab` grant. The icon's presence is declared in the manifest and reported
   by `chrome.action.getUserSettings`.
3. **A live GitHub Pull Request page.** The PR adapter has unit coverage against
   fixtures; no live PR page was captured during this preparation. If the PR path
   matters to your review, `https://github.com/kallist/CueParcel/pulls` is a
   convenient public PR list to open one from.
