# Roadmap

CueParcel 1.1.0 is the current release. This page lists what is actually planned,
in rough order of priority. **No dates are promised, and nothing here is
committed until it ships.** If you want to influence the order, open an issue.

## Near term

### Chrome Web Store distribution
The biggest adoption blocker today is installation friction: the release has to
be loaded unpacked from `chrome://extensions`. A store listing is planned. It
requires packaging, store assets, and a privacy-practices review — none of which
change the runtime behaviour or the permission set.

### Edge Add-ons distribution
CueParcel is built on the same Chromium extension platform and already targets
Manifest V3. After the Chrome Web Store listing, an Edge Add-ons submission
follows the same packaging.

### Shadow-root capture
Pages whose article lives inside a shadow root currently return
`NO_CONTENT_FOUND` instead of being extracted or reported with a named reason.
This is a real limitation with an obvious user-visible failure mode. The planned
work is: extract when the host is discoverable from the document, and otherwise
report the reason as a structured error.

## Medium term

### Additional semantic adapters
The adapter registry picks the most specific match and falls back to Generic
Article. Candidates for new adapters have to earn their place by having a stable,
semantically meaningful DOM — a specific adapter is worse than no adapter when it
fires on the wrong page. Areas under consideration:

- more code-hosting and issue-tracker shapes
- specification and RFC documents
- long-form documentation with versioned navigation

Any new adapter ships with fixtures, integration tests, and an honest confidence
rule. None of them may claim a source fact the DOM did not provide.

### Improved portable delivery
TaskSpec is already portable and versioned. Under consideration: making the
delivered package easier to hand to tools that are not TaskSpec-aware, without
adding a backend or a network dependency.

### Recipe quality
Recipes currently select the shape of the generated instructions. Under
consideration: clearer generated instructions per recipe, and better suggestions
from adapter analysis — while keeping the user in control of the final choice.

## Longer term / exploratory

### Ecosystem integrations
CueParcel deliberately stops at `Web → TaskSpec`. Anything that consumes TaskSpec
together with another system (for example repository retrieval) belongs to a
separate project. Integrations will be built against the published contract
rather than by reaching into CueParcel internals.

### Accessibility and internationalisation polish
The UI already respects `prefers-reduced-motion` and carries every state as text
as well as colour. Further work: broader keyboard paths and locale-aware
formatting.

## Explicitly not planned

These have been considered and rejected, so that the boundary is clear:

- **A backend, accounts, cloud sync or team features.** CueParcel is local-first;
  adding a service would invalidate that.
- **Telemetry or analytics.** Not even "anonymous usage statistics".
- **Calling an LLM from the extension.** CueParcel prepares and copies context.
  It does not summarise, does not run an agent, and never needs an API key.
- **Broadening permissions.** `activeTab`, `scripting`, `sidePanel`, `storage`
  are the whole list. No host permissions, no `<all_urls>`.
- **Server-side or remote code.** The extension ships its own code and nothing
  else.

## How to propose something

Open an issue describing the problem rather than the solution. Roadmap items are
added when a problem is real, reproducible, and fits the local-first boundary.
