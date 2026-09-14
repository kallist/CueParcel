/**
 * GitHub Pull Request DOM selectors — the only place PR-specific selectors
 * live (same policy as github-issue-selectors: long-stable structural
 * selectors, first match wins, never random generated hash classes).
 *
 * Final QA found the previous selector set no longer matched github.com: the
 * PR header migrated to a React "PageHeader" and the legacy
 * [data-testid="pr-header*"] hooks, span.State and span.commit-ref are gone.
 * Verified against the live DOM of github.com/kallist/Page2Agent/pull/2:
 *  - title:    h1.prc-PageHeader-Title-*  (text carries a " - #2" suffix)
 *  - branches: a[data-component="BranchName"] with /tree/<branch> hrefs,
 *              inside the header's role="group" branches container
 *  - state:    not exposed as text in the current header (stays undefined
 *              unless a state pill with text really exists)
 */

/** PR title (react header test id first; legacy h1 fallbacks follow). */
export const PR_TITLE_SELECTORS = [
  '[data-testid="pr-header-title"]',
  ".prc-PageHeader-Title",
  "h1.js-issue-title",
  ".gh-header-title",
  "h1",
] as const;

/**
 * PR state pill text: "Open" / "Closed" / "Merged" (Draft pills are not a
 * state). The current React header renders no state text node, so this list
 * legitimately resolves to nothing there and the adapter reports no state
 * rather than guessing one.
 */
export const PR_STATE_SELECTORS = [
  '[data-testid="pr-header-state"]',
  '[data-testid="state"]',
  "span.State",
  ".State",
] as const;

/** PR branch refs container (base/head branch display names). */
export const PR_HEADER_CONTAINER_SELECTORS = [
  '[data-testid="pr-header"]',
  "#partial-discussion-header",
  ".gh-header",
  '.PullRequestHeaderBranches-module__branches__mwwe4',
  'div[role="group"]',
] as const;

/**
 * A rendered branch name. `data-component="BranchName"` is the current
 * structural hook; `span.commit-ref` is the legacy shape.
 */
export const PR_BRANCH_REF_SELECTORS = [
  'a[data-component="BranchName"]',
  "span.commit-ref",
] as const;

/** PR description: the FIRST js-comment-body in the conversation timeline is
 *  the PR description; review comments are later js-comment-body nodes. */
export const PR_DESCRIPTION_SELECTORS = [
  '[data-testid="pr-description"] [data-testid="markdown-body"]',
  "div.js-comment-body",
  "div.comment-body.markdown-body",
] as const;

/** PR description author (timeline author of the description item). */
export const PR_AUTHOR_SELECTORS = [
  '[data-testid="pr-description"] a.author',
  "div.js-timeline-item a.author",
  "a.author",
] as const;

/**
 * PR creation time — description header relative-time first. Only elements
 * exposing a real `datetime` attribute are usable.
 */
export const PR_CREATED_TIME_SELECTORS = [
  '[data-testid="pr-description"] relative-time',
  "div.js-timeline-item relative-time",
  "div.js-timeline-item time",
  "div.gh-header-meta relative-time",
  "relative-time",
] as const;

/** PR labels container (issue/PR share the sidebar Labels UI). */
export const PR_LABELS_CONTAINER_SELECTORS = [
  '[data-testid="issue-labels"]',
  '[data-testid="pr-labels"]',
  "div.js-issue-labels",
] as const;

export { firstMatch } from "./github-issue-selectors";
