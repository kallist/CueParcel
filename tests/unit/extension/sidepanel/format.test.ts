/**
 * Panel display vocabulary (Final QA UX-05, UX-06).
 *
 * UX-05: one source is measured at three different points and the numbers
 * legitimately differ, so every surface must name the stage it is showing.
 * UX-06: the source line must not repeat itself ("GitHub Issue · GitHub Issue").
 */
import { describe, expect, it } from "vitest";
import {
  CAPTURE_METHOD_LABELS,
  ITEM_SCOPE_LABELS,
  SOURCE_KIND_LABELS,
  TOKEN_STAGE_LABELS,
  describeSourceLine,
  formatTokenStage,
} from "../../../../src/extension/sidepanel/workbench-ui/format";

describe("formatTokenStage (UX-05)", () => {
  it("distinguishes the three token stages", () => {
    expect(formatTokenStage(296, "selected")).toBe("~296 selected-content tokens");
    expect(formatTokenStage(560, "packaged")).toBe("~560 packaged-source tokens");
    expect(formatTokenStage(836, "total")).toBe("~836 total-context tokens");
  });

  it("keeps the three stage labels distinct", () => {
    const labels = Object.values(TOKEN_STAGE_LABELS);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toEqual([
      "selected-content tokens",
      "packaged-source tokens",
      "total-context tokens",
    ]);
  });

  it("always marks the number as an estimate", () => {
    for (const stage of ["selected", "packaged", "total"] as const) {
      const text = formatTokenStage(1234, stage);
      expect(text.startsWith("~")).toBe(true);
      // Grouped for readability, never an exact-tokenizer claim.
      expect(text).toContain("1,234");
      expect(text).not.toMatch(/exact|tokenizer|gpt|claude/i);
    }
  });
});

describe("describeSourceLine (UX-06)", () => {
  it("does not repeat the source kind as the adapter", () => {
    // The real defect: "GitHub Issue · GitHub Issue · Selected sections".
    expect(
      describeSourceLine({
        sourceKind: "github_issue",
        adapter: { id: "github-issue", name: "GitHub Issue" },
        scope: "selection",
      }),
    ).toBe("GitHub Issue · Selected sections");
  });

  it("shows the adapter when it genuinely adds information", () => {
    expect(
      describeSourceLine({
        sourceKind: "web",
        adapter: { id: "technical-docs", name: "Technical Documentation" },
      }),
    ).toBe("Web Page · Technical Documentation");
  });

  it("omits a redundant full-page scope and capture method", () => {
    expect(
      describeSourceLine({
        sourceKind: "web",
        adapter: { id: "generic-article", name: "Generic Article" },
        method: "full-page",
        scope: "full-page",
      }),
    ).toBe("Web Page · Generic Article");
  });

  it("names the capture method when the content was cropped", () => {
    expect(
      describeSourceLine({
        sourceKind: "github_issue",
        adapter: { id: "github-issue", name: "GitHub Issue" },
        method: "context-lens",
        scope: "selection",
      }),
    ).toBe("GitHub Issue · Context Lens · Selected sections");
  });

  it("distinguishes a text selection from a section pick", () => {
    expect(
      describeSourceLine({
        sourceKind: "web",
        adapter: { id: "generic-article", name: "Generic Article" },
        method: "text-selection",
        scope: "text-selection",
      }),
    ).toBe("Web Page · Generic Article · Text selection");
  });

  it("collapses duplicate entries case-insensitively", () => {
    expect(
      describeSourceLine({
        sourceKind: "web",
        adapter: { id: "technical-docs", name: "Web Page" },
        scope: "full-page",
      }),
    ).toBe("Web Page");
  });

  it("gracefully handles an unknown source kind and missing fields", () => {
    expect(describeSourceLine({ sourceKind: "mystery" })).toBe("mystery");
    expect(describeSourceLine({ sourceKind: "web" })).toBe("Web Page");
  });

  it("never emits an empty segment", () => {
    const line = describeSourceLine({
      sourceKind: "github_pull_request",
      adapter: { id: "github-pull-request", name: "GitHub Pull Request" },
      method: "full-page",
      scope: "full-page",
    });
    expect(line).toBe("GitHub Pull Request");
    expect(line).not.toContain(" ·  · ");
    expect(line.endsWith("·")).toBe(false);
  });

  it("keeps the label maps exhaustive for every kind, method and scope", () => {
    expect(SOURCE_KIND_LABELS.github_pull_request).toBe("GitHub Pull Request");
    expect(CAPTURE_METHOD_LABELS["context-lens"]).toBe("Context Lens");
    expect(ITEM_SCOPE_LABELS["text-selection"]).toBe("Text selection");
  });
});
