# Page2Agent

> Turn web pages into structured, source-grounded context and tasks for AI agents.

A URL tells an agent *where to look*. Page2Agent tells the agent *what
matters, what it means, and what to do with it*.

Page2Agent is a lightweight, local-first Chrome / Edge (Manifest V3)
extension that turns web pages into **Visual Context Workbench** output:
understand the page, pick the parts that matter, combine several sources,
choose what your agent should do, and inspect exactly what would be sent —
as agent text, faithful Markdown, or a versioned **TaskSpec** JSON contract.

## The six V1.1 capabilities

1. **Context Lens** — a beautiful in-page visual picking mode. Semantic
   regions (sections, code blocks, tables, lists, GitHub issue areas) are
   highlighted on hover with live `selected-content tokens`; one click includes
   or excludes an area; the page DOM is never modified.
2. **Context Cart** — combine multiple pages, picked sections and text
   selections into one agent context. Roles (`Task`, `Reference`,
   `Evidence`, `Example`, `Selection`), a single primary source, reorder,
   undo, clear — light, session-only, private.
3. **Context Recipes** — no prompt writing: pick what the agent should do —
   `Learn`, `Compare`, `Verify`, `Build`, `Fix`. Recipes are suggested from the
   adapter analysis but the user stays in control.
4. **Semantic Adapter 2.0** — Generic Article, GitHub Issue, GitHub Pull
   Request, and Technical Documentation detection (honest fallback to
   generic when confidence is insufficient).
5. **TaskSpec** — a versioned, portable, deterministic JSON task contract
   (sources, roles, provenance, adapter-verified source facts, explicit
   acceptance criteria only when the source really provides them, unknowns,
   generated instructions, token estimates) consumable by other tools (e.g.
   ContextForge) without Page2Agent internals.
6. **Context Receipt + Nutrition Label** — a compact summary of exactly what the
   agent will receive (total-context tokens and the source/generated/metadata
   split), expanding into Included/Excluded facts, Generated vs Source
   separation, Unknowns and observable context facts. No fake quality scores.

### Three provenance dimensions, never conflated

"What the source is", "how it was captured" and "how much was captured" are
independent facts, so a GitHub Issue cropped with the Context Lens is still a
GitHub Issue:

```text
Type:    GitHub Issue          ← semantic adapter (what the page IS)
Adapter: GitHub Issue
Capture: Context Lens          ← capture method (how the user cropped it)
Scope:   Selected sections     ← capture scope (how much was captured)
```

TaskSpec carries the same split (`adapter`, `captureMethod`, `scope`).

### Token stages

One source is measured at three points, and the numbers legitimately differ, so
every surface names the stage it shows. All values are **estimates** from one
deterministic offline heuristic — no model tokenizer equivalence is implied.

| Stage | Shown as | Where |
|---|---|---|
| Picked content | `~296 selected-content tokens` | Context Lens dock, pick summary |
| Packaged source | `~560 packaged-source tokens` | Source card, Context Cart |
| Whole context | `~836 total-context tokens` | Context Receipt, Nutrition Label |

### Adapter-verified source facts

Facts an adapter actually resolved travel into the TaskSpec so consumers never
re-parse the URL: `repository`, `issueNumber` / `pullRequestNumber`, `state`,
`labels`, `author`, `publishedAt`, `baseBranch`, `headBranch`. A fact the DOM did
not provide stays **absent** — nothing is inferred or guessed.

## Install (development load)

No store release exists yet — load the built extension unpacked.

Prerequisites: Node.js 24 (see `.nvmrc`).

```text
npm ci
npm run build
```

Chrome: open `chrome://extensions` → enable **Developer mode** → **Load
unpacked** → select the `dist/` folder. Edge: the same at `edge://extensions`.

## Access: pin Page2Agent once

The toolbar action is the product's entry point, so pin it for one-click access:

1. Click the **Extensions** (puzzle-piece) icon in the browser toolbar.
2. Click the **pin** next to **Page2Agent**.
3. From then on: click the Page2Agent icon on any page → capture runs → the
   Side Panel opens.

**Page2Agent cannot pin itself.** Pinning is an explicit user decision in the
browser's own UI, and an extension cannot perform it. When Page2Agent detects it
is not pinned it shows a short, dismissible getting-started card saying exactly
that, and falls quiet once dismissed.

- **Keyboard shortcut:** `Alt+Shift+P` captures the current page without the
  toolbar (reassignable at `chrome://extensions/shortcuts`).
- **Toolbar badge:** shows the number of sources in this window's Context Cart,
  so you can see at a glance whether context is assembled. Window-scoped: one
  window's cart never paints another window's badge.
- The Extensions menu remains the fallback entry point.

## Usage

### Fix an issue with supporting docs

1. Open the GitHub issue you need to fix.
2. Click the Page2Agent toolbar icon on that tab — the Side Panel opens,
   capture runs, and the issue is identified.
3. **Pick Context** — click only the relevant parts of the issue on the page,
   then **Done** in the lens dock, and **Add to Context**.
4. Open the official documentation, capture it, **+ Add to Context**.
5. The Context Cart now holds 2 sources.
6. Choose `Fix` (recommended for issue-backed contexts).
7. Inspect the **Agent** / **Markdown** / **TaskSpec** tabs and the
   **Context Receipt** — exactly what will the agent receive?
8. **Copy for Agent** (or Copy JSON / Download JSON) and paste it into any
   agent.

### Compare two pages

1. Capture article A → **+ Add to Context**.
2. Capture article B → **+ Add to Context** (Cart = 2).
3. Choose `Compare`. Single-source contexts can never produce a fake
   comparison — Compare stays disabled until there are two sources.

## Visual design & accessibility

- **Premium graphite** visual language: layered dark surfaces (the hero theme),
  a restrained blue → violet → cyan accent ramp, one soft aurora wash behind the
  header and a bounded 12-particle atmosphere. No purple-drenched gradients, no
  neon outlines, no heavy glassmorphism, no particle screensaver.
- The light/system theme is preserved and deliberately calmer than dark.
- **Reduced motion** (`prefers-reduced-motion: reduce`) removes all decorative
  motion and hides the particles; nothing functional depends on animation —
  every state is also carried by text, a badge, a border colour or a percentage.
- Unified inline SVG line icons (no icon dependency, no remote assets).
- Keyboard-navigable, `focus-visible` rings, semantic roles, `aria-expanded` on
  the receipt disclosure, decorative layers are `aria-hidden` and never
  focusable.
- Text contrast is contrast-checked against every surface in both themes
  (≥ 4.5:1 WCAG AA for secondary and muted text).

## Privacy & permissions

- Capture is always user-triggered; nothing runs in the background.
- Everything is processed locally inside the extension: **no backend, no
  analytics, no telemetry, no provider keys, no cloud sync, no remote code**.
- Permissions stay at the least-privilege minimum: `activeTab`, `scripting`,
  `sidePanel`, `storage`. No `<all_urls>`, no host permissions, no `tabs`,
  no browsing-data permissions.
- Session state lives in `chrome.storage.session` only (cleared on browser
  close); at most one captured document per window is cached; captured page
  content is never written to `chrome.storage.local`. The only local preference
  is a single boolean recording that the pin onboarding was dismissed.

## Architecture

```text
Toolbar gesture → Capture → Semantic Adapter → NormalizedDocument
  → Context Lens / text selection → ContextSource
  → Context Cart → Recipe → TaskSpec → Agent | Markdown | JSON
  → Context Receipt
```

- **Core** — domain contracts and validators (`NormalizedDocument`,
  ContextSource/Cart, Recipes, TaskSpec, Receipt/Nutrition), the deterministic
  token estimator, and source Markdown serialization. Markdown is a delivery
  format; `NormalizedDocument` is canonical.
- **Application** — TaskSpec building/JSON, agent/markdown text, selection
  fragment documents.
- **Adapters** — Generic Article, GitHub Issue, GitHub Pull Request,
  Technical Documentation (registry: specific → generic, never the reverse).
- **Extension** — Service Worker capture orchestration + lens router, content
  script capture + lens engine, Side Panel workbench UI, session/cart storage,
  toolbar badge and pin onboarding.

Source content, source-derived facts and Page2Agent-generated instructions
are strictly separated in every layer; the prompt-injection trust boundary
applies to every source in the cart.

## Development

```text
npm run lint            ESLint
npm run typecheck       TypeScript strict check
npm run test            Vitest (unit / integration / component)
npm run test:e2e        build + Playwright MV3 extension E2E (headed Chromium)
npm run build           production extension build + artifact validation
npm run verify          fast deterministic gate (lint + typecheck + test + build)
npm run verify:all      verify + E2E
```

`npm run test:e2e` uses a **test-only harness** (`dist-e2e/`, gitignored): the
production build plus a test manifest that grants only the local fixture
origin (`http://127.0.0.1/*`) host access to emulate the action event, because
GUI toolbar automation cannot reliably create an `activeTab` grant. It does
not validate the production activeTab grant UX or the native Side Panel
container.

## Testing

- **Unit** — domain, validators, messaging (incl. all lens messages), cart
  reducers, receipts, task specs, source facts, provenance dimensions, toolbar
  badge, onboarding, session/caches, filename/preview.
- **Integration** — adapters and TaskSpec pipelines against realistic offline
  fixtures (Generic, GitHub Issue incl. modern task lists, GitHub PR,
  Technical Docs, docs-lookalike pages that must stay Generic).
- **Component** — Side Panel V1.1 states and flows (Testing Library), including
  receipt disclosure and toolbar/onboarding behaviour.
- **Browser E2E** — real Chromium with the built extension: capture, Context
  Lens picking, Cart multi-source, recipe→TaskSpec mapping, docs
  classification, receipts (compact + expanded), token stages, provenance
  dimensions, restore/repeat/no-content paths.

## Limitations

- `activeTab` grants expire with navigation/closure; capture always starts
  from a toolbar action on the target page.
- Extraction is DOM/heuristic-based: app-like or script-rendered-only pages,
  iframes and PDFs may not extract. GitHub DOM changes can break the GitHub
  adapters over time; the Technical Docs classifier is deliberately
  conservative (falls back to Generic).
- Whitespace-significant content (config blocks, environment dumps) written
  with `<br>` and alignment is preserved; content that relies on CSS-only
  layout for structure is not recoverable from the DOM.
- Token counts are **estimated** (one deterministic heuristic), never
  claimed equal to any model tokenizer.
- The preview is plain text, not rendered Markdown.
- Only session-scoped state is kept; there is no history, no accounts, no
  sync.
- The native Side Panel container and the toolbar-click `activeTab` grant
  cannot be automated, so they remain manual QA items (see the E2E harness note
  above). Context Lens visuals are likewise a manual QA item.

## Ecosystem boundary

Page2Agent produces TaskSpec + web context. Repository retrieval is a
separate project's concern:

```text
Page2Agent    Web → TaskSpec
ContextForge  TaskSpec + Repository → Repository Context
```

## License

MIT — see [LICENSE](LICENSE).
