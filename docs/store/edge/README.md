# CueParcel — Microsoft Edge Add-ons submission pack

Everything needed to submit **CueParcel 1.1.0** to Microsoft Edge Add-ons through
Partner Center. Nothing in this directory is a Chrome Web Store asset.

## Files

| File | Purpose |
|---|---|
| `AUDIT.md` | The repository audit this pack is based on, with every claim's evidence and every open caveat |
| `EDGEADDONS.md` | Cover sheet: product identity, single purpose, permission summary, properties, and the Partner Center field-by-field entry list |
| `permission-justifications.md` | Reviewer-grade justification for each of the four permissions, plus the host-permission and remote-code declarations |
| `privacy-answers.md` | Exact answers for the Partner Center privacy sections, and the data-usage checkbox mapping with its confidence level |
| `certification-notes.md` | Reviewer test instructions, the stable test page, and the honest list of what a reviewer cannot do in an automated run |
| `description-en.md` | English listing body, with character count and the honesty constraints applied |
| `description-zh-CN.md` | Simplified Chinese localised listing body |
| `screenshots/` | Five 1280 × 800 store screenshots captured from the real product UI, plus `EVIDENCE.json` recording the on-screen text of every capture |
| `promo/` | The 300 × 300 logo and both promotional tiles, built from the approved CueParcel brand assets |

## Regenerating the imagery

```bash
npm run assets:store
```

That builds `dist/` and runs `scripts/capture-store-assets.mjs`, which loads the
production extension into a real Chromium session, drives the product through the
five flows, and writes all eight files. It asserts the properties that make the
screenshots trustworthy (no host permissions in the build, the expected adapter
resolved for every capture, the cart actually holding its sources, the generated
task actually targeting the issue) and aborts instead of writing a screenshot that
would misrepresent the product. See `EDGEADDONS.md` for the per-file descriptions
and the honest limitations of these captures.

## Package under submission

`cueparcel-v1.1.0-chromium.zip` — the released 1.1.0 artifact at the repository
root.

```text
SHA256 63d57d5464043ed5b3f52ddde37abaa595c59eea798c1a3f91cf07da82b1b4f6
```

This matches `SHA256SUMS.txt` and is re-verified by `AUDIT.md`. The v1.1.0 release
is not modified by this submission pack: no extension source, manifest or version
number is changed.

## Privacy policy URL

```text
https://kallist.github.io/CueParcel/privacy.html
```

Served by the GitHub Pages workflow from `site/privacy.html` in this repository.

## What is deliberately absent

- No Chrome Web Store listing, copy, asset, or checklist.
- No fabricated Partner Center submission, review status, or publication claim.
- No generated or mocked UI imagery: every screenshot is the extension's own
  compiled interface, captured from a real browser session.
