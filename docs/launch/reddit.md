<!-- DRAFT — not posted anywhere. Before posting, check the target subreddit's self-promotion and flair rules; they differ a lot between subs. Do not post on the author's behalf. -->

**Suggested placement** — r/SideProject or r/webdev fits this best; r/ChatGPT only if framed strictly as a workflow tip, not a launch. Self-promotion rules differ per sub (some require a flair, some ban launch posts outside a weekly thread, some require prior participation), so read the sidebar and the wiki before submitting, and post from an account with real history in that community.

**Suggested media:** `docs/assets/cueparcel-demo.gif` (the picking interaction reads instantly as a GIF, and it's the whole pitch).

---

I keep pasting entire web pages into an AI and then wondering why the answer is confidently beside the point. The model isn't short of text — it's drowning in the wrong text. Nav bar, cookie banner, a comment thread from 2019, and then, somewhere in the middle, the paragraph I actually needed.

So I built CueParcel. It's a local-first Chrome/Edge extension: hit the picker, hover the page, and the regions that look meaningful light up — a section, a code block, a table, a GitHub issue. Click what belongs, skip what doesn't, and the side panel shows a running estimate of how many tokens you've selected. Nothing about the page changes; you're just cropping.

You can add more pages into one context, tag each piece by role, and say what you want done with it — learn it, compare it, verify it, build from it, fix it — instead of crafting a prompt. Then you read the receipt: what's going in, what you left out, and what the source genuinely doesn't say. Copy it into whatever agent you already use.

Four permissions, no backend, no telemetry, no API key, and it only acts when you click. MIT licensed.

Limits: not on the Chrome Web Store yet (load the unpacked release from GitHub), extraction is heuristic so app-like pages and PDFs may come up empty, token counts are estimates, and the preview is plain text.

`docs/assets/cueparcel-card-fix.png` shows a bug report turned into task context.
