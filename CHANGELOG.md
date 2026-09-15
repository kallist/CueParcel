# Changelog

All notable changes to CueParcel are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and
this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

> **Compatibility note.** TaskSpec schema v1.0 intentionally retains
> `producer.name = "Page2Agent"`. That value is part of the serialized
> machine-readable contract, so it is deliberately **not** renamed with the
> product brand. See [docs/BRAND.md](docs/BRAND.md).

## [Unreleased]

Nothing yet.

## [1.1.0] — Visual Context Workbench

The release that turned CueParcel from "a page to Markdown converter" into a
workbench for choosing context.

### Added

- **Context Lens** — in-page visual picking. Semantic regions (sections, code
  blocks, tables, lists, GitHub issue areas) highlight on hover with a live
  selected-content token count; click to include or exclude. The page DOM is
  never modified.
- **Context Cart** — combine multiple pages, picked sections and text selections
  into a single agent context, with roles (`Task`, `Reference`, `Evidence`,
  `Example`, `Selection`), one primary source, reorder, undo and clear.
- **Context Recipes** — `Learn`, `Compare`, `Verify`, `Build`, `Fix`. Recipes are
  suggested from adapter analysis; the user makes the final choice. `Compare`
  stays disabled until there really are two sources.
- **Semantic Adapter 2.0** — Generic Article, GitHub Issue, GitHub Pull Request
  and Technical Documentation detection, with honest fallback to Generic when
  confidence is insufficient.
- **TaskSpec** — a versioned (schemaVersion `"1.0"`), deterministic JSON task
  contract: sources, roles, provenance, adapter-verified source facts, acceptance
  criteria only when the source states them, explicit unknowns, generated
  instructions, and token estimates.
- **Context Receipt + Nutrition Label** — a compact summary of exactly what the
  agent will receive, with the source / generated / metadata token split,
  expanding into included and excluded facts. No fake quality scores.
- **Three provenance dimensions** — type, capture method and scope are tracked
  separately and never conflated, in the UI and in TaskSpec.
- **Token stages** — picked content, packaged source and whole context are
  reported as distinct, clearly labelled estimates.

### Changed

- The toolbar action opens the Side Panel and runs the capture; the Side Panel no
  longer guesses or requests a capture target of its own.
- Suggested keyboard shortcut is **`Alt+Shift+Y`**. `Alt+Shift+P` was left
  unassigned because Chrome reserves it for its own "Pin tab" command, so a
  suggestion of `Alt+Shift+P` is silently ignored by the browser.

### Fixed

- The toolbar badge shows the focused window's Context Cart count. Chrome has no
  per-window action badge — `setBadgeText({ windowId })` is rejected as an unknown
  property — so the badge is a single focused-window value that an unfocused
  window can never paint.
- Cancelling the Context Lens now leaves picking mode instead of only clearing the
  current selection.

## [0.1.0]

Initial release: Chrome/Edge Manifest V3 extension, Side Panel, user-triggered
capture, Generic Article and GitHub Issue extraction, `NormalizedDocument`,
`AgentPackage`, Markdown serialization, Copy for Agent / Copy Markdown / Download
Markdown.

[Unreleased]: https://github.com/kallist/CueParcel/compare/v1.1.0...HEAD
[1.1.0]: https://github.com/kallist/CueParcel/releases/tag/v1.1.0
