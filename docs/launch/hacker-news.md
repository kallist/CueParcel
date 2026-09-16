<!-- DRAFT — not posted anywhere. Before posting, the author must read Hacker News' submission guidelines and the Show HN rules, and confirm this still describes the shipped 1.1.0 release accurately. Do not post on the author's behalf. -->

# Show HN: CueParcel – Pick the parts of a page that matter, copy them for an AI

**Title (78 chars):**

```
Show HN: CueParcel – Pick the parts of a page that matter, copy them for an AI
```

**Repo:** https://github.com/kallist/CueParcel (MIT, Chrome/Edge MV3 extension, v1.1.0)

---

## First comment (post immediately after submitting)

Pasting a whole page into a coding agent hands it the nav and three sections I didn't care about. It guesses which part mattered.

CueParcel is a local-first Chrome/Edge extension that lets me crop the page. Context Lens highlights semantic regions on hover — sections, code blocks, tables, lists, GitHub issue areas — with a live token count; I click to include or exclude, and the page DOM is never modified. Picks land in a Context Cart, where several pages get a role each (Task, Reference, Evidence, Example, Selection) and a Context Recipe states the intent: Learn, Compare, Verify, Build, Fix.

"Just copying a page" differs. Copying sends the page, every token competing for attention, nothing marked as the point. CueParcel sends fewer tokens, an explicit role per source, and three provenance dimensions kept separate: Type (what the page *is*), Capture (how I cropped it), Scope (how much) — and Capture never changes Type, so a GitHub issue cropped with the Lens stays a GitHub issue. Source text and generated text are separated in the data model: if an issue never states acceptance criteria, the output says "Not explicitly provided in source" rather than inventing them. TaskSpec is a versioned (`schemaVersion` "1.0") deterministic contract carrying explicit unknowns, so other tools consume it without my internals. Four permissions, `activeTab`, `scripting`, `sidePanel`, `storage`, and no host permissions — so no code path reads a page you didn't just ask me to read.

Limits: distributed through GitHub Releases only — download the ZIP, unzip, Load unpacked; browser stores are not available. Extraction is heuristic: app-like pages, iframes and PDFs may not extract, and GitHub DOM changes can break the GitHub adapters. Token counts are estimates from an offline heuristic, not any tokenizer. Preview is plain text. No history, accounts, or sync. Tracked issue: articles in a shadow root return `NO_CONTENT_FOUND`.

What I'd like feedback on:

- Is the three-dimension provenance model right, or one axis too many?
- Would you consume a TaskSpec from another tool, and what's missing?
- What pages break the extractor for you?
- Is `NO_CONTENT_FOUND` right for shadow-DOM hosts, or should it guess?