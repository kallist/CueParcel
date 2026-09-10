// @vitest-environment jsdom
/**
 * GitHub Pull Request adapter — current-DOM regression (Final QA).
 *
 * The Final QA real-browser run found the PR adapter had silently stopped
 * matching github.com: the header moved to a React "PageHeader", and the
 * legacy hooks ([data-testid="pr-header-title"], span.State, span.commit-ref,
 * #partial-discussion-header) no longer exist. Result: the PR title fell back
 * to a generated string and state/branches were dropped entirely.
 *
 * The markup below mirrors the structure verified live on
 * github.com/kallist/Page2Agent/pull/2 (see .local/qa-final/artifacts/
 * pr-facts.json): an <h1 class="prc-PageHeader-Title-*"> whose text carries a
 * " - #2" suffix, branch anchors with data-component="BranchName" and
 * /tree/<branch> hrefs (rendered twice), and non-ISO relative-time text.
 */
import { describe, expect, it } from "vitest";
import { GitHubPullRequestExtractor } from "../../../../src/adapters/github/github-pr-extractor";
import { loadHtml } from "../../../helpers/load-html-fixture";

const PR_URL = "https://github.com/kallist/Page2Agent/pull/2";

function prPage(headerHtml: string, descriptionHtml = "<p>Description body.</p>"): Document {
  return loadHtml(
    `<!doctype html><html><head>
      <link rel="canonical" href="${PR_URL}">
    </head><body>
      <div class="prc-PageHeader-Header">${headerHtml}</div>
      <div data-testid="pr-description"><div data-testid="markdown-body" class="markdown-body">${descriptionHtml}</div></div>
    </body></html>`,
    PR_URL,
  );
}

/**
 * The exact current header shape: title suffix, duplicated branch pair inside
 * the branches group, and an author anchor.
 */
const CURRENT_HEADER = `
  <h1 class="prc-PageHeader-Title-p0Mgh lh-condensed PullRequestHeader-module__inlineTitle__c">
    feat: Page2Agent V1.1 — Visual Context Workbench - #2
  </h1>
  <div class="fgColor-muted d-flex flex-items-center PullRequestHeaderSummary-module__summaryContainer__dA7d">
    <span><a class="author Link--primary text-bold" href="/kallist">kallist</a> wants to merge 10 commits into</span>
    <div class="d-flex flex-items-center gap-1 PullRequestHeaderBranches-module__branches__mwwe4" role="group">
      <a data-component="BranchName" href="/kallist/Page2Agent/tree/main" class="PullRequestBranchName-module__branchName__SCtl2">main</a>
      <span>from</span>
      <a data-component="BranchName" href="/kallist/Page2Agent/tree/feat/context-workbench-v1.1" class="PullRequestBranchName-module__branchName__SCtl2">feat/context-workbench-v1.1</a>
    </div>
  </div>
  <div class="min-width-0">
    <div class="d-flex flex-items-center gap-1 PullRequestHeaderBranches-module__branches__mwwe4" role="group">
      <a data-component="BranchName" href="/kallist/Page2Agent/tree/main" class="PullRequestBranchName-module__branchName__SCtl2">main</a>
      <span>from</span>
      <a data-component="BranchName" href="/kallist/Page2Agent/tree/feat/context-workbench-v1.1" class="PullRequestBranchName-module__branchName__SCtl2">feat/context-workbench-v1.1</a>
    </div>
  </div>
`;

const extractor = new GitHubPullRequestExtractor();

async function extract(document: Document) {
  return extractor.extract({
    context: {
      captureId: "11111111-1111-4111-8111-111111111111",
      tabId: 3,
      url: PR_URL,
      title: "PR",
      capturedAt: "2026-09-10T16:23:42.955Z",
    },
    document,
  });
}

describe("GitHub PR adapter — current github.com header", () => {
  it("reads the real PR title and strips GitHub's appended number suffix", async () => {
    const document = await extract(prPage(CURRENT_HEADER));
    expect(document.metadata.title).toBe("feat: Page2Agent V1.1 — Visual Context Workbench");
  });

  it("does not fall back to a generated title when the header exists", async () => {
    const document = await extract(prPage(CURRENT_HEADER));
    expect(document.metadata.title).not.toBe("kallist/Page2Agent pull request #2");
  });

  it("resolves base and head branches from data-component=BranchName", async () => {
    const document = await extract(prPage(CURRENT_HEADER));
    expect(document.source.kind).toBe("github_pull_request");
    if (document.source.kind !== "github_pull_request") throw new Error("wrong kind");
    expect(document.source.baseBranch).toBe("main");
    expect(document.source.headBranch).toBe("feat/context-workbench-v1.1");
  });

  it("collapses the duplicated branch pair instead of recording base twice", async () => {
    const document = await extract(prPage(CURRENT_HEADER));
    if (document.source.kind !== "github_pull_request") throw new Error("wrong kind");
    expect(document.source.baseBranch).not.toBe(document.source.headBranch);
  });

  it("resolves the description author", async () => {
    const document = await extract(prPage(CURRENT_HEADER));
    expect(document.metadata.author).toBe("kallist");
  });

  it("omits state when the header renders no state pill rather than guessing", async () => {
    const document = await extract(prPage(CURRENT_HEADER));
    if (document.source.kind !== "github_pull_request") throw new Error("wrong kind");
    expect(document.source.state).toBeUndefined();
    expect(document.source).not.toHaveProperty("state");
  });

  it("still reads a legacy state pill when one is rendered", async () => {
    const document = await extract(
      prPage(`${CURRENT_HEADER}<span class="State State--open">Open</span>`),
    );
    if (document.source.kind !== "github_pull_request") throw new Error("wrong kind");
    expect(document.source.state).toBe("open");
  });

  it("maps merged and closed state text deterministically", async () => {
    const merged = await extract(prPage(`${CURRENT_HEADER}<span class="State">Merged</span>`));
    const closed = await extract(prPage(`${CURRENT_HEADER}<span class="State">Closed</span>`));
    if (merged.source.kind !== "github_pull_request") throw new Error("wrong kind");
    if (closed.source.kind !== "github_pull_request") throw new Error("wrong kind");
    expect(merged.source.state).toBe("merged");
    expect(closed.source.state).toBe("closed");
  });

  it("never records a rendered phrase as publishedAt", async () => {
    const document = await extract(
      prPage(
        `${CURRENT_HEADER}<div data-testid="pr-description"><relative-time>on Aug 28, 2026</relative-time></div>`,
      ),
    );
    expect(document.metadata.publishedAt).toBeUndefined();
    expect(document.metadata).not.toHaveProperty("publishedAt");
  });

  it("records a real ISO timestamp from relative-time datetime", async () => {
    const document = await extract(
      prPage(
        `${CURRENT_HEADER}<div data-testid="pr-description"><relative-time datetime="2026-09-03T20:02:42+08:00">September 3, 2026</relative-time></div>`,
      ),
    );
    expect(document.metadata.publishedAt).toBe("2026-09-03T20:02:42+08:00");
  });

  it("keeps identity URL-only and review comments out of the description", async () => {
    const document = await extract(
      prPage(
        CURRENT_HEADER,
        "<p>Description body.</p>",
      ),
    );
    expect(document.source.kind).toBe("github_pull_request");
    const json = JSON.stringify(document.blocks);
    expect(json).toContain("Description body.");
    expect(json).not.toContain("review comment");
  });

  it("leaves a legitimate numeric title alone", async () => {
    const document = await extract(
      prPage(`<h1 class="prc-PageHeader-Title-x">Fix issue #348 handling</h1>`),
    );
    expect(document.metadata.title).toBe("Fix issue #348 handling");
  });
});
