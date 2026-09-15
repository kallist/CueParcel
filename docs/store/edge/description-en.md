# CueParcel — Microsoft Edge Add-ons store listing (English)

> Submission metadata for the `en` (English) listing of **Microsoft Edge Add-ons**.
> Paste the body below the `--- LISTING BODY ---` marker into Partner Center.
> No Chrome Web Store asset or copy is defined by this file.
>
> | Field | Value |
> |---|---|
> | Language | English (`en`) |
> | Display name | CueParcel |
> | Short description / summary | Collect what matters from the web and turn it into structured, source-grounded context for AI. |
> | Body length | 5,985 characters incl. line breaks / 5,926 excl. (within Microsoft's 250–10,000 requirement) |
> | Category | Productivity |
> | Mature content | No |
> | Website | https://kallist.github.io/CueParcel/ |
> | Support | https://github.com/kallist/CueParcel/issues |
> | Privacy policy | https://kallist.github.io/CueParcel/privacy.html |

## Character count

Measured by taking the lines strictly **between** the two markers, dropping the
blank separator lines at each end, joining with `\n`, and reading `.Length`. That
is exactly the text a reviewer pastes into Partner Center's description field, so
the count is the count the store will see.

```powershell
function Get-Body([string]$path) {
  $lines = Get-Content -LiteralPath $path
  $s = [Array]::IndexOf($lines, "--- LISTING BODY ---") + 1
  $e = [Array]::IndexOf($lines, "--- END LISTING BODY ---")
  $seg = $lines[$s..($e-1)]
  while ($seg.Count -gt 0 -and $seg[0].Trim()  -eq "") { $seg = $seg[1..($seg.Count-1)] }
  while ($seg.Count -gt 0 -and $seg[-1].Trim() -eq "") { $seg = $seg[0..($seg.Count-2)] }
  $seg -join "`n"
}
(Get-Body "docs/store/edge/description-en.md").Length
```

| Metric | Value |
|---|---|
| Characters (including line breaks) | 5,985 |
| Characters (excluding line breaks) | 5,926 |
| Lines | 60 |
| Minimum required | 250 |
| Maximum allowed | 10,000 |
| Result | PASS — 4,015 characters of headroom below the cap |

## Honesty constraints applied

- No testimonials, no ratings, no user or install counts, no "trusted by" claims.
- No superlatives ("best", "fastest", "#1", "revolutionary").
- No trend or popularity claims ("trending", "now everyone is using").
- No keyword lists or repeated keyword padding.
- No claim that CueParcel sends anything to a model, runs an agent, summarises
  with AI, syncs to a cloud, or requires an API key. It prepares and copies
  context; the user decides what to do with it.

--- LISTING BODY ---

**CueParcel helps you give AI the context you actually mean.**

Most of the time, the choice is between pasting a whole webpage — most of which is irrelevant — or sending only a URL and hoping. CueParcel adds the third option: choose the useful parts of a page, combine several sources, say what you want done, and read the result before you copy it.

**How it works**

1. **Capture the page you are reading.** Click the CueParcel icon. The Side Panel opens next to the page, so your source stays visible while you work.
2. **Pick the parts that matter.** Use **Context Lens** to select the sections you want directly on the page — an installation section, a warning, a table of supported options — instead of the whole document.
3. **Collect more than one source with the Context Cart.** Add an issue, a pull request, and a documentation page to the same cart. Each item keeps its own URL, title and origin, so nothing becomes anonymous text.
4. **Choose what you want done.** **Learn**, **Compare**, **Verify**, **Build** or **Fix** — each recipe decides what the task needs and tells you when a source is missing.
5. **Read the package before you send it.** Copy the result as an agent-ready prompt, as Markdown, or as a JSON **TaskSpec**, then copy or download it yourself. CueParcel never sends anything for you.

**Context Lens — pick, don't paste**

Context Lens runs on your page after you ask for it. It outlines the meaningful blocks it can see — headings, paragraphs, lists, code blocks, tables, quote blocks — and you click the ones to include. Anything you leave alone stays out. You can add your own text selection as one more region. A live estimate shows how much selected content you have gathered, so you can feel the difference between "this section" and "this entire page".

**Context Cart — combine sources, keep provenance**

The Context Cart holds the sources you have collected for one task. Sources are typed as they are captured: a GitHub issue, a GitHub pull request, a technical documentation page, or a generic web page. Specific adapters handle **GitHub Issue**, **GitHub Pull Request** and **Technical Documentation** structure, and a generic article extraction handles the rest. Every source keeps its URL, title and role, and the cart shows each item separately so you can reorder or remove it.

**Five recipes**

- **Learn** — explain the captured material faithfully, keeping the source's own terminology.
- **Compare** — line up two or more sources: agreements, differences, trade-offs, and what is missing.
- **Verify** — separate what the source actually supports from what it does not.
- **Build** — treat captured documentation as the implementation reference, without inventing undocumented behaviour.
- **Fix** — take a reported problem, state how to reproduce it, and target the smallest reliable fix.

Each recipe states its own minimum number of sources, so a two-source comparison cannot quietly run on one source.

**TaskSpec — the machine-readable side**

Alongside the readable prompt, CueParcel builds a **TaskSpec**: a structured JSON document describing the task, the sources, the source facts an adapter actually verified (repository, issue number, state, labels, branch names), the estimated size, and the recipe that produced it. A fact the page did not contain stays absent rather than guessed. Download it as JSON when another tool needs to consume the package instead of a person.

**Context Receipt — inspect before you copy**

The **Context Receipt** summarises the package you are about to send: which sources are in it, what each one contributes, the source-versus-generated split, the estimated size, and — importantly — what is *not* included. It also lists the facts that were excluded or could not be verified. You get to see the boundary of your own context before it leaves your clipboard.

**Local-first by design**

- **Capture happens only when you click.** CueParcel has no background capture, no scheduled jobs, and no always-on page access.
- **Nothing is processed off your device.** There is no CueParcel server, no backend, no account, no sign-in, no API key, and no cloud sync. Text is prepared inside the extension and copied through your own clipboard.
- **No analytics and no telemetry.** CueParcel does not measure you, does not report usage, and contains no tracking code.
- **Captured page content is session-scoped.** Captured content is held for the current browser session and is cleared when the browser closes. It is never written to permanent local storage.
- **Four permissions, no host permissions.** CueParcel requests `activeTab`, `scripting`, `sidePanel` and `storage`. It does not request access to all sites, and it does not use cookies, history, bookmarks or web request access.
- **No remote code.** Everything that runs is packaged inside the extension.

Read the full policy at https://kallist.github.io/CueParcel/privacy.html.

**Who it is for**

Anyone who works with an AI assistant and keeps retyping or re-pasting source material: developers reading an issue thread and its documentation, people comparing two proposals, reviewers checking whether a claim is actually supported, and anyone who wants the assistant to answer about *this* section instead of the whole internet.

**What CueParcel is not**

CueParcel is not a chatbot, not a summariser, and not an agent runner. It does not call a model and it does not need an API key. It prepares a well-structured package and hands it to you — you paste it wherever you already work. Nothing about your sources becomes public, because nothing about your sources leaves your browser.

**Getting started**

Install CueParcel, pin it to the toolbar, then open any normal web page and click the CueParcel icon. The Side Panel opens beside the page: capture it, pick the sections you mean, add them to the cart, choose a recipe, and inspect the Context Receipt before you copy. Press Alt+Shift+Y to trigger a capture from the keyboard.

--- END LISTING BODY ---
