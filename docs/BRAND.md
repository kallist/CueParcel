# CueParcel Brand

## Product

**CueParcel** — formerly Page2Agent.

**Tagline:** A quieter way to collect what matters.

**Description:** Collect what matters from the web and turn it into structured,
source-grounded context for AI.

## The name

- **Cue** — a useful signal, a selected insight, an important piece of context.
- **Parcel** — a deliberately assembled package that can travel onward to AI.

The workflow the name describes:

```text
Web → identify useful cues → collect / select → combine sources
    → choose task intent → inspect → package → send onward
```

## Mark

An open **C** with a single **Cue Blue** dot in its opening.

- **C** = collect / contain / context / Cue
- **dot** = the selected cue — the single focus point

Built as plain geometry, not an illustration: two arcs and one circle inside a
32×32 viewBox. Uniform 5.6 stroke, a 78° opening, and a cue dot of radius 2.85
centred at x=21. The open silhouette carries the recognition, so the mark needs
no gradient, shadow or 3D treatment.

## Colour

| Role | Value |
|---|---|
| Ink (near black) | `#111318` |
| Cue Blue (single accent) | `#3157FF` |
| Paper (warm off-white) | `#F7F7F4` |
| White | `#FFFFFF` |
| Neutral muted | `#6B7280` |

The blue dot is the **only** accent. Do not introduce further brand accents, and
do not replace functional UI colours with brand blue.

## Assets

| File | Purpose |
|---|---|
| `public/brand/cueparcel-mark.svg` | Mark on light backgrounds (ink C) |
| `public/brand/cueparcel-mark-dark.svg` | Mark on dark backgrounds (light C) |
| `public/brand/cueparcel-wordmark.svg` | Mark + "CueParcel" lockup |
| `public/icons/icon{16,32,48,128}.png` | Extension icons (mark on a light tile) |

Regenerate with:

```bash
node scripts/generate-brand-assets.mjs
```

The script computes the geometry and rasterises the PNGs with Playwright's
bundled Chromium (already a dev dependency). Nothing in `dist/` requires that
tool at runtime — the build ships only the finished PNGs.

## Icon

Extension icons place the mark on a subtle light neutral rounded-square tile so
contrast stays predictable on both light and dark browser chrome. The tile is
deliberately understated: on a light toolbar the near-black C carries the
legibility, and on a dark toolbar the tile does.

## Voice

Calm, precise, human, useful. Editorial rather than promotional.

**Do**

- say what the product does, plainly
- let one brand line carry the voice, and keep everything else functional
- prefer "collect", "pick", "package", "context"

**Don't**

- claim the product sends anything to AI, runs an agent, syncs to a cloud, or
  summarises with a model — it prepares and copies context
- use AI clichés (sparkles, robots, brains, wands, magic)
- use purple AI gradients, neon, glassmorphism or cyberpunk styling
- use cartoon parcels, shipping boxes or courier imagery
- rename the stable feature vocabulary (Context Lens, Context Cart, Recipes,
  TaskSpec, Context Receipt)

## Accessibility

Where the mark sits beside visible "CueParcel" text, the mark is
`aria-hidden="true"` and the visible text supplies the accessible name — never
two labels.

## Compatibility

CueParcel is the product brand formerly known as Page2Agent.

TaskSpec schema v1.0 intentionally retains `producer.name = "Page2Agent"` as a
stable serialized compatibility identifier. It is part of the machine-readable
contract, so it is not stale branding and must not be mass-replaced.

Internal identifiers (`p2a-*` classes, `page2agent.*` storage keys, message
discriminants, `Page2AgentError` types, module paths) are likewise retained:
branding must not risk runtime compatibility.
