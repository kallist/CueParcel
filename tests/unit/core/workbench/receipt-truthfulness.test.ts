/**
 * Context Receipt truthfulness (Final QA M-04).
 *
 * The receipt's contract is "what will my agent actually receive?", so an
 * `included` row may only describe a fact that exists in THIS capture. Before
 * this fix the rows were named from an adapter capability checklist
 * ("Issue Title", "Issue Body", "PR Title", "PR Description"), which conflated
 * "this adapter can extract X" with "this capture contains X", and an empty
 * GitHub labels container leaked the literal placeholder "None yet" as a label.
 *
 * `excluded` rows are a separate field on purpose: they are mechanism facts
 * (what the adapter never reads), never presented as included content.
 */
import { describe, expect, it } from "vitest";
import {
  buildContextReceipt,
  RECEIPT_INCLUDED_AUTHOR,
  RECEIPT_INCLUDED_CONTENT,
  RECEIPT_INCLUDED_LABELS,
  RECEIPT_INCLUDED_PUBLISHED_AT,
  RECEIPT_INCLUDED_SELECTED_SECTIONS,
  RECEIPT_INCLUDED_TEXT_SELECTION,
  RECEIPT_INCLUDED_TITLE,
} from "../../../../src/core/workbench/context-receipt";
import type { ReceiptSourceInput } from "../../../../src/core/workbench/context-receipt";
import { extractLabelsFromContainer } from "../../../../src/adapters/github/github-labels";
import { makeGitHubIssueDocument, makeWebDocument } from "../../../helpers/workbench-fixtures";
import { loadHtml } from "../../../helpers/load-html-fixture";

function sourceOf(overrides: Partial<ReceiptSourceInput> = {}): ReceiptSourceInput {
  const document = overrides.document ?? makeGitHubIssueDocument();
  return {
    id: "s1",
    title: document.metadata.title,
    adapter: document.capture?.adapter,
    scope: document.capture?.scope ?? "full-page",
    selectedLabels: [],
    document,
    ...overrides,
  };
}

function includedOf(source: ReceiptSourceInput): string[] {
  return buildContextReceipt({ sources: [source] }).sources[0].included;
}

describe("M-04 — Included rows describe only facts present in the capture", () => {
  it("uses neutral, adapter-independent row names", () => {
    const rows = includedOf(sourceOf());
    expect(rows).toContain(RECEIPT_INCLUDED_TITLE);
    expect(rows).toContain(RECEIPT_INCLUDED_CONTENT);
    // Adapter-capability names must never appear as captured facts.
    for (const forbidden of ["Issue Title", "Issue Body", "PR Title", "PR Description", "Page Title", "Page Content"]) {
      expect(rows).not.toContain(forbidden);
    }
  });

  it("omits Author and Published At when the document lacks them", () => {
    const document = makeGitHubIssueDocument({
      metadata: { title: "No byline", capturedAt: "2026-01-02T00:00:00.000Z" },
    });
    const rows = includedOf(sourceOf({ document }));
    expect(rows).not.toContain(RECEIPT_INCLUDED_AUTHOR);
    expect(rows).not.toContain(RECEIPT_INCLUDED_PUBLISHED_AT);
    expect(rows).toContain(RECEIPT_INCLUDED_TITLE);
  });

  it("includes Author and Published At when the document has them", () => {
    const rows = includedOf(sourceOf());
    expect(rows).toContain(RECEIPT_INCLUDED_AUTHOR);
    expect(rows).toContain(RECEIPT_INCLUDED_PUBLISHED_AT);
  });

  it("omits Labels when a GitHub source has no labels", () => {
    const document = makeGitHubIssueDocument({
      source: {
        kind: "github_issue",
        url: "https://github.com/o/r/issues/12",
        owner: "o",
        repo: "r",
        issueNumber: 12,
      },
    });
    expect(document.source.kind === "github_issue" && document.source.labels).toBeUndefined();
    expect(includedOf(sourceOf({ document }))).not.toContain(RECEIPT_INCLUDED_LABELS);
  });

  it("includes Labels when the source really has labels", () => {
    const document = makeGitHubIssueDocument({
      source: {
        kind: "github_issue",
        url: "https://github.com/o/r/issues/12",
        owner: "o",
        repo: "r",
        issueNumber: 12,
        labels: ["bug"],
      },
    });
    expect(includedOf(sourceOf({ document }))).toContain(RECEIPT_INCLUDED_LABELS);
  });

  it("never derives a GitHub label for a plain web source", () => {
    const document = makeWebDocument();
    const rows = includedOf(sourceOf({ document, adapter: document.capture?.adapter }));
    expect(rows).not.toContain(RECEIPT_INCLUDED_LABELS);
  });

  it("reports the pick scope and its real region labels", () => {
    const document = makeWebDocument({
      capture: {
        adapter: { id: "generic-article", name: "Generic Article" },
        method: "context-lens",
        scope: "selection",
      },
    });
    const rows = includedOf(
      sourceOf({ document, scope: "selection", selectedLabels: ["Authentication"] }),
    );
    expect(rows).toContain(RECEIPT_INCLUDED_SELECTED_SECTIONS);
    expect(rows).toContain("Authentication");
    expect(rows).not.toContain(RECEIPT_INCLUDED_TEXT_SELECTION);
  });

  it("distinguishes a text selection from a section pick", () => {
    const document = makeWebDocument({
      capture: {
        adapter: { id: "generic-article", name: "Generic Article" },
        method: "text-selection",
        scope: "text-selection",
      },
    });
    const rows = includedOf(sourceOf({ document, scope: "text-selection" }));
    expect(rows).toContain(RECEIPT_INCLUDED_TEXT_SELECTION);
    expect(rows).not.toContain(RECEIPT_INCLUDED_SELECTED_SECTIONS);
  });

  it("keeps Included and Excluded as separate fields with different content", () => {
    const receipt = buildContextReceipt({ sources: [sourceOf()] });
    const row = receipt.sources[0];
    const overlap = row.included.filter((entry) => row.excluded.includes(entry));
    expect(overlap).toEqual([]);
    expect(row.excluded.length).toBeGreaterThan(0);
  });

  it("keeps every row non-empty and free of placeholder text", () => {
    const document = makeWebDocument();
    const rows = includedOf(sourceOf({ document }));
    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.trim().length).toBeGreaterThan(0);
      expect(row).not.toBe("None yet");
    }
  });

  it("does not leak an empty heading or empty labels into the rows", () => {
    const document = makeGitHubIssueDocument({
      source: {
        kind: "github_issue",
        url: "https://github.com/o/r/issues/12",
        owner: "o",
        repo: "r",
        issueNumber: 12,
        labels: ["bug"],
      },
    });
    const rows = includedOf(sourceOf({ document, selectedLabels: ["  ", ""] }));
    for (const row of rows) {
      expect(row.trim()).toBe(row);
      expect(row.length).toBeGreaterThan(0);
    }
  });
});

describe("M-04 — GitHub label extraction ignores the empty-state placeholder", () => {
  const CONTAINER = ["div.js-issue-labels"] as const;

  it("treats the rendered 'None yet' placeholder as no labels", () => {
    const doc = loadHtml(
      `<!doctype html><html><body><div class="js-issue-labels"><a href="#"><span data-component="Text">None yet</span></a></div></body></html>`,
    );
    expect(extractLabelsFromContainer(doc, CONTAINER)).toEqual([]);
  });

  it("still extracts real labels", () => {
    const doc = loadHtml(
      `<!doctype html><html><body><div class="js-issue-labels">
        <a href="/labels/bug"><span data-component="Text">bug</span></a>
        <a href="/labels/p1"><span data-component="Text">p1</span></a>
      </div></body></html>`,
    );
    expect(extractLabelsFromContainer(doc, CONTAINER)).toEqual(["bug", "p1"]);
  });

  it("deduplicates repeated labels", () => {
    const doc = loadHtml(
      `<!doctype html><html><body><div class="js-issue-labels">
        <a href="/labels/bug"><span data-component="Text">bug</span></a>
        <a href="/labels/bug"><span data-component="Text">bug</span></a>
      </div></body></html>`,
    );
    expect(extractLabelsFromContainer(doc, CONTAINER)).toEqual(["bug"]);
  });
});
