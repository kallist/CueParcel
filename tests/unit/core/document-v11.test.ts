import { describe, expect, it } from "vitest";
import {
  DOCUMENT_ADAPTER_IDS,
  DOCUMENT_ADAPTER_NAMES,
  DOCUMENT_CAPTURE_METHODS,
  GITHUB_PULL_REQUEST_STATES,
  isGitHubPullRequestSourceDescriptor,
  isGitHubPullRequestState,
  isNormalizedDocument,
} from "../../../src/core";
import type { NormalizedDocument } from "../../../src/core";
import { makeWebDocument } from "../../helpers/workbench-fixtures";

describe("V1.1 adapter ids and source kinds", () => {
  it("keeps semantic adapters free of capture methods", () => {
    // Final QA M-01: "context-lens" is how content was captured, not what the
    // page IS, so it must never appear as a semantic adapter id.
    expect([...DOCUMENT_ADAPTER_IDS]).toEqual([
      "generic-article",
      "github-issue",
      "github-pull-request",
      "technical-docs",
    ]);
    expect(DOCUMENT_ADAPTER_IDS).not.toContain("context-lens");
    expect([...DOCUMENT_CAPTURE_METHODS]).toEqual([
      "full-page",
      "context-lens",
      "text-selection",
    ]);
    expect(DOCUMENT_ADAPTER_NAMES["context-lens" as never]).toBeUndefined();
  });

  it("validates GitHub pull request descriptors strictly", () => {
    const base = {
      kind: "github_pull_request" as const,
      url: "https://github.com/o/r/pull/99",
      owner: "o",
      repo: "r",
      prNumber: 99,
    };
    expect(isGitHubPullRequestSourceDescriptor(base)).toBe(true);
    expect(isGitHubPullRequestSourceDescriptor({ ...base, state: "drafty" })).toBe(false);
    expect(isGitHubPullRequestSourceDescriptor({ ...base, prNumber: 0 })).toBe(false);
    expect(isGitHubPullRequestSourceDescriptor({ ...base, extra: 1 })).toBe(false);
    expect(isGitHubPullRequestState("open")).toBe(true);
    expect(isGitHubPullRequestState("merged")).toBe(true);
    expect(isGitHubPullRequestState("closed")).toBe(true);
    expect(isGitHubPullRequestState("reopened")).toBe(false);
    expect([...GITHUB_PULL_REQUEST_STATES]).toEqual(["open", "closed", "merged"]);
  });
});

describe("V1.1 capture provenance on NormalizedDocument", () => {
  it("accepts documents with adapter + method + scope metadata", () => {
    const document = makeWebDocument({
      capture: {
        adapter: { id: "technical-docs", name: "Technical Documentation" },
        method: "full-page",
        scope: "full-page",
      },
    });
    expect(isNormalizedDocument(document)).toBe(true);
  });

  it("accepts a Context Lens fragment that keeps its semantic adapter (M-01)", () => {
    const document = makeWebDocument({
      source: {
        kind: "github_issue",
        url: "https://github.com/o/r/issues/1",
        owner: "o",
        repo: "r",
        issueNumber: 1,
      },
      capture: {
        adapter: { id: "github-issue", name: "GitHub Issue" },
        method: "context-lens",
        scope: "selection",
      },
    });
    expect(isNormalizedDocument(document)).toBe(true);
    expect(document.capture?.adapter.id).toBe("github-issue");
    expect(document.capture?.method).toBe("context-lens");
  });

  it("accepts legacy documents without capture metadata", () => {
    const document = makeWebDocument();
    delete (document as { capture?: unknown }).capture;
    expect(isNormalizedDocument(document)).toBe(true);
  });

  it("rejects unknown adapters, wrong names, and unknown methods/scopes", () => {
    const base = makeWebDocument();
    const good = { adapter: { id: "generic-article", name: "Generic Article" } };
    expect(
      isNormalizedDocument({
        ...base,
        capture: { adapter: { id: "unknown-adapter", name: "X" }, method: "full-page", scope: "full-page" },
      }),
    ).toBe(false);
    expect(
      isNormalizedDocument({
        ...base,
        capture: { adapter: { id: "generic-article", name: "Renamed" }, method: "full-page", scope: "full-page" },
      }),
    ).toBe(false);
    expect(
      isNormalizedDocument({
        ...base,
        capture: { adapter: good.adapter, method: "banana", scope: "full-page" },
      }),
    ).toBe(false);
    expect(
      isNormalizedDocument({
        ...base,
        capture: { adapter: good.adapter, method: "full-page", scope: "banana" },
      }),
    ).toBe(false);
    expect(
      isNormalizedDocument({
        ...base,
        capture: { adapter: good.adapter, method: "full-page", scope: "full-page", extra: 1 },
      }),
    ).toBe(false);
  });

  it("rejects a capture that omits the method field", () => {
    const base = makeWebDocument();
    expect(
      isNormalizedDocument({
        ...base,
        capture: { adapter: { id: "generic-article", name: "Generic Article" }, scope: "full-page" },
      }),
    ).toBe(false);
  });

  it("round-trips a pull-request document through validation", () => {
    const document: NormalizedDocument = {
      schemaVersion: 1,
      source: {
        kind: "github_pull_request",
        url: "https://github.com/o/r/pull/7",
        owner: "o",
        repo: "r",
        prNumber: 7,
        state: "open",
        baseBranch: "main",
        headBranch: "fix/thing",
      },
      metadata: { title: "Fix the thing", capturedAt: "2026-01-02T00:00:00.000Z" },
      blocks: [
        { type: "heading", level: 2, text: "Summary" },
        { type: "paragraph", text: "This PR fixes the thing." },
      ],
      assets: [],
      capture: {
        adapter: { id: "github-pull-request", name: "GitHub Pull Request" },
        method: "full-page",
        scope: "full-page",
      },
    };
    expect(isNormalizedDocument(document)).toBe(true);
  });
});
