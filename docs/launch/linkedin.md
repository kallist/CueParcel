<!-- DRAFT — not posted anywhere. Before posting, check LinkedIn's and your own organisation's self-promotion policies, and confirm this still matches the shipped 1.1.0 release. Do not post on the author's behalf. -->

# LinkedIn

**Suggested media:** `docs/assets/cueparcel-card-compare.png` (a receipt reads as a document, which suits this feed better than a GIF).

---

The hard part of working with AI agents turned out not to be the model. It is the context we hand it.

Paste a whole web page into an assistant and most of what you sent is noise. The model reads all of it with equal attention, and the answer you get back is often plausible and subtly beside the point.

CueParcel is a small browser extension that treats context selection as a real step. You visually pick the parts of a page that matter, combine several sources, tag each one by role, and choose what you want done with it — learn it, compare it, verify it, build from it, fix it. Before anything leaves your browser, you can read a short receipt of exactly what will be sent, what you excluded, and what the source does not state. No backend, no telemetry, no API key, and it acts only when you click.

Shipping honestly means naming the limits: it is not on the Chrome Web Store yet, extraction is heuristic, and token counts are estimates. Those are documented rather than smoothed over.

MIT licensed, version 1.1.0: https://github.com/kallist/CueParcel
