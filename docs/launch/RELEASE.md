# Release process

CueParcel ships as a GitHub Release containing a ZIP that can be loaded unpacked
in Chrome or Edge. This document is the exact procedure. **Nothing here is
automatic**: publishing a release is a deliberate, manual decision.

## What a release contains

| Asset | Produced by | Notes |
|---|---|---|
| `cueparcel-v<version>-chromium.zip` | `npm run package:release` | The extension. `manifest.json` is at the **archive root**, not under `dist/`. |
| `SHA256SUMS.txt` | `npm run package:release` | SHA-256 of the ZIP, so a download can be verified. |
| Source code (automatic) | GitHub | The `v<version>` tag's tarball and zipball. |

## 1. Verify the commit you are about to release

```bash
git switch main
git pull --ff-only origin main
git status                       # must be clean
git rev-parse HEAD               # record this SHA for the release notes
```

Then run the full gate. **Do not release on a red or skipped gate.**

```bash
npm ci
npm run verify:all               # lint + typecheck + test + build + E2E
```

Also confirm nothing protected has drifted:

```bash
node -e "const m=require('./dist/manifest.json');console.log(m.permissions,m.version,m.manifest_version)"
# [ 'activeTab', 'scripting', 'sidePanel', 'storage' ] 1.1.0 3
```

## 2. Build the artifacts

```bash
npm run package:release
```

This runs the production build, writes the ZIP and `SHA256SUMS.txt` at the
repository root, then **re-opens the archive it just wrote** and asserts:

- `manifest.json` exists at the archive root,
- no entry has a `dist/` prefix,
- no entry contains a path-traversal segment,
- the archived `manifest.json` parses, reports the expected version, and is MV3.

If any of those fail, the script exits non-zero and no artifact is produced.

Both files are gitignored on purpose: release artifacts are published as release
assets, never committed.

## 3. Sanity-check the ZIP by hand

Do this once per release, on a machine that did not build it if possible.

```bash
unzip -l cueparcel-v1.1.0-chromium.zip | head
# the first entry must be manifest.json, with no directory prefix
```

Then load it for real:

1. Unzip into an empty folder.
2. Open `chrome://extensions` (Edge: `edge://extensions`).
3. Enable **Developer mode** → **Load unpacked** → select the unzipped folder.
4. Confirm the extension appears as **CueParcel 1.1.0**, with the mark visible in
   the toolbar once pinned.
5. Click it on a normal article page. The Side Panel must open and the capture
   must complete.
6. Click **Pick Context**, include one area, and confirm it becomes a source.
7. Choose a recipe, open **TaskSpec**, and confirm it parses as JSON.

Verify the checksum:

```bash
sha256sum -c SHA256SUMS.txt      # macOS: shasum -a 256 -c SHA256SUMS.txt
```

## 4. Tag and publish

Draft the release on GitHub:

- **Tag:** `v1.1.0`, created from the verified `main` commit.
- **Title:** `CueParcel v1.1.0`
- **Body:** start from the opening below, then the CHANGELOG section for this
  version, then the screenshots.

```text
CueParcel turns web pages into source-grounded context for AI.

Pick what matters.
Combine multiple sources.
Choose the task.
Inspect exactly what will be sent.
```

Include in the notes:

- the capabilities in this release (Context Lens, Context Cart,
  Learn / Compare / Verify / Build / Fix, the GitHub Issue / PR / Technical Docs
  adapters, TaskSpec, Context Receipt),
- the local-first privacy statement and the four permissions,
- Chrome and Edge installation instructions,
- screenshots (`docs/assets/`), and
- the checksum of the ZIP.

Attach `cueparcel-v1.1.0-chromium.zip` and `SHA256SUMS.txt` as release assets.

### Versioning rules

- `package.json` `version` and `dist/manifest.json` `version` must match the tag.
- **Branding is not a version bump.** Renames, assets and presentation changes do
  not change the version.
- **TaskSpec `schemaVersion` and `producer.name` are a separate contract.** They
  are versioned independently of the product. `producer.name` stays
  `"Page2Agent"`; see [../BRAND.md](../BRAND.md).
- `CHANGELOG.md` must have a section for the version before you tag it.

## 5. After publishing

- Update any "latest release" links if the version is hard-coded anywhere. The
  README links to `/releases` rather than a pinned version, so it needs no edit.
- Verify the release page renders the screenshots and the asset list is correct.
- Do not move or re-upload a release asset without also updating
  `SHA256SUMS.txt`; the checksum is the only thing letting a user verify what
  they downloaded.

## Distribution status

- **GitHub Releases: this is the official channel, and the only one.**
- **Browser extension stores: not available.** CueParcel is not published on the
  Chrome Web Store or Microsoft Edge Add-ons, and no store submission is currently
  planned or in progress. The ZIP built here is the artifact any future submission
  would use, but nothing is pending.

Never describe CueParcel as available on a store before the listing is approved
and public.
