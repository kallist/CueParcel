<!-- DRAFT — not posted anywhere. Before posting, check the platform's self-promotion and automation rules. Do not post on the author's behalf. -->

# X / Twitter thread (7 posts)

Guidance for the author: put the repo link in post 7, and add the same link as a reply to post 1 — links in the first post tend to cost you reach. At most two hashtags across the whole thread; none are used below.

---

**1/7** — hook · media: `docs/assets/cueparcel-hero.png`

Pasting a URL into an AI agent hands it your nav bar, your footer, and three sections you don't care about.

The agent then guesses which part matters. Usually it guesses wrong.

So I built a way to pick the parts myself.

**2/7** — media: `docs/assets/cueparcel-demo.gif`

Context Lens: press pick, hover the page.

Sections, code blocks, tables, lists and GitHub issue areas highlight as you go, with a live token count of what you've selected.

Click to include. Click to exclude. The page DOM is never touched.

**3/7** — media: none (text post)

Two GitHub issues, one docs page, and a paragraph I selected by hand — in one context, each tagged by role: Task, Reference, Evidence, Example, Selection.

One primary source. Reorder, undo, clear. Session-only: gone when the browser closes.

**4/7** — media: none (text post)

Context Recipes skip the prompt drafting.

Pick what the agent should do — Learn, Compare, Verify, Build, Fix — based on what you collected. Recipes are suggested from adapter analysis, but you stay in control.

**5/7** — media: `docs/assets/cueparcel-card-compare.png`

Before you copy, you read the Context Receipt: total tokens, the source/generated/metadata split, what's included, what you excluded, what's generated versus quoted, and what the source never says.

Unknowns stay unknowns. No fake quality scores.

**6/7** — media: `docs/assets/cueparcel-card-build.png`

Privacy model, stated plainly:

No backend, no telemetry, no API key, no cloud sync, no remote code.
Nothing runs in the background — capture is always your click.
Four permissions: activeTab, scripting, sidePanel, storage.
No host permissions. No <all_urls>.

**7/7** — media: `docs/assets/cueparcel-card-fix.png`

Honest limits: not on the Chrome Web Store yet (load the unpacked release), DOM/heuristic extraction so some app-like pages, iframes and PDFs fail, token counts are estimates, preview is plain text, no history or sync.

MIT. v1.1.0.

github.com/kallist/CueParcel
