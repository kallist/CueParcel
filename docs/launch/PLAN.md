# Launch plan

A plan for concentrating **legitimate** attention on CueParcel rather than
dribbling it out over weeks — and for not doing anything that would be
dishonest if it worked.

**Read this first:** nothing here is a promise of outcome. CueParcel is a small
local-first developer tool. This plan does not claim it will reach GitHub
Trending, and no part of it tries to game a ranking system. Star counts are not
a goal; being genuinely useful to a handful of people who then say so is.

## Ground rules

These are not negotiable, and they apply to every step below.

1. **No manufactured engagement.** No bought, traded or automated stars. No
   upvote rings. No asking friends to post on your behalf. No "please star so we
   can trend".
2. **One post per community, adapted to that community.** Identical cross-posts
   are spam. The drafts in this folder are deliberately different from each
   other; keep them that way.
3. **Read each community's rules first, and follow them.** Some subreddits ban
   self-promotion entirely, some require a flair, some require participation
   history. If the rules say no, the answer is no.
4. **Answer as a maintainer, not a marketer.** When someone reports a real
   problem, fix it or write it down honestly.
5. **Never overstate.** Not on a store, not Trending, no fake metrics, no
   certification claims. See the honesty checks in
   `tests/unit/packaging/launch-packaging.test.ts`, which fail the build if the
   README drifts into any of that.
6. **Do not change the product to chase attention.** The permission set, the
   local-first model and the TaskSpec contract are not launch-day levers.

## Prerequisites (must be true before T-0)

- [ ] `main` is green: `npm run verify:all` passes.
- [ ] The release artifact exists and self-checks: `npm run package:release`
      reports `manifest.json` at the archive root.
- [ ] `cueparcel-v1.1.0-chromium.zip` loads unpacked on a clean browser profile
      and a capture completes end to end.
- [ ] The GitHub **social preview** image is uploaded (Settings → General →
      Social preview). This is a manual GitHub UI step; it cannot be set from
      the repository.
- [ ] The GitHub **About** description and **topics** are set (see below).
- [ ] Every README image renders on the public repository page.
- [ ] The landing page (`site/`) is published, or intentionally deferred.
- [ ] An issue triage habit exists: someone will answer issues within a day or
      two during launch week.

## T-3 days — freeze and verify

| Task | Why |
|---|---|
| Freeze `main` except for release blockers | A moving target makes the release notes wrong |
| Re-run `npm run verify:all` on the exact commit to be released | Local green ≠ CI green |
| Build and self-check the ZIP | `manifest.json` at the archive root |
| Verify the social preview renders at 1200×630 | Platforms crop; a wrong ratio looks broken |
| Re-watch the demo GIF at 1x | It is the single most-read asset; a stale frame is worse than none |
| Proofread the launch drafts against the honesty rules | One overstatement poisons the thread |
| Confirm the Chrome Web Store status is described as "planned" | The README says exactly that; the posts must match |

## T-1 — verify on a machine that did not build it

- [ ] Load the release ZIP unpacked in a **clean** browser profile on another
      machine or VM.
- [ ] Complete the real workflow: capture → Context Lens → add a second source →
      choose a recipe → open TaskSpec → copy.
- [ ] Click every link in the README, in both languages.
- [ ] Open the repository in a narrow window (and on mobile) and confirm the
      README images and tables are readable.
- [ ] Verify `SHA256SUMS.txt` against a fresh download of the ZIP.

## T-0 — publish, then talk about it

**Publish, in this order:**

1. Create the `v1.1.0` tag on the verified commit and publish the GitHub Release
   with the ZIP and `SHA256SUMS.txt` attached. Notes come from
   `CHANGELOG.md`; screenshots come from `docs/assets/`.
2. Confirm the release page renders correctly, then confirm the README's
   "Download" link resolves to `/releases`.
3. Publish the landing page if it is ready. If it is not ready, skip it — do not
   publish a half-finished page to hit a date.

**Then post, within the same 24 hours:**

| Channel | Draft | Notes |
|---|---|---|
| Hacker News (Show HN) | `hacker-news.md` | Best on a weekday morning US time. Be present in the thread. |
| One relevant subreddit | `reddit.md` | **One.** Read the rules; some ban self-promotion outright. |
| X | `x.md` | Short thread, real screenshots, no hashtag stuffing. |
| LinkedIn | `linkedin.md` | Problem-first framing for a mixed audience. |
| Chinese developer communities | `chinese-launch.md` | V2EX 分享创造, 掘金, 少数派 — read each one's 版规 first. |

**Do not** post the same text, the same title, or the same framing across
channels. That is what makes it spam.

## T+1 — respond

- Answer every substantive question, including the hostile ones. "Copying the
  page is good enough" is a fair challenge; answer it with the provenance and
  source/generated separation arguments, not with defensiveness.
- Fix onboarding blockers found by real users the same day if they are small.
- File everything you cannot fix immediately as an issue with an honest label.
- **Do not** manufacture engagement to keep the thread warm. If it dies, it dies.

## T+2 to T+7 — earn the follow-up

- Publish **one** genuinely useful technical piece, for example: how the three
  provenance dimensions are kept separate, or why `producer.name` stayed
  `Page2Agent`, or what "honest unknowns" means in the TaskSpec contract.
- Highlight feedback that changed the product, with credit.
- Ship real fixes found during launch, and say so plainly.
- Resist adding a feature because a launch thread asked for it. Roadmap changes
  belong in `ROADMAP.md` after they are thought through.

## If it does not get traction

Most launches do not. That is normal and it is not a failure of the product.

- Do not re-post the same thing to the same community.
- Do not buy attention.
- Keep the issue templates, the docs and the release process good, and let the
  project accumulate usefulness. A tool that works and answers its issues
  eventually gets found.

## Things that would make this launch dishonest

Listed explicitly so they can be refused on the day, when it is tempting:

- Claiming Trending, or asking for stars "to trend".
- Describing CueParcel as available on the Chrome Web Store.
- Implying a security certification.
- Editing the numbers in the README to look better.
- Presenting the demo GIF as a live `github.com` capture. The captions say which
  page and adapter each screenshot came from; keep them accurate.
- Quietly dropping the limitations section to make the pitch cleaner.

## Manual steps that cannot be automated

These require a human in a browser:

- Settings → General → **Social preview** upload.
- **About** description and **Topics** (values below).
- Publishing the GitHub Release and attaching the artifacts.
- Reading each community's current rules before posting.

## About metadata to set

**Description:**

```text
Turn web pages into clean, source-grounded context for AI — visually pick,
combine and package what matters.
```

**Topics:** `chrome-extension`, `browser-extension`, `manifest-v3`, `ai`,
`ai-agents`, `llm`, `context-engineering`, `prompt-engineering`,
`developer-tools`, `productivity`, `local-first`, `privacy`, `markdown`,
`typescript`, `react`, `github`

Every one of these has to be defensible. If a topic cannot be justified by what
the extension actually does, leave it out — an irrelevant topic buys a little
traffic and costs credibility.
