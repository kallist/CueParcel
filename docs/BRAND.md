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

An open **C** with a single **Cue Blue** cue dot beside its opening.

- **C** = collect / contain / context / Cue
- **dot** = the selected cue — the single focus point

Built as plain geometry, not an illustration: two arcs and one circle inside a
32×32 viewBox. The proportions are **measured from the approved brand board**
rather than chosen, and are expressed as ratios of the C's outer radius so the
artwork cannot drift:

| Element | Ratio of the C's outer radius | In the 32-unit viewBox |
|---|---|---|
| Stroke | 0.2324 (11.6% of the C's height) | 3.456 |
| Opening | 80°, centred on +x | 80° |
| Cue dot radius | 0.2998 (~30% of the C's height) | 4.459 |
| Dot centre, right of the C's centre | 0.7712 | 11.469 |

The dot sits **in the open mouth**: its left edge is inside the opening and its
right edge reaches ~1.06 units **past** the C's outer edge. That overhang is the
whole point of the lockup — it is why the mark reads as "a cue entering the C"
rather than a ringed dot. The open silhouette carries the recognition, so the
mark needs no gradient, shadow or 3D treatment.

Two implementation traps are worth knowing before editing the path:

1. **An SVG arc cannot span more than 180°.** The C's 280° body must be split
   into at least two `A` commands. A single large-arc command silently renders
   the 80° *complement*, collapsing the C into two stub ends while the `d`
   attribute still looks plausible. `scripts/generate-brand-assets.mjs` asserts
   the split.
2. **The dot is the widest drawn element, not the C.** The mark is fitted by its
   total width, so the right margin is set by the dot's edge. Assuming the C
   alone defines the extent is what previously pushed the artwork off-canvas.

## Colour

| Role | Value | Where |
|---|---|---|
| C ink, light surfaces | `#141720` | SVG masters, wordmark |
| C ink, dark surfaces | `#F2F3F5` | `cueparcel-mark-dark.svg`, and the Side Panel via `currentColor` |
| C ink, extension icon | `#66779A` | PNG icons only |
| Cue Blue (single accent) | `#224AE6` | the cue dot, everywhere |
| Paper (warm off-white) | `#F7F7F4` | UI surfaces |
| White | `#FFFFFF` | UI surfaces |

All four values were sampled from the approved brand board's own pixels.

**Why the icon's C is a medium cool-slate, not the approved near-black:** a
transparent icon has no background to lean on, so the C must clear both browser
chromes by itself. Measured contrast of `#141720` is 15.85:1 on light chrome but
**1.12:1 on dark chrome** — invisible. `#66779A` sits at 3.98:1 on light chrome
and 3.54:1 on dark chrome, so one colour works on both. The alternative — putting
the mark on an opaque tile — was rejected: the approved mark has no tile.

The blue dot is the **only** accent. Do not introduce further brand accents, and
do not replace functional UI colours with brand blue.

## Assets

| File | Purpose |
|---|---|
| `public/brand/cueparcel-mark.svg` | Mark on light backgrounds (`#141720` C) |
| `public/brand/cueparcel-mark-dark.svg` | Mark on dark backgrounds (`#F2F3F5` C) |
| `public/brand/cueparcel-wordmark.svg` | Mark + "CueParcel" lockup |
| `public/icons/icon{16,32,48,128}.png` | Extension icons — **transparent, no tile** |

Regenerate with:

```bash
node scripts/generate-brand-assets.mjs
```

The script computes the geometry, asserts it against the approved envelope, and
rasterises the PNGs with Playwright's bundled Chromium (already a dev
dependency). Generation is deterministic: two consecutive runs produce
byte-identical assets. Nothing in `dist/` requires that tool at runtime — the
build ships only the finished PNGs.

## Icon

The extension icons are the bare mark on **transparent** pixels: no tile, box,
card, chip, shadow or glow. The artwork is the C plus the dot and nothing else,
so it can float on any surface.

Both the C and the dot are fitted inside the canvas with 0.6 units of margin on
every side (uniform scale, exact aspect ratio). Antialiased edge pixels may reach
the first and last column at 16 and 32 px, because 0.3 px and 0.6 px of padding
round down — that is rasterisation, not clipping. What would be clipping is ink
beyond the margin the fit rule predicts.

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
