# ADR-002 — CueParcel V1.1 Visual Context Workbench

Status: accepted
Date: 2026
Supersedes: nothing (extends ADR-001)
Product: CueParcel (developed as Page2Agent; the TaskSpec v1.0 producer
identifier intentionally remains "Page2Agent" — see docs/BRAND.md)

## Context

V0.1 turned a captured page into one AgentPackage/markdown blob. V1.1 turns
the product into a *Visual Context Workbench*: users understand a page, pick
which areas matter, combine several sources, choose what the agent should do,
inspect exactly what would be sent, and deliver it to any agent.

Six features are in scope: Context Lens, Context Cart, Context Recipes,
Semantic Adapter 2.0 (Generic + GitHub Issue + GitHub Pull Request +
Technical Documentation), TaskSpec, and Context Receipt + Context Nutrition
Label. Everything outside that list (AI chat, RAG, repository retrieval,
cloud sync, MCP, PDF/OCR, agent execution) is out of scope; repository
retrieval belongs to the separate ContextForge project.

## Decisions

### D1 — NormalizedDocument gains capture provenance, schema stays v1

`NormalizedDocument` keeps `schemaVersion: 1` and gains an OPTIONAL
`capture?: { adapter: {id, name}, scope: "full-page"|"selection"|
"text-selection" }`. Legacy session documents remain valid; new adapters
always write it. The adapter identity tells receipts/nutrition/recipes
exactly which pipeline produced the blocks; scope records user picking.
Source kinds gain `github_pull_request` (identity from URL only).

Why: additive, backward-compatible, and receipts must never re-run
detection. The strict allowed-key validator was extended, not relaxed.

### D2 — Workbench domain is pure core; serialization is application

`src/core/workbench` holds ContextSourceItem/ContextCart reducers, recipes,
TaskSpec types and receipt/nutrition derivation with strict runtime
validators — no React, no chrome. `src/application/workbench` builds
TaskSpecs, JSON/agent/markdown text, and selection fragment documents.

Why: cart/taskspec logic is testable in plain Node and reusable by future
consumers; delivery formats stay derived, never canonical.

### D3 — Markdown remains a delivery format

Sources keep their blocks; TaskSpec sources embed deterministic
`contentMarkdown` derived from blocks at build time. Agent text and Markdown
previews serialize from the same spec so tabs can never disagree.

### D4 — Semantic adapters, honest classification

Registry priority: GitHub Issue → GitHub PR → Technical Docs → Generic.
The docs adapter shares Generic's URL eligibility and inside `extract()`
classifies with a deterministic weighted detector
(`assessDocsKind`); if confidence is insufficient it returns the generic
pipeline and records `generic-article` — never a false "Technical
Documentation" claim. GitHub body regions picked by the Lens convert with
the same clone-only task-list normalization as the full-page adapter.

### D5 — Context Lens is DOM-immutable by construction

The lens resolves *semantic regions* (atomic blocks like pre/table/quote/
list/figure, or heading-anchored runs of siblings) without touching the page
tree. All visuals live in ONE shadow-root host; state events are broadcast;
cleanup removes listeners/host/rAF on deactivate/finish/Escape/pagehide and
duplicate hosts are pre-removed. An innerHTML byte-equality regression test
guards immutability.

### D6 — Cart state is a pure reducer; persistence is per-window session

Cart operations are immutable reducer functions (≤1 primary invariant,
single-shot undo, cap 12). The panel persists one key per browser window in
`chrome.storage.session`; invalid records degrade to an empty cart. Captured
documents are cached one-per-window under their own session key so "Add
current page to Context" never re-extracts; cache writes never fail a
capture.

### D7 — The panel orchestrates; the worker routes

The panel owns cart/build state and lens UI state. Lens requests
(enter/query/materialize/clear/text-selection probe & capture) travel
Panel → Service Worker router → content script and back; responses are
validated from `unknown`. Live lens inclusion counts stream to the panel via
`lens.state.event` broadcasts. No tabs permission was added.

### D8 — Recipes gate instead of guessing

Exactly five recipes exist. Compare requires ≥2 sources; a single-source
Context shows the recipe disabled with an explicit message and TaskSpec
building refuses (no fake comparisons). Suggestions are adapter-aware but
advisory only.

### D9 — TaskSpec unknowns never invent

`requirements.acceptanceCriteria` is null unless the source explicitly
provided an Acceptance/Requirements/Definition-of-Done section; a missing
value for fix tasks is also surfaced as a deterministic `unknowns` entry.
Target repository is emitted only when explicit (primary GitHub source, or
exactly one distinct repository in the cart); ambiguity is null.

### D10 — Token estimates are a labeled heuristic

One deterministic offline estimator (`page2agent-heuristic-v1`: CJK code
points count 1, other code points 1/4, ceiling) is used across lens, cart,
TaskSpec, receipt and nutrition. Every surface says "estimated tokens"; no
model-tokenizer equivalence is implied. Nutrition percentages are derived
from the same estimates and always labeled.

### D11 — Delivery formats

Agent text partitions generated task facts/instructions from the Sources;
the Markdown tab carries only the source partition. TaskSpec JSON is
pretty-printed, key-ordered and byte-deterministic for a given cart+recipe.

## Consequences

- Receipts/nutrition/task specs can be unit-tested without the browser.
- Adapter adds are localized (registry + selectors + capture field).
- Panel logic is thin over a pure model, so future consumers (ContextForge,
  CLIs, harnesses) consume TaskSpec JSON without Page2Agent internals.
- Lens DOM-immutability regression prevents overlay leaks into captures.

## Addendum — Final QA fixes and premium UI (pre-merge)

An independent real-browser Final QA pass (real Chrome 152 / Edge 152-153, real
public pages, the production extension loaded unpacked) produced four MEDIUM,
three LOW and three UX findings. This addendum records the resulting decisions;
the original decisions above are unchanged where they were correct.

### D12 — Three provenance dimensions, never conflated (fixes M-01)

`DocumentCaptureInfo` is `{adapter, method, scope}`. `context-lens` was removed
from `DOCUMENT_ADAPTER_IDS` — it is a **capture method**, not a semantic
adapter — and a separate `DOCUMENT_CAPTURE_METHODS` vocabulary was introduced.
A Lens pick resolves the page's semantic adapter through the **same production
registry a full-page capture uses**, so cropping a GitHub Issue keeps
`github-issue`, and TaskSpec gained `captureMethod` alongside `scope`.

Why: "what the source is" and "how the user cropped it" are orthogonal. Sharing
one slot lost the page identity downstream.

The docs adapter classifies inside `extract()`, so the registry's eligibility
answer alone is not an identity. Lens therefore hands that adapter the page
document so *its* classifier decides, instead of defaulting to either label.

### D13 — TaskSpec carries adapter-verified source facts (fixes M-02)

`TaskSpecSource.sourceFacts` is an optional typed object: `repository`,
`issueNumber` | `pullRequestNumber`, `state`, `labels`, `author`,
`publishedAt`, `baseBranch`, `headBranch`. Only facts the adapter actually
resolved are present; a fact the DOM did not provide stays absent.

Why: the adapters already knew these, but the portable contract dropped them, so
consumers had to re-parse URLs for the issue number, labels or PR branches.

Strict validation applies: positive integers, non-empty label lists, and
`publishedAt` must be a real ISO 8601 timestamp with an explicit zone.
`isIsoDateTimeString` was tightened accordingly, because a rendered phrase
("on Aug 28, 2026") parses in V8 but is not a machine-consumable source fact and
made the value order-dependent.

### D14 — Whitespace-significant content keeps its structure (fixes M-03)

A structural, site-neutral detector (`src/shared/dom/preformatted.ts`) decides
whether an element's visible text is whitespace-significant: enough `<br>`
breaks, every segment short enough to be a data line, and at least two indented
or assignment/arrow-keyed lines. Preformatted paragraph content serializes as a
fenced code block; preformatted content inside a list item stays in the list as
Markdown continuation lines so numbering is never reset.

Why: the real GitHub Issue expressed an LLM config block with 10 `<br>` breaks
and column alignment; flattening it into one prose line destroyed the
information. No new block type and no schema change were needed, because
`isMeaningfulText` already accepts multi-line strings.

### D15 — Context Receipt states only captured facts (fixes M-04)

Rows are neutral and adapter-independent (`Title`, `Content`, `Author`,
`Published At`, `Labels`, `Selected Sections`, `Text Selection`) and each is
emitted only when that fact exists in the document. The exported
`RECEIPT_INCLUDED_CATEGORIES` capability checklist was removed.

Why: naming rows from what an adapter *can* extract ("Issue Title",
"PR Description") conflated capability with this capture's facts. `excluded`
stays a separate field and remains mechanism facts, per the original decision.

A related data defect was fixed in the GitHub label extractor: the literal
placeholder "None yet" rendered inside an empty labels container was returned as
a label, which let the receipt claim "Labels" for a source that has none.

### D16 — Markdown escaping is position-aware (fixes L-01/L-02/L-03)

Only characters that can change rendering are escaped, and only where they can.
Parentheses are never escaped in ordinary text (they carry no meaning there;
destinations have their own escaper). Emphasis characters are escaped only when
not intraword, so `insert_content_list` and `llm_model_max_async=16` stay
readable. Only `[` is escaped, because only it can open a link.

Why: the previous rules escaped `)` but never `(`, escaped 38 underscores in one
real issue body, and turned a human-facing title into `This \[Bug\]:…`.

### D17 — Token estimates are labelled per stage (fixes UX-05)

`selected-content tokens` (Lens / pick), `packaged-source tokens` (source card,
Cart) and `total-context tokens` (Receipt, Nutrition) name the stage each figure
belongs to, everywhere they appear, including agent output. All remain
explicitly estimates.

Why: the same source legitimately showed ~296, ~560 and ~836 with no
explanation, so the numbers looked inconsistent rather than staged.

### D18 — Receipt is compact by default; one dominant scroll surface (UX-03/UX-02)

The Receipt leads with total-context tokens, the source/generated/metadata split
and a one-line summary, and exposes Included/Excluded/Generated/Unknown/Warnings
plus the full nutrition label behind a real disclosure (`aria-expanded` +
`aria-controls`). The output preview is capped (300px, 190px on short panels)
with `overscroll-behavior: contain`.

Why: the expanded receipt pushed Copy/Download far down the panel, and a 9903px
preview inside a 1511px document formed a nested scroll trap.

### D19 — Toolbar access is honest about pinning

A badge mirror of the focused window's Cart count, a dismissible pin onboarding
driven by `chrome.action.getUserSettings()`, and an `Alt+Shift+Y`
`_execute_action` shortcut. No new permission was added.

Why: the toolbar action is the only entry point, and an extension cannot pin
itself. When the API is absent or the state is unknown, Page2Agent shows nothing
rather than guessing; the copy states that Chrome requires the user to pin it.

Superseded by human-QA findings HQA-04 and Test 22 (same branch, before merge):

- **The badge is global, not per-window.** Chrome rejects
  `chrome.action.setBadgeText({ windowId })` with "Unexpected property:
  'windowId'", so the original per-window write silently never painted anything.
  There is no per-window action badge to use. The badge therefore shows the
  FOCUSED window's Cart count, written by that window's own Side Panel and
  refreshed by the Service Worker on `chrome.windows.onFocusChanged`, so a
  background window's cart can never paint the count the user is looking at.
  Per-window Cart *state* is unchanged (one `chrome.storage.session` key per
  window).
- **The shortcut is `Alt+Shift+Y`.** Chrome reserves `Alt+Shift+P` for its own
  "Pin tab" command, and a `suggested_key` that collides is left unassigned —
  `chrome.commands.getAll()` reported an empty shortcut, so the advertised
  `Alt+Shift+P` did nothing.

### D20 — Premium graphite visual system

A full design-token layer (layered graphite surfaces, a restrained blue → violet
→ cyan accent ramp, a real type scale and spacing scale), one soft aurora wash
behind the header plus a bounded 12-particle CSS-only atmosphere, unified inline
SVG line icons, and motion that only expresses state. `prefers-reduced-motion`
removes all decorative motion and hides the particles; nothing functional
depends on animation. The light/system theme is preserved and calmer than dark.

Why: the workbench was functionally complete but visually generic. The
constraint was deliberate restraint — no purple-drenched gradients, neon
outlines, heavy glassmorphism or particle overload. Secondary and muted text
contrast is measured against every surface in both themes
(≥ 4.5:1 WCAG AA).
