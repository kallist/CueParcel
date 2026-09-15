<!--
  Thanks for contributing to CueParcel. See CONTRIBUTING.md for the full workflow.
  Please keep this template's headings; delete the prompts once answered.
-->

## What this changes

<!-- One or two sentences. What problem does this solve? -->

## Why

<!-- The reason this is worth doing. Link the issue it closes, if there is one. -->

Closes #

## Type of change

- [ ] Bug fix (no behaviour change beyond the fix)
- [ ] New capability
- [ ] Refactor or internal cleanup
- [ ] Documentation
- [ ] Tests or tooling only
- [ ] Branding or presentation (no product behaviour change)

## Boundary check

CueParcel has hard boundaries. Please confirm this change respects them:

- [ ] **No new permissions.** The manifest still declares exactly `activeTab`,
      `scripting`, `sidePanel`, `storage` — no host permissions, no `<all_urls>`.
- [ ] **No network calls.** Nothing added that sends data anywhere: no backend,
      no telemetry, no analytics, no remote code.
- [ ] **No TaskSpec compatibility break.** `schemaVersion` is still `"1.0"` and
      `producer.name` is still `"Page2Agent"`. If this change affects the
      protocol, it is versioned rather than silently altered.
- [ ] **Source / generated separation preserved.** Page content is still data,
      never instructions, and generated requirements still never appear as if the
      source stated them.
- [ ] **No invented source facts.** Anything the DOM did not provide stays absent.

## How it was verified

<!-- Actual commands and their actual results. "Looks fine" is not verification. -->

```text
npm run lint
npm run typecheck
npm run test
npm run build
```

## If this touches extraction or adapters

- [ ] Added or updated fixtures (synthetic HTML, never a real private page).
- [ ] Added integration coverage for the new shape.
- [ ] Confirmed the registry still prefers specific → generic, never the reverse.
- [ ] Confirmed an unrecognised page still falls back honestly instead of
      claiming a page type.

## If this changes the Side Panel UI

- [ ] Every state is still conveyed by text as well as colour.
- [ ] `prefers-reduced-motion: reduce` still removes decorative motion.
- [ ] Keyboard navigation and `focus-visible` still work.
- [ ] Contrast is still at least 4.5:1 for body text on every surface.

## Screenshots

<!-- For any UI change, before/after screenshots. Redact private page content. -->

## Checklist

- [ ] I read [CONTRIBUTING.md](../CONTRIBUTING.md) and [AGENTS.md](../AGENTS.md).
- [ ] Tests prove real behaviour; I did not skip, weaken or delete a legitimate
      test to make this pass.
- [ ] I did not commit secrets, tokens, cookies, private page HTML or captured
      user content.
- [ ] I did not include unrelated refactors in this pull request.
- [ ] I have reported honestly anything I could not verify.
