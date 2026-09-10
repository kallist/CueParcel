/**
 * TaskSpec specialized source facts (Final QA M-02).
 *
 * Before this change the portable contract dropped every adapter-verified
 * semantic fact — issue number, repository, labels, state, branches, author —
 * so a downstream consumer had to re-parse the URL to learn them. These tests
 * pin the contract, including the honest boundary: a fact the adapter did not
 * resolve must be ABSENT, never invented.
 */
import { describe, expect, it } from "vitest";
import { buildTaskSpec } from "../../../../src/application/workbench/task-spec-builder";
import { serializeAgentContext } from "../../../../src/application/workbench/delivery";
import { serializeTaskSpecJson } from "../../../../src/application/workbench/task-spec-json";
import { addContextSource, createEmptyCart } from "../../../../src/core/workbench/context-cart";
import { isTaskSpec, isTaskSpecSourceFacts } from "../../../../src/core/workbench/task-spec";
import type { ContextCart } from "../../../../src/core/workbench/context-cart";
import type { ContextSourceItem } from "../../../../src/core/workbench/context-source";
import type { NormalizedDocument, RecipeId } from "../../../../src/core";
import { makeGitHubIssueDocument, makeWebDocument } from "../../../helpers/workbench-fixtures";

function makeGitHubPullRequestDocument(
  overrides: Partial<NormalizedDocument> = {},
): NormalizedDocument {
  return {
    schemaVersion: 1,
    source: {
      kind: "github_pull_request",
      url: "https://github.com/o/r/pull/7",
      owner: "o",
      repo: "r",
      prNumber: 7,
    },
    metadata: {
      title: "Add workbench",
      capturedAt: "2026-02-01T00:00:00.000Z",
    },
    blocks: [{ type: "paragraph", text: "Adds the workbench." }],
    assets: [],
    capture: {
      adapter: { id: "github-pull-request", name: "GitHub Pull Request" },
      scope: "full-page",
    },
    ...overrides,
  };
}

function itemFrom(document: NormalizedDocument, overrides: Partial<ContextSourceItem> = {}): ContextSourceItem {
  return {
    id: "item-1",
    captureId: "capture-1",
    url: document.source.url,
    capturedAt: document.metadata.capturedAt,
    title: document.metadata.title,
    sourceKind: document.source.kind,
    adapter: document.capture?.adapter,
    scope: document.capture?.scope ?? "full-page",
    role: "task",
    primary: true,
    document,
    ...overrides,
  };
}

function cartWith(item: ContextSourceItem): ContextCart {
  const result = addContextSource(createEmptyCart(), item);
  if (result.status !== "added") {
    throw new Error("expected added");
  }
  return result.cart;
}

function build(document: NormalizedDocument, recipe: RecipeId = "learn") {
  const built = buildTaskSpec(cartWith(itemFrom(document)), recipe);
  if (built.status !== "ok") {
    throw new Error(`expected ok, got ${built.status}`);
  }
  return built.spec;
}

describe("TaskSpec sourceFacts — GitHub Issue (M-02)", () => {
  it("carries repository, issue number, labels, author and published time", () => {
    const document = makeGitHubIssueDocument({
      source: {
        kind: "github_issue",
        url: "https://github.com/HKUDS/RAG-Anything/issues/348",
        owner: "HKUDS",
        repo: "RAG-Anything",
        issueNumber: 348,
        labels: ["bug"],
      },
      metadata: {
        title: "Image-heavy pages",
        author: "mubeentechling",
        publishedAt: "2026-08-28T11:27:22.000Z",
        capturedAt: "2026-09-10T16:23:33.321Z",
      },
    });
    const spec = build(document, "fix");
    expect(spec.sources[0].sourceFacts).toEqual({
      repository: { owner: "HKUDS", name: "RAG-Anything" },
      issueNumber: 348,
      labels: ["bug"],
      author: "mubeentechling",
      publishedAt: "2026-08-28T11:27:22.000Z",
    });
    // The facts must be machine-readable without re-parsing the URL.
    const json = JSON.parse(serializeTaskSpecJson(spec));
    expect(json.sources[0].sourceFacts.issueNumber).toBe(348);
    expect(json.sources[0].sourceFacts.repository.owner).toBe("HKUDS");
  });

  it("omits facts the document does not have (never invents them)", () => {
    const document = makeGitHubIssueDocument({
      metadata: { title: "No author", capturedAt: "2026-01-02T00:00:00.000Z" },
    });
    const spec = build(document);
    const facts = spec.sources[0].sourceFacts;
    expect(facts).toEqual({ repository: { owner: "o", name: "r" }, issueNumber: 12 });
    expect(facts).not.toHaveProperty("author");
    expect(facts).not.toHaveProperty("publishedAt");
    expect(facts).not.toHaveProperty("labels");
    expect(facts).not.toHaveProperty("state");
  });

  it("does not emit pull-request-only fields on an issue", () => {
    const facts = build(makeGitHubIssueDocument()).sources[0].sourceFacts;
    expect(facts).not.toHaveProperty("pullRequestNumber");
    expect(facts).not.toHaveProperty("baseBranch");
    expect(facts).not.toHaveProperty("headBranch");
  });
});

describe("TaskSpec sourceFacts — GitHub Pull Request (M-02)", () => {
  it("carries pull request number, state and branches", () => {
    const document = makeGitHubPullRequestDocument({
      source: {
        kind: "github_pull_request",
        url: "https://github.com/kallist/Page2Agent/pull/2",
        owner: "kallist",
        repo: "Page2Agent",
        prNumber: 2,
        state: "open",
        baseBranch: "main",
        headBranch: "feat/context-workbench-v1.1",
        labels: ["enhancement"],
      },
      metadata: {
        title: "Page2Agent V1.1",
        author: "kallist",
        publishedAt: "2026-09-03T20:02:42+08:00",
        capturedAt: "2026-09-10T16:23:42.955Z",
      },
    });
    const spec = build(document, "verify");
    expect(spec.sources[0].sourceFacts).toEqual({
      repository: { owner: "kallist", name: "Page2Agent" },
      pullRequestNumber: 2,
      state: "open",
      baseBranch: "main",
      headBranch: "feat/context-workbench-v1.1",
      labels: ["enhancement"],
      author: "kallist",
      publishedAt: "2026-09-03T20:02:42+08:00",
    });
  });

  it("does not emit issueNumber on a pull request", () => {
    const facts = build(makeGitHubPullRequestDocument()).sources[0].sourceFacts;
    expect(facts).not.toHaveProperty("issueNumber");
  });

  it("omits state and branches when the rendered DOM did not provide them", () => {
    const spec = build(makeGitHubPullRequestDocument());
    expect(spec.sources[0].sourceFacts).toEqual({
      repository: { owner: "o", name: "r" },
      pullRequestNumber: 7,
    });
  });
});

describe("TaskSpec sourceFacts — non-GitHub sources and validation", () => {
  it("emits no sourceFacts for a generic web source", () => {
    const spec = build(makeWebDocument());
    expect(spec.sources[0].sourceFacts).toBeUndefined();
    expect(spec.sources[0]).not.toHaveProperty("sourceFacts");
  });

  it("serializes issue facts into human-readable agent output", () => {
    const document = makeGitHubIssueDocument({
      source: {
        kind: "github_issue",
        url: "https://github.com/o/r/issues/12",
        owner: "o",
        repo: "r",
        issueNumber: 12,
        labels: ["bug", "p1"],
      },
    });
    const agent = serializeAgentContext(build(document, "fix"));
    expect(agent).toContain("Source facts:");
    expect(agent).toContain("- Repository: o/r");
    expect(agent).toContain("- Issue: #12");
    expect(agent).toContain("- Author: alice");
    expect(agent).toContain("- Labels: bug, p1");
  });

  it("keeps the TaskSpec structurally valid with facts present", () => {
    expect(isTaskSpec(build(makeGitHubIssueDocument()))).toBe(true);
    expect(isTaskSpec(build(makeGitHubPullRequestDocument()))).toBe(true);
  });

  it("rejects malformed sourceFacts at the contract boundary", () => {
    expect(isTaskSpecSourceFacts({ repository: { owner: "o", name: "r" } })).toBe(true);
    expect(isTaskSpecSourceFacts({ repository: { owner: "", name: "r" } })).toBe(false);
    expect(isTaskSpecSourceFacts({ repository: { owner: "o" } })).toBe(false);
    expect(isTaskSpecSourceFacts({})).toBe(false);
    expect(isTaskSpecSourceFacts({ repository: { owner: "o", name: "r" }, extra: 1 })).toBe(false);
    expect(
      isTaskSpecSourceFacts({ repository: { owner: "o", name: "r" }, issueNumber: 0 }),
    ).toBe(false);
    expect(
      isTaskSpecSourceFacts({ repository: { owner: "o", name: "r" }, issueNumber: 1.5 }),
    ).toBe(false);
    expect(
      isTaskSpecSourceFacts({ repository: { owner: "o", name: "r" }, labels: [] }),
    ).toBe(false);
    expect(
      isTaskSpecSourceFacts({ repository: { owner: "o", name: "r" }, labels: ["  "] }),
    ).toBe(false);
  });

  it("rejects a rendered phrase as publishedAt", () => {
    // Real defect: the GitHub page yielded "on Aug 28, 2026", which V8 parses
    // but which is not a timestamp a consumer can rely on.
    expect(
      isTaskSpecSourceFacts({
        repository: { owner: "o", name: "r" },
        publishedAt: "on Aug 28, 2026",
      }),
    ).toBe(false);
    expect(
      isTaskSpecSourceFacts({
        repository: { owner: "o", name: "r" },
        publishedAt: "2026-08-28T11:27:22.000Z",
      }),
    ).toBe(true);
    expect(
      isTaskSpecSourceFacts({
        repository: { owner: "o", name: "r" },
        publishedAt: "2026-09-03T20:02:42+08:00",
      }),
    ).toBe(true);
  });
});
